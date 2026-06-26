"use client";

import { useState, useTransition } from "react";
import { updateLogo, type LogoConfig } from "@/lib/config/actions";
import { ImageField } from "@/components/MediaPicker";

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Original", value: "" },
  { label: "Branco", value: "brightness(0) invert(1)" },
  { label: "Preto", value: "brightness(0)" },
  { label: "Dourado", value: "sepia(1) saturate(3) brightness(0.85)" },
];

/** Logo da marca — imagem, tamanho e cor.
 *  Vazio = o site usa o logotipo padrão desenhado (FL•RA BOTANICS). */
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Imagem */}
      <div>
        <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Imagem</p>
        <ImageField value={image} tenantId={tenantId} onChange={setImage} />
      </div>

      {/* Preview */}
      {image && (
        <div
          style={{
            padding: "14px 18px",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img
            src={image}
            alt="Preview"
            style={{
              width,
              height,
              objectFit: "contain",
              filter: filter || undefined,
            }}
          />
          <span className="muted" style={{ fontSize: 11 }}>Preview</span>
        </div>
      )}

      {/* Tamanho */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="muted" style={{ fontSize: 11 }}>Largura (px)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={60}
              max={360}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: 140 }}
            />
            <span style={{ fontSize: 13, minWidth: 36 }}>{width}px</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="muted" style={{ fontSize: 11 }}>Altura (px)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={20}
              max={100}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              style={{ width: 140 }}
            />
            <span style={{ fontSize: 13, minWidth: 36 }}>{height}px</span>
          </div>
        </div>
      </div>

      {/* Cor */}
      <div>
        <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Cor do logo</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setFilter(p.value)}
              className={filter === p.value ? "btn btn-gold" : "btn btn-ghost"}
              style={{ padding: "8px 16px", fontSize: 12 }}
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
            onClick={() => setImage("")}
            className="btn btn-ghost"
            style={{ padding: "11px 18px", fontSize: 10 }}
          >
            Voltar ao logo padrão
          </button>
        ) : null}
        {msg ? <p style={{ fontSize: 12, color: "var(--gold-light)", margin: 0 }}>{msg}</p> : null}
      </div>

      <p className="muted" style={{ fontSize: 11, margin: 0 }}>
        Dica: use PNG ou SVG com fundo transparente. Vazio = logotipo padrão FL•RA.
      </p>
    </div>
  );
}
