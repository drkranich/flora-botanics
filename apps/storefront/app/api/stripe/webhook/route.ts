import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhookSignature, type StripeEnvironment, type StripeEvent } from "@flora/core";
import { getServerSupabase, getStripeWebhookSecrets } from "@/lib/server-runtime";

type CheckoutSessionObject = {
  id: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  payment_intent?: string | null;
  subscription?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer?: string | null;
  customer_email?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string | undefined> | null;
};

type StripeObject = {
  id?: string;
  metadata?: Record<string, string | undefined> | null;
  amount_refunded?: number | null;
  payment_intent?: string | null;
  status?: string;
  current_period_end?: number | null;
  canceled_at?: number | null;
  pause_collection?: unknown;
};

type StripeProductEventObject = StripeObject & {
  active?: boolean;
  name?: string;
  description?: string | null;
  default_price?: string | null;
};

type StripePriceEventObject = StripeObject & {
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  lookup_key?: string | null;
  product?: string | { id?: string };
  recurring?: {
    interval?: string;
    interval_count?: number;
  } | null;
};

type StripeInvoiceEventObject = StripeObject & {
  subscription?: string | { id?: string } | null;
  amount_paid?: number | null;
  currency?: string | null;
  hosted_invoice_url?: string | null;
};

async function verifyEvent(payload: string, signature: string | null) {
  const secrets = await getStripeWebhookSecrets();
  if (!secrets.length) {
    return { ok: false as const, error: "Webhook Stripe sem secret configurado no Worker do storefront." };
  }

  for (const candidate of secrets) {
    const verified = await verifyStripeWebhookSignature({
      payload,
      header: signature,
      secret: candidate.secret,
    });
    if (verified.ok) {
      return { ok: true as const, event: verified.data, environment: candidate.environment };
    }
  }

  return { ok: false as const, error: "Assinatura do webhook Stripe inválida." };
}

function eventTenantId(event: StripeEvent) {
  const object = event.data.object as StripeObject;
  return object.metadata?.tenant_id ?? null;
}

function orderIdFrom(object: CheckoutSessionObject | StripeObject) {
  return object.metadata?.order_id ?? ("client_reference_id" in object ? object.client_reference_id : null) ?? null;
}

function idFromStripeRef(ref: string | { id?: string } | null | undefined) {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id ?? null;
}

async function markCheckoutPaid({
  event,
  environment,
}: {
  event: StripeEvent;
  environment: StripeEnvironment;
}) {
  const service = await getServerSupabase();
  const session = event.data.object as CheckoutSessionObject;
  const tenantId = session.metadata?.tenant_id ?? null;
  const orderId = orderIdFrom(session);
  if (!tenantId || !orderId) return "Webhook recebido sem tenant/order metadata; evento registrado e ignorado.";

  const amount = session.amount_total ?? 0;
  await Promise.all([
    service
      .from("orders")
      .update({ status: "paid" })
      .eq("tenant_id", tenantId)
      .eq("id", orderId),
    service.from("payments").upsert({
      tenant_id: tenantId,
      order_id: orderId,
      provider: "stripe",
      provider_payment_id: session.id,
      status: "succeeded",
      amount_cents: amount,
      raw: {
        event_id: event.id,
        environment,
        checkout_session_id: session.id,
        payment_intent: session.payment_intent,
        subscription: session.subscription,
        payment_status: session.payment_status,
        mode: session.mode,
      },
    }, { onConflict: "provider,provider_payment_id" }),
  ]);

  if (session.subscription) {
    const { data: order } = await service
      .from("orders")
      .select("customer_id")
      .eq("tenant_id", tenantId)
      .eq("id", orderId)
      .maybeSingle();
    const { data: item } = await service
      .from("order_items")
      .select("variant_id")
      .eq("order_id", orderId)
      .not("variant_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (order?.customer_id) {
      await service.from("subscriptions").upsert({
        tenant_id: tenantId,
        customer_id: order.customer_id,
        stripe_subscription_id: session.subscription,
        status: session.payment_status === "paid" ? "active" : "pending",
        variant_id: item?.variant_id ?? null,
        interval: null,
      }, { onConflict: "stripe_subscription_id" });
    }
  }

  return `Pedido ${orderId} marcado como pago via Stripe.`;
}

