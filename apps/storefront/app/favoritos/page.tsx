import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { buildMetadata, currentSiteUrl } from "@/lib/seo";
import { FavoritesPanel } from "./FavoritesPanel";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await currentSiteUrl();
  return buildMetadata({
    baseUrl,
    title: "Favoritos",
    description: "Produtos salvos na sua lista de desejos Flora Botanics.",
    path: "/favoritos",
  });
}

export default async function FavoritesPage() {
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

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

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
      <main className="wishlist-page">
        <div className="container">
          <FavoritesPanel tenantId={tenant.tenantId} storageBase={storageBase} />
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
