import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { buildMetadata, currentSiteUrl } from "@/lib/seo";
import { KitBuilder } from "./KitBuilder";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await currentSiteUrl();
  return buildMetadata({
    baseUrl,
    title: "Monte seu kit",
    description: "Escolha seus produtos favoritos e monte um kit personalizado com desconto.",
    path: "/montar-kit",
  });
}

export interface KitProduct {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  variant_id: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  weight_g: number;
}

export default async function MontarKitPage() {
  const tenant = await currentTenant();
  const client = db();

  const [menu, logoSetting, { data: rawProducts }] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client, tenant.tenantId, "logo"
    ),
    client
      .from("products")
      .select(`
        id, slug, name, subtitle, weight_g,
        product_variants(id, price_cents, currency, is_default),
        product_media(role, sort_order, media(storage_path, alt))
      `)
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .is("deleted_at", null)
      .in("type", ["simple", "variable"])
      .order("name", { ascending: true })
      .limit(60),
  ]);

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

  const products: KitProduct[] = (rawProducts ?? []).flatMap((p) => {
    const variants = Array.isArray(p.product_variants) ? p.product_variants : [p.product_variants].filter(Boolean);
    const variant = (variants as Array<{ id: string; price_cents: number; currency: string; is_default: boolean }>)
      .find((v) => v.is_default) ?? (variants as Array<{ id: string; price_cents: number; currency: string; is_default: boolean }>)[0];
    if (!variant) return [];

    const mediaList = (Array.isArray(p.product_media) ? p.product_media : []) as Array<{
      role: string;
      sort_order: number;
      media: { storage_path: string } | Array<{ storage_path: string }> | null;
    }>;
    const coverMedia = mediaList.find((m) => m.role === "cover")?.media ?? mediaList[0]?.media ?? null;
    const media = Array.isArray(coverMedia) ? coverMedia[0] : coverMedia;
    const imageUrl = media?.storage_path ? `${storageBase}${media.storage_path}` : null;

    return [{
      id: p.id,
      slug: p.slug,
      name: p.name,
      subtitle: p.subtitle ?? null,
      variant_id: variant.id,
      price_cents: variant.price_cents,
      currency: variant.currency ?? "BRL",
      image_url: imageUrl,
      weight_g: (p as unknown as { weight_g?: number }).weight_g ?? 200,
    }];
  });

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";

  return (
    <>
      <div className="hero subpage-hero subpage-hero-compact">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      </div>
      <main className="kit-builder-page">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Personalizado</span>
            <h1>Monte seu kit Flora</h1>
            <p className="kit-builder-intro">
              Escolha os produtos, defina as quantidades e ganhe desconto progressivo. Quanto mais itens, maior o desconto.
            </p>
          </div>
          <KitBuilder products={products} />
        </div>
      </main>
      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
