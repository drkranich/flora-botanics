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
