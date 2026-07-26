import type { CSSProperties } from "react";
import { GlassSelect } from "@/components/GlassSelect";
import { GlassDateInput } from "@/components/GlassDateInput";

export interface CampaignFormValues {
  id?: string;
  title?: string | null;
  slug?: string | null;
  subtitle?: string | null;
  status?: string | null;
  channel?: string | null;
  target_cities?: string[] | null;
  target_regions?: string[] | null;
  starts_at?: string | null;
  ends_at?: string | null;
  budget_cents?: number | null;
  body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

export function CampaignForm({
  action,
  values,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: CampaignFormValues;
  submitLabel: string;
}) {
  return (
    <form action={action} className="glass rise" style={formStyle}>
      <div style={gridStyle}>
        <label className="field">
          <span>Nome da campanha</span>
          <input className="input" name="title" defaultValue={values?.title ?? ""} required />
        </label>
        <label className="field">
          <span>Slug</span>
          <input className="input" name="slug" defaultValue={values?.slug ?? ""} placeholder="gerado pelo título" />
        </label>
        <label className="field">
          <span>Status</span>
          <GlassSelect
            name="status"
            defaultValue={values?.status ?? "draft"}
            ariaLabel="Status da campanha"
            options={[
              { value: "draft", label: "Rascunho" },
              { value: "active", label: "Ativa" },
              { value: "paused", label: "Pausada" },
              { value: "ended", label: "Encerrada" },
            ]}
          />
        </label>
        <label className="field">
          <span>Canal</span>
          <input className="input" name="channel" defaultValue={values?.channel ?? ""} placeholder="Site, e-mail, Instagram..." />
        </label>
        <label className="field">
          <span>Início</span>
          <GlassDateInput name="starts_at" defaultValue={toLocalDateTime(values?.starts_at)} withTime placeholder="Selecionar in�cio" />
        </label>
        <label className="field">
          <span>Fim</span>
          <GlassDateInput name="ends_at" defaultValue={toLocalDateTime(values?.ends_at)} withTime placeholder="Selecionar fim" />
        </label>
        <label className="field">
          <span>Cidades-alvo</span>
          <input className="input" name="target_cities" defaultValue={(values?.target_cities ?? []).join(", ")} placeholder="São Paulo, Rio de Janeiro" />
        </label>
        <label className="field">
          <span>Regiões-alvo</span>
          <input className="input" name="target_regions" defaultValue={(values?.target_regions ?? []).join(", ")} placeholder="Sudeste, Sul" />
        </label>
        <label className="field">
          <span>Orçamento</span>
          <input className="input" name="budget" defaultValue={moneyInput(values?.budget_cents)} placeholder="0,00" />
        </label>
        <label className="field">
          <span>CTA</span>
          <input className="input" name="cta_label" defaultValue={values?.cta_label ?? ""} placeholder="Comprar agora" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>URL do CTA</span>
          <input className="input" name="cta_url" defaultValue={values?.cta_url ?? ""} placeholder="https://florabotanics.com.br/produtos" />
        </label>
        <label className="field">
          <span>UTM source</span>
          <input className="input" name="utm_source" defaultValue={values?.utm_source ?? ""} />
        </label>
        <label className="field">
          <span>UTM medium</span>
          <input className="input" name="utm_medium" defaultValue={values?.utm_medium ?? ""} />
        </label>
        <label className="field">
          <span>UTM campaign</span>
          <input className="input" name="utm_campaign" defaultValue={values?.utm_campaign ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Descrição</span>
          <textarea className="input" name="body" defaultValue={values?.body ?? ""} rows={7} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button className="btn btn-gold" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function moneyInput(cents?: number | null) {
  if (!cents) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const formStyle: CSSProperties = {
  padding: 24,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 16,
  marginBottom: 22,
};
