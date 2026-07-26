"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import { requestMarketplaceLabelSync, saveMarketplaceLabelSetting } from "./actions";

export type MarketplaceLabelSettingRow = {
  providerKey: string;
  displayName: string;
  status: string;
  connectionStatus: string;
  credentialsStatus: string;
  sourcePreference: string;
  externalLabelFormats: string[];
  defaultPrintTemplate: string;
  defaultQueueFormat: string;
  trackingSource: string;
  fallbackEnabled: boolean;
  autoQueueExternalLabel: boolean;
  storeOriginalLabel: boolean;
  reprintOriginalEnabled: boolean;
  notes: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

const sourceOptions: GlassSelectOption[] = [
  { value: "external_then_flora", label: "Receber externa, gerar Flora se faltar" },
  { value: "external_label", label: "Usar somente etiqueta do marketplace" },
  { value: "flora_label", label: "Gerar sempre etiqueta Flora" },
  { value: "flora_then_external", label: "Priorizar Flora, manter externa como cópia" },
];

const statusOptions: GlassSelectOption[] = [
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "archived", label: "Arquivada" },
];

const templateOptions: GlassSelectOption[] = [
  { value: "shipping_100x150", label: "Envio térmica 100 x 150 mm" },
  { value: "shipping_a4", label: "Envio A4" },
  { value: "mixed_a4_sheet", label: "Folha econômica mista A4" },
  { value: "sku_50x30", label: "SKU estoque 50 x 30 mm" },
  { value: "barcode_60x40", label: "Código de barras 60 x 40 mm" },
  { value: "barcode_100x50", label: "Código de barras grande 100 x 50 mm" },
  { value: "barcode_a4_2x7", label: "Código de barras A4 2 x 7" },
  { value: "sku_a4_3x8", label: "SKU em folha A4 3 x 8" },
  { value: "kit_80x50", label: "Kit, combo ou lote 80 x 50 mm" },
];

const queueFormatOptions: GlassSelectOption[] = [
  { value: "thermal", label: "Térmica" },
  { value: "a4", label: "A4" },
  { value: "pdf", label: "PDF recebido" },
  { value: "zpl", label: "ZPL recebido" },
];

const trackingOptions: GlassSelectOption[] = [
  { value: "marketplace", label: "Rastreio informado pelo marketplace" },
  { value: "shipping_provider", label: "Rastreio da transportadora" },
  { value: "flora", label: "Rastreio interno Flora" },
  { value: "manual", label: "Informado manualmente" },
];

const formatOptions = [
  { value: "pdf", label: "PDF" },
  { value: "zpl", label: "ZPL" },
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "html", label: "HTML" },
];

