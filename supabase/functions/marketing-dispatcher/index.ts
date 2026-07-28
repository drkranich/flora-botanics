// Edge Function: marketing-dispatcher
//
// Processa a fila marketing_message_queue:
// - envia e-mails via Resend;
// - registra marketing_events;
// - registra marketing_provider_logs;
// - aplica retentativas com backoff;
// - evita reenvio quando o item ja saiu de queued/failed.
//
// Deploy:
//   supabase functions deploy marketing-dispatcher --project-ref mbpvzhcrimdwcqkqvoqr
//
// Secrets necessarios no Supabase:
//   supabase secrets set RESEND_API_KEY=re_xxx --project-ref mbpvzhcrimdwcqkqvoqr
//   supabase secrets set RESEND_FROM_EMAIL="Flora Botanics <contato@florabotanics.com.br>" --project-ref mbpvzhcrimdwcqkqvoqr
//   supabase secrets set CRON_SECRET=um-segredo-longo --project-ref mbpvzhcrimdwcqkqvoqr

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";
const BATCH_SIZE = 25;
const LEGACY_FROM_DOMAIN = "florabotanics.com";
const VERIFIED_FROM_DOMAIN = "florabotanics.com.br";

type QueueItem = {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  campaign_channel_id: string | null;
  journey_id: string | null;
  template_id: string | null;
  customer_id: string | null;
  lead_id: string | null;
  channel: string;
  recipient: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
};

type TemplateRow = {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  variables: unknown;
  blocks: unknown;
};

function normalizeFromEmail(from: string): string {
  return from.replace(
    new RegExp(`@${LEGACY_FROM_DOMAIN.replace(".", "\\.")}(?=[>\\s]|$)`, "i"),
    `@${VERIFIED_FROM_DOMAIN}`,
  );
}

function nextRetryIso(attempts: number): string {
  const minutes = Math.min(720, Math.max(5, 2 ** attempts * 5));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function retryable(error: string): boolean {
  return !/nao esta configurado|não está configurado|dominio nao verificado|domínio não verificado|domain is not verified|template nao encontrado|template não encontrado|nao e de e-mail|não é de e-mail|canal .* provedor/i.test(error);
}

function flattenPayload(payload: unknown): Record<string, string> {
  const out: Record<string, string> = {};

  function walk(value: unknown, path: string) {
    if (value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[path] = String(value);
      return;
    }
    if (Array.isArray(value)) {
      out[path] = value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  }

  walk(payload, "");
  return out;
}

function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => (key in vars ? vars[key] : match));
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escaped}</div>`;
}

function parseBlocks(template: TemplateRow): Array<Record<string, string>> {
  if (Array.isArray(template.blocks) && template.blocks.length > 0) {
    return template.blocks as Array<Record<string, string>>;
  }
  try {
    const parsed = JSON.parse(template.body) as { blocks?: unknown };
    if (Array.isArray(parsed.blocks)) return parsed.blocks as Array<Record<string, string>>;
  } catch {
    // Corpo livre.
  }
  return [];
}

function blocksToHtml(blocks: Array<Record<string, string>>, vars: Record<string, string>): string {
  return blocks.map((block) => {
    if (block.type === "heading") {
      return `<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#1a1a1a;line-height:1.2;">${escapeHtml(renderTemplate(block.text ?? "", vars))}</h1>`;
    }
    if (block.type === "cta") {
      const label = escapeHtml(renderTemplate(block.label ?? "Acessar", vars));
      const url = escapeHtml(renderTemplate(block.url ?? "https://florabotanics.com.br", vars));
      return `<p style="margin:28px 0;text-align:center;"><a href="${url}" style="display:inline-block;background:#1a1a1a;color:#c9a96e;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:16px 40px;border-radius:4px;">${label} &rarr;</a></p>`;
    }
    if (block.type === "image" && block.src) {
      const src = escapeHtml(renderTemplate(block.src, vars));
      const alt = escapeHtml(renderTemplate(block.alt ?? "", vars));
      return `<img src="${src}" alt="${alt}" style="display:block;width:100%;max-width:520px;border-radius:10px;margin:20px auto;" />`;
    }
    if (block.type === "divider") return `<hr style="border:0;border-top:1px solid #ece8e1;margin:26px 0;" />`;
    if (block.type === "spacer") return `<div style="height:24px;"></div>`;
    return renderTemplate(block.html ?? (block.text ? `<p>${escapeHtml(block.text)}</p>` : ""), vars);
  }).join("\n");
}

