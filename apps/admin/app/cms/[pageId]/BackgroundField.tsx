"use client";

import { ImageField } from "@/components/MediaPicker";

/**
 * Fundo da seção — cor sólida, degradê ou imagem, com véu escuro opcional.
 * Salvo em props.background de cada seção:
 * { type: "none"|"color"|"gradient"|"image", color, color2, angle, image, overlay }
 */

export type SectionBackground = {
  type: "none" | "color" | "gradient" | "image";
  color?: string;
  color2?: string;
  angle?: number;
  image?: string;
  overlay?: number;
  blend?: "normal" | "multiply" | "overlay" | "soft-light" | "luminosity";
  effect?: "none" | "smoke" | "mask";
};

const BLENDS: Array<{ value: NonNullable<SectionBackground["blend"]>; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiplicar" },
  { value: "overlay", label: "Sobrepor" },
  { value: "soft-light", label: "Luz suave" },
  { value: "luminosity", label: "Luminosidade" },
];

const EFFECTS: Array<{ value: NonNullable<SectionBackground["effect"]>; label: string }> = [
  { value: "none", label: "Sem efeito" },
  { value: "smoke", label: "Fumaça" },
  { value: "mask", label: "Máscara (bordas dissolvidas)" },
];

const TYPES: Array<{ value: SectionBackground["type"]; label: string }> = [
  { value: "none", label: "Padrão" },
  { value: "color", label: "Cor sólida" },
  { value: "gradient", label: "Degradê" },
  { value: "image", label: "Imagem" },
];

export function BackgroundField({
  value,
  tenantId,
  onChange,
}: {
  value: SectionBackground | undefined;
  tenantId: string;
  onChange: (bg: SectionBackground) => void;
}) {
  const bg: SectionBackground = value ?? { type: "none" };

  function patch(p: Partial<SectionBackground>) {
    onChange({ ...bg, ...p });
  }

  return (
    <div
      style={{
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        marginBottom: 16,
        background: "rgba(10, 22, 11, 0.25)",
      }}
    >
      <p className="field-label" style={{ marginBottom: 10 }}>Fundo da seção</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: bg.type !== "none" ? 14 : 0 }}>
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => patch({ type: t.value })}
            className={bg.type === t.value ? "btn btn-gold" : "btn btn-ghost"}
            style={{ padding: "8px 14px", fontSize: 9 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {bg.type === "color" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <input
            type="color"
            value={bg.color ?? "#f2ecdf"}
            onChange={(e) => patch({ color: e.target.value })}
            style={{ width: 44, height: 44, border: "1px solid var(--glass-border)", borderRadius: 10, background: "transparent", cursor: "pointer", padding: 2 }}
          />
          <span className="muted" style={{ fontSize: 11, fontFamily: "monospace" }}>{bg.color ?? "#f2ecdf"}</span>
        </label>
      ) : null}

      {bg.type === "gradient" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="color"
                value={bg.color ?? "#0f2012"}
                onChange={(e) => patch({ color: e.target.value })}
                style={{ width: 40, height: 40, border: "1px solid var(--glass-border)", borderRadius: 10, background: "transparent", cursor: "pointer", padding: 2 }}
              />
              <span className="muted" style={{ fontSize: 10 }}>Cor 1</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="color"
                value={bg.color2 ?? "#b9924d"}
                onChange={(e) => patch({ color2: e.target.value })}
                style={{ width: 40, height: 40, border: "1px solid var(--glass-border)", borderRadius: 10, background: "transparent", cursor: "pointer", padding: 2 }}
              />
              <span className="muted" style={{ fontSize: 10 }}>Cor 2</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 160 }}>
              <input
                type="range"
                min={0}
                max={360}
                value={bg.angle ?? 135}
                onChange={(e) => patch({ angle: Number(e.target.value) })}
                style={{ flex: 1, accentColor: "var(--gold)" }}
              />
              <span className="muted" style={{ fontSize: 10, width: 38 }}>{bg.angle ?? 135}°</span>
            </label>
          </div>
          <div
            style={{
              height: 34,
              borderRadius: 10,
              border: "1px solid var(--glass-border)",
              background: `linear-gradient(${bg.angle ?? 135}deg, ${bg.color ?? "#0f2012"}, ${bg.color2 ?? "#b9924d"})`,
            }}
          />
        </div>
      ) : null}

      {bg.type === "image" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ImageField
            value={bg.image ?? ""}
            tenantId={tenantId}
            onChange={(url) => patch({ image: url })}
          />
          <div className="field">
            <span className="field-label">Mesclagem (incorporar à página)</span>
            <select
              className="input"
              value={bg.blend ?? "normal"}
              onChange={(e) => patch({ blend: e.target.value as SectionBackground["blend"] })}
            >
              {BLENDS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {bg.type !== "none" ? (
        <div className="field" style={{ marginTop: 12 }}>
          <span className="field-label">Efeito</span>
          <select
            className="input"
            value={bg.effect ?? "none"}
            onChange={(e) => patch({ effect: e.target.value as SectionBackground["effect"] })}
          >
            {EFFECTS.map((ef) => (
              <option key={ef.value} value={ef.value}>{ef.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {bg.type !== "none" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <span className="muted" style={{ fontSize: 10, width: 150 }}>
            Véu escuro (legibilidade)
          </span>
          <input
            type="range"
            min={0}
            max={80}
            value={bg.overlay ?? 0}
            onChange={(e) => patch({ overlay: Number(e.target.value) })}
            style={{ flex: 1, accentColor: "var(--gold)" }}
          />
          <span className="muted" style={{ fontSize: 10, width: 34 }}>{bg.overlay ?? 0}%</span>
        </label>
      ) : null}
    </div>
  );
}
