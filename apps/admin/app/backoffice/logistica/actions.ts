"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { enqueueIntegrationEvent, enqueueIntegrationSync } from "@/lib/integrations/event-bus";

type ActionResult = { ok: true } | { ok: false; error: string };
type MaybeArray<T> = T | T[];
type PrintJobKind = "shipping" | "product";

const MARKETPLACE_LABEL_PREFERENCES = new Set([
  "external_label",
  "flora_label",
  "external_then_flora",
  "flora_then_external",
]);

const MARKETPLACE_LABEL_TEMPLATES = new Set([
  "shipping_100x150",
  "shipping_a4",
  "mixed_a4_sheet",
  "sku_50x30",
  "barcode_60x40",
  "barcode_100x50",
  "barcode_a4_2x7",
  "sku_a4_3x8",
  "kit_80x50",
]);

const MARKETPLACE_QUEUE_FORMATS = new Set(["a4", "thermal", "zpl", "pdf"]);
const MARKETPLACE_TRACKING_SOURCES = new Set(["marketplace", "shipping_provider", "flora", "manual"]);
const MARKETPLACE_SETTING_STATUSES = new Set(["active", "paused", "archived"]);

interface OrderForShipment {
  id: string;
  number: string;
  tenant_id: string;
  customer_id: string | null;
  shipping_address: Record<string, unknown> | null;
  shipping_cents: number | null;
  total_cents: number | null;
  currency?: string | null;
  notes: string | null;
  customers: MaybeArray<{ email: string; full_name: string | null; phone: string | null }> | null;
}

interface VariantForLabel {
  id: string;
  product_id: string;
  tenant_id: string;
  sku: string;
  name: string | null;
  weight_g: number | null;
  products: { name: string; slug: string } | null;
}

interface ShippingRule {
  provider_key: string | null;
  service: string | null;
  strategy: string;
}

function senderSnapshot() {
  return {
    name: "Flora Botanics",
    document: null,
    country: "BR",
  };
}

function buildInternalTrackingCode(orderNumber: string) {
  const cleanNumber = orderNumber.replace(/\D/g, "") || orderNumber.replace(/[^a-zA-Z0-9]/g, "");
  return `FLORA-${cleanNumber}`;
}

function providerLabel(value: string | null) {
  if (!value) return "Automático";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function storefrontUrl() {
  return process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "https://florabotanics.com.br";
}

function trackingUrl(code: string) {
  return `${storefrontUrl()}/rastrear?codigo=${encodeURIComponent(code)}`;
}

function first<T>(value: MaybeArray<T> | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function valueFromSet(formData: FormData, name: string, allowed: Set<string>, fallback: string) {
  const value = String(formData.get(name) ?? fallback);
  return allowed.has(value) ? value : fallback;
}

function booleanValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "") === "true";
}

function formatList(formData: FormData) {
  const values = formData.getAll("external_label_formats").map((value) => String(value));
  const allowed = new Set(["pdf", "zpl", "png", "jpg", "html"]);
  const safe = values.filter((value) => allowed.has(value));
  return safe.length ? safe : ["pdf", "zpl", "png"];
}

async function getPreferredRule(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string) {
  const { data } = await supabase
    .from("shipping_rules")
    .select("provider_key, service, strategy")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as ShippingRule | null;
}

async function ensureDraftNfeForOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staff: NonNullable<Awaited<ReturnType<typeof currentStaff>>>,
  orderId: string
) {
  const { data: existing } = await supabase
    .from("nfe_documents")
    .select("id")
    .eq("tenant_id", staff.tenantId)
    .eq("order_id", orderId)
    .neq("status", "cancelada")
    .limit(1)
    .maybeSingle();

  if (existing?.id) return { status: "already_exists", id: String(existing.id) };

  const [{ data: order }, { data: fiscal }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total_cents")
      .eq("tenant_id", staff.tenantId)
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("fiscal_configs")
      .select("serie_nfe, proximo_numero_nfe, ambiente")
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
  ]);

  if (!order || !fiscal) return { status: "missing_config" };

  const { data: nfe, error } = await supabase
    .from("nfe_documents")
    .insert({
      tenant_id: staff.tenantId,
      order_id: order.id,
      numero: fiscal.proximo_numero_nfe,
      serie: fiscal.serie_nfe,
      ambiente: fiscal.ambiente,
      status: "rascunho",
      valor_total_cents: order.total_cents,
      motivo_status: "Criada automaticamente ao expedir o pedido.",
    })
    .select("id")
    .single();

  if (error || !nfe) return { status: "failed", error: error?.message ?? "Falha ao criar NF-e." };

  await supabase
    .from("fiscal_configs")
    .update({ proximo_numero_nfe: fiscal.proximo_numero_nfe + 1 })
    .eq("tenant_id", staff.tenantId);

  return { status: "created", id: String(nfe.id) };
}

