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
  generateSeoWithAI,
  saveBlogArticle,
  deleteBlogArticle,
  saveBlogCategory,
  type EntityType,
  type SeoMeta,
} from "./actions";
import { SeoMetaEditor } from "@/components/SeoMetaEditor";

// ── Helpers ────────────────────────────────────────────────────────────────────
type Sx = CSSProperties;

function Section({ children, style }: { children: ReactNode; style?: Sx }) {
  return (
    <div style={{ marginBottom: 32, ...style }}>{children}</div>
  );
}

function Card({ children, style }: { children: ReactNode; style?: Sx }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.8)",
      border: "1px solid #e0d5c5",
      borderRadius: 12,
      padding: "20px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Row({ children, style }: { children: ReactNode; style?: Sx }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
      {children}
    </div>
  );
}

function Badge({ score }: { score: number }) {
  const bg = score >= 80 ? "#d4edda" : score >= 50 ? "#fff3cd" : "#f8d7da";
  const color = score >= 80 ? "#155724" : score >= 50 ? "#856404" : "#721c24";
  return (
    <span style={{ background: bg, color, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      {score}
    </span>
  );
}

function SeverityIcon({ s }: { s: string }) {
  if (s === "error") return <span style={{ color: "#d93025" }}>✗</span>;
  if (s === "warning") return <span style={{ color: "#e37400" }}>⚠</span>;
  return <span style={{ color: "#1a73e8" }}>ℹ</span>;
}

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "paginas", label: "Páginas" },
  { key: "produtos", label: "Produtos" },
  { key: "blog", label: "Blog" },
  { key: "redirecionamentos", label: "Redirecionamentos" },
  { key: "sitemap", label: "Sitemap" },
  { key: "robots", label: "Robots.txt" },
  { key: "auditoria", label: "Auditoria" },
  { key: "ai-visibility", label: "AI Visibility" },
] as const;

export type SeoSection = typeof TABS[number]["key"];

// ── Row types ──────────────────────────────────────────────────────────────────
type EntityRow = { id: string; title?: string; name?: string; slug: string; seo: SeoMeta | null; status?: string };
type RedirectRow = { id: string; from_path: string; to_path: string; code: number; reason: string | null; active: boolean };
type RobotsRow = { id: string; user_agent: string; directive: string; path: string; sort_order: number; active: boolean };
type SitemapRow = { entity_type: string; included: boolean; priority: number; change_frequency: string };
type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  score: number | null;
  ran_at: string;
  issues: { code: string; severity: string; message: string }[];
};
type AiScoreRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  ai_score: number | null;
  has_faq: boolean;
  has_schema: boolean;
  has_rich_body: boolean;
  has_entities: boolean;
  has_author: boolean;
};
type BlogCategoryRow = { id: string; name: string; slug: string };
type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category_id: string | null;
  published_at: string | null;
  seo: SeoMeta | null;
  keywords: string[];
};

