import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getPublishedPage, getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { SectionRenderer } from "@/blocks";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await currentTenant();
  const page = await getPublishedPage(db(), tenant.tenantId, slug);
  if (!page) return {};
  return { title: `${page.title} · ${tenant.name}` };
}

/** Rota genérica das páginas institucionais do CMS (/p/sobre-nos etc.). */
export default async function InstitutionalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [page, menu] = await Promise.all([
    getPublishedPage(client, tenant.tenantId, slug),
    getMenu(client, tenant.tenantId, "header"),
  ]);
  if (!page) notFound();

  const sections = (page.sections ?? []) as Array<{
    id: string;
    block: string;
    props: Record<string, unknown>;
  }>;

  return (
    <>
      <div className="page-hero">
        <SiteHeader menu={menu} />
        <div className="container">
          <span className="breadcrumb">Início / {page.title}</span>
          <h1>{page.title}</h1>
        </div>
      </div>

      <div style={{ minHeight: 240 }}>
        {sections.map((s) => (
          <SectionRenderer key={s.id} section={s} />
        ))}
      </div>

      <SiteFooter />
    </>
  );
}
