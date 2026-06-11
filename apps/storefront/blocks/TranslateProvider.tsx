"use client";

import { useEffect } from "react";

/**
 * Motor de tradução embutido (Google Translate Element), invisível.
 * Traduz o DOM da própria página — mesma URL, navegação intacta,
 * sem banner e sem proxy. O seletor PT/EN/ES aciona via .goog-te-combo.
 */

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement?: new (
          options: Record<string, unknown>,
          elementId: string
        ) => unknown;
      };
    };
  }
}

export function TranslateProvider() {
  useEffect(() => {
    if (document.getElementById("gt-script")) return;

    window.googleTranslateElementInit = () => {
      const TE = window.google?.translate?.TranslateElement;
      if (TE) {
        new TE(
          { pageLanguage: "pt", includedLanguages: "en,es,pt", autoDisplay: false },
          "google_translate_element"
        );
      }
    };

    const s = document.createElement("script");
    s.id = "gt-script";
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return <div id="google_translate_element" style={{ display: "none" }} aria-hidden="true" />;
}
