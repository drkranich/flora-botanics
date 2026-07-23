import type { MetadataRoute } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { absoluteUrl, currentSiteUrl } from "@/lib/seo";

export const revalidate = 3600;

type DatedSlug = {
  slug: string;
  updated_at?: string | null;
  created_at?: string | null;
};

function dateOf(row: DatedSlug) {
  return row.updated_at ?? row.created_at ?? new Date().toISOString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await currentTenant();
  const client = db();
  const baseUrl = await currentSiteUrl();

  const [{ data: pages }, { data: products }, { data: categories }] = await Promise.all([
    client
      .from("pages")
      .select("slug, updated_at")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published"),
    client
      .from("products")
      .select("slug, updated_at")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .is("deleted_at", null),
    client
      .from("categories")
      .select("slug, updated_at")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published"),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl(baseUrl, "/"), lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl(baseUrl, "/produtos"), lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl(baseUrl, "/conta"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl(baseUrl, "/carrinho"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];

  for (const page of (pages ?? []) as DatedSlug[]) {
    if (!page.slug || page.slug === "home" || page.slug === "inicio") continue;
    entries.push({
      url: absoluteUrl(baseUrl, `/${page.slug}`),
      lastModified: new Date(dateOf(page)),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const product of (products ?? []) as DatedSlug[]) {
    if (!product.slug) continue;
    entries.push({
      url: absoluteUrl(baseUrl, `/produtos/${product.slug}`),
      lastModified: new Date(dateOf(product)),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const category of (categories ?? []) as DatedSlug[]) {
    if (!category.slug) continue;
    entries.push({
      url: absoluteUrl(baseUrl, `/categorias/${category.slug}`),
      lastModified: new Date(dateOf(category)),
      changeFrequency: "weekly",
      priority: 0.65,
    });
  }

  return entries;
}
