import type { Metadata } from "next";
import Link from "next/link";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { buildMetadata, currentSiteUrl, absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  published_at: string | null;
  reading_time_min: number | null;
  author_name: string | null;
  keywords: string[];
  seo: Record<string, string> | null;
  category_id: string | null;
};

type CategoryRow = { id: string; name: string; slug: string };

type LogoSetting = { image: string; width?: number; height?: number; color?: string };

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await currentSiteUrl();
  return buildMetadata({
    baseUrl,
    title: "Blog | Flora Botanics",
    description: "Dicas de skincare, rotinas de beleza natural, ingredientes e novidades da Flora Botanics.",
    path: "/blog",
  });
}

export default async function BlogPage() {
  const tenant = await currentTenant();
  const client = db();

  const [{ data: articles }, { data: categories }, menu, logoSetting] = await Promise.all([
    client
      .from("blog_articles")
      .select("id,slug,title,subtitle,excerpt,published_at,reading_time_min,author_name,keywords,seo,category_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50),
    client
      .from("blog_categories")
      .select("id,name,slug")
      .eq("tenant_id", tenant.tenantId)
      .order("sort_order"),
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<LogoSetting>(client, tenant.tenantId, "logo"),
  ]);

  const rows    = (articles ?? []) as ArticleRow[];
  const cats    = (categories ?? []) as CategoryRow[];
  const baseUrl = await currentSiteUrl();
  const logoSrc = logoSetting?.image ? logoSetting.image : null;
  const logoUrl = logoSrc ? absoluteUrl(baseUrl, logoSrc) : undefined;
  const logoW   = logoSetting?.width ?? 120;
  const logoH   = logoSetting?.height ?? 40;
  const logoC   = logoSetting?.color ?? "#1a1a1a";

  return (
    <>
      <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoW} logoHeight={logoH} logoColor={logoC} />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>
        <header style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, color: "#2c1810", marginBottom: 8 }}>Blog Flora Botanics</h1>
          <p style={{ color: "#666", fontSize: 15 }}>
            Dicas de skincare, ingredientes naturais e rotinas de cuidado.
          </p>
        </header>

        {/* Categorias */}
        {cats.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
            <Link
              href="/blog"
              style={{
                borderRadius: 20,
                padding: "4px 14px",
                fontSize: 13,
                background: "#b9924d",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Todos
            </Link>
            {cats.map(c => (
              <Link
                key={c.id}
                href={`/blog?categoria=${c.slug}`}
                style={{
                  borderRadius: 20,
                  padding: "4px 14px",
                  fontSize: 13,
                  background: "#f5ede0",
                  color: "#7a5c1e",
                  textDecoration: "none",
                  border: "1px solid #e0c070",
                }}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {/* Grid de artigos */}
        {rows.length === 0 ? (
          <p style={{ color: "#888", textAlign: "center", padding: "60px 0" }}>
            Nenhum artigo publicado ainda. Volte em breve!
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {rows.map(a => (
              <Link
                key={a.id}
                href={`/blog/${a.slug}`}
                style={{ textDecoration: "none" }}
              >
                <article style={{
                  border: "1px solid #e8d8c0",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                  transition: "box-shadow .2s, transform .2s",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}>
                  {/* Placeholder de imagem */}
                  <div style={{
                    height: 160,
                    background: "linear-gradient(135deg, #f5ede0, #e8d0b0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                  }}>
                    🌿
                  </div>

                  <div style={{ padding: "16px 18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#2c1810", marginBottom: 6, lineHeight: 1.3 }}>
                      {a.title}
                    </h2>
                    {a.subtitle && (
                      <p style={{ fontSize: 13, color: "#7a5c1e", marginBottom: 6, fontStyle: "italic" }}>
                        {a.subtitle}
                      </p>
                    )}
                    {a.excerpt && (
                      <p style={{ fontSize: 12.5, color: "#555", lineHeight: 1.5, flex: 1 }}>
                        {a.excerpt.slice(0, 120)}{a.excerpt.length > 120 ? "…" : ""}
                      </p>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <span style={{ fontSize: 11, color: "#888" }}>
                        {a.published_at
                          ? new Date(a.published_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
                          : ""}
                      </span>
                      {a.reading_time_min && (
                        <span style={{ fontSize: 11, color: "#b9924d" }}>
                          {a.reading_time_min} min de leitura
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* JSON-LD Blog */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Blog",
              name: "Blog Flora Botanics",
              description: "Dicas de skincare, rotinas de beleza natural e ingredientes da Flora Botanics.",
              url: absoluteUrl(baseUrl, "/blog"),
              publisher: {
                "@type": "Organization",
                name: "Flora Botanics",
                url: baseUrl,
              },
              blogPost: rows.slice(0, 10).map(a => ({
                "@type": "BlogPosting",
                headline: a.title,
                url: absoluteUrl(baseUrl, `/blog/${a.slug}`),
                datePublished: a.published_at,
                ...(a.author_name ? { author: { "@type": "Person", name: a.author_name } } : {}),
              })),
            }),
          }}
        />
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoW} logoHeight={logoH} logoColor={logoC} />
    </>
  );
}
