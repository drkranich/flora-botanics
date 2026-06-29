"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateFavicon } from "@/lib/config/actions";
import { ImageField } from "@/components/MediaPicker";

const PREVIEW_SIZES = [
  { size: 16, label: "Aba pequena" },
  { size: 32, label: "Aba padrão" },
  { size: 64, label: "Favoritos" },
  { size: 180, label: "Apple touch" },
] as const;

export function FaviconEditor({
  initial,
  tenantId,
}: {
  initial: string;
  tenantId: string;
}) {
  const [url, setUrl] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [activeSize, setActiveSize] = useState(64);
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateFavicon(url);
        setMsg("Favicon salvo — ativo em até 60s.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        {/* Preview */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 10,
            border: "1px solid var(--glass-border)",
            background: "var(--glass-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {url ? (
            <img src={url} alt="favicon preview" style={{ width: 48, height: 48, objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 28 }}>🌿</span>
          )}
        </div>

        {/* Upload */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <ImageField value={url} tenantId={tenantId} onChange={setUrl} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={save} disabled={pending} className="btn btn-gold" style={{ padding: "11px 24px" }}>
          {pending ? "…" : "Salvar favicon"}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="btn btn-ghost"
            style={{ padding: "11px 18px", fontSize: 10 }}
          >
            Expandir
          </button>
        )}
        {url && (
          <button
            onClick={() => setUrl("")}
            className="btn btn-ghost"
            style={{ padding: "11px 18px", fontSize: 10 }}
          >
            Remover
          </button>
        )}
        {msg && <p style={{ fontSize: 12, color: "var(--gold-light)", margin: 0 }}>{msg}</p>}
      </div>

      <p className="muted" style={{ fontSize: 11, margin: 0 }}>
        Use PNG ou SVG quadrado (recomendado 512×512 px). Formatos aceitos: .ico, .png, .svg.
      </p>

      {mounted && expanded && url ? createPortal((
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            isolation: "isolate",
            transform: "translateZ(0)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(5, 12, 6, 0.72)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              zIndex: 1,
              width: "min(620px, 100%)",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              padding: 24,
              background: "rgba(15, 32, 18, 0.94)",
              display: "grid",
              gap: 20,
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Preview expandido</p>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Confira se o ícone continua legível nos tamanhos reais do navegador.
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setExpanded(false)} style={{ padding: "8px 14px", fontSize: 10 }}>
                Fechar
              </button>
            </header>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 0.9fr)", gap: 18, alignItems: "stretch" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    minHeight: 240,
                    borderRadius: 18,
                    border: "1px solid var(--glass-border)",
                    background: "rgba(255, 248, 234, 0.06)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    padding: 18,
                  }}
                >
                  <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 180,
                        height: 180,
                        borderRadius: 16,
                        border: "1px solid rgba(242, 236, 223, 0.12)",
                        background: "rgba(10, 22, 11, 0.45)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <img src={url} alt={`Preview do favicon em ${activeSize}px`} style={{ width: activeSize, height: activeSize, objectFit: "contain" }} />
                    </div>
                    <span className="chip chip-live">{activeSize}px ativo</span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: "1px solid var(--glass-border)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(10, 22, 11, 0.38)",
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255, 248, 234, 0.08)",
                      flexShrink: 0,
                    }}
                  >
                    <img src={url} alt="" style={{ width: Math.min(activeSize, 18), height: Math.min(activeSize, 18), objectFit: "contain" }} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Flora Botanics</p>
                    <p className="muted" style={{ margin: "2px 0 0", fontSize: 10 }}>
                      Simulação da aba do navegador
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                {PREVIEW_SIZES.map(({ size, label }) => {
                  const active = activeSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setActiveSize(size)}
                      aria-pressed={active}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px 1fr auto",
                        alignItems: "center",
                        gap: 12,
                        borderRadius: 12,
                        border: active ? "1px solid var(--gold-light)" : "1px solid var(--glass-border)",
                        background: active ? "rgba(185, 146, 77, 0.18)" : "rgba(255, 248, 234, 0.05)",
                        color: "inherit",
                        padding: "10px 12px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 11, color: active ? "var(--gold-light)" : "var(--cream-dim)", fontWeight: 800 }}>
                        {size}px
                      </span>
                      <span>
                        <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>{label}</span>
                        <span className="muted" style={{ display: "block", fontSize: 10, marginTop: 2 }}>
                          Clique para testar este tamanho
                        </span>
                      </span>
                      <span
                        style={{
                          width: Math.max(size, 28),
                          height: Math.max(size, 28),
                          maxWidth: 54,
                          maxHeight: 54,
                          borderRadius: 8,
                          border: "1px solid var(--glass-border)",
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(10, 22, 11, 0.45)",
                          overflow: "hidden",
                        }}
                      >
                        <img src={url} alt="" style={{ width: size, height: size, maxWidth: 48, maxHeight: 48, objectFit: "contain" }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ), document.body) : null}
    </div>
  );
}
