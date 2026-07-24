// Edge Function: process-automations
//
// Processa automações com gatilhos baseados em eventos:
//   - order_paid      → e-mail de confirmação/pós-venda (roda a cada 15min)
//   - order_cancelled → e-mail de cancelamento
//   - birthday        → e-mail de aniversário (verifica diariamente)
//
// Abandoned cart é tratado pela função `cart-recovery`.
//
// Deploy:
//   supabase functions deploy process-automations
//
// Secrets necessários (mesmos do cart-recovery):
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set RESEND_FROM_EMAIL="Flora Botanics <noreply@florabotanics.com.br>"
//
// Agendamento via migration 0021 (pg_cron, a cada 15 min):
//   select cron.schedule('process-automations','*/15 * * * *', ...);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API = "https://api.resend.com/emails";
const LEGACY_FROM = "florabotanics.com";
const VERIFIED_FROM = "florabotanics.com.br";

// ---------- helpers ----------

function normalizeFromEmail(from: string) {
  return from.replace(
    new RegExp(`@${LEGACY_FROM.replace(".", "\\.")}(?=[>\\s]|$)`, "i"),
    `@${VERIFIED_FROM}`
  );
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => vars[k] ?? m);
}

function textToHtml(text: string) {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc}</div>`;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
  from: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null) as { message?: string } | null;
  return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
}

// ---------- trigger processors ----------

interface AutomationAction {
  type: "send_email";
  template_id?: string;
  delay_hours?: number;
  subject_override?: string;
}

interface Automation {
  id: string;
  tenant_id: string;
  name: string;
  trigger: string;
  actions: AutomationAction[];
}

async function processOrderPaid(
  supabase: ReturnType<typeof createClient>,
  automation: Automation,
  apiKey: string,
  fromEmail: string,
  windowMinutes: number
) {
  const action = automation.actions.find((a) => a.type === "send_email");
  if (!action?.template_id) return { processed: 0 };

  // Pedidos pagos na janela de tempo (ex: últimos 15 min)
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, number, total_cents, created_at, customers(id, email, full_name)")
    .eq("tenant_id", automation.tenant_id)
    .eq("status", "paid")
    .gte("updated_at", since);

  if (!orders?.length) return { processed: 0 };

  const { data: template } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("id", action.template_id)
    .eq("tenant_id", automation.tenant_id)
    .maybeSingle();

  if (!template) return { processed: 0 };

  let processed = 0;

  for (const order of orders) {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    if (!customer?.email) continue;

    // Verifica se já foi processado
    const { count } = await supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .eq("customer_id", customer.id)
      .eq("channel", "email");

    if ((count ?? 0) > 0) continue;

    const vars: Record<string, string> = {
      nome: customer.full_name?.split(" ")[0] ?? "cliente",
      nome_completo: customer.full_name ?? "",
      email: customer.email,
      numero_pedido: String(order.number ?? ""),
      total: money(order.total_cents ?? 0),
    };

    const subject = renderTemplate(
      action.subject_override ?? template.subject ?? `Pedido #${order.number} confirmado`,
      vars
    );
    const html = textToHtml(renderTemplate(template.body ?? "", vars));

    const result = await sendEmail({ to: customer.email, subject, html, apiKey, from: fromEmail });

    await supabase.from("automation_runs").insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      customer_id: customer.id,
      channel: "email",
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    if (result.ok) processed++;
  }

  return { processed };
}

async function processBirthday(
  supabase: ReturnType<typeof createClient>,
  automation: Automation,
  apiKey: string,
  fromEmail: string
) {
  const action = automation.actions.find((a) => a.type === "send_email");
  if (!action?.template_id) return { processed: 0 };

  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;

  // Clientes que fazem aniversário hoje
  const { data: customers } = await supabase
    .from("customers")
    .select("id, email, full_name, birth_date")
    .eq("tenant_id", automation.tenant_id)
    .not("birth_date", "is", null)
    .not("email", "is", null);

  const birthdayCustomers = (customers ?? []).filter((c) => {
    if (!c.birth_date) return false;
    const d = new Date(c.birth_date);
    return d.getDate() === day && d.getMonth() + 1 === month;
  });

  if (!birthdayCustomers.length) return { processed: 0 };

  const { data: template } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("id", action.template_id)
    .eq("tenant_id", automation.tenant_id)
    .maybeSingle();

  if (!template) return { processed: 0 };

  let processed = 0;

  for (const customer of birthdayCustomers) {
    // Não enviar mais de 1x por ano
    const yearStart = `${now.getFullYear()}-01-01`;
    const { count } = await supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .eq("customer_id", customer.id)
      .gte("created_at", yearStart);

    if ((count ?? 0) > 0) continue;

    const vars: Record<string, string> = {
      nome: customer.full_name?.split(" ")[0] ?? "cliente",
      nome_completo: customer.full_name ?? "",
      email: customer.email,
    };

    const subject = renderTemplate(
      action.subject_override ?? template.subject ?? "Parabéns pelo seu aniversário! 🌸",
      vars
    );
    const html = textToHtml(renderTemplate(template.body ?? "", vars));

    const result = await sendEmail({ to: customer.email, subject, html, apiKey, from: fromEmail });

    await supabase.from("automation_runs").insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      customer_id: customer.id,
      channel: "email",
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    if (result.ok) processed++;
  }

  return { processed };
}

// ---------- main ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmailRaw = Deno.env.get("RESEND_FROM_EMAIL");
  const fromEmail = fromEmailRaw ? normalizeFromEmail(fromEmailRaw) : null;

  if (!resendKey || !fromEmail) {
    return Response.json(
      { ok: false, error: "RESEND_API_KEY ou RESEND_FROM_EMAIL não configurados" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Busca todas as automações ativas que este job processa
  const { data: automations } = await supabase
    .from("automations")
    .select("id, tenant_id, name, trigger, actions")
    .eq("status", "active")
    .in("trigger", ["order_paid", "order_cancelled", "birthday"]);

  const summary: Record<string, number> = {};
  const WINDOW = 15; // minutos (deve coincidir com o intervalo do cron)

  for (const auto of (automations ?? []) as Automation[]) {
    let result = { processed: 0 };

    if (auto.trigger === "order_paid") {
      result = await processOrderPaid(supabase, auto, resendKey, fromEmail, WINDOW);
    } else if (auto.trigger === "birthday") {
      result = await processBirthday(supabase, auto, resendKey, fromEmail);
    }

    summary[auto.name] = (summary[auto.name] ?? 0) + result.processed;
  }

  return Response.json({ ok: true, summary });
});
