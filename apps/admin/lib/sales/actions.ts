"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

/** Máquina de estados do pedido (blueprint seção 6.4). */
const TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "canceled"],
  paid: ["processing", "canceled", "refunded"],
  processing: ["shipped", "canceled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  canceled: [],
  refunded: [],
};

export async function allowedTransitions(status: string): Promise<string[]> {
  return TRANSITIONS[status] ?? [];
}

export async function transitionOrder(orderId: string, to: string) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const supabase = await supabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select("id, tenant_id, status, number")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Pedido não encontrado");

  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Transição inválida: ${order.status} → ${to}`);
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: to })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    tenant_id: order.tenant_id,
    actor_id: session.userId,
    action: "order.transition",
    entity_type: "order",
    entity_id: String(order.number),
    diff: { from: order.status, to },
  });

  revalidatePath(`/vendas/${orderId}`);
  revalidatePath("/vendas");
}

/* ---------- cupons ---------- */

export async function createCoupon(form: {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  min_subtotal_cents?: number | null;
  ends_at?: string | null;
}) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("coupons").insert({
    tenant_id: tenantId,
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: form.value,
    min_subtotal_cents: form.min_subtotal_cents ?? null,
    ends_at: form.ends_at || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/vendas/cupons");
}

export async function toggleCoupon(id: string, active: boolean) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("coupons")
    .update({ status: active ? "active" : "disabled" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vendas/cupons");
}

export async function deleteCoupon(id: string) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vendas/cupons");
}
