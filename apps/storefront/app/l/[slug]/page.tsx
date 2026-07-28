import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteFooter, SiteHeader } from "@/blocks/chrome";
import { currentTenant, db } from "@/lib/tenant";
import { buildMetadata, currentSiteUrl, seoFromValue } from "@/lib/seo";

export const revalidate = 60;

type LandingRow = {
  slug: string;
  title: string;
  content: unknown;
  seo: unknown;
  updated_at?: string | null;
};

type LandingContent = {
  eyebrow?: string;
  headline?: string;
  intro?: string;
  body?: string;
  cta_label?: string;
  cta_url?: string;
  blocks?: Array<{ type?: string; title?: string; text?: string; label?: string; url?: string }>;
};

function asContent(value: unknown): LandingContent {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as LandingContent) : {};
}

async function getLanding(slug: string) {
  const tenant = await currentTenant();
  const client = db();
  const { data } = await client
    .from("marketing_landing_pages")
    .select("slug, title, content, seo, updated_at")
    .eq("tenant_id", tenant.tenantId)
    .eq("slug", slug)
    .eq("status", "published")
    .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
    .maybeSingle();

  return { tenant, client, landing: (data ?? null) as LandingRow | null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { landing } = await getLanding(slug);
  const baseUrl = await currentSiteUrl();
  if (!landing) return buildMetadata({ baseUrl, title: "Campanha Flora", path: `/l/${slug}` });

  const seo = seoFromValue(landing.seo);
  const content = asContent(landing.content);
  return buildMetadata({
    baseUrl,
    title: seo.title ?? content.headline ?? landing.title,
    description: seo.description ?? content.intro,
    image: seo.image,
    path: `/l/${landing.slug}`,
    type: "website",
  });
}

export default async function MarketingLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, client, landing } = await getLanding(slug);
  if (!landing) notFound();

  const [menu, logoSetting] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(client, tenant.tenantId, "logo"),
  ]);
  const content = asContent(landing.content);
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];

  return (
    <>
      <div className="hero subpage-hero subpage-hero-compact">
        <SiteHeader
          menu={menu}
          logoUrl={logoSetting?.image ?? ""}
          logoWidth={logoSetting?.width ?? 160}
          logoHeight={logoSetting?.height ?? 48}
          logoColor={logoSetting?.color ?? ""}
        />
      </div>
      <main className="public-page">
        <div className="container public-page-inner marketing-landing">
          <span className="eyebrow">{content.eyebrow ?? "Campanha Flora"}</span>
          <h1>{content.headline ?? landing.title}</h1>
          {content.intro ? <p className="public-page-intro">{content.intro}</p> : null}
          {content.body ? (
            <div className="public-page-copy">
              {content.body.split(/\n{2,}/).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          {blocks.length ? (
            <div className="marketing-landing-grid">
              {blocks.map((block, index) => (
                <article key={`${block.title ?? block.type ?? "bloco"}-${index}`} className="marketing-landing-card">
                  <span className="eyebrow">{block.type ?? "Flora"}</span>
                  <h2>{block.title ?? "Cuidado Flora"}</h2>
                  {block.text ? <p>{block.text}</p> : null}
                  {block.url && block.label ? (
                    <Link href={block.url} className="btn btn-secondary">
                      {block.label}
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {content.cta_url && content.cta_label ? (
            <Link href={content.cta_url} className="btn">
              {content.cta_label}
            </Link>
          ) : null}
        </div>
      </main>
      <SiteFooter
        logoUrl={logoSetting?.image ?? ""}
        logoWidth={logoSetting?.width ?? 160}
        logoHeight={logoSetting?.height ?? 48}
        logoColor={logoSetting?.color ?? ""}
      />
    </>
  );
}
