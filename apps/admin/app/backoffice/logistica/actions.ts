"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { enqueueIntegrationEvent, enqueueIntegrationSync } from "@/lib/integrations/event-bus";

type ActionResult = { ok: true } | { ok: false; error: string };
type MaybeArray<T> = T | T[];

interface OrderForShipment {
  id: string;
  number: string;
  tenant_id: string;
  shipping_address: Record<string, unknown> | null;
  shipping_cents: number | null;
  total_cents: number | null;
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

function storefrontUrl() {
  return process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "https://florabotanics.com.br";
}

function first<T>(value: MaybeArray<T> | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
