"use client";

import { useState, useTransition } from "react";
import { saveIntegration, removeIntegration, type IntegrationKey } from "./actions";

export interface FieldDef {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password" | "textarea" | "url";
  hint?: string;
  required?: boolean;
}

interface Props {
  integrationKey: IntegrationKey;
  icon: string;
  title: string;
  description: string;
  fields: FieldDef[];
  docsUrl?: string;
  initial: Record<string, string> | null;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(10,22,11,0.5)",
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  padding: "10px 14px",
  color: "var(--cream)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
  color: "var(--cream-dim)",
  display: "block",
  marginBottom: 4,
};

export function IntegrationCard({
  integrationKey,
  icon,
  title,
  description,
  fields,
  docsUrl,
  initial,
}: Props) {
  const isConnected = initial !== null && Object.keys(initial).length > 0;
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRemoving, startRemove] = useTransition();

  function handleSave(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveIntegration(integrationKey, formData);
      if (res.ok) {
        setSaved(true);
        setOpen(false);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(res.error ?? "Erro ao salvar.");
      }
    });
  }

  function handleRemove() {
    if (!confirm(`Remover credenciais de ${title}?`)) return;
    setError(null);
    startRemove(async () => {
      const res = await removeIntegration(integrationKey);
      if (!res.ok) setError(res.error ?? "Erro ao remover.");
    });
  }

  return (
    <div
      className="glass"
      style={{
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderLeft: isConnected
          ? "2px solid rgba(143,212,134,0.5)"
          : "2px solid var(--glass-border)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 22, color: "var(--gold-light)" }}>{icon}</span>
          <div>
            <strong style={{ fontSize: 13.5, display: "block" }}>{title}</strong>
            <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)", marginTop: 2 }}>{description}</p>
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
            background: isConnected ? "rgba(143,212,134,0.12)" : "rgba(242,236,223,0.06)",
            border: `1px solid ${isConnected ? "rgba(143,212,134,0.35)" : "var(--glass-border)"}`,
            color: isConnected ? "#8fd486" : "var(--cream-dim)",
          }}
        >
          {isConnected ? "● Conectado" : "Não conectado"}
        </span>
      </div>

      {/* Feedback */}
      {saved && (
        <p style={{ margin: 0, fontSize: 12, color: "#8fd486", fontWeight: 700 }}>
          ✓ Credenciais salvas com sucesso.
        </p>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: "#e8a0a0" }}>{error}</p>
      )}

      {/* Actions row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn btn-ghost"
          style={{ padding: "8px 18px", fontSize: 11 }}
        >
          {open ? "Fechar" : isConnected ? "Editar credenciais" : "Configurar"}
        </button>
        {isConnected && !open && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            style={{
              background: "none",
              border: "1px solid rgba(232,160,160,0.3)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 11,
              color: "#e8a0a0",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {isRemoving ? "Removendo…" : "Desconectar"}
          </button>
        )}
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "8px 14px",
              fontSize: 11,
              color: "var(--cream-dim)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Documentação ↗
          </a>
        )}
      </div>

      {/* Form */}
      {open && (
        <form
          action={handleSave}
          style={{
            display: "grid",
            gap: 14,
            paddingTop: 14,
            borderTop: "1px solid rgba(242,236,223,0.08)",
          }}
        >
          {fields.map((f) => (
            <div key={f.name} style={{ display: "grid", gap: 4 }}>
              <label style={labelStyle} htmlFor={`${integrationKey}-${f.name}`}>
                {f.label}{f.required !== false ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={`${integrationKey}-${f.name}`}
                  name={f.name}
                  rows={4}
                  placeholder={f.placeholder}
                  defaultValue={initial?.[f.name] ?? ""}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              ) : (
                <input
                  id={`${integrationKey}-${f.name}`}
                  name={f.name}
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  defaultValue={initial?.[f.name] ?? ""}
                  autoComplete="off"
                  style={inputStyle}
                />
              )}
              {f.hint && (
                <span style={{ fontSize: 11, color: "var(--cream-dim)", lineHeight: 1.4 }}>
                  {f.hint}
                </span>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-gold"
              style={{ padding: "10px 22px", fontSize: 11 }}
            >
              {isPending ? "Salvando…" : "Salvar credenciais"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-ghost"
              style={{ padding: "10px 18px", fontSize: 11 }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
