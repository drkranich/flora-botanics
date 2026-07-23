"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES, type ThemeId, useTheme } from "./ThemeController";

export function ThemePicker() {
  const { themeId, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const current = THEMES[themeId];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: 0,
            right: 0,
            padding: "14px 12px",
            background: "rgba(10, 22, 11, 0.96)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-md)",
            backdropFilter: "blur(24px) saturate(1.3)",
            WebkitBackdropFilter: "blur(24px) saturate(1.3)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
            zIndex: 100,
          }}
        >
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--gold-light)",
              marginBottom: 12,
            }}
          >
            Cor de destaque
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(
              ([id, t]) => (
                <button
                  key={id}
                  onClick={() => {
                    setTheme(id);
                    setOpen(false);
                  }}
                  title={t.label}
                  style={{
                    height: 34,
                    borderRadius: 8,
                    border:
                      themeId === id
                        ? `2px solid ${t.goldLight}`
                        : "2px solid rgba(255,255,255,0.10)",
                    background: `linear-gradient(135deg, ${t.goldLight}, ${t.goldDark})`,
                    cursor: "pointer",
                    position: "relative",
                    transition: "transform 0.18s, border-color 0.18s",
                    outline: "none",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.transform = "scale(1.08)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.transform = "scale(1)")
                  }
                >
                  {themeId === id && (
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: "#fff",
                        textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              )
            )}
          </div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--glass-border)",
              fontSize: 10,
              color: "var(--cream-dim)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: current.swatch,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {current.label} — salvo automaticamente
          </div>
        </div>
      )}

      <button
        className="side-item"
        onClick={() => setOpen((v) => !v)}
        title="Escolher cor do tema"
        style={open ? { background: "var(--glass-bg-strong)", borderRadius: 10 } : {}}
      >
        <span
          className="side-icon"
          style={{
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${current.goldLight}, ${current.goldDark})`,
            display: "inline-block",
            border: "1.5px solid rgba(255,255,255,0.25)",
            flexShrink: 0,
          }}
        />
        <span className="side-label">Tema</span>
      </button>
    </div>
  );
}
