import type { MetadataRoute } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { absoluteUrl, currentSiteUrl } from "@/lib/seo";

export const revalidate = 3600;

type DatedSlug = {
  slug: string;
  updated_at?: string | null;
  created_at?: string | null;
};

type SitemapCfg = {
  entity_type: string;
  included: boolean;
  priority: number;
  change_frequency: string;
};

function dateOf(row: DatedSlug) {
  return row.updated_at ?? row.created_at ?? new Date().toISOString();
}

function cfgFor(configs: SitemapCfg[], type: string, defaults: { priority: number; freq: MetadataRoute.Sitemap[0]["changeFrequency"] }) {
  const cfg = configs.find(c => c.entity_type === type);
  return {
    included: cfg?.included ?? true,
    priority: cfg?.priority ?? defaults.priority,
    changeFrequency: (cfg?.change_frequency as MetadataRoute.Sitemap[0]["changeFrequency"]) ?? defaults.freq,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await currentTenant();
  const client = db();
  const baseUrl = await currentSiteUrl();

  const [
    { data: pages },
    { data: products },
    { data: categories },
    { data: campaigns },
    { data: landingPages },
    { data: articles },
    { data: sitemapConfigs },
  ] = await Promise.all([
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
    client
      .from("campaigns")
      .select("slug, updated_at")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "active"),
    client
      .from("marketing_landing_pages")
      .select("slug, updated_at")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published"),
    client
      .from("blog_articles")
      .select("slug, updated_at, published_at")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    client
      .from("seo_sitemap_config")
      .select("entity_type, included, priority, change_frequency")
      .eq("tenant_id", tenant.tenantId),
  ]);

  const configs = (sitemapConfigs ?? []) as SitemapCfg[];

  const productCfg  = cfgFor(configs, "product",  { priority: 0.8,  freq: "weekly"  });
  const categoryCfg = cfgFor(configs, "category", { priority: 0.65, freq: "weekly"  });
  const pageCfg     = cfgFor(configs, "page",     { priority: 0.7,  freq: "weekly"  });
  const articleCfg  = cfgFor(configs, "article",  { priority: 0.7,  freq: "weekly"  });

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl(baseUrl, "/"), lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl(baseUrl, "/produtos"), lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl(baseUrl, "/blog"), lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl(baseUrl, "/montar-kit"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl(baseUrl, "/favoritos"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl(baseUrl, "/conta"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl(baseUrl, "/carrinho"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl(baseUrl, "/checkout"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.35 },
  ];

  if (pageCfg.included) {
    for (const page of (pages ?? []) as DatedSlug[]) {
      if (!page.slug || page.slug === "home" || page.slug === "inicio") continue;
      entries.push({
        url: absoluteUrl(baseUrl, `/${page.slug}`),
        lastModified: new Date(dateOf(page)),
        changeFrequency: pageCfg.changeFrequency,
        priority: pageCfg.priority,
      });
    }
  }

  if (productCfg.included) {
    for (const product of (products ?? []) as DatedSlug[]) {
      if (!product.slug) continue;
      entries.push({
        url: absoluteUrl(baseUrl, `/produtos/${product.slug}`),
        lastModified: new Date(dateOf(product)),
        changeFrequency: productCfg.changeFrequency,
        priority: productCfg.priority,
      });
    }
  }

  if (categoryCfg.included) {
    for (const category of (categories ?? []) as DatedSlug[]) {
      if (!category.slug) continue;
      entries.push({
        url: absoluteUrl(baseUrl, `/categorias/${category.slug}`),
        lastModified: new Date(dateOf(category)),
        changeFrequency: categoryCfg.changeFrequency,
        priority: categoryCfg.priority,
      });
    }
  }

  for (const campaign of (campaigns ?? []) as DatedSlug[]) {
    if (!campaign.slug) continue;
    entries.push({
      url: absoluteUrl(baseUrl, `/c/${campaign.slug}`),
      lastModified: new Date(dateOf(campaign)),
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const landing of (landingPages ?? []) as DatedSlug[]) {
    if (!landing.slug) continue;
    entries.push({
      url: absoluteUrl(baseUrl, `/l/${landing.slug}`),
      lastModified: new Date(dateOf(landing)),
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  if (articleCfg.included) {
    for (const article of (articles ?? []) as (DatedSlug & { published_at?: string | null })[]) {
      if (!article.slug) continue;
      entries.push({
        url: absoluteUrl(baseUrl, `/blog/${article.slug}`),
        lastModified: new Date(article.published_at ?? dateOf(article)),
        changeFrequency: articleCfg.changeFrequency,
        priority: articleCfg.priority,
      });
    }
  }

  return entries;
}
