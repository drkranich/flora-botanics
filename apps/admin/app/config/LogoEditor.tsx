"use client";

import { useState, useTransition } from "react";
import { updateLogo, type LogoConfig } from "@/lib/config/actions";
import { ImageField } from "@/components/MediaPicker";

const COLOR_PRESETS: { label: string; value: string; bg?: string }[] = [
  { label: "Original",  value: "" },
  { label: "Branco",    value: "brightness(0) invert(1)",                                  bg: "#333" },
  { label: "Preto",     value: "brightness(0)",                                             bg: "#eee" },
  { label: "Dourado",   value: "sepia(1) saturate(4) hue-rotate(5deg) brightness(0.88)" },
  { label: "Cinza",     value: "grayscale(1)" },
  { label: "Verde",     value: "sepia(1) saturate(4) hue-rotate(88deg) brightness(0.85)" },
  { label: "Azul",      value: "sepia(1) saturate(5) hue-rotate(195deg) brightness(0.9)"  },
  { label: "Rosa",      value: "sepia(1) saturate(5) hue-rotate(295deg) brightness(1.05)" },
  { label: "Laranja",   value: "sepia(1) saturate(4) hue-rotate(340deg) brightness(0.95)" },
  { label: "Roxo",      value: "sepia(1) saturate(5) hue-rotate(245deg) brightness(0.9)"  },
];

/** Logo da marca — imagem, tamanho e cor. */
export function LogoEditor({
  initial,
  tenantId,
}: {
  initial: LogoConfig;
  tenantId: string;
}) {
  const [image, setImage] = useState(initial.image);
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [filter, setFilter] = useState(initial.filter);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateLogo({ image, width, height, filter });
        setMsg("Logo salvo — o site atualiza em até 60s.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Imagem */}
      <div>
        <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Imagem</p>
        <ImageField value={image} tenantId={tenantId} onChange={setImage} />
      </div>

      {/* Preview */}
      {image && (
        <div
          style={{
            padding: "18px 24px",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", filter: filter || undefined }}>
            <img
              src={image}
              alt="Preview"
              style={{ width, height, objectFit: "contain" }}
            />
          </span>
          <span className="muted" style={{ fontSize: 11 }}>Preview</span>
        </div>
      )}

      {/* Tamanho */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="muted" style={{ fontSize: 11 }}>Largura (px)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={60}
              max={600}
              step={10}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: 180 }}
            />
            <input
              type="number"
              min={60}
              max={600}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: 62, padding: "4px 6px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 6, color: "inherit", fontSize: 13 }}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="muted" style={{ fontSize: 11 }}>Altura (px)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={20}
              max={200}
              step={4}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              style={{ width: 180 }}
            />
            <input
              type="number"
              min={20}
              max={200}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              style={{ width: 62, padding: "4px 6px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 6, color: "inherit", fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      {/* Cor */}
      <div>
        <p className="muted" style={{ fontSize: 11, marginBottom: 10 }}>Cor do logo</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setFilter(p.value)}
              className={filter === p.value ? "btn btn-gold" : "btn btn-ghost"}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                background: filter === p.value ? undefined : (p.bg ?? undefined),
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={save} disabled={pending} className="btn btn-gold" style={{ padding: "11px 24px" }}>
          {pending ? "…" : "Salvar logo"}
        </button>
        {image ? (
          <button
            onClick={() => { setImage(""); setFilter(""); setWidth(160); setHeight(48); }}
            className="btn btn-ghost"
            style={{ padding: "11px 18px", fontSize: 10 }}
          >
            Voltar ao logo padrão
          </button>
        ) : null}
        {msg ? <p style={{ fontSize: 12, color: "var(--gold-light)", margin: 0 }}>{msg}</p> : null}
      </div>

      <p className="muted" style={{ fontSize: 11, margin: 0 }}>
        Dica: use PNG ou SVG com fundo transparente para que a cor funcione melhor.
      </p>
    </div>
  );
}
