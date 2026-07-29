"use server";

import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

type ManualOrderItem = {
  variantId?: string | null;
  name?: string;
  sku?: string;
  kind?: string;
  quantity?: number;
  unitPriceCents?: number;
  discountCents?: number;
  notes?: string;
};

type ManualCommission = {
  role?: string;
  name?: string;
  type?: string;
  value?: string;
  notes?: string;
};

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} é obrigatório.`);
  return value;
}

function centsFromText(value: string | null) {
  const raw = String(value ?? "").replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function cents(formData: FormData, key: string) {
  return centsFromText(text(formData, key));
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonArray<T>(formData: FormData, key: string): T[] {
  try {
    const parsed = JSON.parse(String(formData.get(key) ?? "[]"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function jsonAddress(formData: FormData, prefix: "shipping" | "billing") {
  const raw = {
    recipient: text(formData, `${prefix}_recipient`),
    document: text(formData, `${prefix}_document`),
    phone: text(formData, `${prefix}_phone`),
    street: text(formData, `${prefix}_street`),
    number: text(formData, `${prefix}_number`),
    complement: text(formData, `${prefix}_complement`),
    district: text(formData, `${prefix}_district`),
    city: text(formData, `${prefix}_city`),
    state: text(formData, `${prefix}_state`),
    zip: text(formData, `${prefix}_zip`),
    notes: text(formData, `${prefix}_notes`),
  };
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => Boolean(value)));
}

async function ensureCanEdit() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");
  const tenantId = await effectiveTenantId();
  return { session, tenantId };
}

export async function createManualOrder(formData: FormData) {
  const { session, tenantId } = await ensureCanEdit();
  const supabase = await supabaseServer();

  const customerEmail = requiredText(formData, "customer_email", "E-mail do cliente").toLowerCase();
  const customerName = text(formData, "customer_name");
  const customerPhone = text(formData, "customer_phone");
  const tags = String(text(formData, "customer_tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        tenant_id: tenantId,
        email: customerEmail,
        full_name: customerName,
        phone: customerPhone,
        accepts_marketing: String(formData.get("accepts_marketing") ?? "") === "on",
        tags: Array.from(new Set(["pedido-manual", ...tags])),
      },
      { onConflict: "tenant_id,email" }
    )
    .select("id")
    .single();

  if (customerError || !customer) {
    throw new Error(customerError?.message ?? "Não foi possível criar ou localizar o cliente.");
  }

  const rawItems = parseJsonArray<ManualOrderItem>(formData, "items_json");
  if (!rawItems.length) throw new Error("Adicione ao menos um item ao pedido.");

  const items = rawItems
    .map((item) => {
      const quantity = Math.max(1, Math.round(numberValue(item.quantity, 1)));
      const unitPriceCents = Math.max(0, Math.round(numberValue(item.unitPriceCents, 0)));
      const discountCents = Math.max(0, Math.round(numberValue(item.discountCents, 0)));
      const totalCents = Math.max(0, quantity * unitPriceCents - discountCents);
      return {
        variantId: item.variantId || null,
        name: String(item.name ?? "").trim() || "Item manual",
        sku: String(item.sku ?? "").trim() || null,
        kind: String(item.kind ?? "custom"),
        quantity,
        unitPriceCents,
        discountCents,
        totalCents,
        notes: String(item.notes ?? "").trim() || null,
      };
    })
    .filter((item) => item.quantity > 0 && item.unitPriceCents >= 0);

  if (!items.length) throw new Error("Os itens informados estão inválidos.");

  const itemSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const itemDiscount = items.reduce((sum, item) => sum + item.discountCents, 0);
  const globalDiscount = cents(formData, "global_discount");
  const shippingCents = cents(formData, "shipping_cents");
  const totalCents = Math.max(0, itemSubtotal - itemDiscount - globalDiscount + shippingCents);
  const paidCents = cents(formData, "paid_cents");
  const paymentStatus = String(formData.get("payment_status") ?? "pending");
  const orderStatus = paymentStatus === "paid" || paymentStatus === "partial" ? "paid" : "pending";

  const { data: numberData, error: numberError } = await supabase.rpc("next_order_number", { t: tenantId });
  if (numberError || !numberData) throw new Error(numberError?.message ?? "Não foi possível gerar o número do pedido.");

  const shippingAddress = jsonAddress(formData, "shipping");
  const billingAddress = jsonAddress(formData, "billing");
  const commissions = parseJsonArray<ManualCommission>(formData, "commissions_json");

  const fiscalSummary = {
    emit_invoice: String(formData.get("emit_invoice") ?? "") === "on",
    invoice_kind: text(formData, "invoice_kind"),
    operation_nature: text(formData, "operation_nature"),
    cfop: text(formData, "cfop"),
    customer_taxpayer: String(formData.get("customer_taxpayer") ?? "") === "on",
    final_customer: String(formData.get("final_customer") ?? "") === "on",
    fiscal_notes: text(formData, "fiscal_notes"),
  };

  const paymentSummary = {
    payment_status: paymentStatus,
    payment_method: text(formData, "payment_method"),
    payment_terms: text(formData, "payment_terms"),
    installments: text(formData, "installments"),
    due_dates: text(formData, "due_dates"),
    acquirer: text(formData, "acquirer"),
    external_identifier: text(formData, "payment_identifier"),
    paid_cents: paidCents,
    remaining_cents: Math.max(0, totalCents - paidCents),
    notes: text(formData, "payment_notes"),
  };

  const deliverySummary = {
    mode: text(formData, "delivery_mode"),
    carrier: text(formData, "carrier"),
    service: text(formData, "shipping_service"),
    deadline: text(formData, "shipping_deadline"),
    tracking_code: text(formData, "tracking_code"),
    weight: text(formData, "weight"),
    dimensions: text(formData, "dimensions"),
    package: text(formData, "package"),
    expected_date: text(formData, "expected_date"),
    responsible: text(formData, "shipping_responsible"),
    customer_observation: text(formData, "customer_observation"),
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      tenant_id: tenantId,
      number: numberData,
      customer_id: customer.id,
      status: orderStatus,
      subtotal_cents: itemSubtotal,
      discount_cents: itemDiscount + globalDiscount,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      currency: "BRL",
      shipping_address: shippingAddress,
      billing_address: Object.keys(billingAddress).length ? billingAddress : shippingAddress,
      notes: text(formData, "internal_notes"),
      placed_at: String(formData.get("save_as_draft") ?? "") === "on" ? null : new Date().toISOString(),
      source_channel: "manual",
      origin_label: text(formData, "origin_label"),
      manual_channel: text(formData, "manual_channel"),
      payment_status: paymentStatus,
      payment_summary: paymentSummary,
      delivery_summary: deliverySummary,
      fiscal_summary: fiscalSummary,
      commission_summary: commissions,
      internal_tags: String(text(formData, "order_tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
    .select("id, number")
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? "Não foi possível criar o pedido.");

  const orderItems = items.map((item) => ({
    order_id: order.id,
    variant_id: item.variantId,
    product_snapshot: {
      name: item.name,
      sku: item.sku,
      kind: item.kind,
      source: "manual_order",
      notes: item.notes,
      discount_cents: item.discountCents,
    },
    quantity: item.quantity,
    unit_price_cents: item.unitPriceCents,
    total_cents: item.totalCents,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw new Error(itemsError.message);

  if (paidCents > 0 || paymentStatus === "paid") {
    await supabase.from("payments").insert({
      tenant_id: tenantId,
      order_id: order.id,
      provider: "manual",
      provider_payment_id: `manual:${order.id}:${Date.now()}`,
      status: paymentStatus === "pending" ? "pending" : "succeeded",
      amount_cents: Math.min(totalCents, Math.max(paidCents, paymentStatus === "paid" ? totalCents : 0)),
      raw: paymentSummary,
    });
  }

  await Promise.all([
    supabase.from("accounting_entries").insert({
      tenant_id: tenantId,
      type: "income",
      category: "Pedido manual",
      description: `Pedido manual #${order.number}`,
      amount_cents: totalCents,
      occurred_at: new Date().toISOString(),
      payment_method: text(formData, "payment_method"),
      source_channel: text(formData, "manual_channel") ?? "manual",
      source_kind: "manual",
      order_id: order.id,
      notes: text(formData, "internal_notes"),
      tags: ["pedido-manual"],
      created_by: session.userId,
    }),
    supabase.from("order_audit_events").insert({
      tenant_id: tenantId,
      order_id: order.id,
      action: "manual_order_created",
      new_value: {
        customer_email: customerEmail,
        total_cents: totalCents,
        payment_status: paymentStatus,
        item_count: items.length,
        fiscal_summary: fiscalSummary,
        delivery_summary: deliverySummary,
      },
      reason: text(formData, "creation_reason"),
      actor_id: session.userId,
    }),
  ]);

  redirect(`/vendas/${order.id}`);
}
