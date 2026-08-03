import type { CSSProperties, ReactNode } from "react";
import { currentTenant, db } from "@/lib/tenant";
import { NewsletterForm } from "./NewsletterForm";
import { ContactForm } from "./ContactForm";

type Props = Record<string, unknown>;
type Cta = { label: string; href: string };
type TypographySettings = {
  displayFont?: string;
  bodyFont?: string;
  align?: "left" | "center" | "right";
  width?: string;
  titleSize?: string;
  bodySize?: string;
  lineHeight?: string;
  color?: string;
};
type SectionBackground = {
  type: "none" | "color" | "gradient" | "image";
  color?: string;
  color2?: string;
  angle?: number;
  image?: string;
  overlay?: number;
  blend?: "normal" | "multiply" | "overlay" | "soft-light" | "luminosity";
};
type ImageFrameSettings = {
  imageFit?: "cover" | "contain";
  imageX?: number;
  imageY?: number;
  imageHeight?: string;
};
type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  type: string;
  product_variants?: Array<{
    price_cents: number;
    currency: string;
    is_default: boolean;
  }>;
  product_media?: Array<{
    role: string;
    media: { storage_path: string; alt: string | null } | Array<{ storage_path: string; alt: string | null }> | null;
  }>;
};

const asset = (p?: string) => (p ? (p.startsWith("/") || p.startsWith("http") ? p : `/${p}`) : "");

