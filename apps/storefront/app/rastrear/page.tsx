import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { buildMetadata, currentSiteUrl } from "@/lib/seo";
import { TrackingClient } from "./TrackingClient";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await currentSiteUrl();
  return buildMetadata({
    baseUrl,
    title: "Rastrear pedido",
    description: "Consulte a situação do seu pedido Flora Botanics em tempo real.",
    path: "/rastrear",
  });
}

export default async function RastrearPage() {
  const tenant = await currentTenant();
  const client = db();

  const [menu, logoSetting] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client, tenant.tenantId, "logo"
    ),
  ]);

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";

  return (
    <>
      <div className="hero subpage-hero subpage-hero-compact">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      </div>

      <main className="tracking-page-wrapper">
        <div className="container">
          <div className="section-heading" style={{ marginBottom: "2.5rem" }}>
            <span className="eyebrow">Entrega</span>
            <h1>Onde está meu pedido?</h1>
            <p style={{ maxWidth: 480, margin: "0.75rem auto 0", opacity: 0.75, fontSize: "0.95rem" }}>
              Acompanhe a jornada do seu pedido Flora Botanics, da embalagem até a sua porta.
            </p>
          </div>

          <TrackingClient />
        </div>
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
