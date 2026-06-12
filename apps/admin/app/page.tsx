import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Admin da Plataforma",
  tenant_owner: "Proprietária",
  tenant_admin: "Administração",
  tenant_editor: "Edição",
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function AdminHome() {
  const session = await getStaffSession();
  if (!session) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const supabase = await supabaseServer();
  const t = session.tenantId;

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
  ] = await Promise.all([
    supabase.from("tenants").select("name, slug").eq("id", t).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", session.userId).maybeSingle(),
    supabase.from("pages").select("*", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "published"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "published").is("deleted_at", null),
    supabase.from("categories").select("*", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "published"),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", t),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("tenant_id", t),
    supabase.from("orders").select("total_cents, status").eq("tenant_id", t).in("status", ["paid", "processing", "shipped", "delivered"]),
    supabase.from("site_settings").select("value").eq("tenant_id", t).eq("key", "logo").maybeSingle(),
    supabase.from("site_settings").select("value").eq("tenant_id", t).eq("key", "social").maybeSingle(),
    supabase.from("audit_logs").select("action, entity_type, entity_id, created_at").eq("tenant_id", t).order("created_at", { ascending: false }).limit(5),
    supabase.from("page_versions").select("created_at, pages!inner(title)").eq("tenant_id", t).order("created_at", { ascending: false }).limit(3),
  ]);

  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())
  );
  const saudacao = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome =
    profile?.full_name?.trim().split(/\s+/)[0] ??
    session.email.split("@")[0].replace(/^./, (c) => c.toUpperCase());

  const revenue = (orders ?? []).reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const orderCount = (orders ?? []).length;
  const logoOk = Boolean((logoSetting?.value as { image?: string } | null)?.image);
  const socialOk = (((socialSetting?.value as { items?: Array<{ href?: string }> } | null)?.items) ?? []).some(
    (s) => s.href && s.href !== "#"
  );

  const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";

  const metrics = [
    { label: "Páginas no ar", value: String(pagesLive ?? 0), href: "/cms" },
    { label: "Produtos à venda", value: String(products ?? 0), href: "/catalogo" },
    { label: "Pedidos", value: String(orderCount), href: "/vendas" },
    { label: "Receita", value: money(revenue), href: "/vendas" },
    { label: "Leads", value: String(leads ?? 0), href: "/vendas/clientes" },
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

  const ACTION_LABEL: Record<string, string> = { "order.transition": "Pedido atualizado" };

  const modules = [
    { title: "CMS", desc: `${pagesLive ?? 0} páginas no ar`, href: "/cms", icon: "✺" },
    { title: "Catálogo", desc: `${products ?? 0} produtos · ${categories ?? 0} categorias`, href: "/catalogo", icon: "❖" },
    { title: "Vendas", desc: `${orderCount} pedidos · ${customers ?? 0} clientes`, href: "/vendas", icon: "◈" },
    { title: "Configurações", desc: logoOk ? "Marca configurada" : "Logo pendente", href: "/config", icon: "✦" },
  ];

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 28px 80px" }}>
      {/* ---------- header + ações rápidas ---------- */}
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

      {/* ---------- métricas ---------- */}
      <div className="rise rise-1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 26 }}>
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}>
            <div className="glass glass-hover" style={{ padding: "18px 20px" }}>
              <p className="display" style={{ fontSize: 30, color: "var(--gold-light)" }}>{m.value}</p>
              <p className="muted" style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>{m.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1.2fr) minmax(260px, 1fr)", gap: 18, marginBottom: 26 }}>
        {/* ---------- checklist ---------- */}
        <section className="glass rise rise-2" style={{ padding: 24 }}>
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

        {/* ---------- atividade recente ---------- */}
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
                  <p style={{ fontSize: 12.5 }}>Página “{page?.title}” editada</p>
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
                  {ACTION_LABEL[a.action] ?? a.action} {a.entity_id ? `#${a.entity_id}` : ""}
                </p>
                <p className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                  {new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* ---------- módulos ---------- */}
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
