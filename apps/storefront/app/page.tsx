import { currentTenant, db } from "@/lib/tenant";
import { getPublishedPage, getMenu } from "@flora/db";
import { SectionRenderer } from "@/blocks";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const revalidate = 60; // ISR: revalida a cada 60s (on-publish na Fase 1)

export default async function HomePage() {
  const tenant = await currentTenant();
  const client = db();

  const [page, menu] = await Promise.all([
    getPublishedPage(client, tenant.tenantId, "home"),
    getMenu(client, tenant.tenantId, "header"),
  ]);

  if (!page) {
    return (
      <main style={{ padding: 80, textAlign: "center" }}>
        <h1>Página não publicada</h1>
        <p>Publique a página “home” no CMS.</p>
      </main>
    );
  }

  const sections = (page.sections ?? []) as Array<{
    id: string;
    block: string;
    props: Record<string, unknown>;
  }>;

  // O hero embute o header (mesma composição do site original)
  const [first, ...rest] = sections;
  const heroFirst = first?.block === "hero";

  return (
    <>
      {heroFirst ? (
        <SectionRenderer section={first} header={<SiteHeader menu={menu} />} />
      ) : (
        <SiteHeader menu={menu} />
      )}
      {(heroFirst ? rest : sections).map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}
      <SiteFooter />
    </>
  );
}
