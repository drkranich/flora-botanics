import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { ThemeEditor } from "./ThemeEditor";
import { SocialEditor } from "./SocialEditor";
import { LogoEditor } from "./LogoEditor";
import { FaviconEditor } from "./FaviconEditor";
import { DomainEditor, type DomainRow } from "./DomainEditor";
import { TeamEditor } from "./TeamEditor";
import type { SocialItem, LogoConfig } from "@/lib/config/actions";
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

  const [{ data: logoSetting }, { data: faviconSetting }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("tenant_id", tenantId).eq("key", "logo").maybeSingle(),
    supabase.from("site_settings").select("value").eq("tenant_id", tenantId).eq("key", "favicon").maybeSingle(),
  ]);

  const rawLogo = (logoSetting?.value ?? {}) as Partial<LogoConfig> & { filter?: string };
  const logoConfig: LogoConfig = {
    image: rawLogo.image ?? "",
    width: rawLogo.width ?? 160,
    height: rawLogo.height ?? 48,
    // Suporte ao campo legado "filter" — migrado para "color" transparentemente
    color: rawLogo.color ?? "",
  };

  const faviconUrl = ((faviconSetting?.value as { url?: string } | null)?.url ?? "") as string;

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
        <LogoEditor initial={logoConfig} tenantId={tenantId} />
      </section>

      {/* ---------- FAVICON ---------- */}
      <section className="glass rise rise-1" style={{ padding: 26, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Favicon</p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          Ícone exibido na aba do navegador e em favoritos. Use PNG ou SVG quadrado (512×512 px recomendado).
        </p>
        <FaviconEditor initial={faviconUrl} tenantId={tenantId} />
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
        <p className="eyebrow" style={{ marginBottom: 6 }}>Domínios</p>
        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          Conecte o domínio próprio da marca e escolha qual endereço aparece como principal.
        </p>
        <DomainEditor domains={(domains ?? []) as DomainRow[]} />
      </section>

      {/* ---------- DOCUMENTOS PDF ---------- */}
      <section className="glass rise rise-3" style={{ padding: 26, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <p className="eyebrow">Documentos PDF</p>
          <Link
            href="/config/pdf-styles"
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: "7px 14px", flexShrink: 0 }}
          >
            🎨 Editor completo de estilos →
          </Link>
        </div>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
          Todos os relatórios do sistema são gerados com fundo <strong>papel kraft</strong> e a logo Flora Botanics como <strong>marca d'água tileada quase transparente</strong>.
          As informações da empresa, cores, fontes, responsável e estilos por categoria de documento estão no{" "}
          <Link href="/config/pdf-styles" style={{ color: "var(--gold-light)" }}>editor completo de estilos</Link>.
          Etiquetas de envio e produto usam fundo branco para compatibilidade com impressoras térmicas.
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
