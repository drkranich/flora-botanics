import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";

const REVENUE_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;
const PRODUCT_COST_RATE = 0.35;
const TAX_RESERVE_RATE = 0.08;
const PAYMENT_FEE_RATE = 0.0399;
const PAYMENT_FIXED_FEE_CENTS = 39;
const OPERATIONAL_RESERVE_RATE = 0.05;

type Search = { period?: string; from?: string; to?: string };

type OrderRow = {
  id: string;
  number: number;
  status: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  customers: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
};

type PaymentRow = { id: string; provider: string; status: string; amount_cents: number; created_at: string };
type CampaignRow = { id: string; title: string; status: string; channel: string | null; revenue_cents: number | null; budget_cents: number | null; orders: number | null };
type SubscriptionRow = { id: string; status: string; total_cents: number | null };

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

function dateRange(search: Search) {
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

function percent(value: number, base: number) {
  if (!base) return "0%";
  return `${Math.round((value / base) * 100)}%`;
}

function average(value: number, count: number) {
  return count > 0 ? Math.round(value / count) : 0;
}

function customerName(order: OrderRow) {
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  return customer?.full_name ?? customer?.email ?? "Cliente não identificado";
}

export default async function ContabilidadePage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const params = await searchParams;
  const range = dateRange(params);
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const ordersQuery = supabase
    .from("orders")
    .select("id, number, status, subtotal_cents, discount_cents, shipping_cents, total_cents, currency, created_at, customers(email, full_name)")
    .eq("tenant_id", tenantId)
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  const paymentsQuery = supabase
    .from("payments")
    .select("id, provider, status, amount_cents, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  const campaignsQuery = supabase
    .from("campaigns")
    .select("id, title, status, channel, revenue_cents, budget_cents, orders")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(80);

  const subscriptionsQuery = supabase
    .from("subscriptions")
    .select("id, status, total_cents")
    .eq("tenant_id", tenantId)
    .limit(200);

  const [ordersRes, paymentsRes, campaignsRes, subscriptionsRes] = await Promise.all([
    ordersQuery,
    paymentsQuery,
    campaignsQuery,
    subscriptionsQuery,
  ]);

  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const subscriptions = (subscriptionsRes.data ?? []) as SubscriptionRow[];

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
  const estimatedCosts = productCost + shippingCollected + taxReserve + paymentFees + operationalReserve;
  const estimatedProfit = grossRevenue - estimatedCosts;
  const campaignRevenue = campaigns.reduce((sum, campaign) => sum + (campaign.revenue_cents ?? 0), 0);
  const campaignBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget_cents ?? 0), 0);

  const exportBase = `/contabilidade/exportar?period=${range.period}${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`;

  const kpis = [
    { label: "Receita realizada", value: money(grossRevenue), detail: `${realizedOrders.length} pedidos pagos/processados` },
    { label: "Lucro estimado", value: money(estimatedProfit), detail: `${percent(estimatedProfit, grossRevenue)} de margem provisória` },
    { label: "Ticket médio", value: money(average(grossRevenue, realizedOrders.length)), detail: "Somente pedidos com receita" },
    { label: "MRR ativo", value: money(mrr), detail: `${activeSubscriptions.length} assinaturas ativas` },
  ];

  const costRows = [
    { label: "Custo dos produtos", value: productCost, note: `Estimado em ${Math.round(PRODUCT_COST_RATE * 100)}% do subtotal` },
    { label: "Frete operacional", value: shippingCollected, note: "Usa o frete cobrado como provisão de custo" },
    { label: "Taxas de pagamento", value: paymentFees, note: "Provisão até Stripe enviar taxas reais" },
    { label: "Impostos", value: taxReserve, note: `Reserva estimada de ${Math.round(TAX_RESERVE_RATE * 100)}%` },
    { label: "Custo operacional", value: operationalReserve, note: `Reserva estimada de ${Math.round(OPERATIONAL_RESERVE_RATE * 100)}%` },
  ];

  const cashRows = [
    { label: "Entradas por pedidos", value: grossRevenue },
    { label: "Pagamentos confirmados", value: paymentRevenue },
    { label: "Descontos concedidos", value: -discounts },
    { label: "Saídas estimadas", value: -estimatedCosts },
    { label: "Saldo projetado", value: estimatedProfit, strong: true },
  ];

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18, marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 44 }}>Contabilidade</h1>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              Receitas, custos, provisões e fluxo de caixa da operação Flora.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <PeriodLinks current={range.period} />
            <Link href={`${exportBase}&format=csv`} className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 10 }}>
              CSV
            </Link>
            <Link href={`${exportBase}&format=pdf`} className="btn btn-gold" style={{ padding: "8px 16px", fontSize: 10 }}>
              PDF
            </Link>
          </div>
        </div>
      </header>

      <section className="rise" style={kpiGridStyle}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className="glass" style={kpiCardStyle}>
            <p className="muted" style={kpiLabelStyle}>{kpi.label}</p>
            <p className="display" style={kpiValueStyle}>{kpi.value}</p>
            <p className="muted" style={kpiDetailStyle}>{kpi.detail}</p>
          </div>
        ))}
      </section>

      <section className="glass rise rise-1" style={noticeStyle}>
        <span className="chip chip-draft">Período: {range.label}</span>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--cream-dim)", lineHeight: 1.7 }}>
          Receita vem dos pedidos reais. Custos, impostos e taxas são provisões até conectarmos custo por produto,
          fiscal e taxas reais do Stripe.
        </p>
      </section>

      <div style={twoColumnStyle}>
        <section className="glass rise rise-2" style={panelStyle}>
          <SectionTitle eyebrow="Custos" title="Saídas e provisões" />
          <div style={{ display: "grid", gap: 12 }}>
            {costRows.map((row) => (
              <MetricLine key={row.label} label={row.label} value={money(row.value)} note={row.note} />
            ))}
          </div>
        </section>

        <section className="glass rise rise-2" style={panelStyle}>
          <SectionTitle eyebrow="Fluxo de caixa" title="Entradas, saídas e saldo" />
          <div style={{ display: "grid", gap: 12 }}>
            {cashRows.map((row) => (
              <MetricLine
                key={row.label}
                label={row.label}
                value={money(row.value)}
                strong={row.strong}
                tone={row.value < 0 ? "danger" : row.strong ? "gold" : "default"}
              />
            ))}
          </div>
        </section>
      </div>

      <div style={twoColumnStyle}>
        <section className="glass rise rise-3" style={panelStyle}>
          <SectionTitle eyebrow="Campanhas" title="Receita por campanha" />
          {campaigns.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {campaigns.slice(0, 6).map((campaign) => (
                <MetricLine
                  key={campaign.id}
                  label={campaign.title}
                  value={money(campaign.revenue_cents ?? 0)}
                  note={`${campaign.channel ?? "sem canal"} · ${campaign.orders ?? 0} pedidos · orçamento ${money(campaign.budget_cents ?? 0)}`}
                />
              ))}
            </div>
          ) : (
            <EmptyText text="Nenhuma campanha com dados financeiros ainda." />
          )}
          <div style={{ marginTop: 16, borderTop: "1px solid var(--glass-border)", paddingTop: 14 }}>
            <MetricLine label="Total atribuído" value={money(campaignRevenue)} note={`Orçamento informado: ${money(campaignBudget)}`} strong />
          </div>
        </section>

        <section className="glass rise rise-3" style={panelStyle}>
          <SectionTitle eyebrow="Pedidos" title="Últimas receitas" />
          {realizedOrders.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {realizedOrders.slice(0, 6).map((order) => (
                <Link key={order.id} href={`/vendas/${order.id}`} style={orderLinkStyle}>
                  <span>
                    <strong>Pedido #{order.number}</strong>
                    <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                      {customerName(order)}
                    </span>
                  </span>
                  <strong style={{ color: "var(--gold-light)" }}>{money(order.total_cents, order.currency)}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyText text="Nenhum pedido com receita neste período." />
          )}
        </section>
      </div>
    </main>
  );
}

