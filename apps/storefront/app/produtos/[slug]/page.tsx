import Link from "next/link";
import { notFound } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const revalidate = 60;

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description_rich: unknown;
  product_variants?: Array<{
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
        `id, slug, name, subtitle, description_rich,
         product_variants(sku, name, price_cents, compare_at_cents, currency, is_default),
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

  return (
    <>
      <div className="hero subpage-hero">
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

      <main className="categories">
        <div
          className="container"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 0.9fr) minmax(280px, 1.1fr)",
            gap: 42,
            alignItems: "start",
          }}
        >
          <div>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={row.name}
                style={{ width: "100%", minHeight: 320, objectFit: "cover", background: "#d9d0bd" }}
              />
            ) : (
              <div style={{ minHeight: 320, background: "#d9d0bd" }} />
            )}
          </div>

          <section>
            <span className="eyebrow">Produto</span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 500, lineHeight: 1 }}>
              {row.name}
            </h2>
            {variant ? (
              <p style={{ marginTop: 18, fontSize: 24, fontWeight: 700, color: "var(--gold-dark)" }}>
                {money(variant.price_cents, variant.currency)}
              </p>
            ) : null}
            {description ? (
              <p style={{ marginTop: 18, color: "var(--muted)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {description}
              </p>
            ) : null}
            <a href="#newsletter" className="btn" style={{ marginTop: 28 }}>
              Avise-me
            </a>
          </section>
        </div>
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
