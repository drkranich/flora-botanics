"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { SiteFooter, SiteHeader, type LogoProps } from "@/blocks/chrome";

type PreviewSection = {
  id: string;
  block: string;
  props: Record<string, unknown>;
};

type Cta = { label?: string; href?: string };
type MenuItem = { label: string; href: string };
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

const asset = (path?: string) => (path ? (path.startsWith("/") || path.startsWith("http") ? path : `/${path}`) : "");

function typography(props: Record<string, unknown>): CSSProperties {
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

function text(text: unknown) {
  const value = String(text ?? "");
  const paragraphs = value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      {(paragraphs.length ? paragraphs : [value]).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  );
}

function editorialHtml(value: unknown) {
  const content = String(value ?? "");
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

function Hero({ props, header }: { props: Record<string, unknown>; header?: ReactNode }) {
  const cta = props.cta as Cta | undefined;
  return (
    <section
      className="hero"
      style={{
        ...typography(props),
        background: `linear-gradient(90deg, rgba(10,22,11,.90) 0%, rgba(10,22,11,.70) 36%, rgba(10,22,11,.32) 66%, rgba(10,22,11,.58) 100%), url("${asset(props.image as string)}") center / cover`,
      }}
    >
      {header}
      <div className="container hero-inner">
        <div className="hero-text">
          <h1>{props.title as string}</h1>
          {props.subtitle ? text(props.subtitle) : null}
          {cta?.label ? <a href={cta.href ?? "#"} className="btn">{cta.label}</a> : null}
        </div>
      </div>
      {props.product_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-products" src={asset(props.product_image as string)} alt="" />
      ) : null}
    </section>
  );
}

function CategoryGrid({ props }: { props: Record<string, unknown> }) {
  const items = (props.items ?? []) as Array<{ category_slug?: string; title?: string; image?: string }>;
  return (
    <section className="categories" id="produtos" style={typography(props)}>
      <div className="container">
        <div className="section-heading"><h2>{props.heading as string}</h2></div>
        <div className="category-grid">
          {items.map((item, index) => (
            <article className="category-card" key={`${item.category_slug ?? item.title ?? "categoria"}-${index}`}>
              {item.image ? (
                <div className="category-card-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="category-card-image" src={asset(item.image)} alt={item.title ?? item.category_slug ?? "Categoria"} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="category-card-hover-image" src={asset(item.image)} alt="" aria-hidden />
                </div>
              ) : null}
              <h3>{item.title ?? item.category_slug ?? "Categoria"}</h3>
              <p>Prévia do rascunho da categoria.</p>
              <a href="#" className="link">Ver produtos</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function IngredientGrid({ props }: { props: Record<string, unknown> }) {
  const cta = props.cta as Cta | undefined;
  const items = (props.items ?? []) as Array<{ title?: string; text?: string; image?: string }>;
  const [l1, l2] = String(props.heading ?? "").split(" para ");
  return (
    <section className="ingredients" id="ingredientes" style={typography(props)}>
      <div className="container ingredients-layout">
        <div className="ingredients-text">
          <h2>{l2 ? <>{l1}<br />para {l2}</> : props.heading as string}</h2>
          {props.text ? text(props.text) : null}
          {cta?.label ? <a href={cta.href ?? "#"} className="link">{cta.label}</a> : null}
        </div>
        <div className="ingredient-grid">
          {items.map((item, index) => (
            <article className="ingredient-card" key={`${item.title ?? "ingrediente"}-${index}`}>
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset(item.image)} alt={item.title ?? "Ingrediente"} />
              ) : null}
              <h3>{item.title}</h3>
              {item.text ? text(item.text) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Manifesto({ props }: { props: Record<string, unknown> }) {
  const cta = props.cta as Cta | undefined;
  const image = asset(props.image as string);
  const imageX = typeof props.imageX === "number" ? props.imageX : 50;
  const imageY = typeof props.imageY === "number" ? props.imageY : 50;
  return (
    <section
      className="manifesto"
      id="sobre"
      style={{
        ...typography(props),
        "--manifesto-height": (props.imageHeight as string) ?? "380px",
        "--manifesto-fit": (props.imageFit as string) ?? "contain",
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
          {props.text ? text(props.text) : null}
          {cta?.label ? <a href={cta.href ?? "#"} className="link">{cta.label}</a> : null}
        </div>
      </div>
    </section>
  );
}

function Benefits({ props }: { props: Record<string, unknown> }) {
  const items = (props.items ?? []) as Array<{ title?: string; text?: string }>;
  return (
    <section className="benefits" id="sustentabilidade" style={typography(props)}>
      <div className="container benefit-grid">
        {items.map((item, index) => (
          <article className="benefit-card" key={`${item.title ?? "beneficio"}-${index}`}>
            <span style={{ color: "var(--gold-dark)", fontSize: 24 }}>•</span>
            <div>
              <h3>{item.title}</h3>
              {item.text ? text(item.text) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Newsletter({ props }: { props: Record<string, unknown> }) {
  const perks = (props.perks ?? []) as string[];
  return (
    <section className="newsletter" id="newsletter" style={typography(props)}>
      <div className="container newsletter-layout">
        <div>
          <h2>{props.title as string}</h2>
          {props.text ? text(props.text) : null}
        </div>
        <div>
          <div className="newsletter-form">
            <input placeholder="seu e-mail" readOnly />
            <button type="button">Avise-me</button>
          </div>
          <div className="newsletter-list">{perks.map((p) => <span key={p}>{p}</span>)}</div>
        </div>
      </div>
    </section>
  );
}

function RichText({ props }: { props: Record<string, unknown> }) {
  return (
    <section className="editorial-section" style={typography(props)}>
      <div className="container">
        <div className="editorial-rich-text" dangerouslySetInnerHTML={{ __html: editorialHtml(props.content) }} />
      </div>
    </section>
  );
}

function Banner({ props }: { props: Record<string, unknown> }) {
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
    <section className="cms-banner-section" style={typography(props)}>
      <div className={fullWidth ? undefined : "container"}>
        {href ? <a href={href}>{body}</a> : body}
      </div>
    </section>
  );
}

function Faq({ props }: { props: Record<string, unknown> }) {
  const items = (props.items ?? []) as Array<{ q?: string; a?: string }>;
  return (
    <section className="cms-faq-section" style={typography(props)}>
      <div className="container">
        <div className="section-heading"><h2>{(props.heading as string) || "Perguntas frequentes"}</h2></div>
        <div className="cms-faq-list">
          {items.map((item, index) => (
            <details key={`${item.q ?? "pergunta"}-${index}`} className="cms-faq-item" open={index === 0}>
              <summary>{item.q || "Pergunta"}</summary>
              <div>{item.a ? text(item.a) : null}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCarousel({ props }: { props: Record<string, unknown> }) {
  const slug = String(props.collection_slug ?? "").trim();
  const labels = slug ? [`Colecao: ${slug}`, "Produto publicado", "Kit publicado"] : ["Produto publicado", "Kit publicado", "Novo destaque"];
  return (
    <section className="cms-product-carousel" style={typography(props)}>
      <div className="container">
        <div className="section-heading"><h2>{(props.heading as string) || "Produtos selecionados"}</h2></div>
        <div className="cms-product-row">
          {labels.map((label, index) => (
            <article className="category-card" key={`${label}-${index}`}>
              <div className="category-card-media" />
              <h3>{label}</h3>
              <p>Preview do carrossel. Produtos reais aparecem no site publicado conforme colecao e estoque.</p>
              <a href="#" className="link">Ver produto</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviewBlock({ section, header }: { section: PreviewSection; header?: ReactNode }) {
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
    default:
      return null;
  }
}

export function LivePreview({
  menu,
  logo,
}: {
  menu: MenuItem[];
  logo: LogoProps;
}) {
  const [sections, setSections] = useState<PreviewSection[]>([]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.data?.type !== "flora-preview") return;
      if (!Array.isArray(event.data.sections)) return;
      setSections(event.data.sections as PreviewSection[]);
    }

    window.addEventListener("message", receive);
    window.parent?.postMessage({ type: "flora-preview-ready" }, "*");

    const retries = [250, 750, 1500, 3000].map((delay) =>
      window.setTimeout(() => window.parent?.postMessage({ type: "flora-preview-ready" }, "*"), delay)
    );

    return () => {
      window.removeEventListener("message", receive);
      retries.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const [first, ...rest] = sections;
  const heroFirst = first?.block === "hero";
  const header = <SiteHeader menu={menu} {...logo} />;

  if (sections.length === 0) {
    return (
      <>
        <div className="hero subpage-hero subpage-hero-compact">{header}</div>
        <main className="page-content">
          <div className="container">
            <p>Aguardando alterações do CMS…</p>
          </div>
        </main>
        <SiteFooter {...logo} />
      </>
    );
  }

  return (
    <>
      {heroFirst ? (
        <PreviewBlock section={first} header={header} />
      ) : (
        <div className="hero subpage-hero subpage-hero-compact">{header}</div>
      )}
      <main className={heroFirst ? undefined : "page-content"}>
        {(heroFirst ? rest : sections).map((section) => (
          <PreviewBlock key={section.id} section={section} />
        ))}
      </main>
      <SiteFooter {...logo} />
    </>
  );
}
