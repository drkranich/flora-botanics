import type { ReactNode } from "react";
import { currentTenant, db } from "@/lib/tenant";
import { NewsletterForm } from "./NewsletterForm";

type Props = Record<string, unknown>;
type Cta = { label: string; href: string };

const asset = (p?: string) => (p ? (p.startsWith("/") || p.startsWith("http") ? p : `/${p}`) : "");

/* ---------- HERO ---------- */
function Hero({ props, header }: { props: Props; header?: ReactNode }) {
  const cta = props.cta as Cta | undefined;
  return (
    <section
      className="hero"
      style={{
        background: `linear-gradient(90deg, rgba(10,22,11,.90) 0%, rgba(10,22,11,.70) 36%, rgba(10,22,11,.32) 66%, rgba(10,22,11,.58) 100%), url("${asset(props.image as string)}") center / cover`,
      }}
    >
      {header}
      <div className="container hero-inner">
        <div className="hero-text">
          <h1>{props.title as string}</h1>
          {props.subtitle ? <p>{props.subtitle as string}</p> : null}
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

  const bySlug = new Map((cats ?? []).map((c) => [c.slug, c]));

  return (
    <section className="categories" id="produtos">
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
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset(item.image)} alt={cat.name} />
                ) : null}
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
  const [l1, l2] = (props.heading as string).split(" para ");
  return (
    <section className="ingredients" id="ingredientes">
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
              (props.heading as string)
            )}
          </h2>
          {props.text ? <p>{props.text as string}</p> : null}
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
              <p>{ing.text}</p>
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
  return (
    <section
      className="manifesto"
      id="sobre"
      style={{
        background: `linear-gradient(90deg, rgba(13,30,14,.96) 0%, rgba(13,30,14,.88) 35%, rgba(13,30,14,.32) 62%, rgba(13,30,14,.45) 100%), url("${asset(props.image as string)}") center / cover`,
      }}
    >
      <div className="container manifesto-inner">
        <div className="manifesto-text">
          {props.eyebrow ? <span className="eyebrow">{props.eyebrow as string}</span> : null}
          <h2>{props.title as string}</h2>
          <p>{props.text as string}</p>
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
    <section className="benefits" id="sustentabilidade">
      <div className="container benefit-grid">
        {items.map((b) => (
          <article className="benefit-card" key={b.title}>
            {BENEFIT_ICONS[b.icon] ?? BENEFIT_ICONS.leaf}
            <div>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
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
  return (
    <section
      className="newsletter"
      id="newsletter"
      style={{
        background: `linear-gradient(90deg, rgba(12,29,13,.96) 0%, rgba(12,29,13,.88) 46%, rgba(12,29,13,.45) 75%, rgba(12,29,13,.25) 100%), url("/assets/newsletter-contagotas.jpg") center right / cover`,
      }}
    >
      <div className="container newsletter-layout">
        <div>
          <h2>{props.title as string}</h2>
          {props.text ? <p>{props.text as string}</p> : null}
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
    <section className="container" style={{ padding: "40px 0" }}>
      <div dangerouslySetInnerHTML={{ __html: props.content as string }} />
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
    default:
      return null; // bloco desconhecido: ignora silenciosamente em produção
  }
}
