"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateFavicon } from "@/lib/config/actions";
import { ImageField } from "@/components/MediaPicker";

export function FaviconEditor({
  initial,
  tenantId,
}: {
  initial: string;
  tenantId: string;
}) {
  const [url, setUrl] = useState(initial);
  const [expanded, setExpanded] = useState(false);
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
            zIndex: 9999,
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

            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "center" }}>
              <div
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 18,
                  border: "1px solid var(--glass-border)",
                  background: "rgba(255, 248, 234, 0.06)",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                <img src={url} alt="Preview grande do favicon" style={{ width: 168, height: 168, objectFit: "contain" }} />
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {[16, 32, 64, 180].map((size) => (
                  <div key={size} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 56, fontSize: 11, color: "var(--cream-dim)" }}>{size}px</span>
                    <span
                      style={{
                        width: Math.max(size, 28),
                        height: Math.max(size, 28),
                        borderRadius: 8,
                        border: "1px solid var(--glass-border)",
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(10, 22, 11, 0.45)",
                      }}
                    >
                      <img src={url} alt="" style={{ width: size, height: size, objectFit: "contain" }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ), document.body) : null}
    </div>
  );
}
