import type { SupabaseClient } from "@supabase/supabase-js";

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  variant_id: string;
  sku: string;
  in_stock: boolean;
  cover_url: string | null;
};

const storageBase = () =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProduct(p: any): StoreProduct {
  const variants = (p.product_variants ?? []) as any[];
  const v = variants.find((x) => x.is_default) ?? variants[0];
  const invRaw = v?.inventory;
  const inv = Array.isArray(invRaw) ? invRaw[0] : invRaw;
  const pm = (p.product_media ?? []) as any[];
  const coverRaw = pm.find((m) => m.role === "cover")?.media ?? null;
  const cover = Array.isArray(coverRaw) ? coverRaw[0] ?? null : coverRaw;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle ?? null,
    price_cents: v?.price_cents ?? 0,
    compare_at_cents: v?.compare_at_cents ?? null,
    variant_id: v?.id ?? "",
    sku: v?.sku ?? "",
    in_stock: !inv?.track || (inv?.quantity ?? 0) > 0,
    cover_url: cover ? storageBase() + cover.storage_path : null,
  };
}

const PRODUCT_SELECT = `id, slug, name, subtitle, status,
  product_variants(id, sku, price_cents, compare_at_cents, is_default,
    inventory(quantity, track)),
  product_media(role, media(storage_path))`;

export async function getCategoryWithProducts(
  db: SupabaseClient,
  tenantId: string,
  slug: string
) {
  const { data: category } = await db
    .from("categories")
    .select("id, slug, name, description")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!category) return null;

  const { data: links } = await db
    .from("product_categories")
    .select(`products!inner(${PRODUCT_SELECT})`)
    .eq("category_id", category.id);

  const products = (links ?? [])
    .map((l) => (l as any).products)
    .filter((p: any) => p && p.status === "published")
    .map(mapProduct);

  return { category, products };
}

export async function getProductBySlug(
  db: SupabaseClient,
  tenantId: string,
  slug: string
) {
  const { data } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data ? mapProduct(data) : null;
}

export function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
