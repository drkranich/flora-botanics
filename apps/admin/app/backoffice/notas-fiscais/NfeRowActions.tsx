"use client";

import { useState } from "react";
import { editNfeDraftAction } from "./emitir-action";

const btnStyle = {
  padding: "5px 10px",
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid var(--glass-border)",
  background: "rgba(255,255,255,0.06)",
  color: "var(--color-text, inherit)",
  cursor: "pointer",
  lineHeight: 1.3,
} as const;

const btnDangerStyle = {
  ...btnStyle,
  color: "rgba(232,160,160,0.9)",
  borderColor: "rgba(232,160,160,0.3)",
} as const;

const inputStyle = {
  width: 70,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid var(--glass-border)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: 12,
} as const;

// ─── Compartilhar (copia chave de acesso) ─────────────────────────────────────

export function NfeCopyButton({ chaveAcesso }: { chaveAcesso: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(chaveAcesso);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: selecionar texto
      const el = document.createElement("textarea");
      el.value = chaveAcesso;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button type="button" onClick={handleCopy} style={btnStyle} title={`Chave: ${chaveAcesso}`}>
      {copied ? "✓ Copiado!" : "Compartilhar"}
    </button>
  );
}

// ─── Editar rascunho (inline) ──────────────────────────────────────────────────

export function NfeEditButton({
  nfeId,
  numero,
  serie,
}: {
  nfeId: string;
  numero: number | null;
  serie: number | null;
}) {
  const [open, setOpen] = useState(false);
  const editBound = editNfeDraftAction.bind(null, nfeId);

  return (
    <span>
      <button type="button" onClick={() => setOpen((v) => !v)} style={btnStyle}>
        {open ? "Fechar" : "Editar"}
      </button>

      {open && (
        <form
          action={editBound}
          onSubmit={() => setOpen(false)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginLeft: 8,
            background: "rgba(0,0,0,0.25)",
            border: "1px solid var(--glass-border)",
            borderRadius: 8,
            padding: "4px 8px",
          }}
        >
          <label style={{ fontSize: 11 }}>
            Nº&nbsp;
            <input name="numero" type="number" min={1} defaultValue={numero ?? 1} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11 }}>
            Série&nbsp;
            <input name="serie" type="number" min={1} defaultValue={serie ?? 1} style={inputStyle} />
          </label>
          <button type="submit" style={{ ...btnStyle, color: "var(--color-gold, #c9a84c)" }}>
            Salvar
          </button>
        </form>
      )}
    </span>
  );
}

// ─── Botão genérico de confirmação para ações destrutivas ─────────────────────

export function NfeConfirmButton({
  label,
  confirmLabel = "Confirmar?",
  danger = false,
  action,
}: {
  label: string;
  confirmLabel?: string;
  danger?: boolean;
  action: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={danger ? btnDangerStyle : btnStyle}
      >
        {label}
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <button
        type="button"
        onClick={() => { action(); setConfirming(false); }}
        style={danger ? btnDangerStyle : btnStyle}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setConfirming(false)} style={btnStyle}>
        Não
      </button>
    </span>
  );
}
