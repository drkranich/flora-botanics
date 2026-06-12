"use client";

/**
 * Renderizador CLIENTE dos blocos — usado pelo preview ao vivo do admin.
 * Mesmo markup/classes do renderizador de produção (blocks/index.tsx),
 * mas síncrono: a grade de categorias recebe os dados via prop.
 */

import type { ReactNode } from "react";
import { NewsletterForm } from "./NewsletterForm";
import { BgWrap, type SectionBg } from "./background";

type Props = Record<string, unknown>;
type Cta = { label: string; href: string };
export type CategoryInfo = { slug: string; name: string; description: string | null };

const asset = (p?: string) =>
  p ? (p.startsWith("/") || p.startsWith("http") ? p : `/${p}`) : "";

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
          {cta ? <a className="btn">{cta.label}</a> : null}
        </div>
      </div>
      {props.product_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-products" src={asset(props.product_image as string)} alt="" />
      ) : null}
    </section>
  );
}

function CategoryGrid({
  props,
  categories,
}: {
  props: Props;
  categories: Map<string, CategoryInfo>;
}) {
  const items = (props.items ?? []) as Array<{ category_slug: string; image?: string }>;
  return (
    <section className="categories">
      <div className="container">
        <div className="section-heading">
          <h2>{props.heading as string}</h2>
        </div>
        <div className="category-grid">
          {items.map((item, i) => {
            const cat = categories.get(item.category_slug);
            return (
              <article className="category-card" key={i}>
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset(item.image)} alt={cat?.name ?? ""} />
                ) : null}
                <h3>{cat?.name ?? item.category_slug ?? "—"}</h3>
                <p>{cat?.description ?? ""}</p>
                <span className="link">Ver produtos</span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function IngredientGrid({ props }: { props: Props }) {
  const cta = props.cta as Cta | undefined;
  const items = (props.items ?? []) as Array<{ title: string; text: string; image?: string }>;
  return (
    <section className="ingredients">
      <div className="container ingredients-layout">
        <div className="ingredients-text">
          <h2>{props.heading as string}</h2>
          {props.text ? <p>{props.text as string}</p> : null}
          {cta ? <span className="link">{cta.label}</span> : null}
        </div>
        <div className="ingredient-grid">
          {items.map((ing, i) => (
            <article className="ingredient-card" key={i}>
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

function Manifesto({ props }: { props: Props }) {
  const cta = props.cta as Cta | undefined;
  return (
    <section
      className="manifesto"
      style={{
        background: `linear-gradient(90deg, rgba(13,30,14,.96) 0%, rgba(13,30,14,.88) 35%, rgba(13,30,14,.32) 62%, rgba(13,30,14,.45) 100%), url("${asset(props.image as string)}") center / cover`,
      }}
    >
      <div className="container manifesto-inner">
        <div className="manifesto-text">
          {props.eyebrow ? <span className="eyebrow">{props.eyebrow as string}</span> : null}
          <h2>{props.title as string}</h2>
          <p>{props.text as string}</p>
          {cta ? <span className="link">{cta.label}</span> : null}
        </div>
      </div>
    </section>
  );
}

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
    <section className="benefits">
      <div className="container benefit-grid">
        {items.map((b, i) => (
          <article className="benefit-card" key={i}>
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

function Newsletter({ props }: { props: Props }) {
  const perks = (props.perks ?? []) as string[];
  return (
    <section
      className="newsletter"
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
            {perks.map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RichText({ props }: { props: Props }) {
  return (
    <section className="container" style={{ padding: "40px 0" }}>
      <div dangerouslySetInnerHTML={{ __html: props.content as string }} />
    </section>
  );
}

function Banner({ props }: { props: Props }) {
  if (!props.image) return null;
  return (
    <section style={{ padding: props.full_width ? 0 : "20px 0" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(props.image as string)} alt="" style={{ width: "100%", display: "block" }} />
    </section>
  );
}

function Faq({ props }: { props: Props }) {
  const items = (props.items ?? []) as Array<{ q: string; a: string }>;
  return (
    <section className="container" style={{ padding: "40px 0", maxWidth: 760 }}>
      {items.map((f, i) => (
        <details key={i} style={{ borderBottom: "1px solid #d9d0bd", padding: "14px 0" }}>
          <summary style={{ fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{f.q}</summary>
          <p style={{ fontSize: 13, lineHeight: 1.6, paddingTop: 10 }}>{f.a}</p>
        </details>
      ))}
    </section>
  );
}

export function ClientSectionRenderer({
  section,
  categories,
  header,
}: {
  section: { id: string; block: string; props: Props };
  categories: Map<string, CategoryInfo>;
  header?: ReactNode;
}) {
  let node: ReactNode = null;
  switch (section.block) {
    case "hero":
      node = <Hero props={section.props} header={header} />;
      break;
    case "category_grid":
      node = <CategoryGrid props={section.props} categories={categories} />;
      break;
    case "ingredient_grid":
      node = <IngredientGrid props={section.props} />;
      break;
    case "manifesto":
      node = <Manifesto props={section.props} />;
      break;
    case "benefits":
      node = <Benefits props={section.props} />;
      break;
    case "newsletter":
      node = <Newsletter props={section.props} />;
      break;
    case "rich_text":
      node = <RichText props={section.props} />;
      break;
    case "banner":
      node = <Banner props={section.props} />;
      break;
    case "faq":
      node = <Faq props={section.props} />;
      break;
    default:
      return null;
  }
  return <BgWrap bg={section.props.background as SectionBg | undefined}>{node}</BgWrap>;
}