// ── Page ───────────────────────────────────────────────────────────────────────
export async function SeoCenterPage({ activeSection }: { activeSection: SeoSection }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const needsPages     = ["paginas", "dashboard"].includes(activeSection);
  const needsProducts  = ["produtos", "dashboard"].includes(activeSection);
  const needsBlog      = ["blog", "dashboard"].includes(activeSection);
  const needsRedirects = ["redirecionamentos"].includes(activeSection);
  const needsRobots    = ["robots"].includes(activeSection);
  const needsSitemap   = ["sitemap"].includes(activeSection);
  const needsAudit     = ["auditoria", "dashboard"].includes(activeSection);
  const needsAiScores  = ["ai-visibility", "dashboard"].includes(activeSection);
  const empty = { data: [], error: null } as const;

  const [
    pagesRes,
    productsRes,
    articlesRes,
    blogCatsRes,
    redirectsRes,
    robotsRes,
    sitemapRes,
    auditsRes,
    aiScoresRes,
  ] = await Promise.all([
    needsPages    ? supabase.from("pages").select("id,title,slug,seo,status").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(100) : Promise.resolve(empty),
    needsProducts ? supabase.from("products").select("id,name,slug,seo,status").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(200) : Promise.resolve(empty),
    needsBlog     ? supabase.from("blog_articles").select("id,title,slug,status,category_id,published_at,seo,keywords").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(100) : Promise.resolve(empty),
    needsBlog     ? supabase.from("blog_categories").select("id,name,slug").eq("tenant_id", tenantId).order("sort_order") : Promise.resolve(empty),
    needsRedirects ? supabase.from("seo_redirects").select("id,from_path,to_path,code,reason,active").eq("tenant_id", tenantId).order("from_path") : Promise.resolve(empty),
    needsRobots   ? supabase.from("seo_robots_rules").select("id,user_agent,directive,path,sort_order,active").eq("tenant_id", tenantId).order("sort_order") : Promise.resolve(empty),
    needsSitemap  ? supabase.from("seo_sitemap_config").select("entity_type,included,priority,change_frequency").eq("tenant_id", tenantId) : Promise.resolve(empty),
    needsAudit    ? supabase.from("seo_audits").select("id,entity_type,entity_id,score,ran_at,issues").eq("tenant_id", tenantId).order("ran_at", { ascending: false }).limit(100) : Promise.resolve(empty),
    needsAiScores ? supabase.from("seo_ai_scores").select("id,entity_type,entity_id,ai_score,has_faq,has_schema,has_rich_body,has_entities,has_author").eq("tenant_id", tenantId).order("ai_score", { ascending: false }).limit(200) : Promise.resolve(empty),
  ]);

  const pages       = (pagesRes.data ?? []) as EntityRow[];
  const products    = (productsRes.data ?? []) as EntityRow[];
  const articles    = (articlesRes.data ?? []) as ArticleRow[];
  const blogCats    = (blogCatsRes.data ?? []) as BlogCategoryRow[];
  const redirects   = (redirectsRes.data ?? []) as RedirectRow[];
  const robots      = (robotsRes.data ?? []) as RobotsRow[];
  const sitemap     = (sitemapRes.data ?? []) as SitemapRow[];
  const audits      = (auditsRes.data ?? []) as AuditRow[];
  const aiScores    = (aiScoresRes.data ?? []) as AiScoreRow[];

  // KPIs dashboard
  const withSeoPages    = pages.filter(p => p.seo && Object.keys(p.seo).length > 0).length;
  const withSeoProducts = products.filter(p => p.seo && Object.keys(p.seo).length > 0).length;
  const avgAuditScore   = audits.length > 0
    ? Math.round(audits.reduce((s, a) => s + (a.score ?? 0), 0) / audits.length)
    : 0;
  const avgAiScore = aiScores.length > 0
    ? Math.round(aiScores.reduce((s, a) => s + (a.ai_score ?? 0), 0) / aiScores.length)
    : 0;

  // Server action wrappers bound to each entity
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
      {/* Header */}
      <header className="rise" style={{ marginBottom: 28 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>SEO Engine</h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Otimização orgânica, visibilidade em IA e blog corporativo da Flora Botanics.
        </p>
      </header>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid #e0d5c5",
        marginBottom: 32,
        overflowX: "auto",
      }}>
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/seo/${t.key}`}
            style={{
              padding: "10px 16px",
              fontSize: 12.5,
              fontWeight: activeSection === t.key ? 700 : 400,
              color: activeSection === t.key ? "#7a5c1e" : "#666",
              borderBottom: activeSection === t.key ? "2px solid #b9924d" : "2px solid transparent",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "all .15s",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────────────────────── */}
      {activeSection === "dashboard" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Páginas com SEO", value: `${withSeoPages}/${pages.length}`, sub: "meta tags configuradas" },
              { label: "Produtos com SEO", value: `${withSeoProducts}/${products.length}`, sub: "meta tags configuradas" },
              { label: "Score médio", value: avgAuditScore > 0 ? avgAuditScore : "—", sub: "última auditoria" },
              { label: "AI Visibility", value: avgAiScore > 0 ? `${avgAiScore}/100` : "—", sub: "score médio" },
              { label: "Redirecionamentos", value: redirects.length, sub: "ativos" },
              { label: "Artigos publicados", value: articles.filter(a => a.status === "published").length, sub: `de ${articles.length} total` },
            ].map((kpi, i) => (
              <Card key={i}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#7a5c1e" }}>{kpi.value}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{kpi.label}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{kpi.sub}</div>
              </Card>
            ))}
          </div>

          {audits.length > 0 && (
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#7a5c1e" }}>Últimas Auditorias</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e0d5c5" }}>
                    {["Tipo", "Score", "Issues", "Executada em"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#888", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audits.slice(0, 10).map(a => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f0ebe0" }}>
                      <td style={{ padding: "6px 8px" }}>{a.entity_type}</td>
                      <td style={{ padding: "6px 8px" }}><Badge score={a.score ?? 0} /></td>
                      <td style={{ padding: "6px 8px" }}>{a.issues.length}</td>
                      <td style={{ padding: "6px 8px", color: "#888" }}>
                        {new Date(a.ran_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ── PÁGINAS ───────────────────────────────────────────────────────────── */}
      {activeSection === "paginas" && (
        <Section>
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24, alignItems: "start" }}>
            {/* sidebar lista */}
            <Card style={{ padding: "12px 0" }}>
              <div style={{ padding: "0 16px 8px", fontSize: 12, color: "#888", fontWeight: 600, borderBottom: "1px solid #f0ebe0", marginBottom: 4 }}>
                {pages.length} páginas
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
                      gap: 8,
                      padding: "8px 16px",
                      textDecoration: "none",
                      fontSize: 12.5,
                      color: "#1a1a1a",
                      borderBottom: "1px solid #f9f5ef",
                    }}
                  >
                    <span style={{ color: hasSeo ? "#2e7d32" : "#c0392b", fontSize: 10 }}>●</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title ?? p.slug}
                    </span>
                  </Link>
                );
              })}
            </Card>

            {/* instrução */}
            <Card>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                Selecione uma página na lista para editar suas meta tags, Open Graph e FAQ.
                <br /><br />
                <span style={{ color: "#2e7d32" }}>●</span> verde = SEO configurado
                &nbsp;&nbsp;
                <span style={{ color: "#c0392b" }}>●</span> vermelho = sem meta tags
              </p>
              <div style={{ marginTop: 16 }}>
                <form action={runSeoAuditBulk.bind(null, "page")}>
                  <button type="submit" className="btn-secondary" style={{ fontSize: 12 }}>
                    🔍 Auditar todas as páginas
                  </button>
                </form>
              </div>
            </Card>
          </div>
        </Section>
      )}

      {/* ── PRODUTOS ──────────────────────────────────────────────────────────── */}
      {activeSection === "produtos" && (
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Meta Tags por Produto</h2>
            <form action={runSeoAuditBulk.bind(null, "product")}>
              <button type="submit" className="btn-secondary" style={{ fontSize: 12 }}>
                🔍 Auditar todos os produtos
              </button>
            </form>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {products.map(p => {
              const seo = (p.seo ?? {}) as SeoMeta;
              const titleLen = (seo.title ?? "").length;
              const descLen  = (seo.description ?? "").length;
              const ok = titleLen >= 30 && titleLen <= 60 && descLen >= 100 && descLen <= 160;

              return (
                <Link
                  key={p.id}
                  href={`/seo/produtos?id=${p.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <Card style={{ padding: "12px 16px", cursor: "pointer", transition: "box-shadow .15s" }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{p.name ?? p.slug}</span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        background: ok ? "#d4edda" : "#f8d7da",
                        color: ok ? "#155724" : "#721c24",
                        borderRadius: 8,
                        padding: "1px 6px",
                      }}>
                        {ok ? "OK" : "PENDENTE"}
                      </span>
                    </Row>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>/{p.slug}</div>
                    {seo.title && (
                      <div style={{ fontSize: 11, color: "#555", marginTop: 6, fontStyle: "italic" }}>
                        &ldquo;{seo.title.slice(0, 60)}&rdquo;
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── BLOG ──────────────────────────────────────────────────────────────── */}
      {activeSection === "blog" && (
        <Section>
          <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Blog Engine</h2>
            <Row style={{ gap: 8 }}>
              <Link href="/seo/blog/novo" className="btn" style={{ fontSize: 12 }}>
                + Novo artigo
              </Link>
            </Row>
          </Row>

          {/* Categorias */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 8 }}>
              Categorias ({blogCats.length})
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {blogCats.map(c => (
                <span
                  key={c.id}
                  style={{
                    background: "#fef3d7",
                    border: "1px solid #e0c070",
                    borderRadius: 12,
                    padding: "3px 12px",
                    fontSize: 12,
                    color: "#7a5c1e",
                  }}
                >
                  {c.name}
                </span>
              ))}
              <Link
                href="/seo/blog/categoria/nova"
                style={{
                  background: "none",
                  border: "1px dashed #b9924d",
                  borderRadius: 12,
                  padding: "3px 12px",
                  fontSize: 12,
                  color: "#b9924d",
                  textDecoration: "none",
                }}
              >
                + Categoria
              </Link>
            </div>
          </div>

          {/* Artigos */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e0d5c5" }}>
                {["Título", "Status", "Categoria", "SEO", "Publicado em", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px", color: "#888", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#888" }}>
                    Nenhum artigo ainda. Crie o primeiro!
                  </td>
                </tr>
              )}
              {articles.map(a => {
                const hasSeo = a.seo && Object.keys(a.seo).length > 0;
                const cat = blogCats.find(c => c.id === a.category_id);
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f0ebe0" }}>
                    <td style={{ padding: "8px" }}>
                      <Link href={`/seo/blog/${a.id}`} style={{ color: "#1a1a1a", fontWeight: 600, textDecoration: "none" }}>
                        {a.title}
                      </Link>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <span style={{
                        background: a.status === "published" ? "#d4edda" : a.status === "archived" ? "#e9ecef" : "#fff3cd",
                        color: a.status === "published" ? "#155724" : a.status === "archived" ? "#495057" : "#856404",
                        borderRadius: 8,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}>
                        {a.status === "published" ? "Publicado" : a.status === "archived" ? "Arquivado" : "Rascunho"}
                      </span>
                    </td>
                    <td style={{ padding: "8px", color: "#666" }}>{cat?.name ?? "—"}</td>
                    <td style={{ padding: "8px" }}>
                      <span style={{ color: hasSeo ? "#2e7d32" : "#c0392b", fontSize: 10 }}>
                        {hasSeo ? "✓ OK" : "✗ Pendente"}
                      </span>
                    </td>
                    <td style={{ padding: "8px", color: "#888" }}>
                      {a.published_at ? new Date(a.published_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <Row style={{ gap: 8 }}>
                        <Link href={`/seo/blog/${a.id}`} style={{ fontSize: 11, color: "#7a5c1e" }}>editar</Link>
                        <form action={deleteBlogArticle.bind(null, a.id)}>
                          <button type="submit" className="btn-ghost" style={{ fontSize: 11, color: "#c0392b" }}>
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
        </Section>
      )}

      {/* ── REDIRECIONAMENTOS ─────────────────────────────────────────────────── */}
      {activeSection === "redirecionamentos" && (
        <Section>
          <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Redirecionamentos</h2>
          </Row>

          {/* Form novo */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Novo Redirecionamento</h3>
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
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 1fr auto", gap: 10, alignItems: "end" }}
            >
              <div>
                <label className="label">De (URL atual)</label>
                <input name="from_path" className="glass-input" placeholder="/produtos/antigo-slug" required />
              </div>
              <div>
                <label className="label">Para (URL destino)</label>
                <input name="to_path" className="glass-input" placeholder="/produtos/novo-slug" required />
              </div>
              <div>
                <label className="label">Código</label>
                <select name="code" className="glass-input">
                  <option value="301">301 Permanente</option>
                  <option value="302">302 Temporário</option>
                  <option value="307">307</option>
                  <option value="308">308</option>
                </select>
              </div>
              <div>
                <label className="label">Motivo (opcional)</label>
                <input name="reason" className="glass-input" placeholder="Ex: slug renomeado" />
              </div>
              <button type="submit" className="btn" style={{ fontSize: 12 }}>Adicionar</button>
            </form>
          </Card>

          {/* Tabela */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e0d5c5" }}>
                {["De", "Para", "Código", "Motivo", "Ativo", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px", color: "#888", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {redirects.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#888" }}>Nenhum redirecionamento cadastrado.</td></tr>
              )}
              {redirects.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0ebe0" }}>
                  <td style={{ padding: "8px", fontFamily: "monospace", color: "#c0392b", fontSize: 11 }}>{r.from_path}</td>
                  <td style={{ padding: "8px", fontFamily: "monospace", color: "#2e7d32", fontSize: 11 }}>{r.to_path}</td>
                  <td style={{ padding: "8px" }}>
                    <span style={{ background: "#f0ebe0", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>{r.code}</span>
                  </td>
                  <td style={{ padding: "8px", color: "#666", fontSize: 11 }}>{r.reason ?? "—"}</td>
                  <td style={{ padding: "8px" }}>
                    <span style={{ color: r.active ? "#2e7d32" : "#c0392b" }}>{r.active ? "✓" : "✗"}</span>
                  </td>
                  <td style={{ padding: "8px" }}>
                    <form action={deleteSeoRedirect.bind(null, r.id)}>
                      <button type="submit" className="btn-ghost" style={{ fontSize: 11, color: "#c0392b" }}>excluir</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ── SITEMAP ───────────────────────────────────────────────────────────── */}
      {activeSection === "sitemap" && (
        <Section>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Configuração do Sitemap</h2>
          <Card>
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
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e0d5c5" }}>
                    {["Tipo", "Incluir", "Prioridade", "Frequência"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px", color: "#888", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "product", label: "Produtos" },
                    { key: "category", label: "Categorias" },
                    { key: "page", label: "Páginas CMS" },
                    { key: "article", label: "Artigos do Blog" },
                  ].map(row => {
                    const cfg = sitemap.find(s => s.entity_type === row.key);
                    return (
                      <tr key={row.key} style={{ borderBottom: "1px solid #f0ebe0" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 600 }}>{row.label}</td>
                        <td style={{ padding: "10px 8px" }}>
                          <input
                            type="checkbox"
                            name={`${row.key}_included`}
                            defaultChecked={cfg?.included ?? true}
                          />
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <select
                            name={`${row.key}_priority`}
                            className="glass-input"
                            defaultValue={String(cfg?.priority ?? 0.5)}
                            style={{ width: 100 }}
                          >
                            {["1.0", "0.9", "0.8", "0.7", "0.6", "0.5", "0.4", "0.3", "0.2", "0.1"].map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <select
                            name={`${row.key}_freq`}
                            className="glass-input"
                            defaultValue={cfg?.change_frequency ?? "weekly"}
                            style={{ width: 130 }}
                          >
                            {["always","hourly","daily","weekly","monthly","yearly","never"].map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="submit" className="btn" style={{ fontSize: 12 }}>Salvar configuração</button>
              </div>
            </form>
          </Card>
        </Section>
      )}

      {/* ── ROBOTS ────────────────────────────────────────────────────────────── */}
      {activeSection === "robots" && (
        <Section>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Regras Robots.txt</h2>

          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Nova Regra</h3>
            <form
              action={async (fd: FormData) => {
                "use server";
                await saveRobotsRule({
                  user_agent: fd.get("user_agent") as string || "*",
                  directive: fd.get("directive") as "allow" | "disallow",
                  path: fd.get("path") as string,
                  sort_order: Number(fd.get("sort_order")) || 0,
                  active: true,
                });
              }}
              style={{ display: "grid", gridTemplateColumns: "150px 120px 1fr 80px auto", gap: 10, alignItems: "end" }}
            >
              <div>
                <label className="label">User-agent</label>
                <input name="user_agent" className="glass-input" defaultValue="*" placeholder="*" />
              </div>
              <div>
                <label className="label">Diretiva</label>
                <select name="directive" className="glass-input">
                  <option value="disallow">Disallow</option>
                  <option value="allow">Allow</option>
                </select>
              </div>
              <div>
                <label className="label">Path</label>
                <input name="path" className="glass-input" placeholder="/admin/" required />
              </div>
              <div>
                <label className="label">Ordem</label>
                <input name="sort_order" type="number" className="glass-input" defaultValue="0" style={{ width: 60 }} />
              </div>
              <button type="submit" className="btn" style={{ fontSize: 12 }}>Adicionar</button>
            </form>
          </Card>

          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Preview do robots.txt</h3>
            <pre style={{ background: "#1a1a1a", color: "#e0d5c5", padding: 16, borderRadius: 8, fontSize: 11, lineHeight: 1.7, overflowX: "auto" }}>
              {`User-agent: *\n` + robots.filter(r => r.active).sort((a, b) => a.sort_order - b.sort_order).map(r =>
                `${r.directive === "allow" ? "Allow" : "Disallow"}: ${r.path}`
              ).join("\n") + "\n\nSitemap: https://floraBotanics.com.br/sitemap.xml"}
            </pre>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {robots.map(r => (
                <Row key={r.id} style={{ justifyContent: "space-between", padding: "6px 8px", background: "#f9f5ef", borderRadius: 6 }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace" }}>
                    <span style={{ color: "#888" }}>User-agent: </span>{r.user_agent}
                    {"  "}
                    <span style={{ color: r.directive === "allow" ? "#2e7d32" : "#c0392b" }}>
                      {r.directive === "allow" ? "Allow" : "Disallow"}:
                    </span>
                    {" "}{r.path}
                  </span>
                  <Row style={{ gap: 8 }}>
                    <span style={{ fontSize: 10, color: r.active ? "#2e7d32" : "#888" }}>{r.active ? "ativo" : "inativo"}</span>
                    <form action={deleteRobotsRule.bind(null, r.id)}>
                      <button type="submit" className="btn-ghost" style={{ fontSize: 11, color: "#c0392b" }}>✕</button>
                    </form>
                  </Row>
                </Row>
              ))}
            </div>
          </Card>
        </Section>
      )}

      {/* ── AUDITORIA ─────────────────────────────────────────────────────────── */}
      {activeSection === "auditoria" && (
        <Section>
          <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Auditoria SEO</h2>
            <div style={{ display: "flex", gap: 8 }}>
              {(["product", "category", "page", "article"] as EntityType[]).map(t => (
                <form key={t} action={runSeoAuditBulk.bind(null, t)}>
                  <button type="submit" className="btn-secondary" style={{ fontSize: 11 }}>
                    Auditar {t === "product" ? "produtos" : t === "category" ? "categorias" : t === "page" ? "páginas" : "artigos"}
                  </button>
                </form>
              ))}
            </div>
          </Row>

          {audits.length === 0 ? (
            <Card>
              <p style={{ textAlign: "center", color: "#888", padding: 24 }}>
                Nenhuma auditoria executada ainda. Clique em &ldquo;Auditar&rdquo; para começar.
              </p>
            </Card>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e0d5c5" }}>
                  {["Tipo", "Score", "Issues", "Erros", "Avisos", "Info", "Executada em"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px", color: "#888", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map(a => {
                  const errors   = a.issues.filter(i => i.severity === "error").length;
                  const warnings = a.issues.filter(i => i.severity === "warning").length;
                  const infos    = a.issues.filter(i => i.severity === "info").length;
                  return (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f0ebe0" }}>
                      <td style={{ padding: "8px" }}>{a.entity_type}</td>
                      <td style={{ padding: "8px" }}><Badge score={a.score ?? 0} /></td>
                      <td style={{ padding: "8px" }}>{a.issues.length}</td>
                      <td style={{ padding: "8px", color: errors > 0 ? "#d93025" : "#888" }}>{errors}</td>
                      <td style={{ padding: "8px", color: warnings > 0 ? "#e37400" : "#888" }}>{warnings}</td>
                      <td style={{ padding: "8px", color: "#666" }}>{infos}</td>
                      <td style={{ padding: "8px", color: "#888" }}>
                        {new Date(a.ran_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {/* ── AI VISIBILITY ─────────────────────────────────────────────────────── */}
      {activeSection === "ai-visibility" && (
        <Section>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>AI Visibility Score</h2>
            <p style={{ fontSize: 12.5, color: "#666", marginTop: 6 }}>
              Mede a probabilidade de seus conteúdos aparecerem em respostas de IA (SGE, ChatGPT, Perplexity, Gemini).
              Critérios: FAQ estruturado, Schema.org, conteúdo rico, entidades/palavras-chave e autoria.
            </p>
          </div>

          {aiScores.length === 0 ? (
            <Card>
              <p style={{ textAlign: "center", color: "#888", padding: 24 }}>
                Nenhum score calculado ainda. Execute a auditoria de cada entidade para gerar os scores.
              </p>
            </Card>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e0d5c5" }}>
                  {["Tipo", "Score IA", "FAQ", "Schema", "Conteúdo Rico", "Palavras-chave", "Autoria"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px", color: "#888", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiScores.map(s => {
                  const check = (v: boolean) => (
                    <span style={{ color: v ? "#2e7d32" : "#ccc" }}>{v ? "✓" : "✗"}</span>
                  );
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f0ebe0" }}>
                      <td style={{ padding: "8px" }}>{s.entity_type}</td>
                      <td style={{ padding: "8px" }}><Badge score={s.ai_score ?? 0} /></td>
                      <td style={{ padding: "8px" }}>{check(s.has_faq)}</td>
                      <td style={{ padding: "8px" }}>{check(s.has_schema)}</td>
                      <td style={{ padding: "8px" }}>{check(s.has_rich_body)}</td>
                      <td style={{ padding: "8px" }}>{check(s.has_entities)}</td>
                      <td style={{ padding: "8px" }}>{check(s.has_author)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      )}
    </main>
  );
}