async function enqueueTrackingEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staff: NonNullable<Awaited<ReturnType<typeof currentStaff>>>,
  order: OrderForShipment,
  shipment: {
    id: string;
    provider_key: string | null;
    carrier: string | null;
    service: string | null;
    tracking_code: string | null;
  }
) {
  const customer = first(order.customers);
  const recipient = customer?.email;
  const trackingCode = shipment.tracking_code;

  if (!recipient || !trackingCode) return { status: "skipped", reason: "sem destinatário ou rastreio" };

  const { data: template } = await supabase
    .from("message_templates")
    .select("id")
    .eq("tenant_id", staff.tenantId)
    .eq("channel", "email")
    .or("category.eq.pedido expedido,name.ilike.%Pedido expedido%,subject.ilike.%enviado%")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template?.id) return { status: "skipped", reason: "template de pedido expedido não instalado" };

  const firstName = (customer?.full_name ?? recipient).split(" ")[0] ?? "cliente";
  const carrier = providerLabel(shipment.provider_key ?? shipment.carrier ?? null);
  const url = trackingUrl(trackingCode);

  const { error } = await supabase.from("marketing_message_queue").upsert(
    {
      tenant_id: staff.tenantId,
      template_id: template.id,
      customer_id: order.customer_id,
      channel: "email",
      recipient,
      payload: {
        customer: {
          first_name: firstName,
          name: customer?.full_name ?? recipient,
          email: recipient,
        },
        order: {
          id: order.id,
          number: order.number,
          total: ((order.total_cents ?? 0) / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: order.currency ?? "BRL",
          }),
          url: `${storefrontUrl()}/conta/pedidos/${order.id}`,
        },
        shipment: {
          id: shipment.id,
          carrier,
          service: shipment.service ?? "serviço automático",
          tracking_code: trackingCode,
          tracking_url: url,
        },
      },
      idempotency_key: `order-shipped:${order.id}:${trackingCode}`,
      priority: 2,
      run_at: new Date().toISOString(),
      status: "queued",
    },
    { onConflict: "tenant_id,idempotency_key" }
  );

  if (error) return { status: "failed", reason: error.message };
  return { status: "queued" };
}

