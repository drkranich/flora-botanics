import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Admin da Plataforma",
  tenant_owner: "Proprietário",
  tenant_admin: "Administrador",
  tenant_editor: "Editor",
};

export default async function AdminHome() {
  const session = await getStaffSession();
  if (!session) {
    // logado mas sem papel de staff → não pertence ao painel
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

  const modules = [
    { title: "CMS", desc: "Páginas, menus e mídia", href: "/cms", ready: false },
    { title: "Catálogo", desc: "Produtos, categorias e estoque", href: "/catalogo", ready: false },
    { title: "Vendas", desc: "Pedidos, clientes e cupons", href: "/vendas", ready: false },
    { title: "Configurações", desc: "Tema, domínios e equipe", href: "/config", ready: false },
  ];

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <div>
          <h1 style={{ fontWeight: 900, letterSpacing: -1, margin: 0 }}>
            {tenant?.name ?? "Flora"} · Admin
          </h1>
          <p style={{ fontSize: 12, color: "#5e584b", margin: "4px 0 0" }}>
            {session.email} — {ROLE_LABEL[session.role]}
          </p>
        </div>
        <LogoutButton />
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {modules.map((m) => (
          <div
            key={m.title}
            style={{
              background: "#fff8ea",
              border: "1px solid #e6ddcb",
              padding: 24,
              opacity: m.ready ? 1 : 0.6,
            }}
          >
            <h2 style={{ fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>
              {m.title}
            </h2>
            <p style={{ fontSize: 12, color: "#5e584b", margin: "8px 0 0" }}>{m.desc}</p>
            {!m.ready ? (
              <p style={{ fontSize: 10, color: "#b9924d", fontWeight: 700, margin: "12px 0 0" }}>
                EM BREVE
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
