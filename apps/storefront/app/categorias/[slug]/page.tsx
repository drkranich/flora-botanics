import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { titleFromSlug } from "@/lib/public-pages";
import { buildMetadata, currentSiteUrl } from "@/lib/seo";

export const revalidate = 60;

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface ProductRow extends ProductCardProduct {}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();
  const baseUrl = await currentSiteUrl();
  const { data: category } = await client
    .from("categories")
    .select("name, description")
    .eq("tenant_id", tenant.tenantId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return buildMetadata({
    baseUrl,
    title: category?.name ?? titleFromSlug(slug),
    description: category?.description ?? "Produtos publicados nesta categoria da Flora Botanics.",
    path: `/categorias/${slug}`,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [{ data: category }, menu, logoSetting] = await Promise.all([
    client
      .from("categories")
      .select("id, slug, name, description")
      .eq("tenant_id", tenant.tenantId)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client,
      tenant.tenantId,
      "logo"
    ),
  ]);

  const { data: links } = category
    ? await client
        .from("product_categories")
        .select("product_id")
        .eq("category_id", category.id)
    : { data: [] };
  const productIds = (links ?? []).map((item) => item.product_id).filter(Boolean);

  const { data: products } = productIds.length
    ? await client
        .from("products")
        .select(
          `id, slug, name, subtitle, type, brand_line, tags,
           product_variants(price_cents, currency, is_default),
           product_media(role, sort_order, media(storage_path, alt))`
        )
        .eq("tenant_id", tenant.tenantId)
        .eq("status", "published")
        .is("deleted_at", null)
        .in("id", productIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  const cat =
    category ??
    ({
      id: "",
      slug,
      name: titleFromSlug(slug),
      description: "Esta categoria esta pronta para receber produtos publicados no CMS.",
    } as CategoryRow);
  const rows = (products ?? []) as unknown as ProductRow[];

  return (
    <>
      <div className="hero subpage-hero">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        <div className="container hero-inner" style={{ paddingTop: 48 }}>
          <div className="hero-text">
            <span className="eyebrow">Categoria</span>
            <h1>{cat.name}</h1>
            {cat.description ? <p>{cat.description}</p> : null}
          </div>
        </div>
      </div>

      <main className="categories">
        <div className="container">
          <div className="section-heading">
            <h2>Produtos da categoria</h2>
          </div>

          {rows.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)", padding: "34px 0" }}>
              Nenhum produto publicado nesta categoria ainda.
            </p>
          ) : (
            <div className="category-grid">
              {rows.map((product) => (
                <ProductCard key={product.id} product={product} storageBase={storageBase} />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
