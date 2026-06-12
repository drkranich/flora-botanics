import type { CSSProperties, ReactNode } from "react";

/**
 * Fundo personalizado por seção (definido no editor do CMS).
 * Suporta cor sólida, degradê em qualquer ângulo, imagem com modos de
 * mesclagem, véu escuro de legibilidade e efeitos fumaça/máscara.
 * Funciona em Server e Client Components (componente puro).
 */

export type SectionBg = {
  type?: "none" | "color" | "gradient" | "image";
  color?: string;
  color2?: string;
  angle?: number;
  image?: string;
  overlay?: number;
  blend?: string;
  effect?: "none" | "smoke" | "mask";
};

const SMOKE =
  "radial-gradient(60% 60% at 15% 20%, rgba(255,248,234,0.35), transparent 70%)," +
  "radial-gradient(50% 50% at 85% 75%, rgba(255,248,234,0.28), transparent 70%)," +
  "radial-gradient(75% 45% at 50% 105%, rgba(242,236,223,0.45), transparent 70%)";

export function BgWrap({ bg, children }: { bg?: SectionBg; children: ReactNode }) {
  if (!bg || !bg.type || bg.type === "none") return <>{children}</>;

  const veilAlpha = (bg.overlay ?? 0) / 100;
  const veil =
    veilAlpha > 0
      ? `linear-gradient(rgba(10,22,11,${veilAlpha}), rgba(10,22,11,${veilAlpha}))`
      : null;

  const style: CSSProperties = { position: "relative" };
  const layers: string[] = [];
  if (veil) layers.push(veil);

  if (bg.type === "color") {
    style.backgroundColor = bg.color ?? "#f2ecdf";
  } else if (bg.type === "gradient") {
    layers.push(
      `linear-gradient(${bg.angle ?? 135}deg, ${bg.color ?? "#0f2012"}, ${bg.color2 ?? "#b9924d"})`
    );
  } else if (bg.type === "image" && bg.image) {
    const src = bg.image.startsWith("http") || bg.image.startsWith("/") ? bg.image : `/${bg.image}`;
    layers.push(`url("${src}")`);
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
    if (bg.blend && bg.blend !== "normal") {
      style.backgroundColor = bg.color ?? "#f2ecdf";
      style.backgroundBlendMode = bg.blend as CSSProperties["backgroundBlendMode"];
    }
  }
  if (layers.length > 0) style.backgroundImage = layers.join(", ");

  if (bg.effect === "mask") {
    const mask = "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)";
    style.maskImage = mask;
    style.WebkitMaskImage = mask;
  }

  return (
    <div className="has-custom-bg" style={style}>
      {children}
      {bg.effect === "smoke" ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: SMOKE,
          }}
        />
      ) : null}
    </div>
  );
}
