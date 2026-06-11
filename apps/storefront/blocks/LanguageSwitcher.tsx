"use client";

/**
 * Seletor de idiomas PT / EN / ES.
 * PT é o idioma nativo do conteúdo. EN e ES abrem a página atual
 * traduzida pelo Google Translate (funciona no site publicado).
 * Tradução nativa por idioma (conteúdo multilíngue no CMS) está
 * prevista na fase Enterprise do blueprint.
 */
export function LanguageSwitcher() {
  function go(lang: "pt" | "en" | "es") {
    if (typeof window === "undefined") return;
    if (lang === "pt") {
      window.location.href = window.location.pathname;
      return;
    }
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://translate.google.com/translate?sl=pt&tl=${lang}&u=${url}`,
      "_blank",
      "noopener"
    );
  }

  return (
    <div className="lang-switch" role="group" aria-label="Idioma">
      <button onClick={() => go("pt")} title="Português">PT</button>
      <button onClick={() => go("en")} title="English">EN</button>
      <button onClick={() => go("es")} title="Español">ES</button>
    </div>
  );
}
