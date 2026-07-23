import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { FavoriteButton } from "@/components/FavoriteButton";
import { AddToCartButton } from "./AddToCartButton";
import { ProductGallery, type GalleryImage } from "./ProductGallery";
import { ProductReviews, type ApprovedReview } from "./ProductReviews";
import { absoluteUrl, buildMetadata, currentSiteUrl, DEFAULT_DESCRIPTION } from "@/lib/seo";

export const revalidate = 60;

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  type: string;
  brand_line: string | null;
  tags: string[];
  description_rich: unknown;
  editorial_content: unknown;
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
    sort_order: number;
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

type ProductEditorialCard = {
  eyebrow: string;
  title: string;
  body: string;
};

type ProductFaqItem = {
  question: string;
  answer: string;
};

type ProductEditorialContent = {
  cards: ProductEditorialCard[];
  faqTitle: string;
  faqItems: ProductFaqItem[];
};

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function coverUrl(product: ProductRow, storageBase: string) {
  const mediaRows = product.product_media ?? [];
  const raw = mediaRows.find((item) => item.role === "cover")?.media ?? mediaRows[0]?.media ?? null;
  const media = Array.isArray(raw) ? raw[0] : raw;
  return media?.storage_path ? `${storageBase}${media.storage_path}` : null;
}

