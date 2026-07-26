import { supabaseServer } from "@/lib/supabase/server";

export const REVENUE_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;
export const PRODUCT_COST_RATE = 0.35;
export const TAX_RESERVE_RATE = 0.08;
export const PAYMENT_FEE_RATE = 0.0399;
export const PAYMENT_FIXED_FEE_CENTS = 39;
export const OPERATIONAL_RESERVE_RATE = 0.05;

export type AccountingSearch = { period?: string; from?: string; to?: string };

export type OrderRow = {
  id: string;
  number: number;
  status: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  source_channel?: string | null;
  created_at: string;
  customers: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
};

export type PaymentRow = { id: string; provider: string; status: string; amount_cents: number; created_at: string };
export type CampaignRow = { id: string; title: string; status: string; channel: string | null; revenue_cents: number | null; budget_cents: number | null; orders: number | null };
export type SubscriptionRow = { id: string; status: string; total_cents: number | null };
export type AccountingEntryRow = {
  id: string;
  type: string;
  category: string;
  description: string;
  amount_cents: number;
  currency: string;
  occurred_at: string;
  vendor_name: string | null;
  document_number: string | null;
  payment_method: string | null;
  cost_center: string | null;
  source_channel: string | null;
  source_kind: string;
  notes: string | null;
  tags: string[] | null;
  is_recurring: boolean;
  recurrence_interval: string | null;
};

export type AccountingLedgerRow = {
  id: string;
  source: "manual" | "automatic";
  type: string;
  category: string;
  description: string;
  amount_cents: number;
  currency: string;
  occurred_at: string;
  channel: string | null;
  cost_center: string | null;
  vendor_name?: string | null;
  document_number?: string | null;
  accounting_entry_id?: string;
  order_id?: string;
  order_number?: number;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateRange(search: AccountingSearch) {
  const now = new Date();
  const customFrom = parseDate(search.from);
  const customTo = parseDate(search.to);

  if (search.period === "custom" && customFrom) {
    return {
      label: customTo
        ? `${customFrom.toLocaleDateString("pt-BR")} a ${customTo.toLocaleDateString("pt-BR")}`
        : customFrom.toLocaleDateString("pt-BR"),
      from: startOfDay(customFrom),
      to: endOfDay(customTo ?? customFrom),
      period: "custom",
    };
  }

  if (search.period === "today") return { label: "Hoje", from: startOfDay(now), to: endOfDay(now), period: "today" };

  if (search.period === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { label: "Últimos 7 dias", from: startOfDay(from), to: endOfDay(now), period: "7d" };
  }

  if (search.period === "month") {
    return { label: "Mês atual", from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now), period: "month" };
  }

  if (search.period === "year") {
    return { label: "Ano atual", from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now), period: "year" };
  }

  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { label: "Últimos 30 dias", from: startOfDay(from), to: endOfDay(now), period: "30d" };
}

export function percent(value: number, base: number) {
  if (!base) return "0%";
  return `${Math.round((value / base) * 100)}%`;
}

export function average(value: number, count: number) {
  return count > 0 ? Math.round(value / count) : 0;
}

export function customerName(order: OrderRow) {
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  return customer?.full_name ?? customer?.email ?? "Cliente não identificado";
}