function PeriodLinks({ current }: { current: string }) {
  const periods = [
    { key: "today", label: "Hoje" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "month", label: "Mês" },
    { key: "year", label: "Ano" },
  ];

  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {periods.map((period) => (
        <Link
          key={period.key}
          href={`/contabilidade?period=${period.key}`}
          className={current === period.key ? "btn btn-gold" : "btn btn-ghost"}
          style={{ padding: "8px 16px", fontSize: 10 }}
        >
          {period.label}
        </Link>
      ))}
    </nav>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p className="eyebrow" style={{ marginBottom: 7 }}>{eyebrow}</p>
      <h2 className="display" style={{ fontSize: 28 }}>{title}</h2>
    </div>
  );
}

function MetricLine({
  label,
  value,
  note,
  strong,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  tone?: "default" | "gold" | "danger";
}) {
  return (
    <div style={metricLineStyle}>
      <span>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        {note ? <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>{note}</span> : null}
      </span>
      <strong
        style={{
          color: tone === "danger" ? "#e8a0a0" : tone === "gold" || strong ? "var(--gold-light)" : "var(--cream-soft)",
          fontSize: strong ? 17 : 14,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="muted" style={{ fontSize: 12, margin: 0 }}>{text}</p>;
}

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const kpiCardStyle: CSSProperties = { padding: "20px 22px", minHeight: 124 };
const kpiLabelStyle: CSSProperties = { fontSize: 10, letterSpacing: 1.2, margin: 0, textTransform: "uppercase" };
const kpiValueStyle: CSSProperties = { fontSize: 30, color: "var(--gold-light)", margin: "10px 0 0" };
const kpiDetailStyle: CSSProperties = { fontSize: 11, marginTop: 8 };

const noticeStyle: CSSProperties = {
  padding: "14px 18px",
  marginBottom: 18,
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
  marginBottom: 18,
};

const panelStyle: CSSProperties = { padding: 22 };

const metricLineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "center",
  padding: "11px 0",
  borderBottom: "1px solid rgba(242, 236, 223, 0.08)",
};

const orderLinkStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  padding: "11px 12px",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(242, 236, 223, 0.035)",
};
