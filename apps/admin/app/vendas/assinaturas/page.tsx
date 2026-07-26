import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { SalesTabs } from "../Tabs";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  paused: "Pausada",
  cancelled: "Cancelada",
  past_due: "Em atraso",
  trialing: "Teste",
};

const STATUS_COLOR: Record<string, string> = {
  active: "#8fd486",
  paused: "var(--gold-light)",
  cancelled: "var(--cream-dim)",
  past_due: "#e8a0a0",
  trialing: "#9ed8f0",
};

export default async function AssinaturasPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select(`
      id, status, plan_name, interval, interval_count,
      discount_percent, total_cents,
      next_billing_at, next_shipping_at,
      created_at, cancelled_at, paused_at,
      customers(full_name, email)
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = subscriptions ?? [];
  const activeCount = rows.filter((s) => s.status === "active").length;
  const mrr = rows.filter((s) => s.status === "active").reduce((sum, s) => sum + (s.total_cents ?? 0), 0);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Assinaturas</h1>
      </header>

      <SalesTabs />

      <div className="rise" style={kpiGridStyle}>
        {[
          { label: "Ativas", value: activeCount },
          { label: "MRR estimado", value: money(mrr) },
          { label: "Total", value: rows.length },
        ].map((kpi) => (
          <div key={kpi.label} className="glass" style={kpiCardStyle}>
            <p className="muted" style={kpiLabelStyle}>{kpi.label}</p>
            <p className="display" style={kpiValueStyle}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="glass rise" style={emptyStateStyle}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Nenhuma assinatura registrada ainda.</p>
          <p className="muted" style={{ fontSize: 13 }}>As assinaturas aparecerão aqui após a integração com Stripe.</p>
        </div>
      ) : (
        <div className="glass rise" style={tableShellStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={tableHeadRowStyle}>
                {["Cliente", "Plano", "Ciclo", "Desconto", "Valor", "Status", "Próx. cobrança"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((sub) => {
                const customer = Array.isArray(sub.customers) ? sub.customers[0] : sub.customers;
                const statusColor = STATUS_COLOR[sub.status] ?? "var(--cream-dim)";
                return (
                  <tr key={sub.id} style={tableBodyRowStyle}>
                    <td style={tdStyle}>
                      <div>{customer?.full_name ?? "—"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{customer?.email}</div>
                    </td>
                    <td style={tdStyle}>{sub.plan_name ?? "—"}</td>
                    <td style={tdStyle}>
                      {sub.interval_count > 1 ? `${sub.interval_count}x ` : ""}{sub.interval ?? "—"}
                    </td>
                    <td style={tdStyle}>{sub.discount_percent ? `${sub.discount_percent}%` : "—"}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "var(--gold-light)" }}>
                      {sub.total_cents ? money(sub.total_cents) : "—"}
                    </td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(statusColor)}>
                        {STATUS_LABEL[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="muted" style={{ ...tdStyle, fontSize: 13 }}>
                      {sub.next_billing_at
                        ? new Date(sub.next_billing_at).toLocaleDateString("pt-BR")
                        : "—"}
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
  gap: 16,
  margin: "28px 0",
};

const kpiCardStyle: CSSProperties = {
  minHeight: 102,
  padding: "18px 22px",
};

const kpiLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.2,
  margin: 0,
  textTransform: "uppercase",
};

const kpiValueStyle: CSSProperties = {
  fontSize: 28,
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
