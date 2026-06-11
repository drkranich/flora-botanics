import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Admin da Plataforma",
  tenant_owner: "Proprietário",
  tenant_admin: "Administrador",
  tenant_editor: "Editor",
};

const MODULES = [
  {
    title: "CMS",
    desc: "Páginas, menus e mídia do site",
    href: "/cms",
    ready: true,
    icon: "✺",
  },
  {
    title: "Catálogo",
    desc: "Categorias (produtos em breve)",
    href: "/catalogo",
    ready: true,
    icon: "❖",
  },
  {
    title: "Vendas",
    desc: "Pedidos, clientes e cupons",
    href: "/vendas",
    ready: false,
    icon: "◈",
  },
  {
    title: "Configurações",
    desc: "Tema, domínios e equipe",
    href: "/config",
    ready: false,
    icon: "✦",
  },
];

export default async function AdminHome() {
  const session = await getStaffSession();
  if (!session) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const supabase = await supabaseServer();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, slug")
    .eq("id", session.tenantId)
    .maybeSingle();

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header
        className="rise"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 20,
          marginBottom: 44,
        }}
      >
        <div>
          <p className="eyebrow">{tenant?.name ?? "Flora Ecosystem"}</p>
          <h1 className="display" style={{ fontSize: 46, marginTop: 6 }}>
            Bom trabalho,{" "}
            <em style={{ color: "var(--gold-light)", fontStyle: "italic" }}>
              {ROLE_LABEL[session.role]}
            </em>
          </h1>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{session.email}</p>
        </div>
        <LogoutButton />
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: 18,
        }}
      >
        {MODULES.map((m, i) => {
          const card = (
            <div
              className={`glass ${m.ready ? "glass-hover" : ""} rise rise-${i + 1}`}
              style={{
                padding: "28px 26px",
                height: "100%",
                opacity: m.ready ? 1 : 0.55,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 22, color: "var(--gold-light)" }}>{m.icon}</span>
              <h2 style={{ fontSize: 15, letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 700 }}>
                {m.title}
              </h2>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{m.desc}</p>
              <span
                className="eyebrow"
                style={{ marginTop: "auto", fontSize: 9, color: m.ready ? "var(--gold-light)" : "var(--cream-dim)" }}
              >
                {m.ready ? "Abrir →" : "Em breve"}
              </span>
            </div>
          );
          return m.ready ? (
            <Link key={m.title} href={m.href}>{card}</Link>
          ) : (
            <div key={m.title}>{card}</div>
          );
        })}
      </div>
    </main>
  );
}
