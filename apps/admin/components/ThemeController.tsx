"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "flora_admin_theme";

export type ThemeId =
  | "ambar"
  | "esmeralda"
  | "indigo"
  | "rosa"
  | "violeta"
  | "cobre"
  | "ardosia"
  | "coral";

export type ThemeConfig = {
  label: string;
  swatch: string;
  gold: string;
  goldLight: string;
  goldDark: string;
  glowRgb: string; // e.g. "185, 146, 77"
};

export const THEMES: Record<ThemeId, ThemeConfig> = {
  ambar: {
    label: "Âmbar",
    swatch: "#b9924d",
    gold: "#b9924d",
    goldLight: "#d9b87a",
    goldDark: "#96763f",
    glowRgb: "185, 146, 77",
  },
  esmeralda: {
    label: "Esmeralda",
    swatch: "#3d9b73",
    gold: "#3d9b73",
    goldLight: "#62c99d",
    goldDark: "#2d7a58",
    glowRgb: "61, 155, 115",
  },
  indigo: {
    label: "Índigo",
    swatch: "#5b7bd5",
    gold: "#5b7bd5",
    goldLight: "#839fe8",
    goldDark: "#3e5db5",
    glowRgb: "91, 123, 213",
  },
  rosa: {
    label: "Rosa",
    swatch: "#c46b8a",
    gold: "#c46b8a",
    goldLight: "#de93aa",
    goldDark: "#a04d6c",
    glowRgb: "196, 107, 138",
  },
  violeta: {
    label: "Violeta",
    swatch: "#8b5cf6",
    gold: "#8b5cf6",
    goldLight: "#a98af8",
    goldDark: "#6d3fd4",
    glowRgb: "139, 92, 246",
  },
  cobre: {
    label: "Cobre",
    swatch: "#b5622d",
    gold: "#b5622d",
    goldLight: "#d4884f",
    goldDark: "#8f4c22",
    glowRgb: "181, 98, 45",
  },
  ardosia: {
    label: "Ardósia",
    swatch: "#6b83a0",
    gold: "#6b83a0",
    goldLight: "#90a8c3",
    goldDark: "#4d6380",
    glowRgb: "107, 131, 160",
  },
  coral: {
    label: "Coral",
    swatch: "#c05e52",
    gold: "#c05e52",
    goldLight: "#de8479",
    goldDark: "#9a4438",
    glowRgb: "192, 94, 82",
  },
};

type ThemeContextValue = {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeId: "ambar",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function applyTheme(id: ThemeId) {
  const t = THEMES[id] ?? THEMES.ambar;
  const r = document.documentElement;
  r.style.setProperty("--gold", t.gold);
  r.style.setProperty("--gold-light", t.goldLight);
  r.style.setProperty("--gold-dark", t.goldDark);
  r.style.setProperty("--gold-rgb", t.glowRgb);
  r.style.setProperty("--glass-border-hover", `rgba(${t.glowRgb}, 0.45)`);
  r.style.setProperty("--shadow-glow", `0 0 42px rgba(${t.glowRgb}, 0.18)`);
  r.setAttribute("data-theme", id);
}

export function ThemeController({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>("ambar");

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) ?? "ambar") as ThemeId;
    const id = saved in THEMES ? saved : "ambar";
    setThemeId(id);
    applyTheme(id);
  }, []);

  function setTheme(id: ThemeId) {
    setThemeId(id);
    applyTheme(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  }

  return (
    <ThemeContext.Provider value={{ themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