function wrapEmail(contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:6px;color:#c9a96e;font-family:Georgia,serif;">FL&bull;RA</p>
            <p style="margin:4px 0 0;font-size:9px;letter-spacing:4px;color:#888;text-transform:uppercase;">BOTANICS</p>
          </td>
        </tr>
        <tr><td style="padding:40px 40px 32px;color:#555;font-size:15px;line-height:1.65;">${contentHtml}</td></tr>
        <tr>
          <td style="background:#f9f6f2;padding:24px 40px;text-align:center;border-top:1px solid #ece8e1;">
            <p style="margin:0;font-size:11px;color:#999;line-height:1.6;">Você recebeu este e-mail porque possui relacionamento com a Flora Botanics.<br>Preferências e descadastro serão respeitados pela plataforma.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function plainTextFromHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function renderEmail(template: TemplateRow, payload: unknown) {
  if (template.channel !== "email") return { ok: false as const, error: "Este template não é de e-mail." };
  const vars = flattenPayload(payload);
  const blocks = parseBlocks(template);
  const rawBody = blocks.length ? blocksToHtml(blocks, vars) : renderTemplate(template.body, vars);
  const subject = renderTemplate(template.subject || template.name, vars);

  if (/\{\{\s*[\w.]+\s*\}\}/.test(subject) || /\{\{\s*[\w.]+\s*\}\}/.test(rawBody)) {
    return { ok: false as const, error: "O template ainda possui variáveis sem valor no payload." };
  }

  const contentHtml = /<\/?[a-z][\s\S]*>/i.test(rawBody) ? rawBody : textToHtml(rawBody);
  return {
    ok: true as const,
    subject,
    html: wrapEmail(contentHtml),
    text: plainTextFromHtml(contentHtml),
  };
}

async function logProvider(supabase: ReturnType<typeof createClient>, item: QueueItem, input: {
  status: "success" | "warning" | "error";
  latencyMs?: number;
  response?: Record<string, unknown>;
  error?: string;
}) {
  await supabase.from("marketing_provider_logs").insert({
    tenant_id: item.tenant_id,
    provider: "resend",
    action: "send_email",
    status: input.status,
    latency_ms: input.latencyMs ?? null,
    request_payload: { queue_id: item.id, template_id: item.template_id, recipient: item.recipient },
    response_payload: input.response ?? {},
    error_message: input.error ?? null,
  });
}

async function event(supabase: ReturnType<typeof createClient>, item: QueueItem, input: {
  type: "sent" | "failure";
  externalId?: string;
  error?: string;
}) {
  await supabase.from("marketing_events").insert({
    tenant_id: item.tenant_id,
    campaign_id: item.campaign_id,
    campaign_channel_id: item.campaign_channel_id,
    customer_id: item.customer_id,
    lead_id: item.lead_id,
    channel: item.channel,
    event_type: input.type,
    provider: "resend",
    external_id: input.externalId ?? null,
    metadata: {
      queue_id: item.id,
      journey_id: item.journey_id,
      template_id: item.template_id,
      recipient: item.recipient,
      ...(input.error ? { error: input.error } : {}),
    },
  });
}

async function fail(supabase: ReturnType<typeof createClient>, item: QueueItem, message: string, attempt: number) {
  const shouldRetry = retryable(message);
  const status = shouldRetry && attempt < item.max_attempts ? "queued" : "dead";
  await supabase.from("marketing_message_queue").update({
    attempts: attempt,
    status,
    run_at: status === "queued" ? nextRetryIso(attempt) : new Date().toISOString(),
    last_error: message,
    locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", item.id);

  await event(supabase, item, { type: "failure", error: message });
  await logProvider(supabase, item, { status: shouldRetry ? "warning" : "error", error: message });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromRaw = Deno.env.get("RESEND_FROM_EMAIL");

  if (!supabaseUrl || !serviceKey) {
    return Response.json({ ok: false, error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }
  if (!resendKey || !fromRaw) {
    return Response.json({ ok: false, error: "RESEND_API_KEY ou RESEND_FROM_EMAIL ausente." }, { status: 500 });
  }

  const from = normalizeFromEmail(fromRaw);
  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("marketing_message_queue")
    .select("id, tenant_id, campaign_id, campaign_channel_id, journey_id, template_id, customer_id, lead_id, channel, recipient, payload, attempts, max_attempts")
    .in("status", ["queued", "failed"])
    .lte("run_at", now)
    .order("priority", { ascending: true })
    .order("run_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const results: Array<{ id: string; status: string; detail: string }> = [];

  for (const item of ((data ?? []) as QueueItem[]).filter((row) => row.attempts < row.max_attempts)) {
    const attempt = item.attempts + 1;
    await supabase.from("marketing_message_queue").update({
      status: "processing",
      attempts: attempt,
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", item.id).in("status", ["queued", "failed"]);

    if (item.channel !== "email") {
      const message = `Canal ${item.channel} ainda não possui provedor ativo.`;
      await fail(supabase, item, message, attempt);
      results.push({ id: item.id, status: "failed", detail: message });
      continue;
    }

    if (!item.template_id) {
      await fail(supabase, item, "Selecione um template antes de enviar.", attempt);
      results.push({ id: item.id, status: "failed", detail: "template_missing" });
      continue;
    }

    const { data: template, error: templateError } = await supabase
      .from("message_templates")
      .select("id, name, channel, subject, body, variables, blocks")
      .eq("tenant_id", item.tenant_id)
      .eq("id", item.template_id)
      .maybeSingle();

    if (templateError || !template) {
      const message = templateError?.message ?? "Template não encontrado.";
      await fail(supabase, item, message, attempt);
      results.push({ id: item.id, status: "failed", detail: message });
      continue;
    }

    const rendered = renderEmail(template as TemplateRow, item.payload);
    if (!rendered.ok) {
      await fail(supabase, item, rendered.error, attempt);
      results.push({ id: item.id, status: "failed", detail: rendered.error });
      continue;
    }

    const started = Date.now();
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [item.recipient],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    const payload = await res.json().catch(() => null) as { id?: string; message?: string } | null;
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const message = payload?.message ?? `Resend retornou ${res.status}`;
      await fail(supabase, item, message, attempt);
      results.push({ id: item.id, status: "failed", detail: message });
      continue;
    }

    await supabase.from("marketing_message_queue").update({
      status: "sent",
      provider: "resend",
      external_id: payload?.id ?? null,
      sent_at: new Date().toISOString(),
      last_error: null,
      locked_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id);
    await event(supabase, item, { type: "sent", externalId: payload?.id });
    await logProvider(supabase, item, { status: "success", latencyMs, response: { id: payload?.id ?? null } });
    results.push({ id: item.id, status: "sent", detail: payload?.id ?? "sent" });
  }

  return Response.json({ ok: true, processed: results.length, results });
});
