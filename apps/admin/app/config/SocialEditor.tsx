"use client";

import { useState, useTransition } from "react";
import { updateSocialLinks, type SocialItem } from "@/lib/config/actions";
import { ImageField } from "@/components/MediaPicker";

/** Botões de redes sociais do rodapé: nome + ícone (imagem) + link. */
export function SocialEditor({
  initial,
  tenantId,
}: {
  initial: SocialItem[];
  tenantId: string;
}) {
  const [items, setItems] = useState<SocialItem[]>(
    initial.length > 0 ? initial : [{ label: "Instagram", image: "", href: "" }]
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function patch(i: number, partial: Partial<SocialItem>) {
    setItems(items.map((x, j) => (j === i ? { ...x, ...partial } : x)));
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateSocialLinks(items);
        setMsg("Redes sociais salvas — o site atualiza em até 60s.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((s, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            border: "1px dashed var(--glass-border)",
            borderRadius: "var(--radius-md)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <button
            type="button"
            className="btn-icon"
            title="Remover"
            onClick={() => setItems(items.filter((_, j) => j !== i))}
            style={{ position: "absolute", top: 10, right: 10, width: 24, height: 24, fontSize: 11, color: "#e8a0a0" }}
          >
            ✕
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, paddingRight: 30 }}>
            <div className="field">
              <span className="field-label">Nome</span>
              <input className="input" value={s.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder="Instagram" />
            </div>
            <div className="field">
              <span className="field-label">Link do perfil</span>
              <input className="input" value={s.href} onChange={(e) => patch(i, { href: e.target.value })} placeholder="https://instagram.com/florabotanics" />
            </div>
          </div>
          <div className="field">
            <span className="field-label">Ícone (imagem — PNG/SVG pequeno)</span>
            <ImageField value={s.image} tenantId={tenantId} onChange={(url) => patch(i, { image: url })} />
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setItems([...items, { label: "", image: "", href: "" }])}
          style={{ padding: "10px 18px", fontSize: 10 }}
        >
          + Adicionar rede
        </button>
        <button onClick={save} disabled={pending} className="btn btn-gold" style={{ padding: "11px 24px" }}>
          {pending ? "…" : "Salvar redes sociais"}
        </button>
        {msg ? <p style={{ fontSize: 12, color: "var(--gold-light)", margin: 0 }}>{msg}</p> : null}
      </div>
    </div>
  );
}
