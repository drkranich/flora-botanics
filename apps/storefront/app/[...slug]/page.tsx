import { redirect } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getPublishedPage, getMenu, getSiteSetting } from "@flora/db";
import { SectionRenderer } from "@/blocks";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const revalidate = 60;

const FALLBACK_ANCHORS: Record<string, string> = {
  ingredientes: "/#ingredientes",
  sobre: "/#sobre",
  "sobre-nos": "/#sobre",
  sustentabilidade: "/#sustentabilidade",
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

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    const fallback = FALLBACK_ANCHORS[last];
    if (fallback && slug.length === 1) redirect(fallback);
    const title = titleFromSlug(last || slug.join("-"));

    return (
      <>
        <div className="hero subpage-hero subpage-hero-compact">
          <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        </div>
        <main className="page-content">
          <div className="container">
            <p>
              Conteúdo de <strong>{title}</strong> — edite esta página no painel (CMS → {title}).
            </p>
          </div>
        </main>
        <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
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
          header={<SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />}
        />
      ) : (
        <div className="hero subpage-hero subpage-hero-compact">
          <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        </div>
      )}
      <main className={heroFirst ? undefined : "page-content"}>
        {(heroFirst ? rest : sections).map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </main>
      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
