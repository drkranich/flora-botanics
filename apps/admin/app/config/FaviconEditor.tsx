"use client";

import { useState, useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

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
    </div>
  );
}
