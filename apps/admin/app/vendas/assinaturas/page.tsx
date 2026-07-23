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
  trialing: "Trial",
};

const STATUS_COLOR: Record<string, string> = {
  active: "#2d6a4f",
  paused: "#b5830a",
  cancelled: "#888",
  past_due: "#c0392b",
  trialing: "#1a6b8a",
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

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, margin: "28px 0" }}>
        {[
          { label: "Ativas", value: activeCount },
          { label: "MRR estimado", value: money(mrr) },
          { label: "Total", value: rows.length },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "var(--cream)", borderRadius: 10, padding: "20px 24px" }}>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{kpi.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 0" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)" }}>
          <p style={{ fontSize: 18 }}>Nenhuma assinatura registrada ainda.</p>
          <p style={{ fontSize: 14 }}>As assinaturas aparecerão aqui após a integração com Stripe.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--cream-dark)" }}>
                {["Cliente", "Plano", "Ciclo", "Desconto", "Valor", "Status", "Próx. cobrança"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((sub) => {
                const customer = Array.isArray(sub.customers) ? sub.customers[0] : sub.customers;
                return (
                  <tr key={sub.id} style={{ borderBottom: "1px solid var(--cream)" }}>
                    <td style={{ padding: "12px 12px" }}>
                      <div>{customer?.full_name ?? "—"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{customer?.email}</div>
                    </td>
                    <td style={{ padding: "12px 12px" }}>{sub.plan_name ?? "—"}</td>
                    <td style={{ padding: "12px 12px" }}>
                      {sub.interval_count > 1 ? `${sub.interval_count}× ` : ""}{sub.interval}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      {sub.discount_percent ? `${sub.discount_percent}%` : "—"}
                    </td>
                    <td style={{ padding: "12px 12px", fontWeight: 600 }}>
                      {sub.total_cents ? money(sub.total_cents) : "—"}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: `${STATUS_COLOR[sub.status] ?? "#888"}22`,
                        color: STATUS_COLOR[sub.status] ?? "#888",
                      }}>
                        {STATUS_LABEL[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px", fontSize: 13, color: "var(--muted)" }}>
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
