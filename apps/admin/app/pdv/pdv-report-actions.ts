"use server";

import { currentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface PDVDaySummary {
  date: string;        // YYYY-MM-DD
  sales: number;       // quantidade de pedidos
  total_cents: number; // receita bruta
}

export interface PDVReportResult {
  days: PDVDaySummary[];
  period_total_cents: number;
  period_sales: number;
  avg_ticket_cents: number;
}

export type PDVStatusFilter = "all" | "completed" | "canceled" | "pending";
export type PDVPaymentFilter = "all" | "cash" | "pix" | "credit" | "debit";
export type PDVClientFilter  = "all" | "b2c" | "b2b";

export interface PDVReportFilters {
  status?:  PDVStatusFilter;
  payment?: PDVPaymentFilter;
  client?:  PDVClientFilter;
}

/**
 * Busca o resumo de vendas PDV de um período, com filtros opcionais.
 * @param from YYYY-MM-DD (inclusive)
 * @param to   YYYY-MM-DD (inclusive)
 */
export async function getPDVReport(
  from: string,
  to: string,
  filters: PDVReportFilters = {},
): Promise<PDVReportResult> {
  const staff = await currentStaff();
  if (!staff) return { days: [], period_total_cents: 0, period_sales: 0, avg_ticket_cents: 0 };

  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, total_cents, placed_at, created_at, status, payment_summary, notes")
    .eq("tenant_id", staff.tenantId)
    .eq("source_channel", "pdv")
    .is("deleted_at", null)
    .gte("placed_at", `${from}T00:00:00`)
    .lte("placed_at", `${to}T23:59:59`)
    .order("placed_at", { ascending: true });

  // Filtro de status
  const { status = "all" } = filters;
  if (status === "completed") {
    query = query.in("status", ["paid", "processing", "completed"]);
  } else if (status === "canceled") {
    query = query.eq("status", "canceled");
  } else if (status === "pending") {
    query = query.in("status", ["pending", "draft"]);
  }
  // "all" — sem filtro de status

  const { data } = await query;
  const orders = data ?? [];

  // Filtro de pagamento (client-side — payment_summary é jsonb)
  const { payment = "all" } = filters;
  const filtered = payment === "all" ? orders : orders.filter((o) => {
    const ps = o.payment_summary as Record<string, unknown> | null;
    if (!ps) return false;
    // payment_summary pode ter { method } ou { lines: [{method}] }
    const methods: string[] = [];
    if (typeof ps.method === "string") methods.push(ps.method);
    if (Array.isArray(ps.lines)) {
      for (const l of ps.lines as Record<string, unknown>[]) {
        if (typeof l.method === "string") methods.push(l.method);
      }
    }
    return methods.some((m) => m === payment);
  });

  // Filtro de tipo de cliente (B2B detectado por notes ou campo futuro)
  const { client = "all" } = filters;
  const finalOrders = client === "all" ? filtered : filtered.filter((o) => {
    const isB2B = typeof o.notes === "string" && o.notes.toLowerCase().includes("b2b");
    return client === "b2b" ? isB2B : !isB2B;
  });

  // Agrega por dia
  const dayMap = new Map<string, PDVDaySummary>();
  for (const order of finalOrders) {
    const dateStr = (order.placed_at ?? order.created_at ?? "").slice(0, 10);
    if (!dateStr) continue;
    const existing = dayMap.get(dateStr) ?? { date: dateStr, sales: 0, total_cents: 0 };
    existing.sales += 1;
    existing.total_cents += order.total_cents ?? 0;
    dayMap.set(dateStr, existing);
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const period_total_cents = finalOrders.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const period_sales = finalOrders.length;
  const avg_ticket_cents = period_sales > 0 ? Math.round(period_total_cents / period_sales) : 0;

  return { days, period_total_cents, period_sales, avg_ticket_cents };
}

export interface PDVOrderRow {
  id: string;
  number: number;
  total_cents: number;
  status: string;
  placed_at: string;
  notes: string | null;
}

/** Busca todos os pedidos PDV do dia corrente (para a aba de pedidos do caixa) */
export async function getPDVOrdersToday(): Promise<PDVOrderRow[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("orders")
    .select("id, number, total_cents, status, placed_at, notes")
    .eq("tenant_id", staff.tenantId)
    .eq("source_channel", "pdv")
    .is("deleted_at", null)
    .gte("placed_at", `${today}T00:00:00`)
    .lte("placed_at", `${today}T23:59:59`)
    .order("placed_at", { ascending: false });

  return (data ?? []) as PDVOrderRow[];
}

export interface PDVSaleDetail {
  id: string;
  number: number;
  total_cents: number;
  placed_at: string;
  notes: string | null;
  payment_summary: Record<string, unknown> | null;
}

/** Busca detalhes das vendas de um dia específico para o relatório PDF */
export async function getPDVSalesForDay(date: string): Promise<PDVSaleDetail[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("id, number, total_cents, placed_at, notes, payment_summary")
    .eq("tenant_id", staff.tenantId)
    .eq("source_channel", "pdv")
    .neq("status", "canceled")
    .is("deleted_at", null)
    .gte("placed_at", `${date}T00:00:00`)
    .lte("placed_at", `${date}T23:59:59`)
    .order("placed_at", { ascending: true });

  return (data ?? []) as PDVSaleDetail[];
}
