import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import {
  saveSeoMeta,
  saveSeoRedirect,
  deleteSeoRedirect,
  saveRobotsRule,
  deleteRobotsRule,
  saveSitemapConfig,
  runSeoAudit,
  runSeoAuditBulk,
  runAiVisibilityScore,
  runAiVisibilityScoreBulk,
  generateSeoWithAI,
  saveBlogArticle,
  deleteBlogArticle,
  saveBlogCategory,
  type EntityType,
  type SeoMeta,
} from "./actions";
import { SeoMetaEditor } from "@/components/SeoMetaEditor";
import { RedirectCodeSelect, RobotsDirectiveSelect, SitemapPrioritySelect, SitemapFreqSelect } from "./SeoFormSelects";

// ── Design tokens inline (espelham globals.css) ────────────────────────────────
type Sx = CSSProperties;

const T = {
  glass:       "var(--glass-bg)",
  glassBorder: "var(--glass-border)",
  glassBorderHover: "var(--glass-border-hover)",
  cream:       "var(--cream)",
  creamSoft:   "var(--cream-soft)",
  creamDim:    "var(--cream-dim)",
  gold:        "var(--gold)",
  goldLight:   "var(--gold-light)",
  goldDark:    "var(--gold-dark)",
  forest950:   "var(--forest-950)",
  forest900:   "var(--forest-900)",
  forest800:   "var(--forest-800)",
  radiusLg:    "var(--radius-lg)",
  radiusMd:    "var(--radius-md)",
  radiusSm:    "var(--radius-sm)",
  shadowSoft:  "var(--shadow-soft)",
} as const;

// ── Primitivos UI ──────────────────────────────────────────────────────────────

function GlassCard({ children, style }: { children: ReactNode; style?: Sx }) {
  return (
    <div style={{
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
      borderRadius: "var(--radius-md)",
      backdropFilter: "blur(18px) saturate(1.25)",
      WebkitBackdropFilter: "blur(18px) saturate(1.25)",
      boxShadow: "var(--shadow-soft)",
      padding: "20px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionWrap({ children, style }: { children: ReactNode; style?: Sx }) {
  return <div style={{ marginBottom: 32, ...style }}>{children}</div>;
}

function Row({ children, style }: { children: ReactNode; style?: Sx }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>{children}</div>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      fontSize: 20,
      fontWeight: 700,
      color: "var(--cream)",
      letterSpacing: -0.3,
      marginBottom: 20,
    }}>
      {children}
    </h2>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: "block",
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: "1.8px",
      textTransform: "uppercase" as const,
      color: "var(--cream-dim)",
      marginBottom: 6,
    }}>
      {children}
    </span>
  );
}

/** Badge de score 0-100 */
function ScoreBadge({ score }: { score: number }) {
  const [bg, color] =
    score >= 80
      ? ["rgba(34,197,94,0.18)", "rgba(134,239,172,1)"]
      : score >= 50
      ? ["rgba(234,179,8,0.18)", "rgba(253,224,71,1)"]
      : ["rgba(239,68,68,0.18)", "rgba(252,165,165,1)"];
  return (
    <span style={{
      background: bg,
      color,
      border: `1px solid ${color}40`,
      borderRadius: 999,
      padding: "2px 10px",
      fontSize: 11,
      fontWeight: 800,
      fontVariantNumeric: "tabular-nums",
    }}>
      {score}
    </span>
  );
}

/** Chip de status (publicado/rascunho/arquivado/ativo/pendente) */
function StatusChip({ label, variant }: { label: string; variant: "green" | "yellow" | "red" | "ghost" }) {
  const map: Record<typeof variant, { bg: string; color: string; border: string }> = {
    green:  { bg: "rgba(34,197,94,0.14)",  color: "rgba(134,239,172,1)", border: "rgba(134,239,172,0.3)" },
    yellow: { bg: "rgba(234,179,8,0.14)",  color: "rgba(253,224,71,1)",  border: "rgba(253,224,71,0.3)"  },
    red:    { bg: "rgba(239,68,68,0.14)",   color: "rgba(252,165,165,1)", border: "rgba(252,165,165,0.3)" },
    ghost:  { bg: "rgba(242,236,223,0.06)", color: "var(--cream-dim)",    border: "var(--glass-border)"  },
  };
  const s = map[variant];
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 999,
      padding: "2px 9px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: ".4px",
      textTransform: "uppercase" as const,
    }}>
      {label}
    </span>
  );
}

function CheckMark({ ok }: { ok: boolean }) {
  return (
    <span style={{ color: ok ? "rgba(134,239,172,0.9)" : "rgba(242,236,223,0.2)", fontSize: 14, fontWeight: 700 }}>
      {ok ? "✓" : "✗"}
    </span>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: ok ? "rgba(134,239,172,0.85)" : "rgba(252,165,165,0.7)",
      flexShrink: 0,
    }} />
  );
}

