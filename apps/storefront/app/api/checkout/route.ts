import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession, createStripeCoupon, stripeRequest } from "@flora/core";
import type { StripeCheckoutSession } from "@flora/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getServerSupabase,
  getStripeCheckoutEnvironment,
  getStripeSecret,
} from "@/lib/server-runtime";
import { currentTenant, db } from "@/lib/tenant";

type PaymentMethodType = "pix" | "card" | "pix_card" | "card2" | "card3";

interface CheckoutPayload {
  session_id?: string;
  coupon_code?: string;
  notes?: string;
  /** Método de pagamento escolhido pelo cliente */
  payment_method?: PaymentMethodType;
  /** Valores em centavos por cartão (somente para card2 / card3) */
  card_splits?: number[];
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
    accepts_marketing?: boolean;
  };
  shipping_address?: {
    recipient?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

type CheckoutResult = {
  ok?: boolean;
  error?: string;
  order_id?: string;
  order_number?: number;
  subtotal_cents?: number;
  discount_cents?: number;
  shipping_cents?: number;
  total_cents?: number;
  currency?: string;
};

type OrderItemRow = {
  id: string;
  variant_id: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  product_snapshot: Record<string, unknown>;
};

type StripePriceRow = {
  entity_id: string | null;
  stripe_price_id: string | null;
  unit_amount_cents: number;
  currency: string;
  billing_type: string;
};

/** Cria uma Checkout Session Stripe para uma parcela de split (usa price_data inline) */
async function createSplitSession({
  apiKey,
  orderId,
  tenantId,
  customerEmail,
  amountCents,
  cardIndex,
  numCards,
  successUrl,
  cancelUrl,
  idempotencyKey,
}: {
  apiKey: string;
  orderId: string;
  tenantId: string;
  customerEmail: string | null;
  amountCents: number;
  cardIndex: number; // 1-based
  numCards: number;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}) {
  return stripeRequest<StripeCheckoutSession>({
    apiKey,
    method: "POST",
    path: "/v1/checkout/sessions",
    idempotencyKey,
    params: {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: amountCents,
            product_data: {
              name: `Flora Botanics — Pagamento ${cardIndex} de ${numCards}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      client_reference_id: orderId,
      payment_intent_data: {
        metadata: {
          order_id: orderId,
          tenant_id: tenantId,
          split_card_index: String(cardIndex),
          split_total_cards: String(numCards),
        },
      },
      metadata: {
        order_id: orderId,
        tenant_id: tenantId,
        split_card_index: String(cardIndex),
        split_total_cards: String(numCards),
        source: "storefront_split",
      },
    },
  });
}

function requestOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return req.nextUrl.origin;
  return `${proto}://${host}`;
}

async function createDiscountCoupon({
  apiKey,
  result,
  tenantId,
}: {
  apiKey: string;
  result: CheckoutResult;
  tenantId: string;
}) {
  const discount = result.discount_cents ?? 0;
  if (discount <= 0) return null;
  const coupon = await createStripeCoupon(apiKey, {
    amountOffCents: discount,
    currency: result.currency ?? "BRL",
    name: `Desconto Flora pedido ${result.order_number ?? result.order_id}`,
    idempotencyKey: `flora:coupon:${tenantId}:${result.order_id}:${discount}`,
    metadata: {
      tenant_id: tenantId,
      order_id: result.order_id,
      order_number: result.order_number ? String(result.order_number) : null,
    },
  });
  if (!coupon.ok) throw new Error(coupon.error);
  return coupon.data.id;
}

async function buildStripeLineItems({
  service,
  tenantId,
  orderId,
  environment,
}: {
  service: SupabaseClient;
  tenantId: string;
  orderId: string;
  environment: "test" | "production";
}) {
  const { data: items, error: itemsError } = await service
    .from("order_items")
    .select("id, variant_id, quantity, unit_price_cents, total_cents, product_snapshot")
    .eq("order_id", orderId);

  if (itemsError) throw new Error(itemsError.message);
  const rows = (items ?? []) as OrderItemRow[];
  if (!rows.length) throw new Error("Pedido sem itens para checkout.");

  const variantIds = rows.map((item) => item.variant_id).filter(Boolean) as string[];
  if (variantIds.length !== rows.length) {
    throw new Error("Todos os itens do pedido precisam estar vinculados a uma variante interna.");
  }

  const { data: prices, error: pricesError } = await service
    .from("stripe_prices")
    .select("entity_id, stripe_price_id, unit_amount_cents, currency, billing_type")
    .eq("tenant_id", tenantId)
    .eq("environment", environment)
    .eq("entity_type", "product_variant")
    .eq("active", true)
    .eq("is_default", true)
    .eq("status", "active")
    .in("entity_id", variantIds);

  if (pricesError) throw new Error(pricesError.message);
  const priceByVariant = new Map((prices ?? []).map((price) => [price.entity_id, price as StripePriceRow]));
  const missing = variantIds.filter((variantId) => !priceByVariant.get(variantId)?.stripe_price_id);
  if (missing.length) {
    throw new Error("Há produtos no carrinho sem Price Stripe ativo. Publique o catálogo Stripe no CMS antes de vender.");
  }

  const lineItems = rows.map((item) => {
    const price = priceByVariant.get(item.variant_id!);
    if (!price?.stripe_price_id) throw new Error("Price Stripe ausente.");
    if (price.unit_amount_cents !== item.unit_price_cents) {
      throw new Error("Preço do carrinho diverge do Price ativo no Stripe. Atualize o catálogo antes de finalizar.");
    }
    return { price: price.stripe_price_id, quantity: item.quantity };
  });
  const mode = (prices ?? []).some((price) => price.billing_type === "recurring") ? "subscription" : "payment";
  return { lineItems, mode: mode as "payment" | "subscription" };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as CheckoutPayload;
    const sessionId = String(body.session_id ?? "").trim();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Sessao do carrinho invalida." }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();

    const { data, error } = await client.rpc("create_storefront_order", {
      p_tenant_id: tenant.tenantId,
      p_session_id: sessionId,
      p_customer_email: String(body.customer?.email ?? ""),
      p_customer_name: body.customer?.name ?? null,
      p_customer_phone: body.customer?.phone ?? null,
      p_accepts_marketing: Boolean(body.customer?.accepts_marketing),
      p_shipping_address: body.shipping_address ?? {},
      p_coupon_code: body.coupon_code ?? null,
      p_notes: body.notes ?? null,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const result = data as CheckoutResult | null;

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error ?? "Não foi possível criar o pedido." },
        { status: 400 }
      );
    }

    const orderId = result.order_id;
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Pedido criado sem identificador interno." }, { status: 500 });
    }

    const environment = await getStripeCheckoutEnvironment();
    const apiKey = await getStripeSecret(environment);
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Stripe não está configurado no Worker do storefront." },
        { status: 500 }
      );
    }

    const service = await getServerSupabase();
    const origin = requestOrigin(req);
    const paymentMethod = (body.payment_method ?? "card") as PaymentMethodType;
    const cardSplits = (body.card_splits ?? []) as number[];

    // ── Split entre múltiplos cartões (card2 / card3) ──────────────────────
    if ((paymentMethod === "card2" || paymentMethod === "card3") && cardSplits.length >= 2) {
      const numCards = cardSplits.length;
      const cancelUrl = `${origin}/checkout?cancelado=1&pedido=${orderId}`;
      const customerEmail = body.customer?.email ?? null;

      // Cria sessões em ordem reversa para poder encadear success_url
      const sessions: Array<{ id: string; url: string }> = [];

      for (let i = numCards - 1; i >= 0; i--) {
        const isLast = i === numCards - 1;
        const successUrl = isLast
          ? `${origin}/checkout/sucesso?pedido=${orderId}&session_id={CHECKOUT_SESSION_ID}`
          : `${origin}/checkout/proximo?pedido=${orderId}&url=${encodeURIComponent(sessions[0].url)}`;

        const splitResult = await createSplitSession({
          apiKey,
          orderId,
          tenantId: tenant.tenantId,
          customerEmail,
          amountCents: cardSplits[i],
          cardIndex: i + 1,
          numCards,
          successUrl,
          cancelUrl,
          idempotencyKey: `flora:split:${tenant.tenantId}:${orderId}:c${i + 1}:${cardSplits[i]}`,
        });

        if (!splitResult.ok || !splitResult.data.url) {
          throw new Error(
            `Falha ao criar sessão Stripe para cartão ${i + 1}: ${splitResult.ok ? "sem URL" : splitResult.error}`
          );
        }

        sessions.unshift({ id: splitResult.data.id, url: splitResult.data.url });
      }

      // Salva registro de cada parcela no banco
      for (let i = 0; i < numCards; i++) {
        await service.from("payments").upsert({
          tenant_id: tenant.tenantId,
          order_id: orderId,
          provider: "stripe",
          provider_payment_id: sessions[i].id,
          status: "pending",
          amount_cents: cardSplits[i],
          raw: {
            checkout_session_id: sessions[i].id,
            checkout_url: sessions[i].url,
            environment,
            mode: "payment",
            split_card_index: i + 1,
            split_total_cards: numCards,
          },
        }, { onConflict: "provider,provider_payment_id" });
      }

      return NextResponse.json({
        ...result,
        stripe_environment: environment,
        checkout_session_id: sessions[0].id,
        checkout_url: sessions[0].url,
      });
    }

    // ── Pagamento único (PIX, cartão ou PIX+cartão) ─────────────────────────
    let paymentMethodTypes: string[] | undefined;
    if (paymentMethod === "pix")      paymentMethodTypes = ["pix"];
    else if (paymentMethod === "pix_card") paymentMethodTypes = ["card", "pix"];
    // "card" → undefined (Stripe usa padrão da conta)

    const { lineItems, mode } = await buildStripeLineItems({
      service,
      tenantId: tenant.tenantId,
      orderId,
      environment,
    });
    const couponId = await createDiscountCoupon({ apiKey, result, tenantId: tenant.tenantId });
    const checkout = await createStripeCheckoutSession(apiKey, {
      mode,
      lineItems,
      successUrl: `${origin}/checkout/sucesso?pedido=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout?cancelado=1&pedido=${orderId}`,
      customerEmail: body.customer?.email ?? null,
      clientReferenceId: orderId,
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      shippingAmountCents: result.shipping_cents ?? 0,
      shippingCurrency: result.currency ?? "BRL",
      shippingLabel: "Frete Flora Botanics",
      paymentMethodTypes,
      idempotencyKey: `flora:checkout:${tenant.tenantId}:${orderId}:${paymentMethod}`,
      metadata: {
        tenant_id: tenant.tenantId,
        tenant_slug: tenant.slug,
        order_id: orderId,
        order_number: result.order_number ? String(result.order_number) : null,
        customer_email: body.customer?.email ?? null,
        payment_method: paymentMethod,
        source: "storefront",
      },
    });

    if (!checkout.ok || !checkout.data.url) {
      return NextResponse.json(
        { ok: false, error: checkout.ok ? "Stripe não retornou URL de checkout." : checkout.error },
        { status: 500 }
      );
    }

    await service.from("payments").upsert({
      tenant_id: tenant.tenantId,
      order_id: orderId,
      provider: "stripe",
      provider_payment_id: checkout.data.id,
      status: "pending",
      amount_cents: result.total_cents ?? 0,
      raw: {
        checkout_session_id: checkout.data.id,
        checkout_url: checkout.data.url,
        environment,
        mode,
        payment_method: paymentMethod,
      },
    }, { onConflict: "provider,provider_payment_id" });

    return NextResponse.json({
      ...result,
      stripe_environment: environment,
      checkout_session_id: checkout.data.id,
      checkout_url: checkout.data.url,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
