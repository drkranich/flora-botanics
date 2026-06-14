"use client";

import { useRef, useState, useTransition } from "react";
import { sendMessage } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10, 22, 11, 0.45)",
  width: "100%",
  resize: "vertical",
};

export function MessageForm({ conversationId, channel }: { conversationId: string; channel: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(conversationId, formData);
      if (res.ok) {
        formRef.current?.reset();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form ref={formRef} action={submit} style={{ display: "grid", gap: 8, marginTop: 16, borderTop: "1px solid var(--glass-border)", paddingTop: 16 }}>
      <textarea name="body" required rows={3} placeholder="Escreva uma resposta..." style={inputStyle} />
      {error ? <p style={{ fontSize: 12, color: "#e8a0a0", margin: 0 }}>{error}</p> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "10px 20px", fontSize: 10 }}>
          {pending ? "Enviando…" : channel === "email" ? "Enviar e-mail" : "Registrar resposta"}
        </button>
        {channel !== "email" ? (
          <span className="muted" style={{ fontSize: 10.5 }}>
            Canal ainda não conectado — a resposta fica registrada na conversa, sem envio real.
          </span>
        ) : null}
      </div>
    </form>
  );
}