/** Linha de tabela glass */
const TR_STYLE: Sx = {
  borderBottom: "1px solid rgba(242,236,223,0.06)",
  transition: "background .15s",
};
const TD: Sx = { padding: "10px 10px", fontSize: 12.5, color: "var(--cream-soft)", verticalAlign: "middle" };
const TH: Sx = { textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--cream-dim)", borderBottom: "1px solid rgba(242,236,223,0.1)" };

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "dashboard",         label: "Dashboard",         icon: "◉" },
  { key: "paginas",           label: "Páginas",           icon: "✺" },
  { key: "produtos",          label: "Produtos",          icon: "❖" },
  { key: "blog",              label: "Blog",              icon: "✎" },
  { key: "redirecionamentos", label: "Redireciona.",      icon: "⇄" },
  { key: "sitemap",           label: "Sitemap",           icon: "◫" },
  { key: "robots",            label: "Robots.txt",        icon: "⊙" },
  { key: "auditoria",         label: "Auditoria",         icon: "⚑" },
  { key: "ai-visibility",     label: "AI Visibility",     icon: "◈" },
] as const;

export type SeoSection = typeof TABS[number]["key"];

// ── Row types ──────────────────────────────────────────────────────────────────
type EntityRow   = { id: string; title?: string; name?: string; slug: string; seo: SeoMeta | null; status?: string };
type RedirectRow = { id: string; from_path: string; to_path: string; code: number; reason: string | null; active: boolean };
type RobotsRow   = { id: string; user_agent: string; directive: string; path: string; sort_order: number; active: boolean };
type SitemapRow  = { entity_type: string; included: boolean; priority: number; change_frequency: string };
type AuditRow    = { id: string; entity_type: string; entity_id: string | null; score: number | null; ran_at: string; issues: { code: string; severity: string; message: string; field?: string }[] };
type AiScoreRow  = { id: string; entity_type: string; entity_id: string; ai_score: number | null; has_faq: boolean; has_schema: boolean; has_rich_body: boolean; has_entities: boolean; has_author: boolean };
type BlogCategoryRow = { id: string; name: string; slug: string };
type ArticleRow  = { id: string; title: string; slug: string; status: string; category_id: string | null; published_at: string | null; seo: SeoMeta | null; keywords: string[] };

