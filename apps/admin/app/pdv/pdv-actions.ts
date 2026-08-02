"use server";

import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface PDVProduct {
  id: string;
  name: string;
  image_url: string | null;
  variants: PDVVariant[];
}

export interface PDVVariant {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string | null; // nome da variante (ex: "200ml")
  price_cents: number;
  currency: string;
  stock: number;
}

export type PDVPaymentMethod = "cash" | "credit" | "debit" | "pix" | "mixed";

export interface PDVOrderPayment {
  method: PDVPaymentMethod;
  amount_cents: number;
  change_cents?: number; // troco (só para cash)
}

export interface PDVCartItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_sku: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

export async function getPDVProducts(): Promise<PDVProduct[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      `id, name,
       product_media(role, sort_order, media(storage_path)),
       product_variants(id, sku, barcode, name, price_cents, currency, inventory(quantity))`
    )
    .eq("tenant_id", staff.tenantId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

  return (data ?? []).map((p) => {
    const mediaArr = (p.product_media ?? []) as unknown as Array<{
      role: string;
      sort_order: number;
      media: { storage_path: string } | null;
    }>;
    const primary = mediaArr
      .filter((m) => m.role === "gallery" || m.role === "cover")
      .sort((a, b) => a.sort_order - b.sort_order)[0];
    const image_url = primary?.media?.storage_path
      ? `${storageBase}${primary.media.storage_path}`
      : null;

    const variants = ((p.product_variants ?? []) as unknown as Array<{
      id: string;
      sku: string | null;
      barcode: string | null;
      name: string | null;
      price_cents: number;
      currency: string;
      inventory: { quantity: number } | { quantity: number }[] | null;
    }>).map((v) => {
      const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
      return {
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: v.name,
        price_cents: v.price_cents,
        currency: v.currency ?? "BRL",
        stock: inv?.quantity ?? 0,
      };
    });

    return { id: p.id, name: p.name, image_url, variants };
  });
}

export async function createPDVOrder(
  items: PDVCartItem[],
  payments: PDVOrderPayment[],
  customerName?: string,
  notes?: string
): Promise<{ ok: boolean; orderId?: string; orderNumber?: string; error?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (items.length === 0) return { ok: false, error: "Carrinho vazio." };

  const supabase = await createClient();

  const subtotal = items.reduce((s, i) => s + i.total_cents, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount_cents, 0);

  if (totalPaid < subtotal) {
    return { ok: false, error: "Pagamento insuficiente." };
  }

  // Gera número do pedido PDV
  const orderNumber = `PDV-${Date.now().toString(36).toUpperCase()}`;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      tenant_id: staff.tenantId,
      number: orderNumber,
      status: "processing",
      source_channel: "pdv",
      origin_label: "PDV",
      manual_channel: "Venda presencial",
      payment_status: "paid",
      subtotal_cents: subtotal,
      discount_cents: 0,
      shipping_cents: 0,
      total_cents: subtotal,
      currency: "BRL",
      notes: notes || null,
      placed_at: new Date().toISOString(),
    })
    .select("id, number")
    .single();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? "Erro ao criar pedido." };
  }

  // Insere itens
  const { error: itemsErr } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: order.id,
      variant_id: item.variant_id,
      product_snapshot: {
        name: item.product_name,
        sku: item.variant_sku,
        kind: "pdv",
      },
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_cents: item.total_cents,
    }))
  );

  if (itemsErr) {
    // Rollback manual (Supabase não tem transações no client)
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false, error: itemsErr.message };
  }

  // Registra pagamentos
  const { error: payErr } = await supabase.from("payments").insert(
    payments.map((pmt) => ({
      tenant_id: staff.tenantId,
      order_id: order.id,
      provider: `pdv_${pmt.method}`,
      status: "succeeded",
      amount_cents: pmt.amount_cents,
      raw: { method: pmt.method, change_cents: pmt.change_cents ?? 0, via: "pdv" },
    }))
  );

  if (payErr) {
    console.error("[PDV] Erro ao registrar pagamento:", payErr.message);
    // Pedido já criado, não faz rollback — só loga
  }

  // Decrementa estoque via RPC (GREATEST(0, quantity - N))
  for (const item of items) {
    await supabase
      .rpc("decrement_inventory", {
        p_variant_id: item.variant_id,
        p_quantity: item.quantity,
      })
      .then(({ error }) => {
        if (error) console.warn("[PDV] decrement_inventory:", error.message);
      });
  }

  // Auditoria
  await supabase.from("order_audit_events").insert({
    tenant_id: staff.tenantId,
    order_id: order.id,
    action: "pdv_sale",
    reason: `Venda presencial por ${staff.fullName ?? staff.email}`,
    new_value: { items: items.length, total_cents: subtotal, payments },
    actor_id: staff.id,
  }).then(({ error }) => {
    if (error) console.warn("[PDV] audit:", error.message);
  });

  revalidatePath("/vendas");
  return { ok: true, orderId: order.id, orderNumber: String(order.number) };
}
