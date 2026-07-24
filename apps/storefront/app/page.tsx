import { currentTenant, db } from "@/lib/tenant";
import { getPublishedPage, getMenu, getSiteSetting } from "@flora/db";
import { SectionRenderer } from "@/blocks";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { PremiumHome } from "@/components/PremiumHome";
import type { ProductCardProduct } from "@/components/ProductCard";

export const revalidate = 60; // ISR: revalida a cada 60s (on-publish na Fase 1)

export default async function HomePage() {
  const tenant = await currentTenant();
  const client = db();

  const [page, menu, logoSetting] = await Promise.all([
    getPublishedPage(client, tenant.tenantId, "home"),
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
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

  if (!page) {
    const [{ data: featuredProducts }, { data: featuredReviews }] = await Promise.all([
      client
        .from("products")
        .select(
          `id, slug, name, subtitle, type, brand_line, tags,
           product_variants(id, price_cents, currency, is_default),
           product_media(role, sort_order, media(storage_path, alt))`
        )
        .eq("tenant_id", tenant.tenantId)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      client
        .from("product_reviews")
        .select("id, rating, title, body, display_name")
        .eq("tenant_id", tenant.tenantId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    return (
      <div className="site-shell">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        <PremiumHome
          products={(featuredProducts ?? []) as unknown as ProductCardProduct[]}
          reviews={(featuredReviews ?? []) as Array<{ id: string; rating: number; title: string | null; body: string; display_name: string | null }>}
          storageBase={storageBase}
          tenantId={tenant.tenantId}
        />
        <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      </div>
    );
  }

  const sections = (page.sections ?? []) as Array<{
    id: string;
    block: string;
    props: Record<string, unknown>;
  }>;

  // O hero embute o header (mesma composicao do site original)
  const [first, ...rest] = sections;
  const heroFirst = first?.block === "hero";

  return (
    <>
      {heroFirst ? (
        <SectionRenderer section={first} header={<SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />} />
      ) : (
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      )}
      {(heroFirst ? rest : sections).map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}
      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
