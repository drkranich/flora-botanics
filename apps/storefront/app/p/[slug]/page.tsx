import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getPublishedPage, getMenu, getSiteSetting } from "@flora/db";
import { SectionRenderer } from "@/blocks";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { publicFallbackPage } from "@/lib/public-pages";
import { buildMetadata, currentSiteUrl, seoFromValue } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();
  const baseUrl = await currentSiteUrl();
  const page = await getPublishedPage(client, tenant.tenantId, slug);

  if (!page) {
    const fallback = publicFallbackPage(slug);
    return buildMetadata({
      baseUrl,
      title: fallback.title,
      description: fallback.intro,
      path: `/p/${slug}`,
    });
  }

  const seo = seoFromValue(page.seo);
  return buildMetadata({
    baseUrl,
    title: seo.title ?? page.title,
    description: seo.description,
    image: seo.image,
    path: `/${slug}`,
    type: "article",
  });
}

export default async function CmsPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [page, menu, logoSetting] = await Promise.all([
    getPublishedPage(client, tenant.tenantId, slug),
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client,
      tenant.tenantId,
      "logo"
    ),
  ]);

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";

  if (!page) {
    const fallback = publicFallbackPage(slug);

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
