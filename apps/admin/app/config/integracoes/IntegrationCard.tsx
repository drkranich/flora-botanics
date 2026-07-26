"use client";

import { useState, useTransition } from "react";
import {
  saveIntegration,
  removeIntegration,
  startManualSync,
  type IntegrationKey,
} from "./actions";

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
  status: IntegrationStatus | null;
}

export interface IntegrationStatus {
  providerKey: string;
  status: string;
  environment: string;
  credentialsStatus: string;
  autoSyncEnabled: boolean;
  lastSyncAt: string | null;
  lastHealthcheckAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  errorCount: number;
  latestRunStatus: string | null;
  latestRunAt: string | null;
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

const statusCopy: Record<string, { label: string; color: string; background: string; border: string }> = {
  online: {
    label: "Online",
    color: "#8fd486",
    background: "rgba(143,212,134,0.12)",
    border: "rgba(143,212,134,0.35)",
  },
  pending_auth: {
    label: "Aguardando autenticação",
    color: "var(--gold-light)",
    background: "rgba(185,146,77,0.14)",
    border: "rgba(185,146,77,0.35)",
  },
  error: {
    label: "Erro",
    color: "#e8a0a0",
    background: "rgba(232,160,160,0.12)",
    border: "rgba(232,160,160,0.35)",
  },
  paused: {
    label: "Pausado",
    color: "var(--cream-dim)",
    background: "rgba(242,236,223,0.06)",
    border: "var(--glass-border)",
  },
  offline: {
    label: "Offline",
    color: "var(--cream-dim)",
    background: "rgba(242,236,223,0.06)",
    border: "var(--glass-border)",
  },
};

const credentialsCopy: Record<string, string> = {
  missing: "Credenciais ausentes",
  stored: "Credenciais salvas",
  expired: "Credenciais expiradas",
  invalid: "Credenciais inválidas",
};

function formatDateTime(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function IntegrationCard({
  integrationKey,
  icon,
  title,
  description,
  fields,
  docsUrl,
  initial,
  status,
}: Props) {
  const hasLegacyCredentials = initial !== null && Object.keys(initial).length > 0;
  const hasConnectionCredentials = status?.credentialsStatus === "stored";
  const isConnected = hasLegacyCredentials || hasConnectionCredentials;
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [isSyncing, startSync] = useTransition();
  const badge = statusCopy[status?.status ?? (isConnected ? "pending_auth" : "offline")] ?? statusCopy.offline;

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

  function handleSync() {
    setError(null);
    setSaved(false);
    startSync(async () => {
      const res = await startManualSync(integrationKey);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(res.error ?? "Erro ao iniciar sincronização.");
      }
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
            background: badge.background,
            border: `1px solid ${badge.border}`,
            color: badge.color,
          }}
        >
          ● {badge.label}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
        }}
      >
        <small style={metricStyle}>
          <span>Ambiente</span>
          <strong>{status?.environment === "test" ? "Teste" : "Produção"}</strong>
        </small>
        <small style={metricStyle}>
          <span>Credenciais</span>
          <strong>{credentialsCopy[status?.credentialsStatus ?? "missing"] ?? "Não mapeado"}</strong>
        </small>
        <small style={metricStyle}>
          <span>Última sincronização</span>
          <strong>{formatDateTime(status?.lastSyncAt ?? null)}</strong>
        </small>
        <small style={metricStyle}>
          <span>Fila</span>
          <strong>{status?.latestRunStatus ? runLabel(status.latestRunStatus) : "Sem execuções"}</strong>
        </small>
      </div>

      {status?.lastError ? (
        <p style={{ margin: 0, fontSize: 12, color: "#e8a0a0", lineHeight: 1.5 }}>
          Último erro: {status.lastError}
        </p>
      ) : null}

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
            onClick={handleSync}
            disabled={isSyncing}
            className="btn btn-gold"
            style={{ padding: "8px 18px", fontSize: 11 }}
          >
            {isSyncing ? "Enfileirando…" : "Sincronizar agora"}
          </button>
        )}
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

const metricStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  padding: "9px 10px",
  borderRadius: 8,
  border: "1px solid rgba(242,236,223,0.08)",
  background: "rgba(10,22,11,0.32)",
  color: "var(--cream-dim)",
};

function runLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "Na fila",
    running: "Executando",
    succeeded: "Concluída",
    failed: "Falhou",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}
