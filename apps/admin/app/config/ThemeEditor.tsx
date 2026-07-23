"use client";

import { useState, useTransition } from "react";
import { ColorPickerField } from "@/components/ColorPickerField";
import { updateThemeColors } from "@/lib/config/actions";

const COLOR_LABEL: Record<string, string> = {
  "forest-900": "Verde profundo (fundos)",
  "forest-800": "Verde escuro",
  "forest-700": "Verde médio",
  cream: "Creme (fundo do site)",
  "cream-dark": "Creme escuro (seções)",
  gold: "Dourado (botões e acentos)",
  "gold-dark": "Dourado escuro (hover)",
  ink: "Texto",
  muted: "Texto suave",
  white: "Branco quente",
};

export function ThemeEditor({ initial }: { initial: Record<string, string> }) {
  const [colors, setColors] = useState<Record<string, string>>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const keys = Object.keys(COLOR_LABEL).filter((k) => k in colors);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateThemeColors(colors);
        setMsg("Tema salvo — o site atualiza em até 60s.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {keys.map((k) => (
          <ColorPickerField
            key={k}
            label={COLOR_LABEL[k]}
            value={colors[k]}
            onChange={(color) => setColors({ ...colors, [k]: color })}
            allowClear={false}
          />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
        <button onClick={save} disabled={pending} className="btn btn-gold" style={{ padding: "11px 24px" }}>
          {pending ? "…" : "Salvar tema"}
        </button>
        {msg ? <p style={{ fontSize: 12, color: "var(--gold-light)", margin: 0 }}>{msg}</p> : null}
      </div>
    </div>
  );
}