async function markCheckoutFailed(event: StripeEvent) {
  const service = await getServerSupabase();
  const session = event.data.object as CheckoutSessionObject;
  const tenantId = session.metadata?.tenant_id ?? null;
  const orderId = orderIdFrom(session);
  if (!tenantId || !orderId) return "Evento sem tenant/order metadata; ignorado.";

  await Promise.all([
    service
      .from("orders")
      .update({ status: "pending" })
      .eq("tenant_id", tenantId)
      .eq("id", orderId),
    service
      .from("payments")
      .update({
        status: "failed",
        raw: { event_id: event.id, checkout_session_id: session.id, reason: event.type },
      })
      .eq("provider", "stripe")
      .eq("provider_payment_id", session.id),
  ]);
  return `Checkout ${session.id} marcado como falho/expirado.`;
}

async function markRefund(event: StripeEvent) {
  const service = await getServerSupabase();
  const object = event.data.object as StripeObject;
  const tenantId = object.metadata?.tenant_id ?? null;
  const orderId = orderIdFrom(object);
  if (!tenantId || !orderId) return "Evento de reembolso sem metadata do pedido; registrado e ignorado.";

  await service
    .from("payments")
    .update({
      status: "refunded",
      raw: { event_id: event.id, refund_source: object.id, amount_refunded: object.amount_refunded },
    })
    .eq("provider", "stripe")
    .eq("order_id", orderId);
  return `Pedido ${orderId} marcado com reembolso no pagamento.`;
}

async function syncSubscriptionLifecycle(event: StripeEvent) {
  const service = await getServerSupabase();
  const subscription = event.data.object as StripeObject;
  if (!subscription.id) return "Evento de assinatura sem ID; ignorado.";

  const stripeStatus = subscription.status === "canceled" ? "cancelled" : subscription.status;
  const status = event.type === "customer.subscription.deleted"
    ? "cancelled"
    : subscription.pause_collection
      ? "paused"
      : stripeStatus ?? "active";

  const updatePayload = {
    status,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    next_billing_at: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancelled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : event.type === "customer.subscription.deleted"
        ? new Date().toISOString()
        : null,
    paused_at: subscription.pause_collection ? new Date().toISOString() : null,
  };

  const { data: existing } = await service
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (!existing) {
    return `Assinatura ${subscription.id} recebida antes do checkout local; evento registrado para reconciliação.`;
  }

  await service
    .from("subscriptions")
    .update(updatePayload)
    .eq("stripe_subscription_id", subscription.id);

  return `Assinatura ${subscription.id} atualizada para ${status}.`;
}

