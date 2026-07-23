import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getPublishedPage, getMenu, getSiteSetting } from "@flora/db";
import { SectionRenderer } from "@/blocks";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { publicFallbackPage } from "@/lib/public-pages";
import { buildMetadata, currentSiteUrl, seoFromValue } from "@/lib/seo";

export const revalidate = 60;

const FALLBACK_ANCHORS: Record<string, string> = {
  ingredientes: "/#ingredientes",
  sobre: "/#sobre",
  "sobre-nos": "/p/sobre-nos",
  sustentabilidade: "/p/sustentabilidade",
  newsletter: "/#newsletter",
};

function pageSlugCandidates(segments: string[]) {
  const joined = segments.join("/");
  const last = segments[segments.length - 1] ?? "";
  const candidates = [joined, last];

  if (segments[0] === "p" && last) {
    candidates.unshift(last);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();
  const baseUrl = await currentSiteUrl();
  let page: Awaited<ReturnType<typeof getPublishedPage>> | null = null;
  let matchedSlug = slug.join("/");

  for (const candidate of pageSlugCandidates(slug)) {
    page = await getPublishedPage(client, tenant.tenantId, candidate);
    if (page) {
      matchedSlug = candidate;
      break;
    }
  }

  if (!page) {
    const last = slug[slug.length - 1] ?? slug.join("-");
    const fallback = publicFallbackPage(last);
    return buildMetadata({
      baseUrl,
      title: fallback.title,
      description: fallback.intro,
      path: `/${slug.join("/")}`,
    });
  }

  const seo = seoFromValue(page.seo);
  return buildMetadata({
    baseUrl,
    title: seo.title ?? page.title,
    description: seo.description,
    image: seo.image,
    path: `/${matchedSlug}`,
    type: "article",
  });
}

export default async function CmsCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [menu, logoSetting] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client,
      tenant.tenantId,
      "logo"
    ),
  ]);

  let page: Awaited<ReturnType<typeof getPublishedPage>> | null = null;

  for (const candidate of pageSlugCandidates(slug)) {
    page = await getPublishedPage(client, tenant.tenantId, candidate);
    if (page) break;
  }

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";

  if (!page) {
    const last = slug[slug.length - 1] ?? "";
    const anchor = FALLBACK_ANCHORS[last];
    if (anchor && slug.length === 1) redirect(anchor);
    const fallback = publicFallbackPage(last || slug.join("-"));

    return (
      <>
        <div className="hero subpage-hero subpage-hero-compact">
          <SiteHeader
            menu={menu}
            logoUrl={logoUrl}
            logoWidth={logoWidth}
            logoHeight={logoHeight}
            logoColor={logoColor}
          />
        </div>
        <main className="public-page">
          <div className="container public-page-inner">
            <span className="eyebrow">{fallback.eyebrow}</span>
            <h1>{fallback.title}</h1>
            <p className="public-page-intro">{fallback.intro}</p>
            <div className="public-page-copy">
              {fallback.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {fallback.cta ? (
              <a href={fallback.cta.href} className="btn">
                {fallback.cta.label}
              </a>
            ) : null}
          </div>
        </main>
        <SiteFooter
          logoUrl={logoUrl}
          logoWidth={logoWidth}
          logoHeight={logoHeight}
          logoColor={logoColor}
        />
      </>
    );
  }

  const sections = (page.sections ?? []) as Array<{
    id: string;
    block: string;
    props: Record<string, unknown>;
  }>;
  const [first, ...rest] = sections;
  const heroFirst = first?.block === "hero";

  return (
    <>
      {heroFirst ? (
        <SectionRenderer
          section={first}
          header={
            <SiteHeader
              menu={menu}
              logoUrl={logoUrl}
              logoWidth={logoWidth}
              logoHeight={logoHeight}
              logoColor={logoColor}
            />
          }
        />
      ) : (
        <div className="hero subpage-hero subpage-hero-compact">
          <SiteHeader
            menu={menu}
            logoUrl={logoUrl}
            logoWidth={logoWidth}
            logoHeight={logoHeight}
            logoColor={logoColor}
          />
        </div>
      )}
      <main className={heroFirst ? undefined : "page-content"}>
        {(heroFirst ? rest : sections).map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </main>
      <SiteFooter
        logoUrl={logoUrl}
        logoWidth={logoWidth}
        logoHeight={logoHeight}
        logoColor={logoColor}
      />
    </>
  );
}
