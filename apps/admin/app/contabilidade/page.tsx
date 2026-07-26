import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { buildAccountingReport, customerName, percent, average, type AccountingSearch, type AccountingLedgerRow } from "@/lib/accounting/report";
import { money } from "@/lib/format";
import { AccountingEntryForm } from "./AccountingEntryForm";
import { DeleteAccountingEntryButton } from "./DeleteAccountingEntryButton";

const ENTRY_TYPE_LABEL: Record<string, string> = {
  income: "Receita manual",
  expense: "Despesa geral",
  tax: "Imposto",
  fee: "Taxa",
  product_cost: "Custo de produto",
  shipping_cost: "Frete / logística",
  packaging_cost: "Embalagem",
  operational_cost: "Operacional",
  adjustment: "Ajuste",
};

function exportHref(base: string, format: "csv" | "pdf") {
  return `${base}&format=${format}`;
}

export default async function ContabilidadePage({ searchParams }: { searchParams: Promise<AccountingSearch> }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const params = await searchParams;
  const tenantId = await effectiveTenantId();
  const report = await buildAccountingReport(tenantId, params);
  const { totals, range } = report;

  const exportBase = `/contabilidade/exportar?period=${range.period}${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`;

  const kpis = [
    { label: "Receita ajustada", value: money(totals.adjustedRevenue), detail: `${money(totals.grossRevenue)} em pedidos + ${money(totals.manualIncome)} manual` },
    { label: "Lucro ajustado", value: money(totals.adjustedProfit), detail: `${percent(totals.adjustedProfit, totals.adjustedRevenue)} de margem após custos manuais` },
    { label: "Custos totais", value: money(totals.adjustedCosts), detail: `${money(totals.estimatedCosts)} estimado + ${money(totals.manualExpenses)} manual` },
    { label: "Ticket medio", value: money(average(totals.grossRevenue, report.realizedOrders.length)), detail: `${report.realizedOrders.length} pedidos com receita` },
  ];

  const costRows = [
    { label: "Custo estimado dos produtos", value: totals.productCost, note: "Provisão automática sobre subtotal" },
    { label: "Custo manual de produto", value: totals.manualProductCosts, note: "Lançamentos reais adicionados pela equipe" },
    { label: "Frete operacional estimado", value: totals.shippingCollected, note: "Usa o frete cobrado como provisão" },
    { label: "Taxas estimadas de pagamento", value: totals.paymentFees, note: "Provisão até Stripe enviar taxas reais" },
    { label: "Taxas manuais", value: totals.manualFees, note: "Taxas bancárias, gateways, chargebacks e similares" },
    { label: "Impostos estimados", value: totals.taxReserve, note: "Reserva fiscal automática" },
    { label: "Impostos manuais", value: totals.manualTaxes, note: "ICMS, DAS, nota, contador, ajustes fiscais" },
    { label: "Operacional manual", value: totals.manualOperationalCosts, note: "Embalagem, operação, logística e ajustes" },
  ];

  const cashRows = [
    { label: "Entradas por pedidos", value: totals.grossRevenue },
    { label: "Receitas manuais", value: totals.manualIncome },
    { label: "Descontos concedidos", value: -totals.discounts },
    { label: "Saídas estimadas", value: -totals.estimatedCosts },
    { label: "Saídas manuais", value: -totals.manualExpenses },
    { label: "Saldo ajustado", value: totals.adjustedProfit, strong: true },
  ];

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18, marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 44 }}>Contabilidade</h1>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              Receitas, custos, impostos, taxas, provisões e fluxo de caixa operacional.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <PeriodLinks current={range.period} />
            <Link href={exportHref(exportBase, "csv")} className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 10 }}>
              CSV
            </Link>
            <Link href={exportHref(exportBase, "pdf")} className="btn btn-gold" style={{ padding: "8px 16px", fontSize: 10 }}>
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
          Os números combinam pedidos reais, provisões automáticas e lançamentos manuais. Conforme Stripe, SEFAZ,
          logística e compras forem conectados, este módulo passa a trocar estimativas por dados reais.
        </p>
      </section>

      <AccountingEntryForm />

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

      <section className="glass rise rise-3" style={panelStyle}>
        <SectionTitle eyebrow="Lançamentos" title="Custos, impostos e ajustes manuais" />
        {report.ledgerRows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--cream-dim)", borderBottom: "1px solid var(--glass-border)" }}>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Origem</th>
                  <th style={thStyle}>Canal</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Descrição</th>
                  <th style={thStyle}>Centro</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {report.ledgerRows.map((entry) => (
                  <AccountingEntryRowView key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyText text="Nenhum lançamento manual neste período." />
        )}
      </section>

      <div style={twoColumnStyle}>
        <section className="glass rise rise-4" style={panelStyle}>
          <SectionTitle eyebrow="Campanhas" title="Receita por campanha" />
          {report.campaigns.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {report.campaigns.slice(0, 6).map((campaign) => (
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
            <MetricLine label="Total atribuído" value={money(totals.campaignRevenue)} note={`Orçamento informado: ${money(totals.campaignBudget)}`} strong />
          </div>
        </section>

        <section className="glass rise rise-4" style={panelStyle}>
          <SectionTitle eyebrow="Pedidos" title="Últimas receitas" />
          {report.realizedOrders.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {report.realizedOrders.slice(0, 6).map((order) => (
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

function AccountingEntryRowView({ entry }: { entry: AccountingLedgerRow }) {
  return (
    <tr style={{ borderBottom: "1px solid rgba(242, 236, 223, 0.08)" }}>
      <td style={tdStyle}>{new Date(entry.occurred_at).toLocaleDateString("pt-BR")}</td>
      <td style={tdStyle}>
        <span className={entry.source === "automatic" ? "chip chip-live" : "chip chip-draft"}>
          {entry.source === "automatic" ? "Automático" : "Manual"}
        </span>
      </td>
      <td style={tdStyle}>{entry.channel ?? "—"}</td>
      <td style={tdStyle}>
        <span className={entry.type === "income" ? "chip chip-live" : "chip chip-draft"}>
          {ENTRY_TYPE_LABEL[entry.type] ?? entry.type}
        </span>
      </td>
      <td style={tdStyle}>
        <strong>{entry.description}</strong>
        <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>
          {entry.category}
          {entry.vendor_name ? ` · ${entry.vendor_name}` : ""}
          {entry.document_number ? ` · doc ${entry.document_number}` : ""}
        </span>
      </td>
      <td style={tdStyle}>{entry.cost_center ?? "—"}</td>
      <td style={tdStyle}>
        <strong style={{ color: entry.type === "income" ? "var(--gold-light)" : "#e8a0a0" }}>
          {entry.type === "income" ? "+" : "-"} {money(entry.amount_cents, entry.currency)}
        </strong>
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {entry.accounting_entry_id ? (
          <DeleteAccountingEntryButton id={entry.accounting_entry_id} label={entry.description} />
        ) : (
          <span className="muted" style={{ fontSize: 10 }}>sincronizado</span>
        )}
      </td>
    </tr>
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
  marginTop: 18,
  marginBottom: 18,
};

const panelStyle: CSSProperties = { padding: 22 };
const thStyle: CSSProperties = { padding: "10px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 };
const tdStyle: CSSProperties = { padding: "12px", verticalAlign: "top" };

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
