import { notFound, redirect } from "next/navigation";
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

  let page:
    | Awaited<ReturnType<typeof getPublishedPage>>
    | null = null;

  for (const candidate of pageSlugCandidates(slug)) {
    page = await getPublishedPage(client, tenant.tenantId, candidate);
    if (page) break;
  }

  if (!page) {
    const last = slug[slug.length - 1] ?? "";
    const fallback = FALLBACK_ANCHORS[last];
    if (fallback) redirect(fallback);
    notFound();
  }

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";
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
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      )}
      {(heroFirst ? rest : sections).map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
