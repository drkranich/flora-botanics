import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { ProductCard, productPrice, type ProductCardProduct } from "@/components/ProductCard";
import { buildMetadata, currentSiteUrl } from "@/lib/seo";
import { CatalogDropdown } from "./CatalogDropdown";

export const revalidate = 60;

interface ProductRow extends ProductCardProduct {
  type: string;
  brand_line: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

const PRODUCT_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "simple", label: "Produtos simples" },
  { value: "variable", label: "Com variações" },
  { value: "kit", label: "Kits" },
  { value: "digital", label: "Digitais" },
  { value: "subscription", label: "Assinaturas" },
] as const;

const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "nome", label: "Nome A-Z" },
  { value: "preco-menor", label: "Menor preço" },
  { value: "preco-maior", label: "Maior preço" },
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

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await currentSiteUrl();
  return buildMetadata({
    baseUrl,
    title: "Catálogo",
    description: "Conheça a coleção publicada da Flora Botanics.",
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
         product_media(role, sort_order, media(storage_path, alt))`
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(180),
  ]);

  const categoryRows = (categories ?? []) as CategoryRow[];
  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  const allRows = (products ?? []) as unknown as ProductRow[];
  const allProductIds = allRows.map((product) => product.id);
  const { data: productCategoryRows } = allProductIds.length
    ? await client
        .from("product_categories")
        .select("product_id, categories(name, slug)")
        .in("product_id", allProductIds)
    : { data: [] };
  const categoriesByProduct = new Map<string, string[]>();
  const categoryProductIds = new Set<string>();

  for (const item of productCategoryRows ?? []) {
    const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
    if (!category) continue;

    const names = categoriesByProduct.get(item.product_id) ?? [];
    names.push(category.name);
    categoriesByProduct.set(item.product_id, names);

    if (category.slug === categorySlug) {
      categoryProductIds.add(item.product_id);
    }
  }

  const searchSuggestions = Array.from(
    new Set(
      [
        ...categoryRows.map((category) => category.name),
        ...allRows.flatMap((product) => [
          product.name,
          product.subtitle,
          product.brand_line,
          ...(product.tags ?? []),
          ...(categoriesByProduct.get(product.id) ?? []),
        ]),
      ]
        .filter((item): item is string => Boolean(item))
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, 80);
  const rows = allRows
    .filter((product) => {
      const matchesCategory = !categorySlug || categoryProductIds.has(product.id);
      const matchesType = type === "all" || product.type === type;
      const haystack = normalize(
        [
          product.name,
          product.subtitle,
          product.brand_line,
          ...(product.tags ?? []),
          ...(categoriesByProduct.get(product.id) ?? []),
        ]
          .filter(Boolean)
          .join(" ")
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
              <h2>Catálogo</h2>
            </div>
            <p className="catalog-summary">
              {rows.length} {rows.length === 1 ? "produto encontrado" : "produtos encontrados"}
            </p>
          </div>

          <form className="catalog-filter-panel" action="/produtos" method="get">
            <label className="catalog-field">
              <span>Buscar</span>
              <input
                name="q"
                type="search"
                defaultValue={search}
                list="catalog-search-suggestions"
                placeholder="Nome, benefício, linha, categoria ou tag"
              />
            </label>
            <datalist id="catalog-search-suggestions">
              {searchSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <div className="catalog-field">
              <span>Categoria</span>
              <CatalogDropdown
                name="categoria"
                value={categorySlug}
                options={[
                  { value: "", label: "Todas" },
                  ...categoryRows.map((category) => ({ value: category.slug, label: category.name })),
                ]}
              />
            </div>
            <div className="catalog-field">
              <span>Tipo</span>
              <CatalogDropdown name="tipo" value={type} options={PRODUCT_TYPES} />
            </div>
            <div className="catalog-field">
              <span>Ordenar</span>
              <CatalogDropdown name="ordenar" value={sort} options={SORT_OPTIONS} />
            </div>
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
                Ajuste os filtros ou limpe a busca para ver todos os produtos publicados no catálogo.
              </p>
              <a href="/produtos" className="btn">Ver catálogo completo</a>
            </div>
          ) : (
            <div className="category-grid">
              {rows.map((product) => (
                <ProductCard key={product.id} product={product} storageBase={storageBase} tenantId={tenant.tenantId} />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
