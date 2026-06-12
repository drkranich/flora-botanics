import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { OperateButton, NewTenantForm } from "./TenantActions";

/**
 * PLATAFORMA — painel do superadmin (platform_admin).
 * Visão acima dos tenants: todas as marcas, métricas e criação de novas.
 * É o embrião do modelo white label do blueprint (fase 5).
 */
export default async function PlataformaPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role !== "platform_admin") redirect("/");

  const supabase = await supabaseServer();
  const jar = await cookies();
  const activeTenant = jar.get("fl_tenant")?.value;

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, status, plan, created_at, tenant_domains(domain, is_primary)")
    .order("created_at");

  // métricas por tenant (plataforma pequena: consultas diretas)
  const rows = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const [{ count: pages }, { count: products }, { data: orders }] = await Promise.all([
        supabase.from("pages").select("*", { count: "exact", head: true }).eq("tenant_id", t.id).eq("status", "published"),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("tenant_id", t.id).is("deleted_at", null),
        supabase.from("orders").select("total_cents, status").eq("tenant_id", t.id).in("status", ["paid", "processing", "shipped", "delivered"]),
      ]);
      const domains = (t.tenant_domains ?? []) as Array<{ domain: string; is_primary: boolean }>;
      return {
        ...t,
        domain: domains.find((d) => d.is_primary)?.domain ?? domains[0]?.domain ?? "—",
        pages: pages ?? 0,
        products: products ?? 0,
        orders: (orders ?? []).length,
        revenue: (orders ?? []).reduce((s, o) => s + (o.total_cents ?? 0), 0),
      };
    })
  );

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <p className="eyebrow">Flora Ecosystem · Plataforma</p>
          <h1 className="display" style={{ fontSize: 44, marginTop: 6 }}>Marcas</h1>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            Visão do superadmin: todas as marcas que rodam sobre o mesmo núcleo.
          </p>
        </div>
        <NewTenantForm />
      </header>

      <div className="rise rise-1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Marcas ativas", value: String(rows.filter((r) => r.status === "active").length) },
          { label: "Receita da plataforma", value: money(totalRevenue) },
          { label: "Produtos no ecossistema", value: String(rows.reduce((s, r) => s + r.products, 0)) },
          { label: "Pedidos no ecossistema", value: String(rows.reduce((s, r) => s + r.orders, 0)) },
        ].map((m) => (
          <div key={m.label} className="glass" style={{ padding: "16px 20px" }}>
            <p className="display" style={{ fontSize: 26, color: "var(--gold-light)" }}>{m.value}</p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>{m.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((t, i) => (
          <div key={t.id} className={`glass rise rise-${Math.min(i + 1, 4)}`} style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: 16 }}>{t.name}</strong>
                <span className={`chip ${t.status === "active" ? "chip-live" : "chip-draft"}`}>
                  {t.status === "active" ? "Ativa" : "Suspensa"}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                {t.domain} · plano {t.plan} · desde {new Date(t.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
              {[
                { v: t.pages, l: "páginas" },
                { v: t.products, l: "produtos" },
                { v: t.orders, l: "pedidos" },
                { v: money(t.revenue), l: "receita" },
              ].map((m) => (
                <div key={m.l} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--gold-light)" }}>{m.v}</p>
                  <p className="muted" style={{ fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase" }}>{m.l}</p>
                </div>
              ))}
              <OperateButton tenantId={t.id} active={activeTenant === t.id || (rows.length === 1 && !activeTenant)} />
            </div>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 11.5, marginTop: 22, lineHeight: 1.7 }}>
        “Operar” define qual marca os módulos (Site, Catálogo, Vendas…) administram.
        Onboarding self-service, planos pagos e domínios automáticos chegam na fase
        white label do blueprint.
      </p>

      <Link href="/" className="btn btn-ghost" style={{ padding: "10px 20px", marginTop: 18 }}>
        ← Voltar ao painel
      </Link>
    </main>
  );
}
