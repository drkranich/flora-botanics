/**
 * Edge Function: cart-recovery
 *
 * Detecta carrinhos abandonados (ativos há >30min com e-mail capturado e
 * sem e-mail de recuperação já enviado) e envia um e-mail via Resend.
 *
 * Deploy:
 *   supabase functions deploy cart-recovery --project-ref mbpvzhcrimdwcqkqvoqr
 *
 * Secrets necessários (configurar via `supabase secrets set`):
 *   supabase secrets set RESEND_API_KEY=re_xxx
 *   supabase secrets set RESEND_FROM_EMAIL="Flora Botanics <noreply@florabotanics.com>"
 *
 * Agendamento automático via pg_cron (rodar no SQL Editor do Supabase):
 * ─────────────────────────────────────────────────────────────────────────
 *   select cron.schedule(
 *     'cart-recovery',
 *     '*/30 * * * *',
 *     $$
 *       select net.http_post(
 *         'https://mbpvzhcrimdwcqkqvoqr.supabase.co/functions/v1/cart-recovery',
 *         '{}',
 *         'application/json',
 *         ARRAY[http_header('Authorization','Bearer ' || current_setting('app.service_role_key'))]
 *       ) as request_id
 *     $$
 *   );
 * ─────────────────────────────────────────────────────────────────────────
 * Ou chame manualmente via POST na URL acima com o Bearer token do projeto.
 *
 * Invocação manual para teste:
 *   supabase functions invoke cart-recovery --project-ref mbpvzhcrimdwcqkqvoqr
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API = "https://api.resend.com/emails";
const ABANDON_MINUTES = 30;

interface CartItem {
  product_id: string;
  variant_id?: string;
  name: string;
  slug?: string;
  image?: string;
  price_cents: number;
  quantity: number;
}

interface Cart {
  id: string;
  tenant_id: string;
  customer_email: string;
  customer_name: string | null;
  items: CartItem[];
  subtotal_cents: number;
  recovery_email_count: number;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildEmail(cart: Cart): string {
  const firstName = cart.customer_name?.split(" ")[0] ?? "cliente";
  const subtotal = money(cart.subtotal_cents);

  const itemsHtml = cart.items
    .map(
      (item) => `
      <tr>
        ${item.image
          ? `<td style="padding:8px;"><img src="${item.image}" width="56" height="56" style="border-radius:6px;object-fit:cover;"></td>`
          : "<td style='padding:8px;width:72px;'></td>"
        }
        <td style="padding:8px;font-size:14px;">
          <strong>${item.name}</strong><br>
          <span style="color:#888;font-size:12px;">Qtd: ${item.quantity}</span>
        </td>
        <td style="padding:8px;text-align:right;font-size:14px;white-space:nowrap;font-weight:600;">
          ${money(item.price_cents * item.quantity)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:6px;color:#c9a96e;font-family:Georgia,serif;">
              FL<span style="color:#c9a96e;">•</span>RA
            </p>
            <p style="margin:4px 0 0;font-size:9px;letter-spacing:4px;color:#888;text-transform:uppercase;">
              BOTANICS
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;">
              Você esqueceu algo, ${firstName} 🌿
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
              Notamos que você deixou produtos incríveis no seu carrinho.
              Eles ainda estão disponíveis — mas o estoque é limitado!
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ece8e1;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              ${itemsHtml}
              <tr style="background:#f9f6f2;border-top:1px solid #ece8e1;">
                <td colspan="2" style="padding:12px 8px;font-size:14px;font-weight:600;color:#1a1a1a;">
                  Total do carrinho
                </td>
                <td style="padding:12px 8px;text-align:right;font-size:16px;font-weight:700;color:#1a1a1a;white-space:nowrap;">
                  ${subtotal}
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://flora-botanics.gmoraes.workers.dev"
                     style="display:inline-block;background:#1a1a1a;color:#c9a96e;text-decoration:none;
                            font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;
                            padding:16px 40px;border-radius:4px;">
                    Finalizar minha compra →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f6f2;padding:24px 40px;text-align:center;border-top:1px solid #ece8e1;">
            <p style="margin:0;font-size:11px;color:#999;line-height:1.6;">
              Você recebeu este e-mail porque tem itens no carrinho da Flora Botanics.<br>
              Se não quiser mais receber estas notificações,
              <a href="#" style="color:#999;">clique aqui para cancelar</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // Suporte a CORS para invocar via browser
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
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

  if (!resendKey || !fromEmail) {
    return Response.json(
      { ok: false, error: "RESEND_API_KEY ou RESEND_FROM_EMAIL não configurados" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Carrinhos: ativos há >30min, com e-mail, sem e-mail de recuperação enviado
  const cutoff = new Date(Date.now() - ABANDON_MINUTES * 60 * 1000).toISOString();

  const { data: carts, error } = await supabase
    .from("carts")
    .select("id, tenant_id, customer_email, customer_name, items, subtotal_cents, recovery_email_count")
    .eq("status", "active")
    .not("customer_email", "is", null)
    .is("recovery_email_sent_at", null)
    .lt("last_activity_at", cutoff)
    .gt("subtotal_cents", 0) // ignora carrinhos vazios
    .limit(50); // lote por execução

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ cart_id: string; ok: boolean; detail: string }> = [];

  for (const cart of (carts ?? []) as Cart[]) {
    if (!cart.customer_email) continue;

    const firstName = cart.customer_name?.split(" ")[0] ?? "cliente";
    const html = buildEmail(cart);

    // Envia via Resend
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [cart.customer_email],
        subject: `${firstName}, você esqueceu seu carrinho 🌿 — Flora Botanics`,
        html,
      }),
    });

    const ok = res.ok;
    const data = await res.json().catch(() => null) as { id?: string; message?: string } | null;

    if (ok) {
      // Atualiza o carrinho
      await supabase
        .from("carts")
        .update({
          status: "abandoned",
          recovery_email_sent_at: new Date().toISOString(),
          recovery_email_count: (cart.recovery_email_count ?? 0) + 1,
        })
        .eq("id", cart.id);

      results.push({ cart_id: cart.id, ok: true, detail: data?.id ?? "sent" });
    } else {
      results.push({ cart_id: cart.id, ok: false, detail: data?.message ?? `HTTP ${res.status}` });
    }
  }

  return Response.json({
    ok: true,
    processed: results.length,
    results,
    cutoff,
  });
});
