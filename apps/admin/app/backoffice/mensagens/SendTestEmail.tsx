"use client";

import { useState, useTransition } from "react";
import { sendTestEmail } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10, 22, 11, 0.45)",
  width: 200,
};

const buttonStyle: React.CSSProperties = {
  background: "rgba(242, 236, 223, 0.08)",
  border: "1px solid var(--glass-border)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--cream)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function SendTestEmail({ templateId }: { templateId: string }) {
  const [to, setTo] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function submit() {
    if (!to.trim()) {
      setResult({ ok: false, message: "Informe um e-mail." });
      return;
    }
    setResult(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("to", to.trim());
      const res = await sendTestEmail(templateId, formData);
      if (res.ok) {
        setResult({ ok: true, message: "Enviado!" });
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input
        type="email"
        placeholder="enviar teste para..."
        value={to}
        onChange={(e) => setTo(e.target.value)}
        style={inputStyle}
      />
      <button type="button" onClick={submit} disabled={pending} style={buttonStyle}>
        {pending ? "Enviando…" : "Enviar teste"}
      </button>
      {result ? (
        <span style={{ fontSize: 11, color: result.ok ? "#7fbf9e" : "#e8a0a0" }}>
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
