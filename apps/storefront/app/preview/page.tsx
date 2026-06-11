"use client";

/**
 * PREVIEW AO VIVO — carregado em iframe pelo editor do admin.
 * Recebe as seções via postMessage e renderiza com os mesmos
 * componentes/estilos do site. Sem dados, a página fica em branco.
 */

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ClientSectionRenderer, type CategoryInfo } from "@/blocks/client";

type Section = { id: string; block: string; props: Record<string, unknown> };

export default function PreviewPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [categories, setCategories] = useState<Map<string, CategoryInfo>>(new Map());

  useEffect(() => {
    // categorias (leitura pública via RLS) para a grade renderizar nomes reais
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase
      .from("categories")
      .select("slug, name, description")
      .eq("status", "published")
      .then(({ data }) => {
        setCategories(new Map((data ?? []).map((c) => [c.slug, c as CategoryInfo])));
      });

    function onMessage(e: MessageEvent) {
      if (e.data?.type === "flora-preview" && Array.isArray(e.data.sections)) {
        setSections(e.data.sections as Section[]);
      }
    }
    window.addEventListener("message", onMessage);
    // avisa o editor que o preview está pronto para receber dados
    window.parent?.postMessage({ type: "flora-preview-ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

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

  return (
    <>
      {sections.map((s) => (
        <ClientSectionRenderer key={s.id} section={s} categories={categories} />
      ))}
    </>
  );
}