function galleryImages(product: ProductRow, storageBase: string): GalleryImage[] {
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

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function editorialContent(
  value: unknown,
  benefitTags: string[],
  routineText: string
): ProductEditorialContent {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawCards = Array.isArray(record.cards) ? record.cards : [];
  const rawFaq = Array.isArray(record.faq) ? record.faq : [];

  const fallbackCards: ProductEditorialCard[] = [
    {
      eyebrow: "Benefícios",
      title: benefitTags.length > 0 ? "O que este cuidado entrega" : "Cuidado Flora Botanics",
      body:
        benefitTags.length > 0
          ? benefitTags.join(" · ")
          : "Os benefícios deste produto podem ser organizados no catálogo para aparecerem aqui.",
    },
    {
      eyebrow: "Rotina",
      title: "Como encaixar no cuidado diário",
      body: routineText,
    },
    {
      eyebrow: "Compra",
      title: "Dados seguros do catálogo",
      body:
        "A sacola usa o produto e a variante cadastrados no banco. O preço final é recalculado no servidor.",
    },
  ];

  const fallbackFaq: ProductFaqItem[] = [
    { question: "Como incluir este produto na rotina?", answer: routineText },
    {
      question: "Como vejo prazo e entrega?",
      answer:
        "A entrega e o endereço são tratados no carrinho e no checkout, mantendo preço e dados do pedido recalculados no servidor.",
    },
    {
      question: "Este produto tem compra segura?",
      answer:
        "Sim. O carrinho usa o produto e a variante cadastrados no catálogo; preço e identificação não dependem do navegador.",
    },
  ];

  const cards = rawCards
    .slice(0, 6)
    .map((item, index) => {
      const card = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const fallback = fallbackCards[index] ?? fallbackCards[0];
      return {
        eyebrow: textValue(card.eyebrow, fallback.eyebrow),
        title: textValue(card.title, fallback.title),
        body: textValue(card.body, fallback.body),
      };
    })
    .filter((item) => item.eyebrow || item.title || item.body);

  const faqItems = rawFaq
    .slice(0, 10)
    .map((item, index) => {
      const faq = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const fallback = fallbackFaq[index] ?? { question: "Pergunta", answer: "" };
      return {
        question: textValue(faq.question, fallback.question),
        answer: textValue(faq.answer, fallback.answer),
      };
    })
    .filter((item) => item.question && item.answer);

  return {
    cards: cards.length > 0 ? cards : fallbackCards,
    faqTitle: textValue(record.faq_title, "Dúvidas rápidas"),
    faqItems: faqItems.length > 0 ? faqItems : fallbackFaq,
  };
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  simple: "Produto",
  variable: "Produto com variações",
  kit: "Kit botânico",
  digital: "Produto digital",
  subscription: "Assinatura",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();
  const baseUrl = await currentSiteUrl();

  const { data: product } = await client
    .from("products")
    .select("name, subtitle, product_media(role, media(storage_path))")
    .eq("tenant_id", tenant.tenantId)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (!product) {
    return buildMetadata({
      baseUrl,
      title: "Produto não encontrado",
      description: DEFAULT_DESCRIPTION,
      path: `/produtos/${slug}`,
    });
  }

  const row = product as unknown as ProductRow;
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  const image = coverUrl(row, storageBase);

  return buildMetadata({
    baseUrl,
    title: row.name,
    description: row.subtitle ?? DEFAULT_DESCRIPTION,
    path: `/produtos/${slug}`,
    image,
  });
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
        `id, slug, name, subtitle, type, brand_line, tags, description_rich, editorial_content,
         product_variants(id, sku, name, price_cents, compare_at_cents, currency, is_default),
         product_media(role, sort_order, media(storage_path, alt))`
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
  const images = galleryImages(row, storageBase);
  const image = images[0]?.url ?? coverUrl(row, storageBase);
  const description = richTextToPlain(row.description_rich);
  const productUrl = absoluteUrl(await currentSiteUrl(), `/produtos/${row.slug}`);
  const benefitTags = (row.tags ?? []).filter(Boolean).slice(0, 6);
  const routineText =
    row.type === "kit"
      ? "Combine os itens do kit conforme a ordem sugerida pela rotina da marca."
      : "Use na rotina conforme a orientação do rótulo e complemente com os demais cuidados Flora.";
  const editorial = editorialContent(row.editorial_content, benefitTags, routineText);
  const faqItems = editorial.faqItems;
  const { data: reviewRows } = await client
    .from("product_reviews")
    .select("id, rating, title, body, display_name, created_at")
    .eq("tenant_id", tenant.tenantId)
    .eq("product_id", row.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(12);
  const reviews = (reviewRows ?? []) as ApprovedReview[];
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
      {variant ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: row.name,
              description: row.subtitle ?? description ?? DEFAULT_DESCRIPTION,
              image: images.length > 0 ? images.map((item) => item.url) : image ? [image] : undefined,
              sku: variant.sku,
              url: productUrl,
              brand: { "@type": "Brand", name: "Flora Botanics" },
              offers: {
                "@type": "Offer",
                url: productUrl,
                priceCurrency: variant.currency,
                price: (variant.price_cents / 100).toFixed(2),
                availability:
                  row.type === "kit" && kitAvailable <= 0
                    ? "https://schema.org/OutOfStock"
                    : "https://schema.org/InStock",
              },
              ...(reviews.length > 0 ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1),
                  reviewCount: reviews.length,
                  bestRating: 5,
                  worstRating: 1,
                },
              } : {}),
            }),
          }}
        />
      ) : null}
      {faqItems.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            }),
          }}
        />
      ) : null}
      <div className="hero subpage-hero product-hero-compact">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        <div className="container hero-inner" style={{ paddingTop: 48 }}>
          <div className="hero-text">
            <Link href="/produtos" className="eyebrow">
              Catálogo
            </Link>
            <h1>{row.name}</h1>
            {row.subtitle ? <p>{row.subtitle}</p> : null}
          </div>
        </div>
      </div>

      <main className="product-page">
        <div className="container product-detail-grid">
          <ProductGallery images={images} fallbackAlt={row.name} />

          <section className="product-info-panel">
            <span className="eyebrow">Produto</span>
            <h2>{row.name}</h2>
            {row.type === "kit" ? <span className="product-kind-badge">Kit botânico</span> : null}
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

            <div className="product-care-notes">
              <article>
                <strong>Linha</strong>
                <span>{row.brand_line ?? "Flora Botanics"}</span>
              </article>
              <article>
                <strong>Tipo</strong>
                <span>{PRODUCT_TYPE_LABELS[row.type] ?? row.type}</span>
              </article>
              {variant?.sku ? (
                <article>
                  <strong>SKU</strong>
                  <span>{variant.sku}</span>
                </article>
              ) : null}
            </div>

            {row.tags?.length ? (
              <div className="product-tag-row" aria-label="Características do produto">
                {row.tags.slice(0, 8).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}

            {row.type === "kit" ? (
              <div className="kit-composition">
                <strong>Este kit inclui</strong>
                {kitItems.length === 0 ? (
                  <p>Componentes ainda não cadastrados para este kit.</p>
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

            <div className="product-info-actions">
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
                  disabledLabel="Kit indisponível"
                />
              ) : (
                <a href="#newsletter" className="btn">
                  Avise-me
                </a>
              )}
              <FavoriteButton tenantId={tenant.tenantId} productId={row.id} label="Salvar favorito" />
            </div>
          </section>
        </div>

        <div className="container product-after-grid">
          <section className="product-editorial-grid" aria-label="Detalhes do cuidado">
            {editorial.cards.map((card, index) => (
              <article key={`${card.eyebrow}-${index}`}>
                <span className="eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                {index === 0 && benefitTags.length > 0 && card.body === benefitTags.join(" · ") ? (
                  <div className="product-benefit-list">
                    {benefitTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : (
                  <p>{card.body}</p>
                )}
              </article>
            ))}
          </section>

          <section className="product-faq-panel" aria-label="Perguntas frequentes do produto">
            <div className="section-heading catalog-heading">
              <h2>{editorial.faqTitle}</h2>
            </div>
            <div className="product-faq-list">
              {faqItems.map((item) => (
                <details key={item.question} className="product-faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <div className="container product-reviews-container">
          <ProductReviews tenantId={tenant.tenantId} productId={row.id} reviews={reviews} />
        </div>

        {variant ? (
          <div className="product-mobile-buy" aria-label="Compra rápida">
            <div>
              <strong>{row.name}</strong>
              <span>{money(variant.price_cents, variant.currency)}</span>
            </div>
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
              disabledLabel="Kit indisponível"
            />
          </div>
        ) : null}
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
