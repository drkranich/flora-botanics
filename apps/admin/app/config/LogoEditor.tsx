"use client";

import { useState, useTransition } from "react";
import { updateLogo, type LogoConfig } from "@/lib/config/actions";
import { ImageField } from "@/components/MediaPicker";

/** Swatches de acesso rápido — o usuário pode escolher qualquer cor além desses. */
const SWATCHES = [
  { label: "Branco",   hex: "#ffffff" },
  { label: "Preto",    hex: "#1a1a1a" },
  { label: "Dourado",  hex: "#c9a96e" },
  { label: "Bege",     hex: "#f5f0eb" },
  { label: "Verde",    hex: "#2d5a27" },
  { label: "Azul",     hex: "#1e3a5f" },
  { label: "Rosa",     hex: "#d4789a" },
];

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
  const [color, setColor] = useState(initial.color ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Se há uma cor, aplica via CSS mask (colore o PNG de forma exata).
  // Se não há cor, mostra a imagem original.
  const previewStyle: React.CSSProperties = color
    ? {
        display: "inline-block",
        width,
        height,
        WebkitMask: `url(${image}) no-repeat center / contain`,
        mask: `url(${image}) no-repeat center / contain`,
        backgroundColor: color,
      }
    : {
        width,
        height,
        objectFit: "contain" as const,
      };

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateLogo({ image, width, height, color });
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
            background: color && color !== "#ffffff" ? "#f5f5f5" : "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {color ? (
            <span style={previewStyle} />
          ) : (
            <img
              src={image}
              alt="Preview"
              style={{ width, height, objectFit: "contain" }}
            />
          )}
          <span className="muted" style={{ fontSize: 11 }}>Preview</span>
        </div>
      )}

      {/* Tamanho */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="muted" style={{ fontSize: 11 }}>Largura (px)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range" min={60} max={600} step={10} value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: 160 }}
            />
            <input
              type="number" min={60} max={600} value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: 62, padding: "4px 6px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 6, color: "inherit", fontSize: 13 }}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="muted" style={{ fontSize: 11 }}>Altura (px)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range" min={20} max={200} step={4} value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              style={{ width: 160 }}
            />
            <input
              type="number" min={20} max={200} value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              style={{ width: 62, padding: "4px 6px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 6, color: "inherit", fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      {/* Cor */}
      <div>
        <p className="muted" style={{ fontSize: 11, marginBottom: 10 }}>Cor do logo</p>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {/* Color picker livre */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <div style={{ position: "relative", width: 44, height: 44 }}>
              <input
                type="color"
                value={color || "#ffffff"}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  border: "2px solid var(--glass-border)",
                  cursor: "pointer",
                  padding: 2,
                  background: "none",
                }}
              />
            </div>
            <span className="muted" style={{ fontSize: 9 }}>Livre</span>
          </div>

          <div style={{ width: 1, height: 44, background: "var(--glass-border)" }} />

          {/* Swatches rápidos */}
          {SWATCHES.map((s) => (
            <div key={s.hex} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <button
                onClick={() => setColor(s.hex)}
                title={s.label}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: s.hex,
                  border: color === s.hex
                    ? "3px solid var(--gold-light)"
                    : "2px solid var(--glass-border)",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
              />
              <span className="muted" style={{ fontSize: 9 }}>{s.label}</span>
            </div>
          ))}

          <div style={{ width: 1, height: 44, background: "var(--glass-border)" }} />

          {/* Original */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <button
              onClick={() => setColor("")}
              title="Cor original da imagem"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: color === ""
                  ? "3px solid var(--gold-light)"
                  : "2px solid var(--glass-border)",
                cursor: "pointer",
                background:
                  "linear-gradient(135deg, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
              }}
            />
            <span className="muted" style={{ fontSize: 9 }}>Original</span>
          </div>
        </div>

        {color && (
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Cor selecionada: <code style={{ fontSize: 11 }}>{color}</code>
            {" — usa CSS mask para colorir o PNG de forma exata."}
          </p>
        )}
        {!color && (
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Cor original da imagem (sem alteração).
          </p>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={save} disabled={pending} className="btn btn-gold" style={{ padding: "11px 24px" }}>
          {pending ? "…" : "Salvar logo"}
        </button>
        {image ? (
          <button
            onClick={() => { setImage(""); setColor(""); setWidth(160); setHeight(48); }}
            className="btn btn-ghost"
            style={{ padding: "11px 18px", fontSize: 10 }}
          >
            Voltar ao logo padrão
          </button>
        ) : null}
        {msg ? <p style={{ fontSize: 12, color: "var(--gold-light)", margin: 0 }}>{msg}</p> : null}
      </div>

      <p className="muted" style={{ fontSize: 11, margin: 0 }}>
        Dica: use PNG com fundo transparente para que a colorização funcione perfeitamente.
      </p>
    </div>
  );
}
