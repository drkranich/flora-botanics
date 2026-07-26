import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { CommercialQuoteForm } from "./CommercialQuoteForm";
import { FinanceCalculatorForm } from "./FinanceCalculatorForm";
import { FinanceSettingsForm, type FinanceSettingsData } from "./FinanceSettingsForm";
import { PriceTableForm } from "./PriceTableForm";
import { deletePriceTable } from "./actions";

type CalculationRow = {
  id: string;
  title: string;
  calculation_mode: string;
  sale_model: string;
  channel: string;
  quantity: number;
  totals: Record<string, number>;
  alerts: { tone: string; message: string }[] | null;
  created_at: string;
};

type QuoteRow = {
  id: string;
  number: number;
  kind: string;
  status: string;
  customer_name: string;
  company_name: string | null;
  channel: string | null;
  totals: Record<string, number>;
  created_at: string;
};

type PriceTableRow = {
  id: string;
  name: string;
  table_type: string;
  channel: string | null;
  customer_name: string | null;
  min_quantity: number;
  discount_percent: number;
  commission_percent: number;
  minimum_margin_percent: number;
  approval_required: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
};

const SECTIONS = [
  { label: "Visão geral", href: "#visao-geral" },
  { label: "Calculadora de custos", href: "#calculadora" },
  { label: "Formação de preços", href: "#calculadora" },
  { label: "Kits e combos", href: "#calculadora" },
  { label: "Orçamentos", href: "#documentos" },
  { label: "Cotações", href: "#documentos" },
  { label: "Propostas comerciais", href: "#documentos" },
  { label: "Custos fixos", href: "#calculadora" },
  { label: "Custos variáveis", href: "#calculadora" },
  { label: "Impostos", href: "#calculadora" },
  { label: "Comissões", href: "#calculadora" },
  { label: "Logística", href: "#calculadora" },
  { label: "Margens", href: "#historico" },
  { label: "Cenários", href: "#historico" },
  { label: "Rentabilidade", href: "#historico" },
  { label: "Fluxo de caixa", href: "/contabilidade#fluxo-de-caixa" },
  { label: "Contas a pagar", href: "/contabilidade#contas-a-pagar" },
  { label: "Contas a receber", href: "/contabilidade#contas-a-receber" },
  { label: "Centros de custo", href: "/contabilidade#centros-de-custo" },
  { label: "Relatórios", href: "#exportacao" },
  { label: "Configurações", href: "#configuracoes" },
];

const KIND_LABEL: Record<string, string> = {
  budget: "Orçamento",
  quote: "Cotação",
  proposal: "Proposta",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  review: "Revisão",
  sent: "Enviado",
  viewed: "Visualizado",
  approved: "Aprovado",
  rejected: "Reprovado",
  expired: "Vencido",
  cancelled: "Cancelado",
  converted: "Convertido",
};

