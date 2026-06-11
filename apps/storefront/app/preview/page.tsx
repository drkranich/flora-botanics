"use client";

/**
 * PREVIEW AO VIVO — carregado em iframe pelo editor do admin.
 * Renderiza a PÁGINA COMPLETA (header + seções + rodapé) com os mesmos
 * estilos do site, recebendo as seções via postMessage. Rolagem natural.
 */

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ClientSectionRenderer, type CategoryInfo } from "@/blocks/client";

type Section = { id: string; block: string; props: Record<string, unknown> };
type MenuItem = { label: string; href: string };
type FooterColumn = { heading: string; links: MenuItem[] };

export default function PreviewPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [categories, setCategories] = useState<Map<string, CategoryInfo>>(new Map());
  const [headerMenu, setHeaderMenu] = useState<MenuItem[]>([]);
  const [footerCols, setFooterCols] = useState<FooterColumn[]>([]);
  const [logo, setLogo] = useState<string>("");

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase
      .from("categories")
      .select("slug, name, description")
      .eq("status", "published")
      .then(({ data }) =>
        setCategories(new Map((data ?? []).map((c) => [c.slug, c as CategoryInfo])))
      );

    supabase
      .from("menus")
      .select("location, items")
      .then(({ data }) => {
        for (const m of data ?? []) {
          if (m.location === "header") setHeaderMenu((m.items ?? []) as MenuItem[]);
        }
        const cols = (data ?? [])
          .filter((m) => String(m.location).startsWith("footer"))
          .map((m) => m.items as unknown as FooterColumn)
          .filter((c) => c && Array.isArray(c.links));
        setFooterCols(cols);
      });

    supabase
      .from("site_settings")
      .select("key, value")
      .eq("key", "logo")
      .then(({ data }) => {
        const img = (data?.[0]?.value as { image?: string } | undefined)?.image ?? "";
        setLogo(img);
      });

    function onMessage(e: MessageEvent) {
      if (e.data?.type === "flora-preview" && Array.isArray(e.data.sections)) {
        setSections(e.data.sections as Section[]);
      }
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "flora-preview-ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const logoEl = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <span className="logo"><img src={logo} alt="Logo" style={{ height: 56, width: "auto" }} /></span>
  ) : (
    <span className="logo">
      <span className="logo-main">FL<span className="logo-symbol"></span>RA</span>
      <span className="logo-sub">BOTANICS</span>
    </span>
  );

  const header = (
    <header className="header container">
      {logoEl}
      <nav className="nav">
        {headerMenu.map((i) => (
          <span key={i.label} style={{ cursor: "default" }}>{i.label}</span>
        ))}
      </nav>
      <div className="header-actions">
        <span className="btn">Avise-me</span>
      </div>
    </header>
  );

  if (sections.length === 0) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Montserrat, sans-serif",
          color: "#5e584b",
          fontSize: 13,
        }}
      >
        Aguardando o editor…
      </main>
    );
  }

  const [first, ...rest] = sections;
  const heroFirst = first?.block === "hero";

  return (
    <>
      {heroFirst ? (
        <ClientSectionRenderer section={first} categories={categories} header={header} />
      ) : (
        <div className="page-hero" style={{ paddingBottom: 20 }}>{header}</div>
      )}
      {(heroFirst ? rest : sections).map((s) => (
        <ClientSectionRenderer key={s.id} section={s} categories={categories} />
      ))}

      <footer className="footer">
        <div className="container footer-layout">
          {logoEl}
          {footerCols.map((col) => (
            <div key={col.heading}>
              <h4>{col.heading}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>{l.label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="copyright">© {new Date().getFullYear()} Flora Botanics.</p>
      </footer>
    </>
  );
}
