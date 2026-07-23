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
  brand_line: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
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

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

const PRODUCT_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "simple", label: "Produtos simples" },
  { value: "variable", label: "Com variacoes" },
  { value: "kit", label: "Kits" },
  { value: "digital", label: "Digitais" },
  { value: "subscription", label: "Assinaturas" },
] as const;

const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "nome", label: "Nome A-Z" },
  { value: "preco-menor", label: "Menor preco" },
  { value: "preco-maior", label: "Maior preco" },
] as const;

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function defaultVariant(product: ProductRow) {
  const variants = product.product_variants ?? [];
  return variants.find((item) => item.is_default) ?? variants[0] ?? null;
}

function productPrice(product: ProductRow) {
  return defaultVariant(product)?.price_cents ?? 0;
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const search = param(rawParams.q).slice(0, 80);
  const categorySlug = param(rawParams.categoria);
  const requestedType = param(rawParams.tipo) || "all";
  const requestedSort = param(rawParams.ordenar) || "recentes";
  const type = PRODUCT_TYPES.some((item) => item.value === requestedType) ? requestedType : "all";
  const sort = SORT_OPTIONS.some((item) => item.value === requestedSort) ? requestedSort : "recentes";
  const normalizedSearch = normalize(search);
  const tenant = await currentTenant();
  const client = db();

  const [menu, logoSetting, { data: categories }, { data: products }] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client,
      tenant.tenantId,
      "logo"
    ),
    client
      .from("categories")
      .select("id, slug, name")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("products")
      .select(
        `id, slug, name, subtitle, type, brand_line, tags, created_at, updated_at,
         product_variants(price_cents, currency, is_default),
         product_media(role, media(storage_path, alt))`
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(180),
  ]);

  const categoryRows = (categories ?? []) as CategoryRow[];
  const selectedCategory = categoryRows.find((item) => item.slug === categorySlug) ?? null;
  const { data: categoryLinks } = selectedCategory
    ? await client
        .from("product_categories")
        .select("product_id")
        .eq("category_id", selectedCategory.id)
    : { data: [] };
  const categoryProductIds = new Set((categoryLinks ?? []).map((item) => item.product_id));
  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  const allRows = (products ?? []) as unknown as ProductRow[];
  const rows = allRows
    .filter((product) => {
      const matchesCategory = !categorySlug || (selectedCategory && categoryProductIds.has(product.id));
      const matchesType = type === "all" || product.type === type;
      const haystack = normalize(
        [product.name, product.subtitle, product.brand_line, ...(product.tags ?? [])].filter(Boolean).join(" ")
      );
      const matchesSearch =
        !normalizedSearch || normalizedSearch.split(/\s+/).every((token) => haystack.includes(token));

      return matchesCategory && matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === "nome") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "preco-menor") return productPrice(a) - productPrice(b);
      if (sort === "preco-maior") return productPrice(b) - productPrice(a);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  function catalogHref(overrides: Partial<{ q: string; categoria: string; tipo: string; ordenar: string }>) {
    const params = new URLSearchParams();
    const next = {
      q: search,
      categoria: categorySlug,
      tipo: type,
      ordenar: sort,
      ...overrides,
    };

    if (next.q) params.set("q", next.q);
    if (next.categoria) params.set("categoria", next.categoria);
    if (next.tipo && next.tipo !== "all") params.set("tipo", next.tipo);
    if (next.ordenar && next.ordenar !== "recentes") params.set("ordenar", next.ordenar);

    const query = params.toString();
    return query ? `/produtos?${query}` : "/produtos";
  }

  return (
    <>
      <div className="hero subpage-hero subpage-hero-compact">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      </div>

      <main className="categories">
        <div className="container">
          <div className="catalog-intro">
            <div className="section-heading catalog-heading">
              <h2>Catalogo</h2>
            </div>
            <p className="catalog-summary">
              {rows.length} {rows.length === 1 ? "produto encontrado" : "produtos encontrados"}
            </p>
          </div>

          <form className="catalog-filter-panel" action="/produtos" method="get">
            <label className="catalog-field">
              <span>Buscar</span>
              <input name="q" type="search" defaultValue={search} placeholder="Nome, beneficio, linha ou tag" />
            </label>
            <label className="catalog-field">
              <span>Categoria</span>
              <select name="categoria" defaultValue={categorySlug}>
                <option value="">Todas</option>
                {categoryRows.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="catalog-field">
              <span>Tipo</span>
              <select name="tipo" defaultValue={type}>
                {PRODUCT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="catalog-field">
              <span>Ordenar</span>
              <select name="ordenar" defaultValue={sort}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="catalog-filter-button">Filtrar</button>
            <a href="/produtos" className="catalog-clear-link">Limpar</a>
          </form>

          {categoryRows.length > 0 ? (
            <div className="catalog-chips" aria-label="Categorias">
              <a className={!categorySlug ? "catalog-chip is-active" : "catalog-chip"} href={catalogHref({ categoria: "" })}>
                Tudo
              </a>
              {categoryRows.map((category) => (
                <a
                  key={category.id}
                  className={category.slug === categorySlug ? "catalog-chip is-active" : "catalog-chip"}
                  href={catalogHref({ categoria: category.slug })}
                >
                  {category.name}
                </a>
              ))}
            </div>
          ) : null}

          {rows.length === 0 ? (
            <div className="catalog-empty-state">
              <h3>Nenhum produto encontrado</h3>
              <p>
                Ajuste os filtros ou limpe a busca para ver todos os produtos publicados no catalogo.
              </p>
              <a href="/produtos" className="btn">Ver catalogo completo</a>
            </div>
          ) : (
            <div className="category-grid">
              {rows.map((product) => {
                const variant = defaultVariant(product);
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