export default async function FinanceiroPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const [{ data: calculations, error: calculationsError }, { data: quotes }, { data: settings }, { data: priceTables }] = await Promise.all([
    supabase
      .from("finance_calculations")
      .select("id, title, calculation_mode, sale_model, channel, quantity, totals, alerts, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("commercial_quotes")
      .select("id, number, kind, status, customer_name, company_name, channel, totals, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("finance_settings")
      .select("target_margin_percent, minimum_margin_percent, default_tax_percent, default_payment_fee_percent, default_payment_fixed_cents, default_logistics_percent, default_overhead_percent, rules")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("finance_price_tables")
      .select("id, name, table_type, channel, customer_name, min_quantity, discount_percent, commission_percent, minimum_margin_percent, approval_required, valid_from, valid_until, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (calculationsError) {
    return (
      <main style={pageStyle}>
        <Header />
        <section className="glass rise" style={{ padding: 22, borderColor: "rgba(232,160,160,0.45)" }}>
          <p className="eyebrow" style={{ color: "#e8a0a0", marginBottom: 8 }}>Migration pendente</p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Aplique a migration `20260726114536_commercial_finance_engine.sql` para liberar o modulo financeiro completo.
          </p>
        </section>
      </main>
    );
  }

  const rows = (calculations ?? []) as unknown as CalculationRow[];
  const quoteRows = (quotes ?? []) as unknown as QuoteRow[];
  const priceRows = (priceTables ?? []) as unknown as PriceTableRow[];
  const totalRevenue = rows.reduce((sum, row) => sum + (row.totals?.netRevenueCents ?? 0), 0);
  const totalCost = rows.reduce((sum, row) => sum + (row.totals?.totalCostCents ?? 0), 0);
  const totalProfit = rows.reduce((sum, row) => sum + (row.totals?.netProfitCents ?? 0), 0);
  const averageMargin = rows.length
    ? rows.reduce((sum, row) => sum + (row.totals?.netMarginPercent ?? 0), 0) / rows.length
    : 0;
  const calculationOptions = rows.map((row) => ({ value: row.id, label: `${row.title} - ${money(row.totals?.netRevenueCents ?? 0)}` }));

  return (
    <main style={pageStyle}>
      <Header />

      <section id="visao-geral" className="rise" style={kpiGridStyle}>
        <Kpi label="Receita simulada" value={money(totalRevenue)} note={`${rows.length} cenários salvos`} />
        <Kpi label="Custo simulado" value={money(totalCost)} note="custos, taxas, impostos e comissões" />
        <Kpi label="Lucro previsto" value={money(totalProfit)} note={`${averageMargin.toFixed(1)}% margem média`} />
        <Kpi label="Documentos" value={`${quoteRows.length}`} note="orçamentos, cotações e propostas" />
      </section>

      <section className="glass rise rise-1" style={{ padding: 18, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Subseções do módulo</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SECTIONS.map((section) => (
            <Link key={`${section.href}-${section.label}`} href={section.href} className="finance-subsection-link">
              {section.label}
            </Link>
          ))}
        </div>
      </section>

      <section id="calculadora">
        <FinanceCalculatorForm />
      </section>

      <div id="configuracoes" style={twoColumnStyle}>
        <FinanceSettingsForm settings={settings as FinanceSettingsData | null} />
        <PriceTableForm />
      </div>

      <section id="tabelas" className="glass rise rise-2" style={{ padding: 22, marginTop: 18 }}>
        <SectionTitle eyebrow="Tabelas comerciais" title="Preços, descontos e aprovações" />
        {priceRows.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {priceRows.map((table) => (
              <div key={table.id} style={priceTableRowStyle}>
                <span>
                  <strong>{table.name}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>
                    {table.table_type} - {table.channel ?? "sem canal"} - mínimo {table.min_quantity}
                    {table.customer_name ? ` - ${table.customer_name}` : ""}
                  </span>
                </span>
                <span className="chip chip-draft">{Number(table.discount_percent).toFixed(1)}% desc.</span>
                <span className="chip chip-draft">{Number(table.commission_percent).toFixed(1)}% comissão</span>
                <span className={table.approval_required ? "chip" : "chip chip-live"}>
                  {table.approval_required ? "Aprovação" : "Liberada"}
                </span>
                <form action={deletePriceTable.bind(null, table.id)}>
                  <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 9 }}>
                    Excluir
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Nenhuma tabela criada ainda. Crie regras para atacado, B2B, representantes, marketplaces, campanhas e assinaturas.
          </p>
        )}
      </section>

      <div style={twoColumnStyle}>
        <div id="documentos">
          <CommercialQuoteForm calculations={calculationOptions} />
        </div>

        <section id="exportacao" className="glass rise rise-2" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 7 }}>Relatórios</p>
              <h2 className="display" style={{ fontSize: 28 }}>Exportação</h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/financeiro/exportar?format=csv" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>CSV</Link>
              <Link href="/financeiro/exportar?format=pdf" className="btn btn-gold" style={{ padding: "8px 14px", fontSize: 10 }}>PDF</Link>
              <Link href="/financeiro/exportar?format=xlsx" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>XLSX</Link>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
            Exporta cenários, margens, lucros, custos totais, tabelas de preço e documentos comerciais.
          </p>
        </section>
      </div>

      <section id="historico" className="glass rise rise-3" style={{ padding: 22, marginTop: 18 }}>
        <SectionTitle eyebrow="Cenários" title="Histórico salvo" />
        {rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--cream-dim)", textAlign: "left" }}>
                  <th style={thStyle}>Cenário</th>
                  <th style={thStyle}>Modelo</th>
                  <th style={thStyle}>Canal</th>
                  <th style={thStyle}>Itens</th>
                  <th style={thStyle}>Receita</th>
                  <th style={thStyle}>Custo</th>
                  <th style={thStyle}>Lucro</th>
                  <th style={thStyle}>Margem</th>
                  <th style={thStyle}>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid rgba(242,236,223,0.08)" }}>
                    <td style={tdStyle}><strong>{row.title}</strong></td>
                    <td style={tdStyle}>{row.sale_model}</td>
                    <td style={tdStyle}>{row.channel}</td>
                    <td style={tdStyle}>{row.totals?.itemCount ?? row.quantity}</td>
                    <td style={tdStyle}>{money(row.totals?.netRevenueCents ?? 0)}</td>
                    <td style={tdStyle}>{money(row.totals?.totalCostCents ?? 0)}</td>
                    <td style={tdStyle}>
                      <strong style={{ color: (row.totals?.netProfitCents ?? 0) < 0 ? "#e8a0a0" : "var(--gold-light)" }}>
                        {money(row.totals?.netProfitCents ?? 0)}
                      </strong>
                    </td>
                    <td style={tdStyle}>{Number(row.totals?.netMarginPercent ?? 0).toFixed(1)}%</td>
                    <td style={tdStyle}>{row.alerts?.length ? `${row.alerts.length} alerta(s)` : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Nenhum cenário salvo ainda.</p>
        )}
      </section>

      <section className="glass rise rise-4" style={{ padding: 22, marginTop: 18 }}>
        <SectionTitle eyebrow="Comercial" title="Orçamentos, cotações e propostas" />
        {quoteRows.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {quoteRows.map((quote) => (
              <div key={quote.id} style={quoteRowStyle}>
                <span>
                  <strong>#{quote.number} - {quote.customer_name}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>
                    {KIND_LABEL[quote.kind] ?? quote.kind} - {quote.company_name ?? "sem empresa"} - {quote.channel ?? "sem canal"}
                  </span>
                </span>
                <span className="chip chip-draft">{STATUS_LABEL[quote.status] ?? quote.status}</span>
                <strong style={{ color: "var(--gold-light)" }}>{money(quote.totals?.netRevenueCents ?? 0)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Nenhum documento comercial criado ainda.</p>
        )}
      </section>
    </main>
  );
}

function Header() {
  return (
    <header className="rise" style={{ marginBottom: 26 }}>
      <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18, marginTop: 10 }}>
        <div>
          <h1 className="display" style={{ fontSize: 42 }}>Financeiro, Precificação e Orçamentos</h1>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            Motor de custos, margens, kits, canais, propostas e decisões comerciais.
          </p>
        </div>
      </div>
    </header>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass" style={{ padding: "20px 22px", minHeight: 120 }}>
      <p className="muted" style={{ fontSize: 10, letterSpacing: 1.2, margin: 0, textTransform: "uppercase" }}>{label}</p>
      <p className="display" style={{ fontSize: 30, color: "var(--gold-light)", margin: "10px 0 0" }}>{value}</p>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{note}</p>
    </div>
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

const pageStyle: CSSProperties = { maxWidth: 1220, margin: "0 auto", padding: "48px 28px 80px" };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 18 };
const twoColumnStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(320px, 1.15fr) minmax(280px, 0.85fr)", gap: 18, marginTop: 18 };
const thStyle: CSSProperties = { padding: "10px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 };
const tdStyle: CSSProperties = { padding: "12px", verticalAlign: "top" };
const quoteRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) auto auto",
  gap: 14,
  alignItems: "center",
  padding: "12px 14px",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(255,248,234,0.035)",
};

const priceTableRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto auto auto auto",
  gap: 10,
  alignItems: "center",
  padding: "12px 14px",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(255,248,234,0.035)",
};

