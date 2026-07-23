import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(val: number | null | undefined, fallback = "—") {
  return val != null ? `${Number(val).toFixed(1)}%` : fallback;
}

export default async function CustosPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/catalogo");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: products } = await supabase
    .from("products")
    .select(`
      id, name, slug, type, cost_cents, cost_breakdown, margin_percent,
      weight_g, width_cm, height_cm, depth_cm,
      product_variants(price_cents, is_default)
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("name");

  const rows = (products ?? []).map((p) => {
    const variants = (Array.isArray(p.product_variants) ? p.product_variants : [p.product_variants])
      .filter(Boolean) as Array<{ price_cents: number; is_default: boolean }>;
    const price = (variants.find((v) => v.is_default) ?? variants[0])?.price_cents ?? 0;
    const cost = p.cost_cents ?? 0;
    const margin = price > 0 ? ((price - cost) / price) * 100 : null;
    return { ...p, price, cost, margin };
  });

  const avgMargin = rows.filter((r) => r.margin != null).reduce((sum, r) => sum + (r.margin ?? 0), 0)
    / (rows.filter((r) => r.margin != null).length || 1);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/catalogo" className="eyebrow" style={{ opacity: 0.8 }}>← Catálogo</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Custos & Margem</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          Custo de produção, preço de venda e margem bruta estimada por produto.
        </p>
      </header>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Produtos analisados", value: rows.length },
          { label: "Margem média", value: pct(avgMargin) },
          { label: "Produtos sem custo", value: rows.filter((r) => !r.cost).length },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "var(--cream)", borderRadius: 10, padding: "18px 20px" }}>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{kpi.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 0" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--cream-dark)" }}>
              {["Produto", "Preço venda", "Custo total", "Margem bruta", "Peso", "Dimensões (cm)", "Detalhamento"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const breakdown = p.cost_breakdown as Record<string, number> | null;
              const hasBreakdown = breakdown && Object.keys(breakdown).length > 0;
              const marginColor = (p.margin ?? 0) >= 50 ? "#2d6a4f" : (p.margin ?? 0) >= 30 ? "#b5830a" : "#c0392b";
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--cream)" }}>
                  <td style={{ padding: "12px 12px" }}>
                    <Link href={`/catalogo/${p.slug}`} style={{ fontWeight: 600 }}>{p.name}</Link>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>{p.type}</div>
                  </td>
                  <td style={{ padding: "12px 12px", fontWeight: 600 }}>{money(p.price)}</td>
                  <td style={{ padding: "12px 12px" }}>
                    {p.cost > 0 ? money(p.cost) : <span style={{ color: "var(--muted)" }}>Não informado</span>}
                  </td>
                  <td style={{ padding: "12px 12px", fontWeight: 700, color: p.margin != null ? marginColor : "var(--muted)" }}>
                    {p.margin != null ? pct(p.margin) : "—"}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    {p.weight_g > 0 ? `${p.weight_g} g` : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 12px", fontSize: 13 }}>
                    {(p.width_cm > 0 || p.height_cm > 0 || p.depth_cm > 0)
                      ? `${p.width_cm}×${p.height_cm}×${p.depth_cm}`
                      : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    {hasBreakdown ? (
                      <details style={{ fontSize: 12 }}>
                        <summary style={{ cursor: "pointer", color: "var(--muted)" }}>Ver breakdown</summary>
                        <div style={{ paddingTop: 6, display: "grid", gap: 2 }}>
                          {Object.entries(breakdown!).map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                              <span>{money(v)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
