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
  draft: "#888",
  active: "#2d6a4f",
  paused: "#b5830a",
  ended: "#aaa",
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
        <Link href="/vendas/campanhas/nova" className="btn" style={{ fontSize: 14 }}>
          + Nova campanha
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Ativas", value: active },
          { label: "Total campanhas", value: rows.length },
          { label: "Receita total", value: money(totalRevenue) },
          { label: "Total pedidos", value: rows.reduce((s, c) => s + (c.orders ?? 0), 0) },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "var(--cream)", borderRadius: 10, padding: "18px 20px" }}>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{kpi.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)" }}>
          <p style={{ fontSize: 18 }}>Nenhuma campanha criada ainda.</p>
          <p style={{ fontSize: 14 }}>Use campanhas para segmentar por cidade, canal e público.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--cream-dark)" }}>
                {["Campanha", "Cidades", "Canal", "Período", "Views", "Cliques", "Conv.", "Receita", "Status"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--cream)" }}>
                  <td style={{ padding: "12px 12px" }}>
                    <Link href={`/vendas/campanhas/${c.id}`} style={{ fontWeight: 600 }}>{c.title}</Link>
                    {c.subtitle && <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.subtitle}</div>}
                  </td>
                  <td style={{ padding: "12px 12px", fontSize: 12, color: "var(--muted)" }}>
                    {(c.target_cities ?? []).slice(0, 2).join(", ")}
                    {(c.target_cities ?? []).length > 2 && ` +${(c.target_cities ?? []).length - 2}`}
                  </td>
                  <td style={{ padding: "12px 12px" }}>{c.channel ?? "—"}</td>
                  <td style={{ padding: "12px 12px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {c.starts_at ? new Date(c.starts_at).toLocaleDateString("pt-BR") : "—"}
                    {" → "}
                    {c.ends_at ? new Date(c.ends_at).toLocaleDateString("pt-BR") : "∞"}
                  </td>
                  <td style={{ padding: "12px 12px" }}>{(c.views ?? 0).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "12px 12px" }}>{(c.clicks ?? 0).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "12px 12px" }}>{pct(c.orders ?? 0, c.clicks ?? 0)}</td>
                  <td style={{ padding: "12px 12px", fontWeight: 600 }}>{money(c.revenue_cents ?? 0)}</td>
                  <td style={{ padding: "12px 12px" }}>
                    <span style={{
                      display: "inline-block", padding: "3px 10px", borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      background: `${STATUS_COLOR[c.status]}22`,
                      color: STATUS_COLOR[c.status],
                    }}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
