"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { sendEmail } from "@/lib/email/resend";

export interface CartItem {
  product_id: string;
  variant_id?: string;
  name: string;
  slug?: string;
  image?: string;
  price_cents: number;
  quantity: number;
}

export interface AbandonedCart {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  items: CartItem[];
  subtotal_cents: number;
  status: string;
  recovery_email_sent_at: string | null;
  recovery_email_count: number;
  last_activity_at: string;
  created_at: string;
  minutes_abandoned: number;
}

/** Busca carrinhos abandonados (ativos há >30min) do tenant. */
export async function listAbandonedCarts(): Promise<AbandonedCart[]> {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("carts")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "abandoned"])
    .order("last_activity_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).map((c) => ({
    ...c,
    items: (c.items ?? []) as CartItem[],
    minutes_abandoned: Math.floor(
      (now - new Date(c.last_activity_at).getTime()) / 60000
    ),
  }));
}

/** Estatísticas de carrinhos para os cards de resumo. */
export async function getCartStats() {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const [{ count: totalAbandoned }, { count: emailSent }, { count: recovered }, { data: valueData }] =
    await Promise.all([
      supabase
        .from("carts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["active", "abandoned"])
        .lt("last_activity_at", thirtyMinutesAgo),
      supabase
        .from("carts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("recovery_email_sent_at", "is", null),
      supabase
        .from("carts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "recovered"),
      supabase
        .from("carts")
        .select("subtotal_cents")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "abandoned"])
        .lt("last_activity_at", thirtyMinutesAgo),
    ]);

  const totalValueCents = (valueData ?? []).reduce(
    (sum, c) => sum + (c.subtotal_cents ?? 0),
    0
  );
  const recoveryRate =
    emailSent && emailSent > 0
      ? Math.round(((recovered ?? 0) / emailSent) * 100)
      : 0;

  return {
    totalAbandoned: totalAbandoned ?? 0,
    totalValueCents,
    emailSent: emailSent ?? 0,
    recovered: recovered ?? 0,
    recoveryRate,
  };
}

/** Envia e-mail de recuperação de carrinho. */
export async function sendCartRecovery(cartId: string): Promise<{ ok: boolean; message: string }> {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  // Busca o carrinho
  const { data: cart, error } = await supabase
    .from("carts")
    .select("*")
    .eq("id", cartId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !cart) return { ok: false, message: "Carrinho não encontrado." };
  if (!cart.customer_email) return { ok: false, message: "Carrinho sem e-mail do cliente." };

  const items = (cart.items ?? []) as CartItem[];
  const firstName = cart.customer_name?.split(" ")[0] ?? "cliente";
  const subtotal = ((cart.subtotal_cents ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        ${item.image ? `<td style="padding:8px;"><img src="${item.image}" width="56" height="56" style="border-radius:6px;object-fit:cover;"></td>` : "<td></td>"}
        <td style="padding:8px;font-size:14px;">
          <strong>${item.name}</strong><br>
          <span style="color:#888;">Qtd: ${item.quantity}</span>
        </td>
        <td style="padding:8px;text-align:right;font-size:14px;white-space:nowrap;">
          ${((item.price_cents * item.quantity) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">

        <!-- Header -->
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

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;">
              Você esqueceu algo, ${firstName} 🌿
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
              Notamos que você deixou produtos incríveis no seu carrinho.
              Eles ainda estão disponíveis — mas o estoque é limitado!
            </p>

            <!-- Itens -->
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

            <!-- CTA -->
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

        <!-- Footer -->
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

  const result = await sendEmail({
    to: cart.customer_email,
    subject: `${firstName}, você esqueceu seu carrinho 🌿 — Flora Botanics`,
    html,
  });

  if (!result.ok) return { ok: false, message: result.error };

  // Marca o carrinho como "e-mail enviado"
  await supabase
    .from("carts")
    .update({
      status: "abandoned",
      recovery_email_sent_at: new Date().toISOString(),
      recovery_email_count: (cart.recovery_email_count ?? 0) + 1,
    })
    .eq("id", cartId);

  revalidatePath("/vendas/carrinhos");
  return { ok: true, message: `E-mail enviado para ${cart.customer_email}` };
}

/** Descarta manualmente um carrinho (sem enviar e-mail). */
export async function dismissCart(cartId: string): Promise<void> {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  await supabase
    .from("carts")
    .update({ status: "abandoned" })
    .eq("id", cartId)
    .eq("tenant_id", tenantId);

  revalidatePath("/vendas/carrinhos");
}
