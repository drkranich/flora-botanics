"use client";

import { useState, useTransition } from "react";
import { updateLogo } from "@/lib/config/actions";
import { ImageField } from "@/components/MediaPicker";

/** Logo da marca — usada no header e no rodapé do site.
 *  Vazio = o site usa o logotipo padrão desenhado (FL•RA BOTANICS). */
export function LogoEditor({
  initial,
  tenantId,
}: {
  initial: string;
  tenantId: string;
}) {
  const [image, setImage] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateLogo(image);
        setMsg("Logo salvo — o site atualiza em até 60s.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ImageField value={image} tenantId={tenantId} onChange={setImage} />
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
