"use client";

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect } from "@/components/GlassSelect";
import {
  archiveOrder,
  cancelOrderWithReason,
  duplicateOrder,
  registerOrderPayment,
  softDeleteOrder,
  updateOrderOperation,
} from "./order-actions";

const CHANNELS = [
  { value: "atendimento_direto", label: "Atendimento direto" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "loja_fisica", label: "Loja física" },
  { value: "representante", label: "Representante" },
  { value: "marketplace", label: "Marketplace" },
  { value: "b2b", label: "B2B" },
  { value: "outro", label: "Outro canal" },
];

const PAYMENT_STATUS = [
  { value: "pending", label: "Pendente" },
  { value: "partial", label: "Parcial" },
  { value: "paid", label: "Pago" },
  { value: "scheduled", label: "Agendado" },
  { value: "failed", label: "Falhou" },
  { value: "refunded", label: "Reembolsado" },
];

const PAYMENT_METHODS = [
  { value: "manual", label: "Manual" },
  { value: "pix", label: "PIX" },
  { value: "card", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
  { value: "transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Outro" },
];

const DELIVERY_MODES = [
  { value: "shipping", label: "Envio" },
  { value: "pickup", label: "Retirada" },
  { value: "local_delivery", label: "Entrega local" },
  { value: "marketplace", label: "Marketplace" },
  { value: "pending", label: "A definir" },
];

const INVOICE_KINDS = [
  { value: "nfe", label: "NF-e" },
  { value: "nfce", label: "NFC-e" },
  { value: "nfse", label: "NFS-e" },
  { value: "none", label: "Sem emissão agora" },
];

const COMMISSION_TYPES = [
  { value: "percent_sale", label: "% sobre venda" },
  { value: "percent_profit", label: "% sobre lucro" },
  { value: "fixed", label: "Valor fixo" },
  { value: "bonus", label: "Bônus" },
];

type Summary = Record<string, unknown>;
type Commission = { role?: string; name?: string; type?: string; value?: string; notes?: string };

export interface ManagedOrder {
  id: string;
  origin_label: string | null;
  manual_channel: string | null;
  payment_status: string | null;
  payment_summary: Summary | null;
  delivery_summary: Summary | null;
  fiscal_summary: Summary | null;
  commission_summary: Commission[] | null;
  internal_tags: string[] | null;
  notes: string | null;
  archived_at: string | null;
  deleted_at: string | null;
}

function stringValue(summary: Summary | null | undefined, key: string) {
  const value = summary?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function OrderManagementPanel({ order }: { order: ManagedOrder }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>(
    Array.isArray(order.commission_summary) && order.commission_summary.length
      ? order.commission_summary
      : [{ role: "Vendedor", name: "", type: "percent_sale", value: "", notes: "" }]
  );

  const commissionJson = useMemo(() => JSON.stringify(commissions), [commissions]);

  function run(action: () => Promise<{ ok: true; message?: string; id?: string } | { ok: false; error: string }>, redirectToId = false) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Ação registrada.");
      if (redirectToId && result.id) router.push(`/vendas/${result.id}`);
      router.refresh();
    });
  }

  function updateCommission(index: number, patch: Commission) {
    setCommissions((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <section className="glass rise" style={{ padding: 22, marginTop: 16, display: "grid", gap: 18 }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Operação do pedido</p>
        <h2 style={{ margin: 0, fontSize: 24 }}>Pagamento, fiscal, entrega e ações</h2>
      </div>

      {order.archived_at ? <Alert tone="warn">Pedido arquivado. Motivos e alterações ficam preservados na auditoria.</Alert> : null}
      {order.deleted_at ? <Alert tone="danger">Pedido marcado como excluído. Ele permanece no histórico para auditoria.</Alert> : null}
      {message ? <Alert tone="ok">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <form
        action={(formData) => run(() => updateOrderOperation(order.id, formData))}
        style={{ display: "grid", gap: 16 }}
      >
        <input type="hidden" name="commission_summary" value={commissionJson} />

        <div style={grid3}>
          <Field label="Origem visível">
            <input className="input" name="origin_label" defaultValue={order.origin_label ?? ""} placeholder="Ex.: venda assistida, B2B..." />
          </Field>
          <Field label="Canal interno">
            <GlassSelect name="manual_channel" options={CHANNELS} defaultValue={order.manual_channel ?? "atendimento_direto"} inlineMenu />
          </Field>
          <Field label="Status financeiro">
            <GlassSelect name="payment_status" options={PAYMENT_STATUS} defaultValue={order.payment_status ?? "pending"} inlineMenu />
          </Field>
        </div>

        <div style={grid3}>
          <Field label="Método">
            <GlassSelect name="payment_method" options={PAYMENT_METHODS} defaultValue={stringValue(order.payment_summary, "method") || "manual"} inlineMenu />
          </Field>
          <Field label="Condição">
            <input className="input" name="payment_terms" defaultValue={stringValue(order.payment_summary, "terms")} placeholder="À vista, 30/60..." />
          </Field>
          <Field label="Identificador">
            <input className="input" name="payment_identifier" defaultValue={stringValue(order.payment_summary, "external_identifier")} placeholder="NSU, comprovante, gateway..." />
          </Field>
        </div>

        <div style={grid3}>
          <Field label="Modo de entrega">
            <GlassSelect name="delivery_mode" options={DELIVERY_MODES} defaultValue={stringValue(order.delivery_summary, "mode") || "shipping"} inlineMenu />
          </Field>
          <Field label="Transportadora">
            <input className="input" name="carrier" defaultValue={stringValue(order.delivery_summary, "carrier")} placeholder="Correios, Loggi..." />
          </Field>
          <Field label="Rastreio">
            <input className="input" name="tracking_code" defaultValue={stringValue(order.delivery_summary, "tracking_code")} placeholder="Código existente ou gerado" />
          </Field>
        </div>

        <div style={grid3}>
          <Field label="Nota fiscal">
            <GlassSelect name="invoice_kind" options={INVOICE_KINDS} defaultValue={stringValue(order.fiscal_summary, "invoice_kind") || "nfe"} inlineMenu />
          </Field>
          <Field label="Natureza da operação">
            <input className="input" name="operation_nature" defaultValue={stringValue(order.fiscal_summary, "operation_nature")} placeholder="Venda de mercadoria" />
          </Field>
          <Field label="CFOP">
            <input className="input" name="cfop" defaultValue={stringValue(order.fiscal_summary, "cfop")} placeholder="5102, 6102..." />
          </Field>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <p className="eyebrow" style={{ margin: 0 }}>Comissões</p>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "7px 12px", fontSize: 10 }}
              onClick={() => setCommissions((current) => [...current, { role: "", name: "", type: "percent_sale", value: "", notes: "" }])}
            >
              + Comissão
            </button>
          </div>
          {commissions.map((commission, index) => (
            <div key={index} style={{ ...grid5, alignItems: "end" }}>
              <Field label="Papel">
                <input className="input" value={commission.role ?? ""} onChange={(e) => updateCommission(index, { role: e.target.value })} placeholder="Vendedor, afiliado..." />
              </Field>
              <Field label="Nome">
                <input className="input" value={commission.name ?? ""} onChange={(e) => updateCommission(index, { name: e.target.value })} placeholder="Responsável" />
              </Field>
              <Field label="Tipo">
                <GlassSelect value={commission.type ?? "percent_sale"} options={COMMISSION_TYPES} onChange={(value) => updateCommission(index, { type: value })} inlineMenu />
              </Field>
              <Field label="Valor">
                <input className="input" value={commission.value ?? ""} onChange={(e) => updateCommission(index, { value: e.target.value })} placeholder="5%, R$ 20..." />
              </Field>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "12px 14px", fontSize: 10 }}
                onClick={() => setCommissions((current) => current.filter((_, i) => i !== index))}
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <div style={grid2}>
          <Field label="Observação do cliente">
            <textarea className="input" name="customer_observation" defaultValue={stringValue(order.delivery_summary, "customer_observation")} rows={3} placeholder="Observação informada pelo cliente para entrega, embalagem ou atendimento." />
          </Field>
          <Field label="Observações internas">
            <textarea className="input" name="notes" defaultValue={order.notes ?? ""} rows={3} placeholder="Notas internas do pedido." />
          </Field>
        </div>

        <div style={grid2}>
          <Field label="Tags internas">
            <input className="input" name="internal_tags" defaultValue={(order.internal_tags ?? []).join(", ")} placeholder="vip, atacado, revisão..." />
          </Field>
          <Field label="Motivo da alteração">
            <input className="input" name="change_reason" placeholder="Por que esta alteração foi feita?" />
          </Field>
        </div>

        <button type="submit" disabled={pending} className="btn btn-gold" style={{ justifySelf: "start", padding: "12px 22px", fontSize: 10 }}>
          {pending ? "Salvando..." : "Salvar operação"}
        </button>
      </form>

      <form
        action={(formData) => run(() => registerOrderPayment(order.id, formData))}
        style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 16, display: "grid", gap: 12 }}
      >
        <p className="eyebrow" style={{ margin: 0 }}>Baixa de pagamento</p>
        <div style={grid4}>
          <Field label="Valor recebido">
            <input className="input" name="amount" placeholder="0,00" />
          </Field>
          <Field label="Método">
            <GlassSelect name="payment_method" options={PAYMENT_METHODS} defaultValue="manual" inlineMenu />
          </Field>
          <Field label="Recebido em">
            <GlassDateInput name="paid_at" placeholder="Agora" withTime inlinePopover />
          </Field>
          <Field label="Comprovante/referência">
            <input className="input" name="receipt_reference" placeholder="Código, link ou descrição" />
          </Field>
        </div>
        <Field label="Observação da baixa">
          <input className="input" name="notes" placeholder="Observação financeira, conciliação ou exceção." />
        </Field>
        <button type="submit" disabled={pending} className="btn btn-gold" style={{ justifySelf: "start", padding: "12px 22px", fontSize: 10 }}>
          Registrar pagamento
        </button>
      </form>

      <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 16, display: "grid", gap: 12 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Ações administrativas</p>
        <div style={grid4}>
          <ReasonAction label="Cancelar pedido" placeholder="Motivo obrigatório" danger onSubmit={(formData) => run(() => cancelOrderWithReason(order.id, formData))} />
          <ReasonAction label="Arquivar" placeholder="Motivo do arquivamento" onSubmit={(formData) => run(() => archiveOrder(order.id, formData))} />
          <ReasonAction label="Exclusão lógica" placeholder="Motivo obrigatório" danger onSubmit={(formData) => run(() => softDeleteOrder(order.id, formData))} />
          <div className="glass" style={{ padding: 14, display: "grid", gap: 10, alignContent: "space-between" }}>
            <div>
              <strong>Duplicar pedido</strong>
              <p className="muted" style={{ margin: "5px 0 0", fontSize: 11 }}>Cria rascunho com itens, cliente, entrega e fiscal.</p>
            </div>
            <button type="button" className="btn btn-ghost" disabled={pending} style={{ padding: "10px 14px", fontSize: 10 }} onClick={() => run(() => duplicateOrder(order.id), true)}>
              Duplicar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReasonAction({
  label,
  placeholder,
  danger,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  danger?: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <form action={onSubmit} className="glass" style={{ padding: 14, display: "grid", gap: 10 }}>
      <strong>{label}</strong>
      <input className="input" name="reason" placeholder={placeholder} />
      <button
        type="submit"
        className={danger ? "btn btn-ghost" : "btn btn-gold"}
        style={{
          padding: "10px 14px",
          fontSize: 10,
          ...(danger ? { color: "#e8a0a0", borderColor: "rgba(232,160,160,0.4)" } : {}),
        }}
      >
        Confirmar
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Alert({ children, tone }: { children: ReactNode; tone: "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "#8fd486" : tone === "warn" ? "var(--gold-light)" : "#e8a0a0";
  return (
    <div style={{ border: `1px solid ${color}`, background: "rgba(242,236,223,0.06)", borderRadius: 12, padding: "10px 12px", color, fontSize: 12 }}>
      {children}
    </div>
  );
}

const grid2: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 };
const grid3: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 };
const grid4: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 };
const grid5: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 };