/** Converte props.background em estilo CSS inline */
function sectionBg(props: Props): CSSProperties {
  const bg = props.background as SectionBackground | undefined;
  if (!bg || bg.type === "none") return {};
  const ovr = (bg.overlay ?? 0) > 0 ? `rgba(0,0,0,${(bg.overlay ?? 0) / 100})` : null;
  const veil = ovr ? `linear-gradient(${ovr},${ovr}), ` : "";
  if (bg.type === "color") {
    return { background: `${veil}${bg.color ?? "#f2ecdf"}` };
  }
  if (bg.type === "gradient") {
    return { background: `${veil}linear-gradient(${bg.angle ?? 135}deg, ${bg.color ?? "#0f2012"}, ${bg.color2 ?? "#b9924d"})` };
  }
  if (bg.type === "image" && bg.image) {
    const url = asset(bg.image);
    const blend = bg.blend && bg.blend !== "normal" ? bg.blend : undefined;
    return {
      backgroundImage: `${veil}url("${url}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      ...(blend ? { backgroundBlendMode: blend } : {}),
    };
  }
  return {};
}

function typography(props: Props): CSSProperties {
  const t = (props.typography ?? {}) as TypographySettings;
  return {
    "--section-display-font": t.displayFont ? `"${t.displayFont}", serif` : "var(--font-display)",
    "--section-body-font": t.bodyFont ? `"${t.bodyFont}", sans-serif` : "var(--font-body)",
    "--section-align": t.align ?? "left",
    "--section-width": t.width ?? "760px",
    "--section-title-size": t.titleSize ?? "42px",
    "--section-body-size": t.bodySize ?? "16px",
    "--section-line-height": t.lineHeight ?? "1.75",
    "--section-text-color": t.color || "var(--text)",
  } as CSSProperties;
}

function SmartText({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      {(paragraphs.length ? paragraphs : [text]).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  );
}

function editorialHtml(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return raw;
  }

  return raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function productCoverUrl(product: ProductSummary, storageBase: string) {
  const mediaRows = product.product_media ?? [];
  const raw = mediaRows.find((item) => item.role === "cover")?.media ?? mediaRows[0]?.media ?? null;
  const media = Array.isArray(raw) ? raw[0] : raw;
  return media?.storage_path ? `${storageBase}${media.storage_path}` : null;
}

/* ---------- HERO ---------- */
function Hero({ props, header }: { props: Props; header?: ReactNode }) {
  const cta = props.cta as Cta | undefined;
  const bg = props.background as SectionBackground | undefined;
  const hasCustomBg = bg && bg.type !== "none";
  return (
    <section
      className="hero"
      style={{
        ...typography(props),
        background: hasCustomBg
          ? undefined
          : `linear-gradient(90deg, rgba(10,22,11,.90) 0%, rgba(10,22,11,.70) 36%, rgba(10,22,11,.32) 66%, rgba(10,22,11,.58) 100%), url("${asset(props.image as string)}") center / cover`,
        ...sectionBg(props),
      }}
    >
      {header}
      <div className="container hero-inner">
        <div className="hero-text">
          <h1>{props.title as string}</h1>
          {props.subtitle ? <SmartText text={props.subtitle as string} /> : null}
          {cta ? (
            <a href={cta.href} className="btn">
              {cta.label}
            </a>
          ) : null}
        </div>
      </div>
      {props.product_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="hero-products"
          src={asset(props.product_image as string)}
          alt="Produtos"
        />
      ) : null}
    </section>
  );
}

/* ---------- CATEGORY GRID (busca nomes no banco) ---------- */
async function CategoryGrid({ props }: { props: Props }) {
  const tenant = await currentTenant();
  const items = (props.items ?? []) as Array<{ category_slug: string; image?: string }>;
  const slugs = items.map((i) => i.category_slug);

  const { data: cats } = await db()
    .from("categories")
    .select("slug, name, description")
    .eq("tenant_id", tenant.tenantId)
    .in("slug", slugs);

  const bySlug = new Map<string, { slug: string; name: string; description: string | null }>(
    (cats ?? []).map((c: { slug: string; name: string; description: string | null }) => [c.slug, c])
  );

  return (
    <section className="categories" id="produtos" style={{ ...typography(props), ...sectionBg(props) }}>
      <div className="container">
        <div className="section-heading">
          <h2>{props.heading as string}</h2>
        </div>
        <div className="category-grid">
          {items.map((item) => {
            const cat = bySlug.get(item.category_slug);
            if (!cat) return null;
            return (
              <article className="category-card" key={item.category_slug}>
                <div className="category-card-media-wrap">
                  {item.image ? (
                    <div className="category-card-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="category-card-image" src={asset(item.image)} alt={cat.name} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="category-card-hover-image" src={asset(item.image)} alt="" aria-hidden />
                    </div>
                  ) : (
                    <div className="category-card-media" />
                  )}
                </div>
                <h3>{cat.name}</h3>
                <p>{cat.description}</p>
                <a href={`/categorias/${cat.slug}`} className="link">
                  Ver produtos
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- INGREDIENT GRID ---------- */
function IngredientGrid({ props }: { props: Props }) {
  const cta = props.cta as Cta | undefined;
  const items = (props.items ?? []) as Array<{ title: string; text: string; image?: string }>;
  const heading = String(props.heading ?? "");
  const [l1, l2] = heading.split(" para ");
  return (
    <section className="ingredients" id="ingredientes" style={{ ...typography(props), ...sectionBg(props) }}>
      <div className="container ingredients-layout">
        <div className="ingredients-text">
          <h2>
            {l2 ? (
              <>
                {l1}
                <br />
                para {l2}
              </>
            ) : (
              heading
            )}
          </h2>
          {props.text ? <SmartText text={props.text as string} /> : null}
          {cta ? (
            <a href={cta.href} className="link">
              {cta.label}
            </a>
          ) : null}
        </div>
        <div className="ingredient-grid">
          {items.map((ing) => (
            <article className="ingredient-card" key={ing.title}>
              {ing.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset(ing.image)} alt={ing.title} />
              ) : null}
              <h3>{ing.title}</h3>
              <SmartText text={ing.text} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- MANIFESTO ---------- */
function Manifesto({ props }: { props: Props }) {
  const cta = props.cta as Cta | undefined;
  const image = asset(props.image as string);
  const frame = props as ImageFrameSettings;
  const imageFit = frame.imageFit ?? "contain";
  const imageX = typeof frame.imageX === "number" ? frame.imageX : 50;
  const imageY = typeof frame.imageY === "number" ? frame.imageY : 50;
  const imageHeight = frame.imageHeight ?? "380px";

  return (
    <section
      className="manifesto"
      id="sobre"
      style={{
        ...typography(props),
        ...sectionBg(props),
        "--manifesto-height": imageHeight,
        "--manifesto-fit": imageFit,
        "--manifesto-position": `${imageX}% ${imageY}%`,
      } as CSSProperties}
    >
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="manifesto-image" src={image} alt="" aria-hidden />
          <div className="manifesto-overlay" />
        </>
      ) : null}
      <div className="container manifesto-inner">
        <div className="manifesto-text">
          {props.eyebrow ? <span className="eyebrow">{props.eyebrow as string}</span> : null}
          <h2>{props.title as string}</h2>
          {props.text ? <SmartText text={props.text as string} /> : null}
          {cta ? (
            <a href={cta.href} className="link">
              {cta.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- BENEFITS ---------- */
const BENEFIT_ICONS: Record<string, ReactNode> = {
  leaf: (
    <svg viewBox="0 0 48 48">
      <path d="M24 43V12"></path>
      <path d="M24 14C16 18 12 25 13 34c7-1 11-7 11-20Z"></path>
      <path d="M24 19c8 3 12 9 12 18-7-1-11-7-12-18Z"></path>
    </svg>
  ),
  sprout: (
    <svg viewBox="0 0 48 48">
      <path d="M24 43V8"></path>
      <path d="M24 19c-8 3-12 9-11 17 7-1 11-6 11-17Z"></path>
      <path d="M24 21c8 3 12 9 11 17-7-1-11-6-11-17Z"></path>
      <path d="M24 8l5 8H19l5-8Z"></path>
    </svg>
  ),
  rabbit: (
    <svg viewBox="0 0 48 48">
      <path d="M16 29c-3 1-5 4-5 7 0 5 4 8 10 8h9c5 0 8-3 8-7 0-3-2-6-5-7"></path>
      <path d="M17 29c-2-8 2-17 9-19 6 3 8 11 5 18"></path>
      <path d="M19 22c-5-1-8-5-8-10 6 0 10 4 11 9"></path>
    </svg>
  ),
  flask: (
    <svg viewBox="0 0 48 48">
      <path d="M18 5h12"></path>
      <path d="M21 5v14L11 39c-1 2 1 4 3 4h20c2 0 4-2 3-4L27 19V5"></path>
      <path d="M17 32h14"></path>
    </svg>
  ),
  package: (
    <svg viewBox="0 0 48 48">
      <path d="M14 13h20v29H14z"></path>
      <path d="M19 13V7h10v6"></path>
      <path d="M34 30c5-4 8-10 8-18-9 1-15 7-16 16"></path>
    </svg>
  ),
};

function Benefits({ props }: { props: Props }) {
  const items = (props.items ?? []) as Array<{ icon: string; title: string; text: string }>;
  return (
    <section className="benefits" id="sustentabilidade" style={{ ...typography(props), ...sectionBg(props) }}>
      <div className="container benefit-grid">
        {items.map((b) => (
          <article className="benefit-card" key={b.title}>
            {BENEFIT_ICONS[b.icon] ?? BENEFIT_ICONS.leaf}
            <div>
              <h3>{b.title}</h3>
              <SmartText text={b.text} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- NEWSLETTER ---------- */
function Newsletter({ props }: { props: Props }) {
  const perks = (props.perks ?? []) as string[];
  const bg = props.background as SectionBackground | undefined;
  const hasCustomBg = bg && bg.type !== "none";
  return (
    <section
      className="newsletter"
      id="newsletter"
      style={{
        ...typography(props),
        background: hasCustomBg
          ? undefined
          : `linear-gradient(90deg, rgba(12,29,13,.96) 0%, rgba(12,29,13,.88) 46%, rgba(12,29,13,.45) 75%, rgba(12,29,13,.25) 100%), url("/assets/newsletter-contagotas.jpg") center right / cover`,
        ...sectionBg(props),
      }}
    >
      <div className="container newsletter-layout">
        <div>
          <h2>{props.title as string}</h2>
          {props.text ? <SmartText text={props.text as string} /> : null}
        </div>
        <div>
          <NewsletterForm />
          <div className="newsletter-list">
            {perks.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- RICH TEXT ---------- */
function RichText({ props }: { props: Props }) {
  return (
    <section className="editorial-section" style={{ ...typography(props), ...sectionBg(props) }}>
      <div className="container">
        <div
          className="editorial-rich-text"
          dangerouslySetInnerHTML={{ __html: editorialHtml(props.content) }}
        />
      </div>
    </section>
  );
}

function Banner({ props }: { props: Props }) {
  const image = asset(props.image as string);
  const href = String(props.href ?? "").trim();
  const fullWidth = props.full_width !== false;
  const body = (
    <div className="cms-banner-card">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" />
      ) : (
        <div className="cms-banner-empty" />
      )}
    </div>
  );

  return (
    <section className="cms-banner-section" style={{ ...typography(props), ...sectionBg(props) }}>
      <div className={fullWidth ? undefined : "container"}>
        {href ? <a href={href}>{body}</a> : body}
      </div>
    </section>
  );
}

function Faq({ props }: { props: Props }) {
  const items = (props.items ?? []) as Array<{ q?: string; a?: string }>;
  return (
    <section className="cms-faq-section" style={{ ...typography(props), ...sectionBg(props) }}>
      <div className="container">
        <div className="section-heading">
          <h2>{(props.heading as string) || "Perguntas frequentes"}</h2>
        </div>
        <div className="cms-faq-list">
          {items.map((item, index) => (
            <details key={`${item.q ?? "pergunta"}-${index}`} className="cms-faq-item" open={index === 0}>
              <summary>{item.q || "Pergunta"}</summary>
              <div>{item.a ? <SmartText text={item.a} /> : null}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

async function ProductCarousel({ props }: { props: Props }) {
  const tenant = await currentTenant();
  const client = db();
  const collectionSlug = String(props.collection_slug ?? "").trim();
  let productIds: string[] | null = null;

  if (collectionSlug) {
    const { data: collection } = await client
      .from("collections")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("slug", collectionSlug)
      .eq("status", "published")
      .maybeSingle();

    if (collection?.id) {
      const { data: links } = await client
        .from("collection_products")
        .select("product_id")
        .eq("collection_id", collection.id)
        .order("sort_order");
      productIds = (links ?? []).map((item: { product_id: string }) => item.product_id).filter(Boolean);
    } else {
      productIds = [];
    }
  }

  const query = client
    .from("products")
    .select(
      `id, slug, name, subtitle, type,
       product_variants(price_cents, currency, is_default),
       product_media(role, media(storage_path, alt))`
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(8);

  const { data } = productIds
    ? productIds.length
      ? await query.in("id", productIds)
      : { data: [] }
    : await query.order("created_at", { ascending: false });

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  const products = (data ?? []) as unknown as ProductSummary[];

  return (
    <section className="cms-product-carousel" style={{ ...typography(props), ...sectionBg(props) }}>
      <div className="container">
        <div className="section-heading">
          <h2>{(props.heading as string) || "Produtos selecionados"}</h2>
        </div>
        {products.length === 0 ? (
          <p className="cms-empty-copy">Nenhum produto publicado para este carrossel.</p>
        ) : (
          <div className="cms-product-row">
            {products.map((product) => {
              const variants = product.product_variants ?? [];
              const variant = variants.find((item) => item.is_default) ?? variants[0];
              const image = productCoverUrl(product, storageBase);
              return (
                <article className="category-card" key={product.id}>
                  <div className="category-card-media-wrap">
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
                  </div>
                  <h3>{product.name}</h3>
                  {product.type === "kit" ? <span className="category-card-badge-seal category-card-badge-seal--kit">Kit</span> : null}
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
    </section>
  );
}

/* ---------- RENDERER ---------- */
export function SectionRenderer({
  section,
  header,
}: {
  section: { id: string; block: string; props: Props };
  header?: ReactNode;
}) {
  switch (section.block) {
    case "hero":
      return <Hero props={section.props} header={header} />;
    case "category_grid":
      return <CategoryGrid props={section.props} />;
    case "ingredient_grid":
      return <IngredientGrid props={section.props} />;
    case "manifesto":
      return <Manifesto props={section.props} />;
    case "benefits":
      return <Benefits props={section.props} />;
    case "newsletter":
      return <Newsletter props={section.props} />;
    case "rich_text":
      return <RichText props={section.props} />;
    case "banner":
      return <Banner props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
    case "product_carousel":
      return <ProductCarousel props={section.props} />;
    case "contact_form":
      return (
        <ContactForm
          heading={section.props.heading as string | undefined}
          subheading={section.props.subheading as string | undefined}
          successMessage={section.props.successMessage as string | undefined}
        />
      );
    default:
      return null; // bloco desconhecido: ignora silenciosamente em produção
  }
}
