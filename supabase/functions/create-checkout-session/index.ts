// FLORA ECOSYSTEM · Edge Function: create-checkout-session
// (deployada em 2026-06-11 via MCP — versão 1)
// Valida produto/estoque no servidor e cria uma Stripe Checkout Session.
// Requer secret STRIPE_SECRET_KEY configurada no projeto Supabase.

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "pagamentos ainda não configurados" }, 503);

  try {
    const { variant_id, quantity = 1, tenant_slug } = await req.json();
    const qty = Math.max(1, Math.min(10, Number(quantity) || 1));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // valida tenant
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name")
      .eq("slug", String(tenant_slug ?? "flora-botanics"))
      .eq("status", "active")
      .maybeSingle();
    if (!tenant) return json({ error: "loja não encontrada" }, 400);

    // valida variante + produto publicado + estoque (preço vem do banco, nunca do cliente)
    const { data: variant } = await admin
      .from("product_variants")
      .select(
        "id, sku, price_cents, currency, products!inner(id, name, status, deleted_at), inventory(quantity, track)"
      )
      .eq("id", String(variant_id))
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    const product = (variant as any)?.products;
    if (!variant || !product || product.status !== "published" || product.deleted_at) {
      return json({ error: "produto indisponível" }, 400);
    }
    const invRaw = (variant as any).inventory;
    const inv = Array.isArray(invRaw) ? invRaw[0] : invRaw;
    if (inv?.track && (inv?.quantity ?? 0) < qty) {
      return json({ error: "estoque insuficiente" }, 400);
    }

    const origin = req.headers.get("origin") ?? "http://localhost:3000";
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: (variant as any).currency?.toLowerCase() ?? "brl",
            unit_amount: (variant as any).price_cents,
            product_data: { name: product.name, metadata: { sku: (variant as any).sku } },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["BR"] },
      success_url: `${origin}/pedido/confirmado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/produtos`,
      metadata: {
        tenant_id: tenant.id,
        variant_id: (variant as any).id,
        quantity: String(qty),
      },
    });

    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: "falha ao iniciar o pagamento" }, 500);
  }
});
