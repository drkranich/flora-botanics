"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function centsFromText(value: string | null) {
  const raw = String(value ?? "").replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function textList(value: string | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function context() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  return { session, tenantId, supabase };
}

async function audit(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  input: {
    tenantId: string;
    orderId: string;
    actorId: string;
    action: string;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string | null;
  }
) {
  await supabase
    .from("order_audit_events")
    .insert({
      tenant_id: input.tenantId,
      order_id: input.orderId,
      action: input.action,
      previous_value: input.previousValue ?? null,
      new_value: input.newValue ?? null,
      reason: input.reason ?? null,
      actor_id: input.actorId,
    })
    .then(() => undefined, () => undefined);
}

export async function updateOrderOperation(orderId: string, formData: FormData): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();

  const { data: current } = await supabase
    .from("orders")
    .select("id, payment_status, payment_summary, delivery_summary, fiscal_summary, commission_summary, internal_tags, notes, origin_label, manual_channel")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!current) return { ok: false, error: "Pedido não encontrado." };

  let commissions: unknown[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("commission_summary") ?? "[]"));
    commissions = Array.isArray(parsed) ? parsed : [];
  } catch {
    return { ok: false, error: "Comissões inválidas." };
  }

  const paymentStatus = text(formData, "payment_status") ?? "pending";
  const paymentSummary = {
    method: text(formData, "payment_method"),
    terms: text(formData, "payment_terms"),
    external_identifier: text(formData, "payment_identifier"),
    due_dates: text(formData, "payment_due_dates"),
    notes: text(formData, "payment_notes"),
  };
  const deliverySummary = {
    mode: text(formData, "delivery_mode"),
    carrier: text(formData, "carrier"),
    service: text(formData, "service"),
    deadline: text(formData, "deadline"),
    tracking_code: text(formData, "tracking_code"),
    package: text(formData, "package"),
    customer_observation: text(formData, "customer_observation"),
  };
  const fiscalSummary = {
    invoice_kind: text(formData, "invoice_kind"),
    operation_nature: text(formData, "operation_nature"),
    cfop: text(formData, "cfop"),
    fiscal_notes: text(formData, "fiscal_notes"),
  };
  const payload = {
    origin_label: text(formData, "origin_label"),
    manual_channel: text(formData, "manual_channel"),
    payment_status: paymentStatus,
    payment_summary: paymentSummary,
    delivery_summary: deliverySummary,
    fiscal_summary: fiscalSummary,
    commission_summary: commissions,
    internal_tags: textList(text(formData, "internal_tags")),
    notes: text(formData, "notes"),
  };

  const { error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };

  await audit(supabase, {
    tenantId,
    orderId,
    actorId: session.userId,
    action: "order_operation_updated",
    previousValue: current,
    newValue: payload,
    reason: text(formData, "change_reason"),
  });

  revalidatePath(`/vendas/${orderId}`);
  revalidatePath("/vendas");
  revalidatePath("/backoffice/pedidos");
  return { ok: true, message: "Pedido atualizado." };
}

export async function registerOrderPayment(orderId: string, formData: FormData): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();
  const amountCents = centsFromText(text(formData, "amount"));
  if (amountCents <= 0) return { ok: false, error: "Informe um valor maior que zero." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, total_cents, currency, payment_status, payment_summary, manual_channel")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const method = text(formData, "payment_method") ?? "manual";
  const paidAt = text(formData, "paid_at") ? new Date(String(text(formData, "paid_at"))).toISOString() : new Date().toISOString();
  const raw = {
    method,
    paid_at: paidAt,
    receipt_reference: text(formData, "receipt_reference"),
    notes: text(formData, "notes"),
  };

  const { error: paymentError } = await supabase.from("payments").insert({
    tenant_id: tenantId,
    order_id: orderId,
    provider: method,
    provider_payment_id: `manual:${orderId}:${Date.now()}`,
    status: "succeeded",
    amount_cents: amountCents,
    raw,
  });

  if (paymentError) return { ok: false, error: paymentError.message };

  const nextStatus = amountCents >= Number(order.total_cents ?? 0) ? "paid" : "partial";
  const nextPaymentSummary = {
    ...(typeof order.payment_summary === "object" && order.payment_summary ? order.payment_summary : {}),
    last_payment_cents: amountCents,
    last_payment_at: paidAt,
    last_payment_method: method,
    last_receipt_reference: raw.receipt_reference,
  };

  await supabase
    .from("orders")
    .update({ payment_status: nextStatus, payment_summary: nextPaymentSummary, status: nextStatus === "paid" ? "paid" : "pending" })
    .eq("id", orderId)
    .eq("tenant_id", tenantId);

  await supabase
    .from("accounting_entries")
    .insert({
      tenant_id: tenantId,
      type: "income",
      category: "Baixa de pedido",
      description: `Pagamento do pedido #${order.number}`,
      amount_cents: amountCents,
      occurred_at: paidAt,
      payment_method: method,
      source_channel: order.manual_channel ?? "manual",
      source_kind: "manual_payment",
      order_id: orderId,
      notes: raw.notes,
      tags: ["pagamento-pedido"],
      created_by: session.userId,
    })
    .then(() => undefined, () => undefined);

  await audit(supabase, {
    tenantId,
    orderId,
    actorId: session.userId,
    action: "payment_registered",
    previousValue: { payment_status: order.payment_status },
    newValue: { amount_cents: amountCents, payment_status: nextStatus, raw },
    reason: text(formData, "notes"),
  });

  revalidatePath(`/vendas/${orderId}`);
  revalidatePath("/vendas");
  revalidatePath("/contabilidade");
  return { ok: true, message: "Pagamento registrado." };
}

