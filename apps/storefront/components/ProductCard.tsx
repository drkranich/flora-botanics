import Link from "next/link";
import { FavoriteButton } from "@/components/FavoriteButton";
import { QuickAddToCartButton } from "@/components/QuickAddToCartButton";

export interface ProductCardProduct {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  type?: string | null;
  brand_line?: string | null;
  tags?: string[] | null;
  product_variants?: Array<{
    id?: string;
    price_cents: number;
    currency: string;
    is_default: boolean;
  }>;
  product_media?: Array<{
    role: string;
    sort_order?: number | null;
    media:
      | { storage_path: string; alt: string | null }
      | Array<{ storage_path: string; alt: string | null }>
      | null;
  }>;
}

export function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function defaultVariant(product: ProductCardProduct) {
  const variants = product.product_variants ?? [];
  return variants.find((item) => item.is_default) ?? variants[0] ?? null;
}

export function productPrice(product: ProductCardProduct) {
  return defaultVariant(product)?.price_cents ?? 0;
}

export function productImages(product: ProductCardProduct, storageBase: string) {
  const seen = new Set<string>();

  return (product.product_media ?? [])
    .slice()
    .sort((a, b) => {
      if (a.role === "cover" && b.role !== "cover") return -1;
      if (b.role === "cover" && a.role !== "cover") return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    })
    .flatMap((item) => {
      const media = Array.isArray(item.media) ? item.media : item.media ? [item.media] : [];
      return media.map((m) => ({
        url: `${storageBase}${m.storage_path}`,
        alt: m.alt ?? product.name,
      }));
    })
    .filter((image) => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
}

export function ProductCard({
  product,
  storageBase,
  tenantId,
}: {
  product: ProductCardProduct;
  storageBase: string;
  tenantId?: string;
}) {
  const variant = defaultVariant(product);
  const images = productImages(product, storageBase);
  const mainImage = images[0] ?? null;
  const hoverImage = images[1] ?? mainImage;
  const tags = (product.tags ?? []).filter(Boolean).slice(0, 2);

  return (
    <article className="category-card">
        <div className="category-card-media-wrap">
        {tenantId ? (
          <div className="category-card-favorite">
            <FavoriteButton tenantId={tenantId} productId={product.id} compact />
          </div>
        ) : null}
        {mainImage ? (
          <Link href={`/produtos/${product.slug}`} className="category-card-media" aria-label={product.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="category-card-image" src={mainImage.url} alt={mainImage.alt} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="category-card-hover-image" src={hoverImage?.url ?? mainImage.url} alt="" aria-hidden />
          </Link>
        ) : (
          <Link href={`/produtos/${product.slug}`} className="category-card-media" aria-label={product.name} />
        )}
        {variant ? (
          <div className="category-card-quick-add">
            <QuickAddToCartButton
              productId={product.id}
              variantId={variant.id}
              name={product.name}
              priceCents={variant.price_cents}
              image={mainImage?.url}
            />
          </div>
        ) : null}
      </div>

      <div className="category-card-meta">
        {product.brand_line ? <span>{product.brand_line}</span> : null}
        {product.type === "kit" ? <span>Kit</span> : null}
      </div>
      <h3>{product.name}</h3>
      {tags.length > 0 ? (
        <div className="category-card-tags" aria-label="Caracteristicas do produto">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {product.subtitle ? <p>{product.subtitle}</p> : null}
      {variant ? (
        <p className="category-card-price">
          {money(variant.price_cents, variant.currency)}
        </p>
      ) : null}
      <Link href={`/produtos/${product.slug}`} className="link category-card-link">
        Ver produto
      </Link>
    </article>
  );
}
