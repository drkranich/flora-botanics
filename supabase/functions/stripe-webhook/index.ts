// FLORA ECOSYSTEM · Edge Function: stripe-webhook
// (deployada em 2026-06-11 via MCP — versão 1, verify_jwt desativado:
//  a autenticação é a assinatura criptográfica do Stripe)
// checkout.session.completed → cria cliente + pedido (paid) + itens + pagamento,
// baixa estoque. Idempotente: o mesmo evento nunca duplica pedido.

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("secrets ausentes", { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch {
    return new Response("assinatura inválida", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignorado", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  const tenantId = meta.tenant_id;
  const variantId = meta.variant_id;
  const qty = Math.max(1, parseInt(meta.quantity ?? "1", 10));
  if (!tenantId || !variantId) return new Response("metadata ausente", { status: 200 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // idempotência: já processamos esta sessão?
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_payment_id", session.id)
    .maybeSingle();
  if (existing) return new Response("já processado", { status: 200 });

  try {
    // cliente (upsert por e-mail)
    const email = session.customer_details?.email?.toLowerCase() ?? "desconhecido@flora";
    const { data: customer } = await admin
      .from("customers")
      .upsert(
        {
          tenant_id: tenantId,
          email,
          full_name: session.customer_details?.name ?? null,
          phone: session.customer_details?.phone ?? null,
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
        },
        { onConflict: "tenant_id,email" }
      )
      .select("id")
      .single();

    // dados do produto para o snapshot
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, sku, price_cents, products!inner(name)")
      .eq("id", variantId)
      .maybeSingle();
    const productName = (variant as any)?.products?.name ?? "Produto";

    // número sequencial do pedido
    const { data: orderNumber } = await admin.rpc("next_order_number", { t: tenantId });

    const shipping =
      (session as any).shipping_details ?? session.customer_details ?? null;
    const addr = shipping?.address ?? null;

    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        tenant_id: tenantId,
        number: orderNumber ?? Date.now(),
        customer_id: customer?.id ?? null,
        status: "paid",
        subtotal_cents: session.amount_subtotal ?? 0,
        discount_cents: session.total_details?.amount_discount ?? 0,
        shipping_cents: session.total_details?.amount_shipping ?? 0,
        total_cents: session.amount_total ?? 0,
        currency: (session.currency ?? "brl").toUpperCase(),
        shipping_address: addr
          ? {
              recipient: shipping?.name ?? "",
              street: addr.line1 ?? "",
              complement: addr.line2 ?? "",
              city: addr.city ?? "",
              state: addr.state ?? "",
              zip: addr.postal_code ?? "",
              country: addr.country ?? "BR",
            }
          : null,
        placed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (oErr) throw oErr;

    await admin.from("order_items").insert({
      order_id: order.id,
      variant_id: variantId,
      product_snapshot: { name: productName, sku: (variant as any)?.sku },
      quantity: qty,
      unit_price_cents: (variant as any)?.price_cents ?? 0,
      total_cents: session.amount_subtotal ?? 0,
    });

    await admin.from("payments").insert({
      tenant_id: tenantId,
      order_id: order.id,
      provider: "stripe",
      provider_payment_id: session.id,
      status: "succeeded",
      amount_cents: session.amount_total ?? 0,
      raw: { payment_intent: session.payment_intent, event_id: event.id },
    });

    // baixa de estoque
    const { data: inv } = await admin
      .from("inventory")
      .select("id, quantity, track")
      .eq("variant_id", variantId)
      .maybeSingle();
    if (inv?.track) {
      await admin
        .from("inventory")
        .update({ quantity: Math.max(0, (inv.quantity ?? 0) - qty) })
        .eq("id", inv.id);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    // 500 → Stripe reenvia o evento depois (retry automático)
    return new Response("erro interno", { status: 500 });
  }
});