export async function buildAccountingReport(tenantId: string, search: AccountingSearch) {
  const range = dateRange(search);
  const supabase = await supabaseServer();

  const [ordersRes, paymentsRes, campaignsRes, subscriptionsRes, entriesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, status, subtotal_cents, discount_cents, shipping_cents, total_cents, currency, source_channel, created_at, customers(email, full_name)")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("payments")
      .select("id, provider, status, amount_cents, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("campaigns")
      .select("id, title, status, channel, revenue_cents, budget_cents, orders")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("subscriptions")
      .select("id, status, total_cents")
      .eq("tenant_id", tenantId)
      .limit(200),
    supabase
      .from("accounting_entries")
      .select("id, type, category, description, amount_cents, currency, occurred_at, vendor_name, document_number, payment_method, cost_center, source_channel, source_kind, notes, tags, is_recurring, recurrence_interval")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", range.from.toISOString())
      .lte("occurred_at", range.to.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(300),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const subscriptions = (subscriptionsRes.data ?? []) as SubscriptionRow[];
  const entries = (entriesRes.data ?? []) as AccountingEntryRow[];

  const realizedOrders = orders.filter((order) => REVENUE_STATUSES.includes(order.status as (typeof REVENUE_STATUSES)[number]));
  const paidPayments = payments.filter((payment) => payment.status === "succeeded");
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "active");

  const grossRevenue = realizedOrders.reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
  const subtotal = realizedOrders.reduce((sum, order) => sum + (order.subtotal_cents ?? 0), 0);
  const discounts = realizedOrders.reduce((sum, order) => sum + (order.discount_cents ?? 0), 0);
  const shippingCollected = realizedOrders.reduce((sum, order) => sum + (order.shipping_cents ?? 0), 0);
  const paymentRevenue = paidPayments.reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
  const mrr = activeSubscriptions.reduce((sum, subscription) => sum + (subscription.total_cents ?? 0), 0);
  const productCost = Math.round(subtotal * PRODUCT_COST_RATE);
  const taxReserve = Math.round(grossRevenue * TAX_RESERVE_RATE);
  const paymentFees = Math.round(grossRevenue * PAYMENT_FEE_RATE + realizedOrders.length * PAYMENT_FIXED_FEE_CENTS);
  const operationalReserve = Math.round(grossRevenue * OPERATIONAL_RESERVE_RATE);
  const manualIncome = entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + (entry.amount_cents ?? 0), 0);
  const manualExpenses = entries.filter((entry) => entry.type !== "income").reduce((sum, entry) => sum + (entry.amount_cents ?? 0), 0);
  const manualTaxes = entries.filter((entry) => entry.type === "tax").reduce((sum, entry) => sum + (entry.amount_cents ?? 0), 0);
  const manualFees = entries.filter((entry) => entry.type === "fee").reduce((sum, entry) => sum + (entry.amount_cents ?? 0), 0);
  const manualProductCosts = entries.filter((entry) => entry.type === "product_cost").reduce((sum, entry) => sum + (entry.amount_cents ?? 0), 0);
  const manualOperationalCosts = entries
    .filter((entry) => ["expense", "shipping_cost", "packaging_cost", "operational_cost", "adjustment"].includes(entry.type))
    .reduce((sum, entry) => sum + (entry.amount_cents ?? 0), 0);
  const automaticLedgerRows: AccountingLedgerRow[] = realizedOrders.flatMap((order) => {
    const rows: AccountingLedgerRow[] = [
      {
        id: `order-income-${order.id}`,
        source: "automatic",
        type: "income",
        category: "Venda",
        description: `Pedido #${order.number}`,
        amount_cents: order.total_cents ?? 0,
        currency: order.currency,
        occurred_at: order.created_at,
        channel: order.source_channel ?? "site",
        cost_center: "Vendas",
        order_id: order.id,
        order_number: order.number,
      },
    ];

    if (order.discount_cents > 0) {
      rows.push({
        id: `order-discount-${order.id}`,
        source: "automatic",
        type: "adjustment",
        category: "Desconto",
        description: `Desconto do pedido #${order.number}`,
        amount_cents: order.discount_cents,
        currency: order.currency,
        occurred_at: order.created_at,
        channel: order.source_channel ?? "site",
        cost_center: "Vendas",
        order_id: order.id,
        order_number: order.number,
      });
    }

    return rows;
  });
  const manualLedgerRows: AccountingLedgerRow[] = entries.map((entry) => ({
    id: `manual-${entry.id}`,
    source: "manual",
    type: entry.type,
    category: entry.category,
    description: entry.description,
    amount_cents: entry.amount_cents,
    currency: entry.currency,
    occurred_at: entry.occurred_at,
    channel: entry.source_channel,
    cost_center: entry.cost_center,
    vendor_name: entry.vendor_name,
    document_number: entry.document_number,
    accounting_entry_id: entry.id,
  }));
  const ledgerRows = [...automaticLedgerRows, ...manualLedgerRows].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
  const estimatedCosts = productCost + shippingCollected + taxReserve + paymentFees + operationalReserve;
  const adjustedRevenue = grossRevenue + manualIncome;
  const adjustedCosts = estimatedCosts + manualExpenses;
  const estimatedProfit = grossRevenue - estimatedCosts;
  const adjustedProfit = adjustedRevenue - adjustedCosts;
  const campaignRevenue = campaigns.reduce((sum, campaign) => sum + (campaign.revenue_cents ?? 0), 0);
  const campaignBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget_cents ?? 0), 0);

  return {
    range,
    orders,
    realizedOrders,
    payments,
    paidPayments,
    campaigns,
    subscriptions,
    activeSubscriptions,
    entries,
    ledgerRows,
    totals: {
      grossRevenue,
      adjustedRevenue,
      subtotal,
      discounts,
      shippingCollected,
      paymentRevenue,
      mrr,
      productCost,
      taxReserve,
      paymentFees,
      operationalReserve,
      estimatedCosts,
      estimatedProfit,
      adjustedCosts,
      adjustedProfit,
      manualIncome,
      manualExpenses,
      manualTaxes,
      manualFees,
      manualProductCosts,
      manualOperationalCosts,
      campaignRevenue,
      campaignBudget,
    },
  };
}
