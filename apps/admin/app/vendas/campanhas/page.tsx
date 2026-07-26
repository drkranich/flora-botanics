import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { SalesTabs } from "../Tabs";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  ended: "Encerrada",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--cream-dim)",
  active: "#8fd486",
  paused: "var(--gold-light)",
  ended: "#d0c6b2",
};

export default async function CampanhasPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, slug, title, subtitle, status, channel, target_cities, starts_at, ends_at, views, clicks, orders, revenue_cents, budget_cents")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const rows = campaigns ?? [];
  const active = rows.filter((c) => c.status === "active").length;
  const totalRevenue = rows.reduce((sum, c) => sum + (c.revenue_cents ?? 0), 0);

  function money(cents: number) {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function pct(a: number, b: number) {
    return b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—";
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Campanhas</h1>
      </header>

      <SalesTabs />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <Link href="/vendas/campanhas/nova" className="btn btn-gold" style={{ fontSize: 12 }}>
          + Nova campanha
        </Link>
      </div>

      <div className="rise" style={kpiGridStyle}>
        {[
          { label: "Ativas", value: active },
          { label: "Total campanhas", value: rows.length },
          { label: "Receita total", value: money(totalRevenue) },
          { label: "Total pedidos", value: rows.reduce((s, c) => s + (c.orders ?? 0), 0) },
        ].map((kpi) => (
          <div key={kpi.label} className="glass" style={kpiCardStyle}>
            <p className="muted" style={kpiLabelStyle}>{kpi.label}</p>
            <p className="display" style={kpiValueStyle}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="glass rise" style={emptyStateStyle}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Nenhuma campanha criada ainda.</p>
          <p className="muted" style={{ fontSize: 13 }}>Use campanhas para segmentar por cidade, canal e público.</p>
        </div>
      ) : (
        <div className="glass rise" style={tableShellStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={tableHeadRowStyle}>
                {["Campanha", "Cidades", "Canal", "Período", "Views", "Cliques", "Conv.", "Receita", "Status"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const statusColor = STATUS_COLOR[c.status] ?? "var(--cream-dim)";
                return (
                  <tr key={c.id} style={tableBodyRowStyle}>
                    <td style={tdStyle}>
                      <Link href={`/vendas/campanhas/${c.id}`} style={{ fontWeight: 700, color: "var(--cream)" }}>
                        {c.title}
                      </Link>
                      {c.subtitle && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{c.subtitle}</div>}
                    </td>
                    <td className="muted" style={{ ...tdStyle, fontSize: 12 }}>
                      {(c.target_cities ?? []).slice(0, 2).join(", ")}
                      {(c.target_cities ?? []).length > 2 && ` +${(c.target_cities ?? []).length - 2}`}
                    </td>
                    <td style={tdStyle}>{c.channel ?? "—"}</td>
                    <td className="muted" style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" }}>
                      {c.starts_at ? new Date(c.starts_at).toLocaleDateString("pt-BR") : "—"}
                      {" -> "}
                      {c.ends_at ? new Date(c.ends_at).toLocaleDateString("pt-BR") : "sem fim"}
                    </td>
                    <td style={tdStyle}>{(c.views ?? 0).toLocaleString("pt-BR")}</td>
                    <td style={tdStyle}>{(c.clicks ?? 0).toLocaleString("pt-BR")}</td>
                    <td style={tdStyle}>{pct(c.orders ?? 0, c.clicks ?? 0)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "var(--gold-light)" }}>{money(c.revenue_cents ?? 0)}</td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(statusColor)}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
  marginBottom: 28,
};

const kpiCardStyle: CSSProperties = {
  minHeight: 96,
  padding: "18px 20px",
};

const kpiLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.2,
  margin: 0,
  textTransform: "uppercase",
};

const kpiValueStyle: CSSProperties = {
  fontSize: 26,
  color: "var(--gold-light)",
  margin: "8px 0 0",
};

const emptyStateStyle: CSSProperties = {
  textAlign: "center",
  padding: "54px 28px",
  color: "var(--cream-soft)",
};

const tableShellStyle: CSSProperties = {
  overflowX: "auto",
  borderRadius: 16,
};

const tableHeadRowStyle: CSSProperties = {
  borderBottom: "1px solid var(--glass-border)",
  background: "rgba(242, 236, 223, 0.06)",
};

const tableBodyRowStyle: CSSProperties = {
  borderBottom: "1px solid rgba(242, 236, 223, 0.08)",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 11,
  fontWeight: 800,
  color: "var(--cream-dim)",
  letterSpacing: 0.9,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "13px 14px",
  verticalAlign: "top",
  color: "var(--cream-soft)",
};

function statusBadgeStyle(color: string): CSSProperties {
  return {
    display: "inline-block",
    padding: "4px 11px",
    borderRadius: 999,
    border: `1px solid ${color}55`,
    background: `${color}22`,
    color,
    fontSize: 12,
    fontWeight: 700,
  };
}
