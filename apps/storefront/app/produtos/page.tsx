import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { buildMetadata, currentSiteUrl } from "@/lib/seo";

export const revalidate = 60;

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  type: string;
  product_variants?: Array<{
    price_cents: number;
    currency: string;
    is_default: boolean;
  }>;
  product_media?: Array<{
    role: string;
    media: { storage_path: string; alt: string | null } | Array<{ storage_path: string; alt: string | null }> | null;
  }>;
}

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function coverUrl(product: ProductRow, storageBase: string) {
  const mediaRows = product.product_media ?? [];
  const raw = mediaRows.find((item) => item.role === "cover")?.media ?? mediaRows[0]?.media ?? null;
  const media = Array.isArray(raw) ? raw[0] : raw;
  return media?.storage_path ? `${storageBase}${media.storage_path}` : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await currentSiteUrl();
  return buildMetadata({
    baseUrl,
    title: "Catalogo",
    description: "Conheca a colecao publicada da Flora Botanics.",
    path: "/produtos",
  });
}

export default async function ProductsPage() {
  const tenant = await currentTenant();
  const client = db();

  const [menu, logoSetting, { data: products }] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client,
      tenant.tenantId,
      "logo"
    ),
    client
      .from("products")
      .select(
        `id, slug, name, subtitle, type,
         product_variants(price_cents, currency, is_default),
         product_media(role, media(storage_path, alt))`
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  const rows = (products ?? []) as unknown as ProductRow[];

  return (
    <>
      <div className="hero subpage-hero subpage-hero-compact">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      </div>

      <main className="categories">
        <div className="container">
          <div className="section-heading">
            <h2>Catalogo</h2>
          </div>

          {rows.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)", padding: "34px 0" }}>
              Nenhum produto publicado ainda.
            </p>
          ) : (
            <div className="category-grid">
              {rows.map((product) => {
                const variants = product.product_variants ?? [];
                const variant = variants.find((item) => item.is_default) ?? variants[0];
                const image = coverUrl(product, storageBase);

                return (
                  <article className="category-card" key={product.id}>
                    {image ? (
                      <div className="category-card-media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="category-card-image" src={image} alt={product.name} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="category-card-hover-image" src={image} alt="" aria-hidden />
                      </div>
                    ) : (
                      <div className="category-card-media" />
                    )}
                    <h3>{product.name}</h3>
                    {product.type === "kit" ? <span className="category-card-badge">Kit</span> : null}
                    {product.subtitle ? <p>{product.subtitle}</p> : null}
                    {variant ? (
                      <p style={{ marginBottom: 10, color: "var(--gold-dark)", fontWeight: 700 }}>
                        {money(variant.price_cents, variant.currency)}
                      </p>
                    ) : null}
                    <a href={`/produtos/${product.slug}`} className="link">
                      Ver produto
                    </a>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
