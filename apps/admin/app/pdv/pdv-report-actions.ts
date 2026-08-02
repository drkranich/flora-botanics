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
  /** Total do período */
  period_total_cents: number;
  period_sales: number;
  /** Ticket médio em centavos */
  avg_ticket_cents: number;
}

/**
 * Busca o resumo de vendas PDV de um período.
 * @param from YYYY-MM-DD (inclusive)
 * @param to   YYYY-MM-DD (inclusive)
 */
export async function getPDVReport(from: string, to: string): Promise<PDVReportResult> {
  const staff = await currentStaff();
  if (!staff) return { days: [], period_total_cents: 0, period_sales: 0, avg_ticket_cents: 0 };

  const supabase = await createClient();

  // Busca pedidos PDV no período (placed_at ou created_at, sem deleted/cancelled)
  const { data } = await supabase
    .from("orders")
    .select("id, total_cents, placed_at, created_at")
    .eq("tenant_id", staff.tenantId)
    .eq("source_channel", "pdv")
    .neq("status", "canceled")
    .is("deleted_at", null)
    .gte("placed_at", `${from}T00:00:00`)
    .lte("placed_at", `${to}T23:59:59`)
    .order("placed_at", { ascending: true });

  const orders = data ?? [];

  // Agrega por dia
  const dayMap = new Map<string, PDVDaySummary>();
  for (const order of orders) {
    const dateStr = (order.placed_at ?? order.created_at ?? "").slice(0, 10);
    if (!dateStr) continue;
    const existing = dayMap.get(dateStr) ?? { date: dateStr, sales: 0, total_cents: 0 };
    existing.sales += 1;
    existing.total_cents += order.total_cents ?? 0;
    dayMap.set(dateStr, existing);
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const period_total_cents = orders.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const period_sales = orders.length;
  const avg_ticket_cents = period_sales > 0 ? Math.round(period_total_cents / period_sales) : 0;

  return { days, period_total_cents, period_sales, avg_ticket_cents };
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