function formatDate(iso: string | null) {
  if (!iso) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function MarketplaceLabelSettings({
  rows,
  migrationReady,
}: {
  rows: MarketplaceLabelSettingRow[];
  migrationReady: boolean;
}) {
  if (!migrationReady) {
    return (
      <div style={warningStyle}>
        <p className="eyebrow" style={{ color: "#e8a0a0" }}>Migration pendente</p>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          A tabela marketplace_label_settings ainda não está disponível. Aplique a migration antes de salvar preferências de marketplace.
        </p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Nenhum provider de marketplace encontrado na Central de Integrações.
      </p>
    );
  }

  return (
    <div style={gridStyle}>
      {rows.map((row) => (
        <MarketplaceLabelCard key={row.providerKey} row={row} />
      ))}
    </div>
  );
}

function MarketplaceLabelCard({ row }: { row: MarketplaceLabelSettingRow }) {
  const [status, setStatus] = useState(row.status);
  const [sourcePreference, setSourcePreference] = useState(row.sourcePreference);
  const [defaultPrintTemplate, setDefaultPrintTemplate] = useState(row.defaultPrintTemplate);
  const [defaultQueueFormat, setDefaultQueueFormat] = useState(row.defaultQueueFormat);
  const [trackingSource, setTrackingSource] = useState(row.trackingSource);
  const [externalFormats, setExternalFormats] = useState<Set<string>>(() => new Set(row.externalLabelFormats));
  const [fallbackEnabled, setFallbackEnabled] = useState(row.fallbackEnabled);
  const [autoQueueExternalLabel, setAutoQueueExternalLabel] = useState(row.autoQueueExternalLabel);
  const [storeOriginalLabel, setStoreOriginalLabel] = useState(row.storeOriginalLabel);
  const [reprintOriginalEnabled, setReprintOriginalEnabled] = useState(row.reprintOriginalEnabled);
  const [notes, setNotes] = useState(row.notes);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeFormats = useMemo(() => Array.from(externalFormats), [externalFormats]);

  function toggleFormat(value: string) {
    setExternalFormats((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next.size ? next : current;
    });
  }

  function save() {
    const formData = new FormData();
    formData.set("status", status);
    formData.set("source_preference", sourcePreference);
    formData.set("default_print_template", defaultPrintTemplate);
    formData.set("default_queue_format", defaultQueueFormat);
    formData.set("tracking_source", trackingSource);
    formData.set("fallback_enabled", String(fallbackEnabled));
    formData.set("auto_queue_external_label", String(autoQueueExternalLabel));
    formData.set("store_original_label", String(storeOriginalLabel));
    formData.set("reprint_original_enabled", String(reprintOriginalEnabled));
    formData.set("notes", notes);
    for (const format of activeFormats) formData.append("external_label_formats", format);

    setMessage(null);
    startTransition(async () => {
      const result = await saveMarketplaceLabelSetting(row.providerKey, formData);
      setMessage(result.ok ? "Configuração salva." : result.error);
    });
  }

  function sync() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestMarketplaceLabelSync(row.providerKey);
      setMessage(result.ok ? "Sincronização enfileirada." : result.error);
    });
  }

  return (
    <article style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow">{row.displayName}</p>
          <h3 style={{ margin: "6px 0 0", fontSize: 20 }}>{row.displayName}</h3>
          <p className="muted" style={{ margin: "5px 0 0", fontSize: 11 }}>
            Conexão: {connectionLabel(row.connectionStatus)} · Credenciais: {credentialLabel(row.credentialsStatus)}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <div style={formGridStyle}>
        <Field label="Status">
          <GlassSelect value={status} onChange={setStatus} options={statusOptions} ariaLabel={`Status ${row.displayName}`} inlineMenu />
        </Field>
        <Field label="Política da etiqueta">
          <GlassSelect value={sourcePreference} onChange={setSourcePreference} options={sourceOptions} ariaLabel={`Política ${row.displayName}`} inlineMenu />
        </Field>
        <Field label="Modelo padrão">
          <GlassSelect value={defaultPrintTemplate} onChange={setDefaultPrintTemplate} options={templateOptions} ariaLabel={`Modelo ${row.displayName}`} inlineMenu />
        </Field>
        <Field label="Formato recebido">
          <GlassSelect value={defaultQueueFormat} onChange={setDefaultQueueFormat} options={queueFormatOptions} ariaLabel={`Formato ${row.displayName}`} inlineMenu />
        </Field>
        <Field label="Origem do rastreio">
          <GlassSelect value={trackingSource} onChange={setTrackingSource} options={trackingOptions} ariaLabel={`Rastreio ${row.displayName}`} inlineMenu />
        </Field>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <p className="eyebrow" style={{ fontSize: 9 }}>Arquivos aceitos do marketplace</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {formatOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={externalFormats.has(option.value) ? "btn btn-gold" : "btn btn-ghost"}
              style={{ padding: "7px 12px", fontSize: 10 }}
              onClick={() => toggleFormat(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        <SwitchButton label="Fallback Flora" value={fallbackEnabled} onChange={setFallbackEnabled} />
        <SwitchButton label="Enfileirar externa" value={autoQueueExternalLabel} onChange={setAutoQueueExternalLabel} />
        <SwitchButton label="Guardar original" value={storeOriginalLabel} onChange={setStoreOriginalLabel} />
        <SwitchButton label="Reimprimir original" value={reprintOriginalEnabled} onChange={setReprintOriginalEnabled} />
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span className="eyebrow" style={{ fontSize: 9 }}>Observações operacionais</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex.: Shopee entrega PDF pronto; se não vier etiqueta, gerar Flora 100 x 150 mm."
          style={textareaStyle}
          rows={3}
        />
      </label>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <p className="muted" style={{ margin: 0, fontSize: 10.5 }}>
          Última sincronização: {formatDate(row.lastSyncAt)}
          {row.lastError ? <span style={{ color: "#e8a0a0" }}> · {row.lastError}</span> : null}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" disabled={pending} style={{ padding: "8px 13px", fontSize: 10 }} onClick={sync}>
            Sincronizar etiquetas
          </button>
          <button type="button" className="btn btn-gold" disabled={pending} style={{ padding: "8px 13px", fontSize: 10 }} onClick={save}>
            Salvar política
          </button>
        </div>
      </div>

      {message ? (
        <p style={{ margin: 0, fontSize: 11, color: message.includes("erro") || message.includes("migration") ? "#e8a0a0" : "#8fd486" }}>
          {message}
        </p>
      ) : null}
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span className="eyebrow" style={{ fontSize: 9 }}>{label}</span>
      {children}
    </label>
  );
}

function SwitchButton({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${value ? "rgba(185,146,77,0.52)" : "var(--glass-border)"}`,
        borderRadius: 12,
        padding: "10px 12px",
        color: "var(--cream)",
        background: value ? "rgba(185,146,77,0.16)" : "rgba(10,22,11,0.34)",
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800 }}>{label}</span>
      <span style={{ ...dotStyle, background: value ? "var(--gold-light)" : "rgba(242,236,223,0.18)" }} />
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  const paused = status === "paused";
  return (
    <span
      style={{
        borderRadius: 999,
        border: `1px solid ${active ? "rgba(143,212,134,0.35)" : paused ? "rgba(185,146,77,0.35)" : "rgba(232,160,160,0.35)"}`,
        color: active ? "#8fd486" : paused ? "var(--gold-light)" : "#e8a0a0",
        background: active ? "rgba(143,212,134,0.1)" : paused ? "rgba(185,146,77,0.12)" : "rgba(232,160,160,0.1)",
        padding: "5px 10px",
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        whiteSpace: "nowrap",
      }}
    >
      {active ? "Ativa" : paused ? "Pausada" : "Arquivada"}
    </span>
  );
}

function connectionLabel(status: string) {
  const labels: Record<string, string> = {
    online: "online",
    offline: "offline",
    error: "erro",
    pending_auth: "pendente",
    paused: "pausada",
    connected: "conectada",
    disconnected: "desconectada",
  };
  return labels[status] ?? status;
}

function credentialLabel(status: string) {
  const labels: Record<string, string> = {
    missing: "faltando",
    stored: "salvas",
    expired: "expiradas",
    invalid: "inválidas",
  };
  return labels[status] ?? status;
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 12,
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  background: "rgba(10,22,11,0.34)",
  padding: 16,
  boxShadow: "0 16px 38px rgba(0,0,0,0.18)",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 82,
  resize: "vertical",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(10,22,11,0.45)",
  color: "var(--cream)",
  padding: "10px 12px",
  font: "inherit",
  fontSize: 12,
};

const dotStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 999,
  boxShadow: "0 0 0 4px rgba(242,236,223,0.07)",
};

const warningStyle: CSSProperties = {
  border: "1px solid rgba(232,160,160,0.36)",
  borderLeft: "4px solid #e8a0a0",
  borderRadius: 14,
  padding: 16,
  background: "rgba(232,160,160,0.08)",
};
