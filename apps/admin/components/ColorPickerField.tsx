"use client";

const COLOR_SWATCHES = [
  { label: "Verde profundo", value: "#0f2812" },
  { label: "Verde escuro", value: "#172b17" },
  { label: "Verde medio", value: "#21351d" },
  { label: "Creme", value: "#f2ecdf" },
  { label: "Creme escuro", value: "#e6ddcb" },
  { label: "Dourado", value: "#b9924d" },
  { label: "Dourado escuro", value: "#96763f" },
  { label: "Texto", value: "#28251d" },
  { label: "Texto suave", value: "#5e584b" },
  { label: "Branco quente", value: "#fff8ea" },
];

export type ColorSwatch = {
  label: string;
  value: string;
};

export function ColorPickerField({
  label,
  value,
  onChange,
  placeholder = "ex: #28251d",
  allowClear = true,
  swatches = COLOR_SWATCHES,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  swatches?: ColorSwatch[];
}) {
  const current = value ?? "";
  const active = current.toLowerCase();

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="cms-color-control">
        <span
          className="cms-color-preview"
          style={{
            background: current
              ? current
              : "linear-gradient(135deg, rgba(255,248,234,0.14), rgba(185,146,77,0.2))",
          }}
          aria-hidden="true"
        />
        <input
          value={current}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="cms-color-input"
        />
      </div>
      <div className="cms-color-swatches" aria-label={`Paleta de cor para ${label}`}>
        {swatches.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            title={`${swatch.label} ${swatch.value}`}
            aria-label={`Usar ${swatch.label}`}
            className={active === swatch.value ? "cms-color-swatch is-active" : "cms-color-swatch"}
            onClick={() => onChange(swatch.value)}
          >
            <span style={{ background: swatch.value }} />
          </button>
        ))}
        {allowClear ? (
          <button type="button" className="cms-color-clear" onClick={() => onChange("")}>
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}
