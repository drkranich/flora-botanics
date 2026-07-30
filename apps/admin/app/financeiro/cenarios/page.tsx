/**
 * /financeiro/cenarios — Histórico de cenários de precificação
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

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

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default async function CenariosPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("finance_calculations")
    .select("id, title, calculation_mode, sale_model, channel, quantity, totals, alerts, created_at")
    .eq("tenant_id", session.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main style={pageStyle}>
        <Breadcrumb />
        <section className="glass" style={{ padding: 22, borderColor: "rgba(232,160,160,.45)", borderRadius: 16 }}>
          <p className="eyebrow" style={{ color: "#e8a0a0", marginBottom: 8 }}>Migration pendente</p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Aplique a migration <code>20260726114536_commercial_finance_engine.sql</code> para liberar o módulo.
          </p>
        </section>
      </main>
    );
  }

  const rows = (data ?? []) as CalculationRow[];
  const totalRevenue = rows.reduce((s, r) => s + (r.totals?.netRevenueCents ?? 0), 0);
  const totalCost    = rows.reduce((s, r) => s + (r.totals?.totalCostCents ?? 0), 0);
  const totalProfit  = rows.reduce((s, r) => s + (r.totals?.netProfitCents ?? 0), 0);
  const avgMargin    = rows.length
    ? rows.reduce((s, r) => s + (r.totals?.netMarginPercent ?? 0), 0) / rows.length
    : 0;

  return (
    <main style={pageStyle}>
      <Breadcrumb />
      <header style={{ marginBottom: 28 }}>
        <h1 className="display" style={{ fontSize: 38 }}>Cenários Salvos</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Histórico de simulações de precificação com receita, custo, lucro e alertas.
        </p>
      </header>

      {/* KPIs */}
      <div style={kpiGridStyle}>
        {[
          { label: "Receita simulada", value: money(totalRevenue), note: `${rows.length} cenários` },
          { label: "Custo simulado",   value: money(totalCost),    note: "custos + taxas + comissões" },
          { label: "Lucro previsto",   value: money(totalProfit),  note: `${avgMargin.toFixed(1)}% margem média` },
        ].map((kpi) => (
          <div key={kpi.label} className="glass" style={{ padding: "18px 20px", borderRadius: 14 }}>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1.2, margin: 0, textTransform: "uppercase" }}>{kpi.label}</p>
            <p className="display" style={{ fontSize: 26, color: "var(--gold-light)", margin: "8px 0 0" }}>{kpi.value}</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{kpi.note}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 8 }}>
        <Link href="/financeiro/calculadora" className="btn btn-gold" style={{ padding: "9px 18px", fontSize: 13 }}>
          + Novo cenário
        </Link>
        <Link href="/financeiro/exportar?format=xlsx" className="btn btn-ghost" style={{ padding: "9px 18px", fontSize: 13 }}>
          Exportar XLSX
        </Link>
      </div>

      {/* Tabela */}
      <div className="glass" style={{ padding: 0, borderRadius: 16, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--cream-dim)" }}>
            Nenhum cenário salvo ainda.
            <br />
            <Link href="/financeiro/calculadora" style={{ color: "var(--gold-light)", marginTop: 12, display: "inline-block" }}>
              Criar o primeiro cenário →
            </Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--glass-border)", color: "var(--cream-dim)" }}>
                <th style={thStyle}>Cenário</th>
                <th style={thStyle}>Modelo</th>
                <th style={thStyle}>Canal</th>
                <th style={thStyle}>Itens</th>
                <th style={thStyle}>Receita</th>
                <th style={thStyle}>Custo</th>
                <th style={thStyle}>Lucro</th>
                <th style={thStyle}>Margem</th>
                <th style={thStyle}>Alertas</th>
                <th style={thStyle}>Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid rgba(242,236,223,0.06)" }}>
                  <td style={tdStyle}><strong>{row.title}</strong></td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{row.sale_model}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{row.channel}</td>
                  <td style={tdStyle}>{row.totals?.itemCount ?? row.quantity}</td>
                  <td style={tdStyle}>{money(row.totals?.netRevenueCents ?? 0)}</td>
                  <td style={tdStyle}>{money(row.totals?.totalCostCents ?? 0)}</td>
                  <td style={tdStyle}>
                    <strong style={{ color: (row.totals?.netProfitCents ?? 0) < 0 ? "#e8a0a0" : "var(--gold-light)" }}>
                      {money(row.totals?.netProfitCents ?? 0)}
                    </strong>
                  </td>
                  <td style={tdStyle}>{Number(row.totals?.netMarginPercent ?? 0).toFixed(1)}%</td>
                  <td style={tdStyle}>
                    {row.alerts?.length ? (
                      <span className="chip" style={{ fontSize: 11, background: "#7a3a2a" }}>
                        {row.alerts.length} alerta{row.alerts.length > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="chip chip-live" style={{ fontSize: 11 }}>OK</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: "var(--cream-dim)" }}>{fmtDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function Breadcrumb() {
  return (
    <nav style={{ fontSize: 13, color: "var(--cream-dim, #a09880)", marginBottom: 20, display: "flex", gap: 8 }}>
      <Link href="/financeiro" style={{ color: "inherit", textDecoration: "none" }}>Financeiro</Link>
      <span>/</span>
      <span style={{ color: "var(--color-heading, #f1ede5)" }}>Cenários</span>
    </nav>
  );
}

const pageStyle: CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "48px 28px 80px" };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 24 };
const thStyle: CSSProperties = { padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 };
const tdStyle: CSSProperties = { padding: "13px 14px", verticalAlign: "middle" };