export async function requestShipmentLabel(orderId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, tenant_id, shipping_address, shipping_cents, total_cents, notes, customers(email, full_name, phone)")
    .eq("id", orderId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const shipmentOrder = order as OrderForShipment;
  const rule = await getPreferredRule(supabase, staff.tenantId);
  const providerKey = rule?.provider_key ?? "melhor_envio";
  const service = rule?.service ?? "best_rate";
  const now = new Date().toISOString();
  const trackingCode = buildInternalTrackingCode(String(shipmentOrder.number));
  const customer = first(shipmentOrder.customers);
  const recipientSnapshot = {
    ...(shipmentOrder.shipping_address ?? {}),
    name:
      (shipmentOrder.shipping_address?.recipient as string | undefined) ??
      customer?.full_name ??
      customer?.email ??
      null,
    phone: customer?.phone ?? null,
    email: customer?.email ?? null,
    observation:
      shipmentOrder.notes ??
      (shipmentOrder.shipping_address?.observation as string | undefined) ??
      (shipmentOrder.shipping_address?.notes as string | undefined) ??
      null,
  };

  const { data: existing } = await supabase
    .from("shipments")
    .select("id")
    .eq("tenant_id", staff.tenantId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    tenant_id: staff.tenantId,
    order_id: orderId,
    provider_key: providerKey,
    carrier: providerKey,
    service,
    status: "pending",
    label_status: "queued",
    label_format: "a4",
    tracking_code: trackingCode,
    barcode: trackingCode,
    qr_code: `${storefrontUrl()}/rastrear?codigo=${encodeURIComponent(trackingCode)}`,
    recipient_snapshot: recipientSnapshot,
    sender_snapshot: senderSnapshot(),
    service_cost_cents: shipmentOrder.shipping_cents ?? 0,
    updated_at: now,
  };

  const shipmentResult = existing?.id
    ? await supabase.from("shipments").update(payload).eq("id", existing.id).select("id").single()
    : await supabase.from("shipments").insert(payload).select("id").single();

  if (shipmentResult.error || !shipmentResult.data) {
    return {
      ok: false,
      error:
        shipmentResult.error?.message ??
        "Não foi possível criar a remessa. Verifique se a migration de logística já foi aplicada.",
    };
  }

  const shipmentId = shipmentResult.data.id as string;

  await supabase.from("shipment_packages").upsert(
    {
      tenant_id: staff.tenantId,
      shipment_id: shipmentId,
      sequence: 1,
      weight_grams: 0,
      width_cm: 0,
      height_cm: 0,
      length_cm: 0,
      declared_value_cents: shipmentOrder.total_cents ?? 0,
      notes: `Pacote inicial do pedido #${shipmentOrder.number}`,
    },
    { onConflict: "shipment_id,sequence" }
  ).then(() => undefined, () => undefined);

  await enqueueIntegrationSync(supabase, {
    tenantId: staff.tenantId,
    providerKey,
    connectionId: null,
    action: "create_shipping_label",
    trigger: "manual",
    requestPayload: {
      order_id: orderId,
      shipment_id: shipmentId,
      service,
      recipient_snapshot: recipientSnapshot,
    },
    createdBy: staff.id,
  });

  await enqueueIntegrationEvent(supabase, {
    tenantId: staff.tenantId,
    eventType: "shipping.label.requested",
    source: "admin",
    sourceId: orderId,
    aggregateType: "shipment",
    aggregateId: shipmentId,
    payload: {
      order_id: orderId,
      shipment_id: shipmentId,
      provider_key: providerKey,
      service,
    },
    idempotencyKey: `shipping-label:${shipmentId}:${Date.now()}`,
  }).then(() => undefined, () => undefined);

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    shipment_id: shipmentId,
    order_id: orderId,
    event_type: "label_requested",
    new_value: payload,
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  revalidatePath(`/vendas/${orderId}`);
  return { ok: true };
}

export async function requestShippingQuotes(orderId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, number, tenant_id, shipping_cents, total_cents, currency")
    .eq("id", orderId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const { data: providers } = await supabase
    .from("integration_providers")
    .select("key, display_name")
    .eq("category", "shipping")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  const fallbackProviders = [
    { key: "melhor_envio", display_name: "Melhor Envio" },
    { key: "correios", display_name: "Correios" },
    { key: "loggi", display_name: "Loggi" },
  ];
  const availableProviders = (providers?.length ? providers : fallbackProviders).slice(0, 5);
  const baseCost = Math.max(900, Number(order.shipping_cents ?? 0) || Math.round(Number(order.total_cents ?? 0) * 0.06));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 6).toISOString();

  await supabase
    .from("shipping_quotes")
    .update({ status: "expired" })
    .eq("tenant_id", staff.tenantId)
    .eq("order_id", orderId)
    .eq("status", "quoted");

  const quotes = availableProviders.map((provider, index) => {
    const deadline = 2 + index * 2;
    const cost = Math.round(baseCost * (1 + index * 0.18));
    return {
      tenant_id: staff.tenantId,
      order_id: orderId,
      provider_key: provider.key,
      service: index === 0 ? "best_rate" : index === 1 ? "standard" : "express",
      service_name: index === 0 ? "Melhor custo" : index === 1 ? "Padrão" : "Expresso",
      status: "quoted",
      cost_cents: cost,
      price_cents: cost,
      currency: order.currency ?? "BRL",
      deadline_days: deadline,
      expires_at: expiresAt,
      payload: {
        source: "manual_admin_quote",
        provider_name: provider.display_name,
        note: "Cotação operacional criada no CMS até a API da transportadora retornar valores reais.",
      },
    };
  });

  const { error } = await supabase.from("shipping_quotes").insert(quotes);
  if (error) return { ok: false, error: error.message };

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    order_id: orderId,
    event_type: "shipping_quotes_requested",
    new_value: { quotes: quotes.map((quote) => ({ provider_key: quote.provider_key, service: quote.service })) },
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  return { ok: true };
}

export async function chooseShippingQuote(quoteId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("shipping_quotes")
    .select("id, order_id, provider_key, service, service_name, cost_cents, price_cents, currency, deadline_days")
    .eq("id", quoteId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!quote?.order_id) return { ok: false, error: "Cotação não encontrada." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, tenant_id, customer_id, shipping_address, shipping_cents, total_cents, currency, notes, customers(email, full_name, phone)")
    .eq("id", quote.order_id)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const shipmentOrder = order as OrderForShipment;
  const customer = first(shipmentOrder.customers);
  const trackingCode = buildInternalTrackingCode(String(shipmentOrder.number));
  const now = new Date().toISOString();
  const recipientSnapshot = {
    ...(shipmentOrder.shipping_address ?? {}),
    name:
      (shipmentOrder.shipping_address?.recipient as string | undefined) ??
      customer?.full_name ??
      customer?.email ??
      null,
    phone: customer?.phone ?? null,
    email: customer?.email ?? null,
    observation:
      shipmentOrder.notes ??
      (shipmentOrder.shipping_address?.observation as string | undefined) ??
      (shipmentOrder.shipping_address?.notes as string | undefined) ??
      null,
  };

  await supabase
    .from("shipping_quotes")
    .update({ status: "quoted" })
    .eq("tenant_id", staff.tenantId)
    .eq("order_id", quote.order_id)
    .eq("status", "selected");

  await supabase
    .from("shipping_quotes")
    .update({ status: "selected" })
    .eq("tenant_id", staff.tenantId)
    .eq("id", quoteId);

  const { data: existing } = await supabase
    .from("shipments")
    .select("id")
    .eq("tenant_id", staff.tenantId)
    .eq("order_id", quote.order_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shipmentPayload = {
    tenant_id: staff.tenantId,
    order_id: quote.order_id,
    provider_key: quote.provider_key,
    quote_id: quote.id,
    carrier: quote.provider_key,
    service: quote.service_name ?? quote.service,
    status: "pending",
    label_status: "queued",
    label_format: "a4",
    tracking_code: trackingCode,
    barcode: trackingCode,
    qr_code: trackingUrl(trackingCode),
    recipient_snapshot: recipientSnapshot,
    sender_snapshot: senderSnapshot(),
    service_cost_cents: quote.cost_cents,
    expected_delivery_days: quote.deadline_days,
    updated_at: now,
  };

  const shipmentResult = existing?.id
    ? await supabase.from("shipments").update(shipmentPayload).eq("id", existing.id).select("id").single()
    : await supabase.from("shipments").insert(shipmentPayload).select("id").single();

  if (shipmentResult.error || !shipmentResult.data) {
    return { ok: false, error: shipmentResult.error?.message ?? "Não foi possível selecionar a transportadora." };
  }

  await enqueueIntegrationSync(supabase, {
    tenantId: staff.tenantId,
    providerKey: quote.provider_key,
    connectionId: null,
    action: "create_shipping_label",
    trigger: "manual",
    requestPayload: {
      order_id: quote.order_id,
      shipment_id: shipmentResult.data.id,
      quote_id: quote.id,
      provider_key: quote.provider_key,
      service: quote.service,
      recipient_snapshot: recipientSnapshot,
    },
    createdBy: staff.id,
  });

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    shipment_id: shipmentResult.data.id,
    order_id: quote.order_id,
    event_type: "shipping_quote_selected",
    new_value: shipmentPayload,
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  revalidatePath(`/vendas/${quote.order_id}`);
  return { ok: true };
}

export async function dispatchShipment(shipmentId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, order_id, provider_key, carrier, service, tracking_code")
    .eq("id", shipmentId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!shipment?.order_id) return { ok: false, error: "Remessa não encontrada." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, tenant_id, customer_id, shipping_address, shipping_cents, total_cents, currency, notes, customers(email, full_name, phone)")
    .eq("id", shipment.order_id)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const shipmentOrder = order as OrderForShipment;
  const trackingCode = shipment.tracking_code || buildInternalTrackingCode(String(shipmentOrder.number));
  const now = new Date().toISOString();
  const tracking = trackingUrl(trackingCode);

  const { error: shipmentError } = await supabase
    .from("shipments")
    .update({
      status: "shipped",
      label_status: "created",
      tracking_code: trackingCode,
      barcode: trackingCode,
      qr_code: tracking,
      shipped_at: now,
      updated_at: now,
    })
    .eq("id", shipmentId)
    .eq("tenant_id", staff.tenantId);

  if (shipmentError) return { ok: false, error: shipmentError.message };

  await supabase
    .from("orders")
    .update({ status: "shipped" })
    .eq("id", shipment.order_id)
    .eq("tenant_id", staff.tenantId);

  await supabase.from("shipping_events").insert({
    tenant_id: staff.tenantId,
    order_id: shipment.order_id,
    status: "dispatched",
    description: "Pedido expedido pela Flora Botanics.",
    carrier: providerLabel(shipment.provider_key ?? shipment.carrier ?? null),
    tracking_code: trackingCode,
    created_by: staff.id,
  }).then(() => undefined, () => undefined);

  const nfeResult = await ensureDraftNfeForOrder(supabase, staff, shipment.order_id);
  const emailResult = await enqueueTrackingEmail(supabase, staff, shipmentOrder, {
    id: shipment.id,
    provider_key: shipment.provider_key,
    carrier: shipment.carrier,
    service: shipment.service,
    tracking_code: trackingCode,
  });

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    shipment_id: shipmentId,
    order_id: shipment.order_id,
    event_type: "shipment_dispatched",
    new_value: {
      tracking_code: trackingCode,
      tracking_url: tracking,
      nfe: nfeResult,
      tracking_email: emailResult,
    },
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  revalidatePath("/backoffice/notas-fiscais");
  revalidatePath(`/vendas/${shipment.order_id}`);
  return { ok: true };
}

export async function queueLabelPrint(shipmentId: string, format: "a4" | "thermal" | "zpl" | "pdf"): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, order_id")
    .eq("id", shipmentId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!shipment) return { ok: false, error: "Remessa não encontrada." };

  const { error } = await supabase.from("shipping_label_print_jobs").insert({
    tenant_id: staff.tenantId,
    shipment_id: shipmentId,
    format,
    status: "queued",
    copies: 1,
    created_by: staff.id,
  });

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("shipments")
    .update({ label_status: "printed", printed_at: new Date().toISOString() })
    .eq("id", shipmentId)
    .eq("tenant_id", staff.tenantId);

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    shipment_id: shipmentId,
    order_id: shipment.order_id,
    event_type: "label_print_queued",
    new_value: { format },
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  return { ok: true };
}

export async function queueProductLabelPrint(
  variantId: string,
  format: "a4" | "thermal" | "zpl" | "pdf",
  copies = 1
): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const safeCopies = Math.max(1, Math.min(250, Math.trunc(copies || 1)));
  const supabase = await createClient();

  const { data: variant } = await supabase
    .from("product_variants")
    .select("id, product_id, tenant_id, sku, name, weight_g, products(name, slug)")
    .eq("id", variantId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!variant) return { ok: false, error: "Variação não encontrada." };

  const labelVariant = variant as unknown as VariantForLabel;
  const barcodeValue = labelVariant.sku || `FLORA-${labelVariant.id.slice(0, 8).toUpperCase()}`;
  const productName = labelVariant.products?.name ?? labelVariant.name ?? "Produto Flora";

  const labelPayload = {
    brand: "Flora Botanics",
    product_name: productName,
    variant_name: labelVariant.name,
    sku: labelVariant.sku,
    barcode: barcodeValue,
    weight_g: labelVariant.weight_g,
    label_kind: "stock_product",
    generated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("product_label_print_jobs").insert({
    tenant_id: staff.tenantId,
    product_id: labelVariant.product_id,
    variant_id: labelVariant.id,
    template: "product_stock",
    format,
    status: "queued",
    copies: safeCopies,
    barcode_value: barcodeValue,
    label_payload: labelPayload,
    created_by: staff.id,
  });

  if (error) return { ok: false, error: error.message };

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    event_type: "product_label_print_queued",
    new_value: {
      variant_id: labelVariant.id,
      product_id: labelVariant.product_id,
      format,
      copies: safeCopies,
      barcode_value: barcodeValue,
    },
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  return { ok: true };
}

export async function cancelShipment(shipmentId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, order_id, provider_key")
    .eq("id", shipmentId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!shipment) return { ok: false, error: "Remessa não encontrada." };

  const { error } = await supabase
    .from("shipments")
    .update({
      label_status: "cancelled",
      status: "returned",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", shipmentId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  await enqueueIntegrationEvent(supabase, {
    tenantId: staff.tenantId,
    eventType: "shipping.shipment.cancelled",
    source: "admin",
    sourceId: String(shipment.order_id),
    aggregateType: "shipment",
    aggregateId: shipmentId,
    payload: {
      shipment_id: shipmentId,
      order_id: shipment.order_id,
      provider_key: shipment.provider_key,
    },
    idempotencyKey: `shipping-cancel:${shipmentId}:${Date.now()}`,
  }).then(() => undefined, () => undefined);

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    shipment_id: shipmentId,
    order_id: shipment.order_id,
    event_type: "shipment_cancelled",
    new_value: { cancelled_at: now },
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  return { ok: true };
}

export async function markPrintJobsPrinted(jobs: Array<{ id: string; kind: PrintJobKind }>): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const shippingIds = jobs.filter((job) => job.kind === "shipping").map((job) => job.id);
  const productIds = jobs.filter((job) => job.kind === "product").map((job) => job.id);
  const now = new Date().toISOString();
  const supabase = await createClient();

  if (shippingIds.length) {
    const { error } = await supabase
      .from("shipping_label_print_jobs")
      .update({ status: "printed", printed_at: now })
      .eq("tenant_id", staff.tenantId)
      .in("id", shippingIds);

    if (error) return { ok: false, error: error.message };
  }

  if (productIds.length) {
    const { error } = await supabase
      .from("product_label_print_jobs")
      .update({ status: "printed", printed_at: now })
      .eq("tenant_id", staff.tenantId)
      .in("id", productIds);

    if (error) return { ok: false, error: error.message };
  }

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    event_type: "print_jobs_marked_printed",
    new_value: {
      shipping_label_print_jobs: shippingIds,
      product_label_print_jobs: productIds,
      printed_at: now,
    },
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  return { ok: true };
}

export async function saveMarketplaceLabelSetting(providerKey: string, formData: FormData): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("integration_providers")
    .select("key, category")
    .eq("key", providerKey)
    .eq("category", "marketplace")
    .maybeSingle();

  if (!provider) return { ok: false, error: "Marketplace não encontrado." };

  const payload = {
    tenant_id: staff.tenantId,
    provider_key: providerKey,
    status: valueFromSet(formData, "status", MARKETPLACE_SETTING_STATUSES, "active"),
    source_preference: valueFromSet(formData, "source_preference", MARKETPLACE_LABEL_PREFERENCES, "external_then_flora"),
    external_label_formats: formatList(formData),
    default_print_template: valueFromSet(formData, "default_print_template", MARKETPLACE_LABEL_TEMPLATES, "shipping_100x150"),
    default_queue_format: valueFromSet(formData, "default_queue_format", MARKETPLACE_QUEUE_FORMATS, "thermal"),
    tracking_source: valueFromSet(formData, "tracking_source", MARKETPLACE_TRACKING_SOURCES, "marketplace"),
    fallback_enabled: booleanValue(formData, "fallback_enabled"),
    auto_queue_external_label: booleanValue(formData, "auto_queue_external_label"),
    store_original_label: booleanValue(formData, "store_original_label"),
    reprint_original_enabled: booleanValue(formData, "reprint_original_enabled"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: staff.id,
  };

  const { error } = await supabase
    .from("marketplace_label_settings")
    .upsert(payload, { onConflict: "tenant_id,provider_key" });

  if (error) {
    return {
      ok: false,
      error: `${error.message}. Verifique se a migration marketplace_label_settings já foi aplicada.`,
    };
  }

  await supabase.from("shipping_audit_events").insert({
    tenant_id: staff.tenantId,
    event_type: "marketplace_label_setting_saved",
    new_value: payload,
    actor_id: staff.id,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  return { ok: true };
}

export async function requestMarketplaceLabelSync(providerKey: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin" && staff.role !== "platform_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, provider_key")
    .eq("tenant_id", staff.tenantId)
    .eq("provider_key", providerKey)
    .eq("environment", "production")
    .maybeSingle();

  await enqueueIntegrationSync(supabase, {
    tenantId: staff.tenantId,
    providerKey,
    connectionId: connection?.id ?? null,
    action: "sync_marketplace_labels",
    trigger: "manual",
    requestPayload: {
      provider_key: providerKey,
      scope: "labels_and_tracking",
    },
    createdBy: staff.id,
  });

  await enqueueIntegrationEvent(supabase, {
    tenantId: staff.tenantId,
    eventType: "marketplace.labels.sync_requested",
    source: "admin",
    sourceId: providerKey,
    aggregateType: "marketplace_label_settings",
    aggregateId: providerKey,
    payload: { provider_key: providerKey },
    idempotencyKey: `marketplace-label-sync:${providerKey}:${Date.now()}`,
  }).then(() => undefined, () => undefined);

  revalidatePath("/backoffice/logistica");
  return { ok: true };
}
