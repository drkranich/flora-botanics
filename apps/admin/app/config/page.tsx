import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { ThemeEditor } from "./ThemeEditor";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Admin da Plataforma",
  tenant_owner: "Proprietário",
  tenant_admin: "Administrador",
  tenant_editor: "Editor",
  customer: "Cliente",
};

export default async function ConfigPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: theme }, { data: domains }, { data: team }] = await Promise.all([
    supabase.from("tenant_themes").select("tokens").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("tenant_domains").select("domain, is_primary, verified_at").eq("tenant_id", tenantId),
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("tenant_id", tenantId)
      .neq("role", "customer"),
  ]);

  const colors =
    ((theme?.tokens as Record<string, unknown> | null)?.colors as Record<string, string>) ?? {};

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 32 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Configurações</h1>
      </header>

      {/* ---------- TEMA ---------- */}
      <section className="glass rise rise-1" style={{ padding: 26, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Tema da marca</p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          Estas cores alimentam o site ao vivo (CSS variables injetadas pelo tenant).
          Alterações valem para todo o site após salvar.
        </p>
        <ThemeEditor initial={colors} />
      </section>

      {/* ---------- DOMÍNIOS ---------- */}
      <section className="glass rise rise-2" style={{ padding: 26, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Domínios</p>
        {(domains ?? []).map((d) => (
          <div key={d.domain} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--glass-border)" }}>
            <span style={{ fontSize: 13.5 }}>{d.domain}</span>
            <span style={{ display: "flex", gap: 8 }}>
              {d.is_primary ? <span className="chip chip-live">Primário</span> : null}
              {d.verified_at ? <span className="chip chip-live">Verificado</span> : <span className="chip chip-draft">Pendente</span>}
            </span>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 14 }}>
          Adição de domínio próprio (ex.: florabotanics.com.br) será habilitada na
          etapa de deploy na Cloudflare — DNS e certificado são configurados lá.
        </p>
      </section>

      {/* ---------- EQUIPE ---------- */}
      <section className="glass rise rise-3" style={{ padding: 26 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Equipe</p>
        {(team ?? []).map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--glass-border)" }}>
            <span style={{ fontSize: 13.5 }}>{m.full_name ?? m.id.slice(0, 8)}</span>
            <span className="chip chip-draft">{ROLE_LABEL[m.role] ?? m.role}</span>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 14 }}>
          Convidar novos membros por e-mail exige envio seguro pelo servidor —
          entra junto com as Edge Functions (etapa do deploy). Por enquanto,
          usuários são criados no dashboard do Supabase e promovidos via Cowork.
        </p>
      </section>
    </main>
  );
}
