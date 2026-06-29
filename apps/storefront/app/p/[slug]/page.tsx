import { notFound, redirect } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getPublishedPage, getMenu, getSiteSetting } from "@flora/db";
import { SectionRenderer } from "@/blocks";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const revalidate = 60;

const FALLBACK_ANCHORS: Record<string, string> = {
  ingredientes: "/#ingredientes",
  "sobre-nos": "/#sobre",
  sustentabilidade: "/#sustentabilidade",
  newsletter: "/#newsletter",
};

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

  if (!page) {
    const fallback = FALLBACK_ANCHORS[slug];
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
