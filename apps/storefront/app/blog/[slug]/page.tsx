import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { buildMetadata, currentSiteUrl, absoluteUrl, DEFAULT_DESCRIPTION } from "@/lib/seo";

export const revalidate = 3600;

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body_rich: unknown;
  published_at: string | null;
  reading_time_min: number | null;
  author_name: string | null;
  author_role: string | null;
  keywords: string[];
  seo: Record<string, string | string[]> | null;
  faq: { q: string; a: string }[] | null;
  category_id: string | null;
};

type LogoSetting = { image: string; width?: number; height?: number; color?: string };

// ── generateMetadata ───────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();
  const baseUrl = await currentSiteUrl();

  const { data: article } = await client
    .from("blog_articles")
    .select("title, subtitle, excerpt, seo, keywords, author_name, published_at")
    .eq("tenant_id", tenant.tenantId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) {
    return buildMetadata({ baseUrl, title: "Artigo não encontrado", description: DEFAULT_DESCRIPTION, path: `/blog/${slug}` });
  }

  const seo = (article.seo ?? {}) as Record<string, string>;
  const kw  = (article as unknown as { keywords?: string[] }).keywords ?? [];

  const base = buildMetadata({
    baseUrl,
    title: seo.title || article.title,
    description: seo.description || article.excerpt || article.subtitle || DEFAULT_DESCRIPTION,
    path: `/blog/${slug}`,
    image: seo.og_image || undefined,
    type: "article",
  });

  return {
    ...base,
    ...(kw.length ? { keywords: kw } : {}),
    ...(seo.robots ? { robots: seo.robots } : {}),
    openGraph: {
      ...base.openGraph,
      ...(seo.og_title ? { title: seo.og_title } : {}),
      ...(seo.og_description ? { description: seo.og_description } : {}),
      ...(article.published_at ? { publishedTime: article.published_at } : {}),
      ...(article.author_name ? { authors: [article.author_name] } : {}),
    },
    twitter: {
      ...base.twitter,
      card: seo.og_image ? "summary_large_image" : "summary",
    },
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [{ data: article }, menu, logoSetting] = await Promise.all([
    client
      .from("blog_articles")
      .select("id,slug,title,subtitle,excerpt,body_rich,published_at,reading_time_min,author_name,author_role,keywords,seo,faq,category_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<LogoSetting>(client, tenant.tenantId, "logo"),
  ]);

  if (!article) notFound();

  const a = article as ArticleRow;
  const baseUrl = await currentSiteUrl();
  const seo = (a.seo ?? {}) as Record<string, string>;
  const faqItems = Array.isArray(a.faq) ? a.faq.filter(f => f.q && f.a) : [];

  const logoSrc = logoSetting?.image ?? null;
  const logoUrl = logoSrc ? absoluteUrl(baseUrl, logoSrc) : undefined;
  const logoW   = logoSetting?.width ?? 120;
  const logoH   = logoSetting?.height ?? 40;
  const logoC   = logoSetting?.color ?? "#1a1a1a";

  const articleUrl = absoluteUrl(baseUrl, `/blog/${a.slug}`);

  // JSON-LD BlogPosting com FAQPage embutido
  const jsonLdBlogPost = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.excerpt ?? a.subtitle ?? undefined,
    url: articleUrl,
    datePublished: a.published_at,
    dateModified: a.published_at,
    ...(a.author_name ? {
      author: {
        "@type": "Person",
        name: a.author_name,
        ...(a.author_role ? { jobTitle: a.author_role } : {}),
      },
    } : {
      author: {
        "@type": "Organization",
        name: "Flora Botanics",
        url: baseUrl,
      },
    }),
    publisher: {
      "@type": "Organization",
      name: "Flora Botanics",
      url: baseUrl,
    },
    ...(a.keywords?.length ? { keywords: a.keywords.join(", ") } : {}),
    ...(seo.og_image ? { image: seo.og_image } : {}),
    ...(a.reading_time_min ? { timeRequired: `PT${a.reading_time_min}M` } : {}),
  };

  const jsonLdFaq = faqItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  } : null;

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl(baseUrl, "/blog") },
      { "@type": "ListItem", position: 3, name: a.title, item: articleUrl },
    ],
  };

  return (
    <>
      <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoW} logoHeight={logoH} logoColor={logoC} />

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: 24, fontSize: 12, color: "#888" }}>
          <Link href="/" style={{ color: "#b9924d", textDecoration: "none" }}>Home</Link>
          {" / "}
          <Link href="/blog" style={{ color: "#b9924d", textDecoration: "none" }}>Blog</Link>
          {" / "}
          <span>{a.title}</span>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#2c1810", lineHeight: 1.2, marginBottom: 10 }}>
            {a.title}
          </h1>
          {a.subtitle && (
            <p style={{ fontSize: 18, color: "#7a5c1e", fontStyle: "italic", marginBottom: 16 }}>
              {a.subtitle}
            </p>
          )}

          {/* Meta linha */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12.5, color: "#888", paddingBottom: 20, borderBottom: "1px solid #e8d8c0" }}>
            {a.author_name && (
              <span>✍️ <strong style={{ color: "#555" }}>{a.author_name}</strong>{a.author_role ? ` · ${a.author_role}` : ""}</span>
            )}
            {a.published_at && (
              <span>
                📅 {new Date(a.published_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
            {a.reading_time_min && (
              <span>⏱ {a.reading_time_min} min de leitura</span>
            )}
            {a.keywords?.length > 0 && (
              <span>🏷 {a.keywords.slice(0, 4).join(", ")}</span>
            )}
          </div>
        </header>

        {/* Excerpt */}
        {a.excerpt && (
          <div style={{
            background: "#fffbf5",
            border: "2px solid #e8d0a0",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 28,
            fontSize: 15,
            color: "#555",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}>
            {a.excerpt}
          </div>
        )}

        {/* Corpo — rich text placeholder */}
        {a.body_rich ? (
          <div
            className="prose-flora"
            style={{
              fontSize: 15,
              lineHeight: 1.75,
              color: "#333",
              marginBottom: 40,
            }}
          >
            {/* Renderização simplificada de rich text (JSON) */}
            <RichTextRenderer content={a.body_rich} />
          </div>
        ) : (
          <div style={{ padding: "32px 0", color: "#888", textAlign: "center", fontSize: 14 }}>
            Conteúdo do artigo em breve.
          </div>
        )}

        {/* FAQ */}
        {faqItems.length > 0 && (
          <section style={{ marginBottom: 40 }} aria-label="Perguntas frequentes">
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#2c1810", marginBottom: 16 }}>
              Perguntas Frequentes
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {faqItems.map((item, i) => (
                <details
                  key={i}
                  style={{
                    border: "1px solid #e8d8c0",
                    borderRadius: 8,
                    padding: "14px 18px",
                    background: "#fffbf5",
                  }}
                >
                  <summary style={{
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#2c1810",
                    listStyle: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    userSelect: "none",
                  }}>
                    {item.q}
                    <span style={{ color: "#b9924d", fontSize: 18, lineHeight: 1 }}>+</span>
                  </summary>
                  <p style={{ marginTop: 10, fontSize: 13.5, color: "#555", lineHeight: 1.6 }}>
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Voltar */}
        <div style={{ paddingTop: 24, borderTop: "1px solid #e8d8c0" }}>
          <Link
            href="/blog"
            style={{
              color: "#b9924d",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Ver todos os artigos
          </Link>
        </div>

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBlogPost) }}
        />
        {jsonLdFaq && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
        />
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoW} logoHeight={logoH} logoColor={logoC} />
    </>
  );
}

// ── Rich Text Renderer (simplificado para Tiptap/Lexical JSON) ─────────────────
function RichTextRenderer({ content }: { content: unknown }): React.ReactElement {
  if (!content) return <></>;

  // Tiptap doc format
  if (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    (content as { type: string }).type === "doc" &&
    "content" in content
  ) {
    const doc = content as { type: string; content: unknown[] };
    return <>{doc.content.map((node, i) => <TiptapNode key={i} node={node} />)}</>;
  }

  // Fallback: string
  if (typeof content === "string") {
    return <p>{content}</p>;
  }

  return <></>;
}

function TiptapNode({ node }: { node: unknown }): React.ReactElement {
  if (!node || typeof node !== "object") return <></>;
  const n = node as { type?: string; content?: unknown[]; text?: string; marks?: { type: string }[]; attrs?: Record<string, unknown> };

  const inner = n.content?.map((c, i) => <TiptapNode key={i} node={c} />) ?? null;

  switch (n.type) {
    case "paragraph":
      return <p style={{ marginBottom: "1em" }}>{inner}</p>;
    case "heading": {
      const level = (n.attrs?.level as number) ?? 2;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      const sizes: Record<number, string> = { 1: "28px", 2: "22px", 3: "18px", 4: "16px" };
      return <Tag style={{ fontSize: sizes[level] ?? "16px", fontWeight: 700, color: "#2c1810", margin: "24px 0 10px" }}>{inner}</Tag>;
    }
    case "bulletList":
      return <ul style={{ paddingLeft: 20, marginBottom: "1em" }}>{inner}</ul>;
    case "orderedList":
      return <ol style={{ paddingLeft: 20, marginBottom: "1em" }}>{inner}</ol>;
    case "listItem":
      return <li style={{ marginBottom: 4 }}>{inner}</li>;
    case "blockquote":
      return (
        <blockquote style={{
          borderLeft: "4px solid #b9924d",
          paddingLeft: 16,
          margin: "16px 0",
          color: "#666",
          fontStyle: "italic",
        }}>
          {inner}
        </blockquote>
      );
    case "hardBreak":
      return <br />;
    case "text": {
      let el: React.ReactElement = <>{n.text}</>;
      for (const mark of n.marks ?? []) {
        if (mark.type === "bold") el = <strong>{el}</strong>;
        if (mark.type === "italic") el = <em>{el}</em>;
        if (mark.type === "underline") el = <u>{el}</u>;
        if (mark.type === "code") el = <code style={{ background: "#f5f0eb", padding: "1px 4px", borderRadius: 3, fontSize: "0.9em" }}>{el}</code>;
      }
      return el;
    }
    default:
      return <>{inner}</>;
  }
}
