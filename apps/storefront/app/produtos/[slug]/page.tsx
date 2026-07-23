import Link from "next/link";
import { notFound } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { AddToCartButton } from "./AddToCartButton";

export const revalidate = 60;

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  type: string;
  description_rich: unknown;
  product_variants?: Array<{
    id: string;
    sku: string;
    name: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    currency: string;
    is_default: boolean;
  }>;
  product_media?: Array<{
    role: string;
    media: { storage_path: string; alt: string | null } | Array<{ storage_path: string; alt: string | null }> | null;
  }>;
}

interface KitItemRow {
  component_variant_id: string;
  quantity: number;
}

interface KitComponentRow {
  id: string;
  sku: string;
  name: string | null;
  inventory?: { quantity: number; reserved: number | null } | Array<{ quantity: number; reserved: number | null }> | null;
  products?: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
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

function richTextToPlain(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(richTextToPlain).filter(Boolean).join("\n\n") || null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (Array.isArray(record.content)) return richTextToPlain(record.content);
  }
  return null;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [{ data: product }, menu, logoSetting] = await Promise.all([
    client
      .from("products")
      .select(
        `id, slug, name, subtitle, type, description_rich,
         product_variants(id, sku, name, price_cents, compare_at_cents, currency, is_default),
         product_media(role, media(storage_path, alt))`
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("slug", slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle(),
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client,
      tenant.tenantId,
      "logo"
    ),
  ]);

  if (!product) notFound();

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  const row = product as unknown as ProductRow;
  const variants = row.product_variants ?? [];
  const variant = variants.find((item) => item.is_default) ?? variants[0];
  const image = coverUrl(row, storageBase);
  const description = richTextToPlain(row.description_rich);
  let kitItems: Array<KitItemRow & { component?: KitComponentRow; stock: number }> = [];
  let kitAvailable = 0;

  if (row.type === "kit") {
    const { data: rawItems } = await client
      .from("product_kit_items")
      .select("component_variant_id, quantity")
      .eq("tenant_id", tenant.tenantId)
      .eq("kit_product_id", row.id)
      .order("sort_order");

    const items = (rawItems ?? []) as KitItemRow[];
    const componentIds = items.map((item) => item.component_variant_id);

    if (componentIds.length > 0) {
      const { data: rawComponents } = await client
        .from("product_variants")
        .select("id, sku, name, inventory(quantity, reserved), products(name, slug)")
        .eq("tenant_id", tenant.tenantId)
        .in("id", componentIds);

      const components = new Map(
        ((rawComponents ?? []) as unknown as KitComponentRow[]).map((component) => [component.id, component])
      );

      kitItems = items.map((item) => {
        const component = components.get(item.component_variant_id);
        const inventory = first(component?.inventory);
        const stock = Math.max((inventory?.quantity ?? 0) - (inventory?.reserved ?? 0), 0);
        return { ...item, component, stock };
      });

      kitAvailable = Math.min(
        ...kitItems.map((item) => Math.floor(item.stock / Math.max(item.quantity, 1)))
      );
    }
  }

  return (
    <>
      <div className="hero subpage-hero product-hero-compact">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        <div className="container hero-inner" style={{ paddingTop: 48 }}>
          <div className="hero-text">
            <Link href="/produtos" className="eyebrow">
              Catalogo
            </Link>
            <h1>{row.name}</h1>
            {row.subtitle ? <p>{row.subtitle}</p> : null}
          </div>
        </div>
      </div>

      <main className="product-page">
        <div className="container product-detail-grid">
          <div className="product-gallery-card">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={row.name}
                className="product-detail-image"
              />
            ) : (
              <div className="product-detail-image" />
            )}
          </div>

          <section className="product-info-panel">
            <span className="eyebrow">Produto</span>
            <h2>{row.name}</h2>
            {row.type === "kit" ? <span className="product-kind-badge">Kit botanico</span> : null}
            {variant ? (
              <p className="product-price">
                {money(variant.price_cents, variant.currency)}
              </p>
            ) : null}
            {description ? (
              <p className="product-description">
                {description}
              </p>
            ) : null}

            {row.type === "kit" ? (
              <div className="kit-composition">
                <strong>Este kit inclui</strong>
                {kitItems.length === 0 ? (
                  <p>Componentes ainda nao cadastrados para este kit.</p>
                ) : (
                  <ul>
                    {kitItems.map((item) => {
                      const product = first(item.component?.products);
                      return (
                        <li key={item.component_variant_id}>
                          <span>{product?.name ?? item.component?.sku ?? "Componente"}</span>
                          <em>{item.quantity} un.</em>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <small>
                  Disponibilidade calculada pelo estoque dos componentes: {kitAvailable} kits.
                </small>
              </div>
            ) : null}

            {variant ? (
              <AddToCartButton
                item={{
                  product_id: row.id,
                  variant_id: variant.id,
                  name: row.name,
                  slug: row.slug,
                  image: image ?? undefined,
                  price_cents: variant.price_cents,
                  quantity: 1,
                }}
                disabled={row.type === "kit" && kitAvailable <= 0}
                disabledLabel="Kit indisponivel"
              />
            ) : (
              <a href="#newsletter" className="btn" style={{ marginTop: 28 }}>
                Avise-me
              </a>
            )}
          </section>
        </div>
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
