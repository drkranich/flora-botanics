import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getProductBySlug, money } from "@/lib/catalog";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { BuyButton } from "./BuyButton";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await currentTenant();
  const product = await getProductBySlug(db(), tenant.tenantId, slug);
  if (!product) return {};
  return {
    title: `${product.name} · ${tenant.name}`,
    description: product.subtitle ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [product, menu] = await Promise.all([
    getProductBySlug(client, tenant.tenantId, slug),
    getMenu(client, tenant.tenantId, "header"),
  ]);
  if (!product) notFound();

  return (
    <>
      <div className="page-hero" style={{ paddingBottom: 0 }}>
        <SiteHeader menu={menu} />
      </div>

      <section className="container pdp">
        <div
          className="pdp-photo"
          style={
            product.cover_url
              ? { backgroundImage: `url("${product.cover_url}")` }
              : undefined
          }
        />
        <div>
          <h1>{product.name}</h1>
          {product.subtitle ? <p className="sub">{product.subtitle}</p> : null}

          <span className="price-row">
            <span className="price">{money(product.price_cents)}</span>
            {product.compare_at_cents ? (
              <span className="price-compare">{money(product.compare_at_cents)}</span>
            ) : null}
          </span>
          <p className="sku">Ref. {product.sku}</p>

          <BuyButton variantId={product.variant_id} inStock={product.in_stock} />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
