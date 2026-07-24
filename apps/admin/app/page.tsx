import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { getStorefrontUrl } from "@/lib/storefront-url";
import { LogoutButton } from "./LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Admin da Plataforma",
  tenant_owner: "Proprietária",
  tenant_admin: "Administração",
  tenant_editor: "Edição",
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  processing: "Processando",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "rgba(185,146,77,0.22)",
  paid: "rgba(100,180,100,0.22)",
  processing: "rgba(100,140,220,0.22)",
  shipped: "rgba(140,100,220,0.22)",
  delivered: "rgba(60,180,120,0.22)",
  cancelled: "rgba(200,80,80,0.18)",
};

function computeSince(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    case "month": {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "year": {
      const d = new Date(now);
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    default:
      return new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  }
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const params = await searchParams;
  const period = params.period ?? "30d";
  const since = computeSince(period);

  const supabase = await supabaseServer();
  const t = session.tenantId;

  // Base order query builder
  let ordersQuery = supabase
    .from("orders")
    .select("total_cents, status, created_at")
    .eq("tenant_id", t);
  if (since) ordersQuery = ordersQuery.gte("created_at", since.toISOString());

  const [
    { data: tenant },
    { data: profile },
    { count: pagesLive },
    { count: products },
    { count: categories },
    { count: customers },
    { count: leads },
    { data: orders },
    { data: logoSetting },
    { data: socialSetting },
    { data: activity },
    { data: lastVersion },
    { count: abandonedCarts },
    { data: lowStockVariants },
  ] = await Promise.all([
    supabase.from("tenants").select("name, slug").eq("id", t).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", session.userId).maybeSingle(),
    supabase.from("pages").select("*", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "published"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "published").is("deleted_at", null),
    supabase.from("categories").select("*", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "published"),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", t),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("tenant_id", t),
    ordersQuery,
    supabase.from("site_settings").select("value").eq("tenant_id", t).eq("key", "logo").maybeSingle(),
    supabase.from("site_settings").select("value").eq("tenant_id", t).eq("key", "social").maybeSingle(),
    supabase.from("audit_logs").select("action, entity_type, entity_id, created_at").eq("tenant_id", t).order("created_at", { ascending: false }).limit(5),
    supabase.from("page_versions").select("created_at, pages!inner(title)").eq("tenant_id", t).order("created_at", { ascending: false }).limit(3),
    supabase
      .from("carts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", t)
      .eq("status", "abandoned"),
    supabase
      .from("product_variants")
      .select("id, sku, name, inventory(quantity, reserved), products!inner(name, slug)")
      .eq("tenant_id", t)
      .limit(200),
  ]);

  // Process orders
  const allOrders = orders ?? [];
  const paidOrders = allOrders.filter((o) => ["paid", "processing", "shipped", "delivered"].includes(o.status));
  const revenue = paidOrders.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const orderCount = paidOrders.length;
  const ticketMedio = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

  // Orders by status
  const ordersByStatus: Record<string, number> = {};
  for (const o of allOrders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
  }
  const statusOrder = ["paid", "processing", "shipped", "delivered", "pending", "cancelled"];

  // Critical stock (quantity - reserved <= 3)
  type LowVariant = {
    id: string;
    sku: string;
    name: string | null;
    inventory: { quantity: number; reserved: number | null } | { quantity: number; reserved: number | null }[] | null;
    products: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };
  const criticalStock = ((lowStockVariants ?? []) as unknown as LowVariant[]).filter((v) => {
    const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
    if (!inv) return false;
    const available = (inv.quantity ?? 0) - (inv.reserved ?? 0);
    return available <= 3 && available >= 0;
  }).slice(0, 8);

  // Misc
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())
  );
  const saudacao = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome =
    profile?.full_name?.trim().split(/\s+/)[0] ??
    session.email.split("@")[0].replace(/^./, (c) => c.toUpperCase());

  const logoOk = Boolean((logoSetting?.value as { image?: string } | null)?.image);
  const socialOk = (((socialSetting?.value as { items?: Array<{ href?: string }> } | null)?.items) ?? []).some(
    (s) => s.href && s.href !== "#"
  );

  const storefrontUrl = getStorefrontUrl();

  const PERIODS = [
    { key: "today", label: "Hoje" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "month", label: "Mês" },
    { key: "year", label: "Ano" },
  ];

  const checklist = [
    { done: (pagesLive ?? 0) > 0, label: "Publicar a primeira página", href: "/cms" },
    { done: (categories ?? 0) > 0, label: "Criar categorias", href: "/catalogo/categorias" },
    { done: (products ?? 0) > 0, label: "Cadastrar o primeiro produto", href: "/catalogo" },
    { done: logoOk, label: "Definir o logo da marca", href: "/config" },
    { done: socialOk, label: "Conectar redes sociais", href: "/config" },
    { done: (leads ?? 0) > 0, label: "Captar o primeiro lead", href: "/vendas/clientes" },
    { done: orderCount > 0, label: "Receber o primeiro pedido", href: "/vendas" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  const modules = [
    { title: "CMS", desc: `${pagesLive ?? 0} páginas no ar`, href: "/cms", icon: "✺" },
    { title: "Catálogo", desc: `${products ?? 0} produtos · ${categories ?? 0} categorias`, href: "/catalogo", icon: "❖" },
    { title: "Vendas", desc: `${orderCount} pedidos · ${customers ?? 0} clientes`, href: "/vendas", icon: "◈" },
    { title: "Configurações", desc: logoOk ? "Marca configurada" : "Logo pendente", href: "/config", icon: "✦" },
  ];

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 28px 80px" }}>
      {/* ── header ── */}
      <header className="rise" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18, marginBottom: 30 }}>
        <div>
          <p className="eyebrow">{tenant?.name ?? "Flora Ecosystem"}</p>
          <h1 className="display" style={{ fontSize: 42, marginTop: 6 }}>
            {saudacao}, <em style={{ color: "var(--gold-light)", fontStyle: "italic" }}>{primeiroNome}</em>
          </h1>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {session.email} · {ROLE_LABEL[session.role]}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: "10px 20px" }}>
            Ver site ↗
          </a>
          <Link href="/cms" className="btn btn-gold" style={{ padding: "10px 22px" }}>
            Editar o site
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* ── métricas principais ── */}
      <div className="rise rise-1" style={{ marginBottom: 18 }}>
        {/* cabeçalho da seção: label + filtros de período */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <p className="eyebrow" style={{ fontSize: 10, letterSpacing: 2 }}>Análise de vendas</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`?period=${p.key}`}
                style={{
                  padding: "5px 12px",
                  border: "1px solid",
                  borderColor: period === p.key ? "var(--gold-light)" : "var(--glass-border)",
                  background: period === p.key ? "rgba(218,183,116,0.16)" : "rgba(242,236,223,0.04)",
                  color: period === p.key ? "var(--gold-light)" : "var(--cream-dim)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  borderRadius: 5,
                  transition: "all 0.18s ease",
                }}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        {/* cards de métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 14 }}>
        <Link href="/vendas">
          <div className="glass glass-hover" style={{ padding: "18px 20px", minHeight: 82 }}>
            <p className="display" style={{ fontSize: 28, color: "var(--gold-light)" }}>{money(revenue)}</p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Receita</p>
          </div>
        </Link>
        <Link href="/vendas">
          <div className="glass glass-hover" style={{ padding: "18px 20px", minHeight: 82 }}>
            <p className="display" style={{ fontSize: 28, color: "var(--gold-light)" }}>{orderCount}</p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Pedidos pagos</p>
          </div>
        </Link>
        <Link href="/vendas">
          <div className="glass glass-hover" style={{ padding: "18px 20px", minHeight: 82 }}>
            <p className="display" style={{ fontSize: 28, color: "var(--gold-light)" }}>{money(ticketMedio)}</p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Ticket médio</p>
          </div>
        </Link>
        <Link href="/vendas/clientes">
          <div className="glass glass-hover" style={{ padding: "18px 20px", minHeight: 82 }}>
            <p className="display" style={{ fontSize: 28, color: "var(--gold-light)" }}>{String(customers ?? 0)}</p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Clientes</p>
          </div>
        </Link>
        <Link href="/vendas/clientes">
          <div className="glass glass-hover" style={{ padding: "18px 20px", minHeight: 82 }}>
            <p className="display" style={{ fontSize: 28, color: "var(--gold-light)" }}>{String(leads ?? 0)}</p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Leads</p>
          </div>
        </Link>
        <Link href="/vendas/carrinhos">
          <div className="glass glass-hover" style={{ padding: "18px 20px", minHeight: 82 }}>
            <p className="display" style={{ fontSize: 28, color: abandonedCarts ? "rgba(232,160,80,0.9)" : "var(--gold-light)" }}>{String(abandonedCarts ?? 0)}</p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Abandonados</p>
          </div>
        </Link>
        </div>{/* fim grid cards */}
      </div>{/* fim seção métricas */}

      {/* ── pedidos por status + estoque crítico ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(240px, 0.85fr)", gap: 18, marginBottom: 22 }}>
        {/* pedidos por status */}
        <section className="glass rise rise-2" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Pedidos por status</p>
          {allOrders.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>Nenhum pedido no período.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {statusOrder.filter((s) => ordersByStatus[s]).map((status) => {
                const count = ordersByStatus[status] ?? 0;
                const pct = Math.round((count / allOrders.length) * 100);
                return (
                  <div key={status}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-soft)", letterSpacing: 0.6 }}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 800 }}>
                        {count}
                        <span className="muted" style={{ fontWeight: 500, marginLeft: 4 }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 4, background: "rgba(242,236,223,0.08)", borderRadius: 99 }}>
                      <div style={{
                        height: 4, borderRadius: 99, width: `${pct}%`,
                        background: STATUS_COLOR[status] ?? "rgba(185,146,77,0.3)",
                        transition: "width 0.5s ease",
                        border: "1px solid rgba(242,236,223,0.15)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* estoque crítico */}
        <section className="glass rise rise-2" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p className="eyebrow">Estoque crítico</p>
            {criticalStock.length > 0 ? (
              <span style={{ padding: "3px 8px", border: "1px solid rgba(232,120,80,0.4)", background: "rgba(232,120,80,0.12)", borderRadius: 4, color: "#e87850", fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
                {criticalStock.length} itens
              </span>
            ) : null}
          </div>
          {criticalStock.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>✓ Nenhum produto em estoque crítico.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {criticalStock.map((v) => {
                const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
                const available = (inv?.quantity ?? 0) - (inv?.reserved ?? 0);
                const prod = Array.isArray(v.products) ? v.products[0] : v.products;
                return (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--glass-border)" }}>
                    <div>
                      <p style={{ fontSize: 12, color: "var(--cream-soft)" }}>{prod?.name ?? v.name ?? v.sku}</p>
                      <p className="muted" style={{ fontSize: 10 }}>{v.sku}</p>
                    </div>
                    <span style={{
                      flexShrink: 0,
                      padding: "2px 8px",
                      border: `1px solid ${available === 0 ? "rgba(200,80,80,0.4)" : "rgba(232,180,80,0.4)"}`,
                      background: available === 0 ? "rgba(200,80,80,0.12)" : "rgba(232,180,80,0.10)",
                      color: available === 0 ? "#e88080" : "#e8c050",
                      fontSize: 11,
                      fontWeight: 900,
                      borderRadius: 4,
                      alignSelf: "center",
                    }}>
                      {available === 0 ? "Esgotado" : `${available} un.`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── checklist + atividade ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1.2fr) minmax(260px, 1fr)", gap: 18, marginBottom: 26 }}>
        <section className="glass rise rise-3" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p className="eyebrow">Preparando a loja</p>
            <span className="chip chip-draft">{doneCount}/{checklist.length}</span>
          </div>
          <div style={{ height: 5, borderRadius: 99, background: "rgba(242,236,223,0.1)", marginBottom: 16 }}>
            <div style={{ height: 5, borderRadius: 99, width: `${(doneCount / checklist.length) * 100}%`, background: "linear-gradient(90deg, var(--gold-light), var(--gold))", transition: "width 0.6s var(--ease)" }} />
          </div>
          {checklist.map((c) => (
            <Link key={c.label} href={c.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--glass-border)" }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, flexShrink: 0,
                background: c.done ? "rgba(140,200,130,0.2)" : "rgba(242,236,223,0.07)",
                color: c.done ? "#8fd486" : "var(--cream-dim)",
                border: c.done ? "1px solid rgba(140,200,130,0.4)" : "1px solid var(--glass-border)",
              }}>
                {c.done ? "✓" : ""}
              </span>
              <span style={{ fontSize: 12.5, color: c.done ? "var(--cream-dim)" : "var(--cream-soft)", textDecoration: c.done ? "line-through" : "none" }}>
                {c.label}
              </span>
            </Link>
          ))}
        </section>

        <section className="glass rise rise-3" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Atividade recente</p>
          {(activity ?? []).length === 0 && (lastVersion ?? []).length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>As ações da equipe aparecem aqui.</p>
          ) : null}
          {(lastVersion ?? []).map((v, i) => {
            const page = v.pages as unknown as { title: string };
            return (
              <div key={`v${i}`} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--glass-border)" }}>
                <span style={{ color: "var(--gold-light)", fontSize: 13 }}>✎</span>
                <div>
                  <p style={{ fontSize: 12.5 }}>Página "{page?.title}" editada</p>
                  <p className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                    {new Date(v.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                </div>
              </div>
            );
          })}
          {(activity ?? []).map((a, i) => (
            <div key={`a${i}`} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--glass-border)" }}>
              <span style={{ color: "var(--gold-light)", fontSize: 13 }}>◈</span>
              <div>
                <p style={{ fontSize: 12.5 }}>
                  {a.action} {a.entity_id ? `#${a.entity_id}` : ""}
                </p>
                <p className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                  {new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* ── módulos ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {modules.map((m, i) => (
          <Link key={m.title} href={m.href}>
            <div className={`glass glass-hover rise rise-${Math.min(i + 1, 4)}`} style={{ padding: "24px 22px", height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 20, color: "var(--gold-light)" }}>{m.icon}</span>
              <h2 style={{ fontSize: 14, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 700 }}>{m.title}</h2>
              <p style={{ fontSize: 12, color: "var(--cream-soft)" }}>{m.desc}</p>
              <span className="eyebrow" style={{ marginTop: "auto", fontSize: 9 }}>Abrir →</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