async function syncCatalogProduct(event: StripeEvent, environment: StripeEnvironment) {
  const service = await getServerSupabase();
  const product = event.data.object as StripeProductEventObject;
  if (!product.id) return "Evento de Product sem ID; ignorado.";

  const status = event.type === "product.deleted" ? "archived" : product.active === false ? "inactive" : "active";
  const { data: existing } = await service
    .from("stripe_products")
    .select("id")
    .eq("environment", environment)
    .eq("stripe_product_id", product.id)
    .maybeSingle();

  if (!existing) {
    return `Product ${product.id} existe no Stripe, mas ainda não está vinculado ao catálogo Flora.`;
  }

  await service
    .from("stripe_products")
    .update({
      name: product.name,
      description: product.description ?? null,
      stripe_status: status,
      sync_status: status === "active" ? "synced" : status,
      metadata: product.metadata ?? {},
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", existing.id);

  return `Product ${product.id} sincronizado como ${status}.`;
}

async function syncCatalogPrice(event: StripeEvent, environment: StripeEnvironment) {
  const service = await getServerSupabase();
  const price = event.data.object as StripePriceEventObject;
  if (!price.id) return "Evento de Price sem ID; ignorado.";

  const productId = idFromStripeRef(price.product);
  const status = event.type === "price.deleted" ? "archived" : price.active === false ? "archived" : "active";
  const billingType = price.recurring ? "recurring" : "one_time";

  const { data: existing } = await service
    .from("stripe_prices")
    .select("id")
    .eq("environment", environment)
    .eq("stripe_price_id", price.id)
    .maybeSingle();

  if (!existing) {
    return `Price ${price.id} existe no Stripe, mas ainda não está vinculado ao catálogo Flora.`;
  }

  await service
    .from("stripe_prices")
    .update({
      stripe_product_id: productId,
      lookup_key: price.lookup_key ?? null,
      currency: price.currency?.toUpperCase() ?? "BRL",
      unit_amount_cents: price.unit_amount ?? 0,
      billing_type: billingType,
      recurring_interval: price.recurring?.interval ?? null,
      recurring_interval_count: price.recurring?.interval_count ?? 1,
      status,
      active: status === "active",
      metadata: price.metadata ?? {},
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", existing.id);

  return `Price ${price.id} sincronizado como ${status}.`;
}

async function syncInvoicePayment(event: StripeEvent) {
  const service = await getServerSupabase();
  const invoice = event.data.object as StripeInvoiceEventObject;
  const subscriptionId = idFromStripeRef(invoice.subscription);
  if (!subscriptionId) return "Invoice sem assinatura Stripe vinculada; evento registrado.";

  const status = event.type === "invoice.payment_failed" ? "past_due" : "active";
  const { data: subscription } = await service
    .from("subscriptions")
    .select("id, tenant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!subscription) {
    return `Invoice de assinatura ${subscriptionId} recebida antes do vínculo local; evento registrado para reconciliação.`;
  }

  await service
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subscription.id);

  return event.type === "invoice.payment_failed"
    ? `Assinatura ${subscriptionId} marcada como em atraso.`
    : `Assinatura ${subscriptionId} confirmada por invoice paga.`;
}

async function processEvent(event: StripeEvent, environment: StripeEnvironment) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return markCheckoutPaid({ event, environment });
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      return markCheckoutFailed(event);
    case "charge.refunded":
    case "refund.updated":
      return markRefund(event);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscriptionLifecycle(event);
    case "product.created":
    case "product.updated":
    case "product.deleted":
      return syncCatalogProduct(event, environment);
    case "price.created":
    case "price.updated":
    case "price.deleted":
      return syncCatalogPrice(event, environment);
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return syncInvoicePayment(event);
    default:
      return `Evento ${event.type} registrado sem ação operacional.`;
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const verified = await verifyEvent(payload, signature);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 400 });
  }

  const { event, environment } = verified;
  const service = await getServerSupabase();
  const tenantId = eventTenantId(event);
  const { data: existing } = await service
    .from("stripe_webhook_events")
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.status === "processed" || existing?.status === "ignored") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const eventPayload = {
    tenant_id: tenantId,
    stripe_event_id: event.id,
    event_type: event.type,
    environment,
    livemode: event.livemode,
    api_version: event.api_version ?? null,
    status: "processing",
    payload: event,
  };

  const eventRow = existing
    ? await service.from("stripe_webhook_events").update(eventPayload).eq("id", existing.id).select("id").single()
    : await service.from("stripe_webhook_events").insert({ ...eventPayload, attempts: 1 }).select("id").single();

  if (eventRow.error || !eventRow.data) {
    return NextResponse.json({ ok: false, error: eventRow.error?.message ?? "Falha ao registrar webhook." }, { status: 500 });
  }

  try {
    const message = await processEvent(event, environment);
    await service
      .from("stripe_webhook_events")
      .update({
        status: message.includes("sem ação") || message.includes("ignorado") ? "ignored" : "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", eventRow.data.id);
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar webhook Stripe.";
    await service
      .from("stripe_webhook_events")
      .update({
        status: "failed",
        last_error: message,
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq("id", eventRow.data.id);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
