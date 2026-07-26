"use client";

import { useState } from "react";
import { updateFinanceSettings } from "./actions";

export type FinanceSettingsData = {
  target_margin_percent?: number | null;
  minimum_margin_percent?: number | null;
  default_tax_percent?: number | null;
  default_payment_fee_percent?: number | null;
  default_payment_fixed_cents?: number | null;
  default_logistics_percent?: number | null;
  default_overhead_percent?: number | null;
  rules?: {
    approval_minimum_margin_percent?: number;
    max_discount_without_approval_percent?: number;
    logistics_warning_percent?: number;
  } | null;
};

function moneyInput(cents?: number | null) {
  return ((cents ?? 0) / 100).toFixed(2).replace(".", ",");
}

function numberInput(value: number | null | undefined, fallback: number) {
  return String(value ?? fallback).replace(".", ",");
}

export function FinanceSettingsForm({ settings }: { settings?: FinanceSettingsData | null }) {
  const rules = settings?.rules ?? {};
  const [open, setOpen] = useState(false);

  return (
    <section className="glass rise rise-2" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: open ? 18 : 0 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 7 }}>Configurações financeiras</p>
          <h2 className="display" style={{ fontSize: 28 }}>Regras padrao da marca</h2>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.7 }}>
            Base usada para aprovações, alertas, precificação, impostos estimados, gateway e logística.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" style={{ padding: "9px 16px", fontSize: 10 }} onClick={() => setOpen((v) => !v)}>
          {open ? "Fechar" : "Editar regras"}
        </button>
      </div>

      {open ? (
        <form action={updateFinanceSettings} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <Field name="target_margin_percent" label="Margem desejada %" defaultValue={numberInput(settings?.target_margin_percent, 55)} />
            <Field name="minimum_margin_percent" label="Margem mínima %" defaultValue={numberInput(settings?.minimum_margin_percent, 35)} />
            <Field name="approval_minimum_margin_percent" label="Aprovação abaixo de %" defaultValue={numberInput(rules.approval_minimum_margin_percent, 25)} />
            <Field name="max_discount_without_approval_percent" label="Desconto sem aprovação %" defaultValue={numberInput(rules.max_discount_without_approval_percent, 12)} />
            <Field name="default_tax_percent" label="Imposto estimado %" defaultValue={numberInput(settings?.default_tax_percent, 8)} />
            <Field name="default_payment_fee_percent" label="Gateway %" defaultValue={numberInput(settings?.default_payment_fee_percent, 3.99)} />
            <Field name="default_payment_fixed" label="Taxa fixa gateway" defaultValue={moneyInput(settings?.default_payment_fixed_cents)} />
            <Field name="default_logistics_percent" label="Logística %" defaultValue={numberInput(settings?.default_logistics_percent, 6)} />
            <Field name="logistics_warning_percent" label="Alerta logística %" defaultValue={numberInput(rules.logistics_warning_percent, 18)} />
            <Field name="default_overhead_percent" label="Rateio operacional %" defaultValue={numberInput(settings?.default_overhead_percent, 5)} />
          </div>
          <button className="btn btn-gold" style={{ padding: "11px 22px", fontSize: 10, justifySelf: "start" }}>
            Salvar configurações
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" name={name} inputMode="decimal" defaultValue={defaultValue} />
    </label>
  );
}