export async function archiveOrder(orderId: string, formData: FormData): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();
  const reason = text(formData, "reason");
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update({ archived_at: now, archived_by: session.userId, archive_reason: reason })
    .eq("id", orderId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  await audit(supabase, { tenantId, orderId, actorId: session.userId, action: "order_archived", newValue: { archived_at: now }, reason });
  revalidatePath(`/vendas/${orderId}`);
  revalidatePath("/vendas");
  return { ok: true, message: "Pedido arquivado." };
}

export async function softDeleteOrder(orderId: string, formData: FormData): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();
  const reason = text(formData, "reason");
  if (!reason) return { ok: false, error: "Informe o motivo da exclusão lógica." };
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: now, deleted_by: session.userId, delete_reason: reason })
    .eq("id", orderId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  await audit(supabase, { tenantId, orderId, actorId: session.userId, action: "order_soft_deleted", newValue: { deleted_at: now }, reason });
  revalidatePath(`/vendas/${orderId}`);
  revalidatePath("/vendas");
  return { ok: true, message: "Pedido marcado como excluído." };
}

export async function cancelOrderWithReason(orderId: string, formData: FormData): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();
  const reason = text(formData, "reason");
  if (!reason) return { ok: false, error: "Informe o motivo do cancelamento." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const { error } = await supabase
    .from("orders")
    .update({ status: "canceled" })
    .eq("id", orderId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  await audit(supabase, {
    tenantId,
    orderId,
    actorId: session.userId,
    action: "order_canceled",
    previousValue: { status: order.status },
    newValue: { status: "canceled" },
    reason,
  });
  revalidatePath(`/vendas/${orderId}`);
  revalidatePath("/vendas");
  revalidatePath("/backoffice/pedidos");
  return { ok: true, message: "Pedido cancelado." };
}

// ── Auditoria: editar razão, excluir evento ────────────────────────────────

export async function updateAuditReason(
  auditId: string,
  orderId: string,
  reason: string
): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();

  const { error } = await supabase
    .from("order_audit_events")
    .update({ reason: reason.trim() || null })
    .eq("id", auditId)
    .eq("order_id", orderId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/vendas/${orderId}`);
  return { ok: true, message: "Anotação atualizada." };
}

export async function deleteAuditEvent(
  auditId: string,
  orderId: string
): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();

  // Somente admins podem excluir eventos de auditoria
  if (session.role !== "tenant_admin" && session.role !== "platform_admin") {
    return { ok: false, error: "Apenas administradores podem excluir eventos de auditoria." };
  }

  const { error } = await supabase
    .from("order_audit_events")
    .delete()
    .eq("id", auditId)
    .eq("order_id", orderId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };

  // Registra que houve deleção (meta-auditoria)
  await audit(supabase, {
    tenantId,
    orderId,
    actorId: session.userId,
    action: "audit_event_deleted",
    newValue: { deleted_audit_id: auditId },
  });

  revalidatePath(`/vendas/${orderId}`);
  return { ok: true, message: "Evento de auditoria removido." };
}

export async function duplicateOrder(orderId: string): Promise<ActionResult> {
  const { session, tenantId, supabase } = await context();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("orders")
      .select("customer_id, subtotal_cents, discount_cents, shipping_cents, total_cents, currency, shipping_address, billing_address, notes, source_channel, origin_label, manual_channel, payment_summary, delivery_summary, fiscal_summary, commission_summary, internal_tags")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("variant_id, product_snapshot, quantity, unit_price_cents, total_cents")
      .eq("order_id", orderId),
  ]);

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const { data: numberData, error: numberError } = await supabase.rpc("next_order_number", { t: tenantId });
  if (numberError || !numberData) return { ok: false, error: numberError?.message ?? "Não foi possível gerar o número." };

  const { data: duplicated, error: orderError } = await supabase
    .from("orders")
    .insert({
      ...order,
      tenant_id: tenantId,
      number: numberData,
      status: "pending",
      payment_status: "pending",
      placed_at: null,
      notes: order.notes ? `${order.notes}\n\nDuplicado do pedido original.` : "Duplicado do pedido original.",
    })
    .select("id")
    .single();

  if (orderError || !duplicated) return { ok: false, error: orderError?.message ?? "Não foi possível duplicar o pedido." };

  if (items?.length) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        ...item,
        order_id: duplicated.id,
      }))
    );
    if (itemsError) return { ok: false, error: itemsError.message };
  }

  await audit(supabase, {
    tenantId,
    orderId: duplicated.id,
    actorId: session.userId,
    action: "order_duplicated",
    previousValue: { source_order_id: orderId },
    newValue: { duplicated_order_id: duplicated.id },
  });

  revalidatePath("/vendas");
  return { ok: true, id: duplicated.id, message: "Pedido duplicado." };
}
