"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { enqueueIntegrationEvent, enqueueIntegrationSync } from "@/lib/integrations/event-bus";

type ActionResult = { ok: true } | { ok: false; error: string };

interface OrderForShipment {
  id: string;
  number: string;
  tenant_id: string;
  shipping_address: Record<string, unknown> | null;
  shipping_cents: number | null;
  total_cents: number | null;
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
    .select("id, number, tenant_id, shipping_address, shipping_cents, total_cents")
    .eq("id", orderId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const shipmentOrder = order as OrderForShipment;
  const rule = await getPreferredRule(supabase, staff.tenantId);
  const providerKey = rule?.provider_key ?? "melhor_envio";
  const service = rule?.service ?? "best_rate";
  const now = new Date().toISOString();

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
    recipient_snapshot: shipmentOrder.shipping_address ?? {},
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