// ── Page ───────────────────────────────────────────────────────────────────────
export async function SeoCenterPage({ activeSection }: { activeSection: SeoSection }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase  = await supabaseServer();

  const needsPages     = ["paginas", "dashboard"].includes(activeSection);
  const needsProducts  = ["produtos", "dashboard"].includes(activeSection);
  const needsBlog      = ["blog", "dashboard"].includes(activeSection);
  const needsRedirects = ["redirecionamentos", "dashboard"].includes(activeSection);
  const needsRobots    = ["robots"].includes(activeSection);
  const needsSitemap   = ["sitemap"].includes(activeSection);
  const needsAudit     = ["auditoria", "dashboard"].includes(activeSection);
  const needsAiScores  = ["ai-visibility", "dashboard"].includes(activeSection);
  const empty = { data: [], error: null } as const;

  const [
    pagesRes, productsRes, articlesRes, blogCatsRes,
    redirectsRes, robotsRes, sitemapRes, auditsRes, aiScoresRes,
  ] = await Promise.all([
    needsPages     ? supabase.from("pages").select("id,title,slug,seo,status").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(100) : Promise.resolve(empty),
    needsProducts  ? supabase.from("products").select("id,name,slug,seo,status").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(200) : Promise.resolve(empty),
    needsBlog      ? supabase.from("blog_articles").select("id,title,slug,status,category_id,published_at,seo,keywords").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(100) : Promise.resolve(empty),
    needsBlog      ? supabase.from("blog_categories").select("id,name,slug").eq("tenant_id", tenantId).order("sort_order") : Promise.resolve(empty),
    needsRedirects ? supabase.from("seo_redirects").select("id,from_path,to_path,code,reason,active").eq("tenant_id", tenantId).order("from_path") : Promise.resolve(empty),
    needsRobots    ? supabase.from("seo_robots_rules").select("id,user_agent,directive,path,sort_order,active").eq("tenant_id", tenantId).order("sort_order") : Promise.resolve(empty),
    needsSitemap   ? supabase.from("seo_sitemap_config").select("entity_type,included,priority,change_frequency").eq("tenant_id", tenantId) : Promise.resolve(empty),
    needsAudit     ? supabase.from("seo_audits").select("id,entity_type,entity_id,score,ran_at,issues").eq("tenant_id", tenantId).order("ran_at", { ascending: false }).limit(100) : Promise.resolve(empty),
    needsAiScores  ? supabase.from("seo_ai_scores").select("id,entity_type,entity_id,ai_score,has_faq,has_schema,has_rich_body,has_entities,has_author").eq("tenant_id", tenantId).order("ai_score", { ascending: false }).limit(200) : Promise.resolve(empty),
  ]);

  const pages     = (pagesRes.data ?? [])     as EntityRow[];
  const products  = (productsRes.data ?? [])  as EntityRow[];
  const articles  = (articlesRes.data ?? [])  as ArticleRow[];
  const blogCats  = (blogCatsRes.data ?? [])  as BlogCategoryRow[];
  const redirects = (redirectsRes.data ?? []) as RedirectRow[];
  const robots    = (robotsRes.data ?? [])    as RobotsRow[];
  const sitemap   = (sitemapRes.data ?? [])   as SitemapRow[];
  const audits    = (auditsRes.data ?? [])    as AuditRow[];
  const aiScores  = (aiScoresRes.data ?? [])  as AiScoreRow[];

  // KPIs
  const withSeoPages    = pages.filter(p => p.seo && Object.keys(p.seo).length > 0).length;
  const withSeoProducts = products.filter(p => p.seo && Object.keys(p.seo).length > 0).length;
  const avgAuditScore   = audits.length > 0 ? Math.round(audits.reduce((s, a) => s + (a.score ?? 0), 0) / audits.length) : 0;
  const avgAiScore      = aiScores.length > 0 ? Math.round(aiScores.reduce((s, a) => s + (a.ai_score ?? 0), 0) / aiScores.length) : 0;

  async function saveMeta(type: EntityType, id: string, meta: SeoMeta) {
    "use server";
    return saveSeoMeta(type, id, meta);
  }
  async function generateAi(ctx: Parameters<typeof generateSeoWithAI>[0]) {
    "use server";
    return generateSeoWithAI(ctx);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 28px 80px" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 32 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.7, letterSpacing: "2px" }}>
          ← Painel
        </Link>
        <h1 className="display" style={{ fontSize: 42, marginTop: 10, color: "var(--cream)" }}>
          SEO Engine
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--cream-dim)", marginTop: 6, letterSpacing: ".2px" }}>
          Otimização orgânica, visibilidade em IA e blog corporativo da Flora Botanics.
        </p>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 2,
        overflowX: "auto",
        scrollbarWidth: "none",
        marginBottom: 36,
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-md)",
        padding: "5px 6px",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}>
        {TABS.map(t => {
          const active = activeSection === t.key;
          return (
            <Link
              key={t.key}
              href={`/seo/${t.key}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--forest-950)" : "var(--cream-soft)",
                background: active
                  ? "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))"
                  : "transparent",
                boxShadow: active ? "0 4px 14px rgba(var(--gold-rgb),.35)" : "none",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all .2s var(--ease)",
                letterSpacing: active ? ".2px" : "0",
              }}
            >
              <span style={{ fontSize: 11, opacity: active ? 1 : 0.6 }}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          DASHBOARD
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "dashboard" && (
        <div>
          {/* KPI grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Páginas com SEO",       value: `${withSeoPages}/${pages.length}`,      sub: "meta tags configuradas", icon: "✺" },
              { label: "Produtos com SEO",       value: `${withSeoProducts}/${products.length}`, sub: "meta tags configuradas", icon: "❖" },
              { label: "Score médio",            value: avgAuditScore > 0 ? String(avgAuditScore) : "—", sub: "última auditoria",    icon: "⚑" },
              { label: "AI Visibility",          value: avgAiScore > 0 ? `${avgAiScore}/100` : "—",     sub: "score médio",         icon: "◈" },
              { label: "Redireciona.",           value: String(redirects.length),               sub: "cadastrados",             icon: "⇄" },
              { label: "Artigos publicados",     value: String(articles.filter(a => a.status === "published").length), sub: `de ${articles.length} total`, icon: "✎" },
            ].map((kpi, i) => (
              <GlassCard key={i} style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 18, opacity: .6 }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "var(--gold-light)", letterSpacing: "-1px", fontVariantNumeric: "tabular-nums" }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cream-soft)", marginTop: 4 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--cream-dim)", marginTop: 2 }}>{kpi.sub}</div>
              </GlassCard>
            ))}
          </div>

          {audits.length > 0 && (
            <GlassCard>
              <p className="eyebrow" style={{ marginBottom: 16 }}>Últimas Auditorias</p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tipo", "Score", "Issues", "Executada em"].map(h => <th key={h} style={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {audits.slice(0, 10).map(a => (
                    <tr key={a.id} style={TR_STYLE}>
                      <td style={TD}>{a.entity_type}</td>
                      <td style={TD}><ScoreBadge score={a.score ?? 0} /></td>
                      <td style={TD}>{a.issues.length}</td>
                      <td style={{ ...TD, color: "var(--cream-dim)", fontSize: 11 }}>
                        {new Date(a.ran_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PÁGINAS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "paginas" && (
        <SectionWrap>
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
            {/* Lista */}
            <GlassCard style={{ padding: "10px 0" }}>
              <div style={{ padding: "0 14px 10px", borderBottom: "1px solid var(--glass-border)", marginBottom: 4 }}>
                <span className="eyebrow">{pages.length} páginas</span>
              </div>
              {pages.map(p => {
                const hasSeo = p.seo && Object.keys(p.seo).length > 0;
                return (
                  <Link
                    key={p.id}
                    href={`/seo/paginas?id=${p.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "9px 14px",
                      fontSize: 12.5,
                      color: "var(--cream-soft)",
                      textDecoration: "none",
                      borderBottom: "1px solid rgba(242,236,223,0.04)",
                      transition: "background .15s",
                    }}
                  >
                    <Dot ok={!!hasSeo} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title ?? p.slug}
                    </span>
                  </Link>
                );
              })}
            </GlassCard>

            {/* Painel de instrução */}
            <GlassCard>
              <p className="eyebrow" style={{ marginBottom: 12 }}>Instrução</p>
              <p style={{ fontSize: 13, color: "var(--cream-soft)", lineHeight: 1.7 }}>
                Selecione uma página na lista para editar suas meta tags, Open Graph e FAQ.
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--cream-dim)" }}>
                  <Dot ok={true} /> SEO configurado
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--cream-dim)" }}>
                  <Dot ok={false} /> sem meta tags
                </span>
              </div>
              <div style={{ marginTop: 20 }}>
                <form action={runSeoAuditBulk.bind(null, "page") as unknown as (fd: FormData) => Promise<void>}>
                  <button type="submit" className="btn btn-ghost" style={{ fontSize: 11 }}>
                    ⚑ Auditar todas as páginas
                  </button>
                </form>
              </div>
            </GlassCard>
          </div>
        </SectionWrap>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PRODUTOS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "produtos" && (
        <SectionWrap>
          <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
            <SectionTitle>Meta Tags por Produto</SectionTitle>
            <form action={runSeoAuditBulk.bind(null, "product") as unknown as (fd: FormData) => Promise<void>}>
              <button type="submit" className="btn btn-ghost" style={{ fontSize: 11 }}>
                ⚑ Auditar todos os produtos
              </button>
            </form>
          </Row>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
            {products.map(p => {
              const seo = (p.seo ?? {}) as SeoMeta;
              const titleLen = (seo.title ?? "").length;
              const descLen  = (seo.description ?? "").length;
              const ok = titleLen >= 30 && titleLen <= 60 && descLen >= 100 && descLen <= 160;
              return (
                <Link key={p.id} href={`/seo/produtos?id=${p.id}`} style={{ textDecoration: "none" }}>
                  <GlassCard style={{ padding: "14px 16px", cursor: "pointer" }}>
                    <Row style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>
                        {p.name ?? p.slug}
                      </span>
                      <StatusChip label={ok ? "OK" : "Pendente"} variant={ok ? "green" : "yellow"} />
                    </Row>
                    <div style={{ fontSize: 11, color: "var(--cream-dim)", marginBottom: seo.title ? 6 : 0 }}>
                      /{p.slug}
                    </div>
                    {seo.title && (
                      <div style={{ fontSize: 11, color: "var(--cream-soft)", fontStyle: "italic", opacity: .75 }}>
                        &ldquo;{seo.title.slice(0, 60)}&rdquo;
                      </div>
                    )}
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        </SectionWrap>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          BLOG
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "blog" && (
        <SectionWrap>
          <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
            <SectionTitle>Blog Engine</SectionTitle>
            <Link href="/seo/blog/novo" className="btn btn-gold" style={{ fontSize: 11 }}>
              + Novo artigo
            </Link>
          </Row>

          {/* Categorias */}
          <GlassCard style={{ marginBottom: 20 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Categorias ({blogCats.length})</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {blogCats.map(c => (
                <span key={c.id} style={{
                  background: "rgba(var(--gold-rgb),.12)",
                  border: "1px solid rgba(var(--gold-rgb),.3)",
                  borderRadius: 999,
                  padding: "3px 13px",
                  fontSize: 12,
                  color: "var(--gold-light)",
                }}>
                  {c.name}
                </span>
              ))}
              <Link href="/seo/blog/categoria/nova" style={{
                background: "transparent",
                border: "1px dashed var(--glass-border-hover)",
                borderRadius: 999,
                padding: "3px 13px",
                fontSize: 12,
                color: "var(--gold)",
                textDecoration: "none",
              }}>
                + Categoria
              </Link>
            </div>
          </GlassCard>

          {/* Tabela de artigos */}
          <GlassCard style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Título", "Status", "Categoria", "SEO", "Publicado em", ""].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articles.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--cream-dim)", fontSize: 13 }}>
                      Nenhum artigo ainda. Crie o primeiro!
                    </td>
                  </tr>
                )}
                {articles.map(a => {
                  const hasSeo = a.seo && Object.keys(a.seo).length > 0;
                  const cat = blogCats.find(c => c.id === a.category_id);
                  const statusVariant = a.status === "published" ? "green" : a.status === "archived" ? "ghost" : "yellow";
                  const statusLabel   = a.status === "published" ? "Publicado" : a.status === "archived" ? "Arquivado" : "Rascunho";
                  return (
                    <tr key={a.id} style={TR_STYLE}>
                      <td style={TD}>
                        <Link href={`/seo/blog/${a.id}`} style={{ color: "var(--cream)", fontWeight: 600, textDecoration: "none" }}>
                          {a.title}
                        </Link>
                      </td>
                      <td style={TD}><StatusChip label={statusLabel} variant={statusVariant} /></td>
                      <td style={{ ...TD, color: "var(--cream-dim)" }}>{cat?.name ?? "—"}</td>
                      <td style={TD}><CheckMark ok={!!hasSeo} /></td>
                      <td style={{ ...TD, color: "var(--cream-dim)", fontSize: 11 }}>
                        {a.published_at ? new Date(a.published_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td style={TD}>
                        <Row style={{ gap: 8 }}>
                          <Link href={`/seo/blog/${a.id}`} style={{ fontSize: 11, color: "var(--gold-light)", textDecoration: "none" }}>
                            editar
                          </Link>
                          <form action={deleteBlogArticle.bind(null, a.id) as unknown as (fd: FormData) => Promise<void>}>
                            <button type="submit" className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px", color: "rgba(252,165,165,.8)" }}>
                              excluir
                            </button>
                          </form>
                        </Row>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </SectionWrap>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          REDIRECIONAMENTOS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "redirecionamentos" && (
        <SectionWrap>
          <SectionTitle>Redirecionamentos</SectionTitle>

          <GlassCard style={{ marginBottom: 20 }}>
            <p className="eyebrow" style={{ marginBottom: 16 }}>Novo Redirecionamento</p>
            <form
              action={async (fd: FormData) => {
                "use server";
                await saveSeoRedirect({
                  from_path: fd.get("from_path") as string,
                  to_path:   fd.get("to_path") as string,
                  code:      Number(fd.get("code")) || 301,
                  reason:    fd.get("reason") as string || undefined,
                });
              }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px 1fr auto", gap: 10, alignItems: "end" }}
            >
              <div>
                <Label>De (URL atual)</Label>
                <input name="from_path" className="input" placeholder="/produtos/antigo-slug" required />
              </div>
              <div>
                <Label>Para (URL destino)</Label>
                <input name="to_path" className="input" placeholder="/produtos/novo-slug" required />
              </div>
              <div>
                <Label>Código</Label>
                <RedirectCodeSelect />
              </div>
              <div>
                <Label>Motivo (opcional)</Label>
                <input name="reason" className="input" placeholder="Ex: slug renomeado" />
              </div>
              <button type="submit" className="btn btn-gold" style={{ fontSize: 11 }}>Adicionar</button>
            </form>
          </GlassCard>

          <GlassCard style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["De", "Para", "Código", "Motivo", "Ativo", ""].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {redirects.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "28px", textAlign: "center", color: "var(--cream-dim)", fontSize: 13 }}>
                      Nenhum redirecionamento cadastrado.
                    </td>
                  </tr>
                )}
                {redirects.map(r => (
                  <tr key={r.id} style={TR_STYLE}>
                    <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: "rgba(252,165,165,.85)" }}>{r.from_path}</td>
                    <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: "rgba(134,239,172,.85)" }}>{r.to_path}</td>
                    <td style={TD}>
                      <span style={{
                        background: "rgba(var(--gold-rgb),.15)",
                        border: "1px solid rgba(var(--gold-rgb),.25)",
                        borderRadius: 6,
                        padding: "1px 8px",
                        fontWeight: 700,
                        fontSize: 11,
                        color: "var(--gold-light)",
                      }}>{r.code}</span>
                    </td>
                    <td style={{ ...TD, color: "var(--cream-dim)", fontSize: 11 }}>{r.reason ?? "—"}</td>
                    <td style={TD}><CheckMark ok={r.active} /></td>
                    <td style={TD}>
                      <form action={deleteSeoRedirect.bind(null, r.id) as unknown as (fd: FormData) => Promise<void>}>
                        <button type="submit" className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px", color: "rgba(252,165,165,.8)" }}>
                          excluir
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </SectionWrap>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SITEMAP
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "sitemap" && (
        <SectionWrap>
          <SectionTitle>Configuração do Sitemap</SectionTitle>
          <GlassCard>
            <form
              action={async (fd: FormData) => {
                "use server";
                const types = ["product", "category", "page", "article"];
                await saveSitemapConfig(types.map(t => ({
                  entity_type: t,
                  included: fd.get(`${t}_included`) === "on",
                  priority: Number(fd.get(`${t}_priority`)) || 0.5,
                  change_frequency: fd.get(`${t}_freq`) as string || "weekly",
                })));
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tipo", "Incluir", "Prioridade", "Frequência"].map(h => <th key={h} style={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "product",  label: "Produtos" },
                    { key: "category", label: "Categorias" },
                    { key: "page",     label: "Páginas CMS" },
                    { key: "article",  label: "Artigos do Blog" },
                  ].map(row => {
                    const cfg = sitemap.find(s => s.entity_type === row.key);
                    return (
                      <tr key={row.key} style={TR_STYLE}>
                        <td style={{ ...TD, fontWeight: 600, color: "var(--cream)" }}>{row.label}</td>
                        <td style={TD}>
                          <input
                            type="checkbox"
                            name={`${row.key}_included`}
                            defaultChecked={cfg?.included ?? true}
                            style={{ accentColor: "var(--gold)", width: 16, height: 16, cursor: "pointer" }}
                          />
                        </td>
                        <td style={TD}>
                          <SitemapPrioritySelect name={`${row.key}_priority`} defaultValue={String(cfg?.priority ?? 0.5)} />
                        </td>
                        <td style={TD}>
                          <SitemapFreqSelect name={`${row.key}_freq`} defaultValue={cfg?.change_frequency ?? "weekly"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-gold" style={{ fontSize: 11 }}>Salvar configuração</button>
              </div>
            </form>
          </GlassCard>
        </SectionWrap>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ROBOTS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "robots" && (
        <SectionWrap>
          <SectionTitle>Regras Robots.txt</SectionTitle>

          <GlassCard style={{ marginBottom: 20 }}>
            <p className="eyebrow" style={{ marginBottom: 16 }}>Nova Regra</p>
            <form
              action={async (fd: FormData) => {
                "use server";
                await saveRobotsRule({
                  user_agent: fd.get("user_agent") as string || "*",
                  directive:  fd.get("directive") as "allow" | "disallow",
                  path:       fd.get("path") as string,
                  sort_order: Number(fd.get("sort_order")) || 0,
                  active:     true,
                });
              }}
              style={{ display: "grid", gridTemplateColumns: "150px 130px 1fr 80px auto", gap: 10, alignItems: "end" }}
            >
              <div>
                <Label>User-agent</Label>
                <input name="user_agent" className="input" defaultValue="*" placeholder="*" />
              </div>
              <div>
                <Label>Diretiva</Label>
                <RobotsDirectiveSelect />
              </div>
              <div>
                <Label>Path</Label>
                <input name="path" className="input" placeholder="/admin/" required />
              </div>
              <div>
                <Label>Ordem</Label>
                <input name="sort_order" type="number" className="input" defaultValue="0" style={{ width: 70 }} />
              </div>
              <button type="submit" className="btn btn-gold" style={{ fontSize: 11 }}>Adicionar</button>
            </form>
          </GlassCard>

          <GlassCard>
            <p className="eyebrow" style={{ marginBottom: 14 }}>Preview robots.txt</p>
            <pre style={{
              background: "rgba(10,22,11,0.7)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--cream-soft)",
              padding: "16px 18px",
              fontSize: 11.5,
              lineHeight: 1.8,
              overflowX: "auto",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}>
              {`User-agent: *\n` +
                robots
                  .filter(r => r.active)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(r => `${r.directive === "allow" ? "Allow" : "Disallow"}: ${r.path}`)
                  .join("\n") +
                "\n\nSitemap: https://floraBotanics.com.br/sitemap.xml"}
            </pre>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              {robots.map(r => (
                <Row key={r.id} style={{
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--radius-sm)",
                }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--cream-soft)" }}>
                    <span style={{ color: "var(--cream-dim)" }}>User-agent: </span>
                    {r.user_agent}
                    {"  "}
                    <span style={{ color: r.directive === "allow" ? "rgba(134,239,172,.85)" : "rgba(252,165,165,.85)" }}>
                      {r.directive === "allow" ? "Allow" : "Disallow"}:
                    </span>
                    {" "}{r.path}
                  </span>
                  <Row style={{ gap: 10 }}>
                    <StatusChip
                      label={r.active ? "ativo" : "inativo"}
                      variant={r.active ? "green" : "ghost"}
                    />
                    <form action={deleteRobotsRule.bind(null, r.id) as unknown as (fd: FormData) => Promise<void>}>
                      <button type="submit" className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 9px", color: "rgba(252,165,165,.8)" }}>
                        ✕
                      </button>
                    </form>
                  </Row>
                </Row>
              ))}
            </div>
          </GlassCard>
        </SectionWrap>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          AUDITORIA
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "auditoria" && (
        <SectionWrap>
          {/* Header + botões de auditoria */}
          <Row style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
            <div>
              <SectionTitle>Auditoria SEO</SectionTitle>
              <p style={{ fontSize: 12.5, color: "var(--cream-dim)", marginTop: -14, lineHeight: 1.7 }}>
                Analisa title, description, OG tags, canonical e palavras-chave de cada entidade. Clique num botão para auditar em lote.
              </p>
            </div>
            <Row style={{ gap: 8, flexWrap: "wrap" }}>
              {([
                { type: "product",  label: "Produtos" },
                { type: "category", label: "Categorias" },
                { type: "page",     label: "Páginas" },
                { type: "article",  label: "Artigos" },
              ] as { type: EntityType; label: string }[]).map(({ type, label }) => (
                <form key={type} action={runSeoAuditBulk.bind(null, type) as unknown as (fd: FormData) => Promise<void>}>
                  <button type="submit" className="btn btn-ghost" style={{ fontSize: 11 }}>
                    ⚑ Auditar {label}
                  </button>
                </form>
              ))}
            </Row>
          </Row>

          {audits.length === 0 ? (
            <GlassCard style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 16, opacity: .4 }}>⚑</div>
              <p style={{ color: "var(--cream-soft)", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Nenhuma auditoria executada ainda
              </p>
              <p style={{ color: "var(--cream-dim)", fontSize: 12.5, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 24px" }}>
                Clique em &ldquo;⚑ Auditar&rdquo; acima para analisar suas páginas, produtos, categorias ou artigos do blog.
                Cada auditoria verifica title, description, OG tags, canonical e keywords.
              </p>
              <form action={runSeoAuditBulk.bind(null, "product") as unknown as (fd: FormData) => Promise<void>}>
                <button type="submit" className="btn btn-gold" style={{ fontSize: 12 }}>
                  ⚑ Começar auditoria de produtos
                </button>
              </form>
            </GlassCard>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {audits.map(a => {
                const errs  = a.issues.filter(i => i.severity === "error");
                const warns = a.issues.filter(i => i.severity === "warning");
                const infos = a.issues.filter(i => i.severity === "info");
                const score = a.score ?? 0;
                return (
                  <GlassCard key={a.id} style={{ padding: "16px 20px" }}>
                    {/* Linha de resumo */}
                    <Row style={{ justifyContent: "space-between", marginBottom: a.issues.length > 0 ? 14 : 0, flexWrap: "wrap", gap: 10 }}>
                      <Row style={{ gap: 10 }}>
                        <ScoreBadge score={score} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>
                          {a.entity_type === "product" ? "Produto" : a.entity_type === "page" ? "Página" : a.entity_type === "article" ? "Artigo" : "Categoria"}
                        </span>
                        {a.entity_id && (
                          <span style={{ fontSize: 11, color: "var(--cream-dim)", fontFamily: "monospace" }}>
                            {a.entity_id.slice(0, 8)}…
                          </span>
                        )}
                      </Row>
                      <Row style={{ gap: 10 }}>
                        {errs.length > 0 && (
                          <span style={{ fontSize: 11, color: "rgba(252,165,165,.9)", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 999, padding: "2px 9px", fontWeight: 700 }}>
                            {errs.length} erro{errs.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {warns.length > 0 && (
                          <span style={{ fontSize: 11, color: "rgba(253,224,71,.9)", background: "rgba(234,179,8,.12)", border: "1px solid rgba(234,179,8,.2)", borderRadius: 999, padding: "2px 9px", fontWeight: 700 }}>
                            {warns.length} aviso{warns.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {infos.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--cream-dim)", background: "rgba(242,236,223,.06)", border: "1px solid var(--glass-border)", borderRadius: 999, padding: "2px 9px" }}>
                            {infos.length} info
                          </span>
                        )}
                        <span style={{ fontSize: 10.5, color: "var(--cream-dim)" }}>
                          {new Date(a.ran_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </Row>
                    </Row>

                    {/* Detalhe dos issues */}
                    {a.issues.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: "1px solid rgba(242,236,223,.07)", paddingTop: 12 }}>
                        {a.issues.map((issue, idx) => {
                          const isErr  = issue.severity === "error";
                          const isWarn = issue.severity === "warning";
                          const dotColor = isErr ? "rgba(252,165,165,.85)" : isWarn ? "rgba(253,224,71,.85)" : "rgba(242,236,223,.3)";
                          const textColor = isErr ? "rgba(252,165,165,.9)" : isWarn ? "rgba(253,224,71,.85)" : "var(--cream-dim)";
                          return (
                            <Row key={idx} style={{ gap: 8, alignItems: "flex-start" }}>
                              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 4 }} />
                              <span style={{ fontSize: 12, color: textColor, lineHeight: 1.5 }}>
                                {issue.message}
                                {issue.field && (
                                  <span style={{ fontSize: 10.5, color: "var(--cream-dim)", marginLeft: 8, fontFamily: "monospace" }}>
                                    [{issue.field}]
                                  </span>
                                )}
                              </span>
                            </Row>
                          );
                        })}
                      </div>
                    )}

                    {a.issues.length === 0 && (
                      <p style={{ fontSize: 12, color: "rgba(134,239,172,.8)", marginTop: 0 }}>
                        ✓ Nenhum problema encontrado — SEO perfeito!
                      </p>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </SectionWrap>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          AI VISIBILITY
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === "ai-visibility" && (
        <SectionWrap>
          {/* Header */}
          <Row style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
            <div>
              <SectionTitle>AI Visibility Score</SectionTitle>
              <p style={{ fontSize: 12.5, color: "var(--cream-dim)", marginTop: -14, lineHeight: 1.7, maxWidth: 600 }}>
                Mede a probabilidade de seus conteúdos aparecerem em respostas de IA (SGE, ChatGPT, Perplexity, Gemini).
                Critérios: FAQ estruturado, Schema.org, conteúdo rico, keywords e autoria.
              </p>
            </div>
          </Row>

          {/* Como funciona */}
          <GlassCard style={{ marginBottom: 20 }}>
            <p className="eyebrow" style={{ marginBottom: 14 }}>Como é calculado</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
              {[
                { icon: "❓", label: "FAQ estruturado",   pts: "+25 pts", desc: "Perguntas e respostas na página" },
                { icon: "📋", label: "Schema.org",        pts: "+20 pts", desc: "Marcação de dados estruturados" },
                { icon: "📝", label: "Conteúdo rico",     pts: "+20 pts", desc: "Body com texto formatado" },
                { icon: "🔑", label: "Keywords",          pts: "+20 pts", desc: "Palavras-chave associadas" },
                { icon: "👤", label: "Autoria",           pts: "+15 pts", desc: "Nome do autor preenchido" },
              ].map(c => (
                <div key={c.label} style={{
                  background: "rgba(242,236,223,.04)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cream-soft)", marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, marginBottom: 4 }}>{c.pts}</div>
                  <div style={{ fontSize: 10.5, color: "var(--cream-dim)", lineHeight: 1.5 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Botões para calcular scores */}
          <GlassCard style={{ marginBottom: 20 }}>
            <p className="eyebrow" style={{ marginBottom: 14 }}>Calcular scores em lote</p>
            <p style={{ fontSize: 12.5, color: "var(--cream-dim)", marginBottom: 16, lineHeight: 1.6 }}>
              Selecione o tipo de entidade para calcular o AI Visibility Score de todos os registros.
              Artigos do blog têm o maior potencial pois suportam FAQ, autoria e conteúdo rico.
            </p>
            <Row style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {([
                { type: "article",  label: "◈ Calcular Artigos",    badge: "melhor para IA" },
                { type: "product",  label: "◈ Calcular Produtos",   badge: "" },
                { type: "page",     label: "◈ Calcular Páginas",    badge: "" },
                { type: "category", label: "◈ Calcular Categorias", badge: "" },
              ] as { type: EntityType; label: string; badge: string }[]).map(({ type, label, badge }) => (
                <form
                  key={type}
                  action={runAiVisibilityScoreBulk.bind(null, type) as unknown as (fd: FormData) => Promise<void>}
                >
                  <button
                    type="submit"
                    className={type === "article" ? "btn btn-gold" : "btn btn-ghost"}
                    style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 7 }}
                  >
                    {label}
                    {badge && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: ".6px",
                        textTransform: "uppercase",
                        background: "rgba(0,0,0,.25)",
                        borderRadius: 999,
                        padding: "1px 7px",
                        opacity: .85,
                      }}>
                        {badge}
                      </span>
                    )}
                  </button>
                </form>
              ))}
            </Row>
          </GlassCard>

          {/* Resultados */}
          {aiScores.length === 0 ? (
            <GlassCard style={{ textAlign: "center", padding: "36px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 14, opacity: .35 }}>◈</div>
              <p style={{ color: "var(--cream-soft)", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Nenhum score calculado ainda
              </p>
              <p style={{ color: "var(--cream-dim)", fontSize: 12.5, lineHeight: 1.7, maxWidth: 380, margin: "0 auto" }}>
                Use os botões acima para calcular o AI Visibility Score dos seus conteúdos.
              </p>
            </GlassCard>
          ) : (
            <>
              {/* KPI resumo */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Score médio",         value: `${avgAiScore}/100` },
                  { label: "Com FAQ",              value: `${aiScores.filter(s => s.has_faq).length}/${aiScores.length}` },
                  { label: "Com Schema.org",       value: `${aiScores.filter(s => s.has_schema).length}/${aiScores.length}` },
                  { label: "Com autoria",          value: `${aiScores.filter(s => s.has_author).length}/${aiScores.length}` },
                ].map((kpi, i) => (
                  <GlassCard key={i} style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "var(--gold-light)", letterSpacing: "-1px", fontVariantNumeric: "tabular-nums" }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--cream-dim)", marginTop: 4 }}>{kpi.label}</div>
                  </GlassCard>
                ))}
              </div>

              {/* Tabela detalhada */}
              <GlassCard style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Tipo", "Score IA", "FAQ", "Schema", "Conteúdo", "Keywords", "Autoria"].map(h => (
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aiScores.map(s => {
                      const score = s.ai_score ?? 0;
                      return (
                        <tr key={s.id} style={TR_STYLE}>
                          <td style={TD}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cream)" }}>
                              {s.entity_type === "article" ? "Artigo" : s.entity_type === "product" ? "Produto" : s.entity_type === "page" ? "Página" : "Categoria"}
                            </span>
                            <span style={{ display: "block", fontSize: 10, color: "var(--cream-dim)", fontFamily: "monospace" }}>
                              {s.entity_id.slice(0, 8)}…
                            </span>
                          </td>
                          <td style={TD}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <ScoreBadge score={score} />
                              {/* Barra de progresso */}
                              <div style={{ flex: 1, minWidth: 60, height: 4, background: "rgba(242,236,223,.08)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{
                                  width: `${score}%`,
                                  height: "100%",
                                  borderRadius: 2,
                                  background: score >= 80
                                    ? "linear-gradient(90deg, rgba(134,239,172,.6), rgba(134,239,172,.9))"
                                    : score >= 50
                                    ? "linear-gradient(90deg, rgba(253,224,71,.5), rgba(253,224,71,.8))"
                                    : "linear-gradient(90deg, rgba(252,165,165,.5), rgba(252,165,165,.8))",
                                }} />
                              </div>
                            </div>
                          </td>
                          <td style={TD}><CheckMark ok={s.has_faq} /></td>
                          <td style={TD}><CheckMark ok={s.has_schema} /></td>
                          <td style={TD}><CheckMark ok={s.has_rich_body} /></td>
                          <td style={TD}><CheckMark ok={s.has_entities} /></td>
                          <td style={TD}><CheckMark ok={s.has_author} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </GlassCard>
            </>
          )}
        </SectionWrap>
      )}
    </main>
  );
}
