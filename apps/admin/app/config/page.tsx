import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { ThemeEditor } from "./ThemeEditor";
import { SocialEditor } from "./SocialEditor";
import { LogoEditor } from "./LogoEditor";
import { TeamEditor } from "./TeamEditor";
import type { SocialItem } from "@/lib/config/actions";
import type { TeamMember, PendingInvite } from "@/lib/config/team-actions";

export default async function ConfigPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  // Editores não acessam Configurações
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: theme }, { data: domains }, { data: team }, { data: invites }, { data: socialSetting }] =
    await Promise.all([
      supabase.from("tenant_themes").select("tokens").eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("tenant_domains").select("domain, is_primary, verified_at").eq("tenant_id", tenantId),
      supabase.rpc("team_list", { t: tenantId }),
      supabase
        .from("tenant_invites")
        .select("id, email, role, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .order("created_at"),
      supabase
        .from("site_settings")
        .select("value")
        .eq("tenant_id", tenantId)
        .eq("key", "social")
        .maybeSingle(),
    ]);

  const { data: logoSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "logo")
    .maybeSingle();
  const logoImage =
    ((logoSetting?.value as { image?: string } | null)?.image ?? "") as string;

  const colors =
    ((theme?.tokens as Record<string, unknown> | null)?.colors as Record<string, string>) ?? {};
  const socials =
    ((socialSetting?.value as { items?: SocialItem[] } | null)?.items ?? []) as SocialItem[];

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 32 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Configurações</h1>
      </header>

      {/* ---------- LOGO ---------- */}
      <section className="glass rise rise-1" style={{ padding: 26, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Logo da marca</p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          Aparece no topo e no rodapé do site.
        </p>
        <LogoEditor initial={logoImage} tenantId={tenantId} />
      </section>

      {/* ---------- TEMA ---------- */}
      <section className="glass rise rise-1" style={{ padding: 26, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Tema da marca</p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          Estas cores alimentam o site ao vivo (CSS variables injetadas pelo tenant).
          Alterações valem para todo o site após salvar.
        </p>
        <ThemeEditor initial={colors} />
      </section>

      {/* ---------- REDES SOCIAIS ---------- */}
      <section className="glass rise rise-2" style={{ padding: 26, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Redes sociais do rodapé</p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          Cada botão tem nome, ícone (imagem da biblioteca ou URL) e link.
          Botões sem link ficam ocultos no site.
        </p>
        <SocialEditor initial={socials} tenantId={tenantId} />
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
        <p className="eyebrow" style={{ marginBottom: 6 }}>Equipe</p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
          Administradores têm acesso total à marca; Editores cuidam só de Site e
          Catálogo. O convite vale no primeiro acesso da pessoa com o e-mail
          convidado — em "Primeiro acesso" na tela de login do painel.
        </p>
        <TeamEditor
          members={(team ?? []) as TeamMember[]}
          invites={(invites ?? []) as PendingInvite[]}
          myId={session.userId}
          canManage // editores nunca chegam aqui (redirect no topo)
        />
      </section>
    </main>
  );
}
