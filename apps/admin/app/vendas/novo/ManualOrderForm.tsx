"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import { createManualOrder } from "./actions";

export type ProductOption = {
  value: string;
  label: string;
  name: string;
  sku: string;
  priceCents: number;
  kind: string;
};

type ItemRow = {
  id: string;
  variantId: string;
  name: string;
  sku: string;
  kind: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  notes: string;
};

type CommissionRow = {
  id: string;
  role: string;
  name: string;
  type: string;
  value: string;
  notes: string;
};

const MANUAL_CHANNELS: GlassSelectOption[] = [
  { value: "atendimento_direto", label: "Atendimento direto" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "loja_fisica", label: "Loja física" },
  { value: "vendedor", label: "Vendedor" },
  { value: "representante", label: "Representante" },
  { value: "b2b", label: "Cliente B2B" },
  { value: "orcamento_aprovado", label: "Orçamento aprovado" },
  { value: "evento", label: "Evento ou feira" },
  { value: "parceria", label: "Parceria" },
  { value: "corporativo", label: "Venda corporativa" },
  { value: "pedido_interno", label: "Pedido interno" },
  { value: "reposicao", label: "Reposição" },
  { value: "cortesia", label: "Cortesia" },
  { value: "amostra", label: "Amostra" },
  { value: "consignacao", label: "Consignação" },
  { value: "outro", label: "Outro canal" },
];

const PAYMENT_STATUS: GlassSelectOption[] = [
  { value: "pending", label: "Pagamento pendente" },
  { value: "partial", label: "Pagamento parcial" },
  { value: "paid", label: "Pagamento completo" },
  { value: "scheduled", label: "Pagamento agendado" },
  { value: "b2b_terms", label: "Faturamento B2B" },
];

const PAYMENT_METHODS: GlassSelectOption[] = [
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "boleto", label: "Boleto" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "stripe_checkout", label: "Stripe Checkout" },
  { value: "payment_link", label: "Link de pagamento" },
  { value: "customer_credit", label: "Crédito do cliente" },
  { value: "multiple", label: "Múltiplas formas" },
];

const DELIVERY_MODES: GlassSelectOption[] = [
  { value: "pickup", label: "Retirada" },
  { value: "local_delivery", label: "Entrega local" },
  { value: "correios", label: "Correios" },
  { value: "carrier", label: "Transportadora" },
  { value: "logistics_operator", label: "Operador logístico" },
  { value: "own_delivery", label: "Entrega própria" },
  { value: "customer_freight", label: "Frete contratado pelo cliente" },
  { value: "free_shipping", label: "Frete gratuito" },
  { value: "scheduled_delivery", label: "Entrega agendada" },
];

const INVOICE_KINDS: GlassSelectOption[] = [
  { value: "sale", label: "Nota de venda" },
  { value: "shipment", label: "Nota de remessa" },
  { value: "bonus", label: "Nota de bonificação" },
  { value: "sample", label: "Nota de amostra" },
  { value: "return", label: "Nota de devolução" },
];

const COMMISSION_ROLES: GlassSelectOption[] = [
  { value: "seller", label: "Vendedor" },
  { value: "representative", label: "Representante" },
  { value: "affiliate", label: "Afiliado" },
  { value: "influencer", label: "Influenciador" },
  { value: "physical_store", label: "Loja física" },
  { value: "partner", label: "Parceiro" },
  { value: "marketplace", label: "Marketplace" },
  { value: "manager", label: "Gerente" },
  { value: "supervisor", label: "Supervisor" },
];

const COMMISSION_TYPES: GlassSelectOption[] = [
  { value: "percent_sale", label: "% sobre venda" },
  { value: "fixed", label: "Valor fixo" },
  { value: "percent_profit", label: "% sobre lucro" },
  { value: "percent_net", label: "% sobre valor líquido" },
  { value: "per_item", label: "Por item" },
  { value: "per_order", label: "Por pedido" },
];

function centsFromInput(value: string) {
  const parsed = Number(String(value || "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function moneyFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function newItem(): ItemRow {
  return {
    id: crypto.randomUUID(),
    variantId: "",
    name: "",
    sku: "",
    kind: "custom",
    quantity: "1",
    unitPrice: "0,00",
    discount: "0,00",
    notes: "",
  };
}

function newCommission(): CommissionRow {
  return {
    id: crypto.randomUUID(),
    role: "seller",
    name: "",
    type: "percent_sale",
    value: "",
    notes: "",
  };
}

export function ManualOrderForm({ productOptions }: { productOptions: ProductOption[] }) {
  const [items, setItems] = useState<ItemRow[]>([newItem()]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [expectedDate, setExpectedDate] = useState("");

  const productsForSelect = useMemo<GlassSelectOption[]>(
    () => [{ value: "", label: "Item fora do catálogo / manual" }, ...productOptions.map(({ value, label }) => ({ value, label }))],
    [productOptions]
  );

  const serializedItems = items.map((item) => ({
    variantId: item.variantId || null,
    name: item.name,
    sku: item.sku,
    kind: item.kind,
    quantity: Number(item.quantity.replace(",", ".")) || 1,
    unitPriceCents: centsFromInput(item.unitPrice),
    discountCents: centsFromInput(item.discount),
    notes: item.notes,
  }));

  const serializedCommissions = commissions.map(({ role, name, type, value, notes }) => ({ role, name, type, value, notes }));
  const itemSubtotal = serializedItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const itemDiscount = serializedItems.reduce((sum, item) => sum + item.discountCents, 0);

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function chooseProduct(row: ItemRow, value: string) {
    const product = productOptions.find((option) => option.value === value);
    updateItem(row.id, {
      variantId: value,
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      kind: product?.kind ?? "custom",
      unitPrice: product ? String((product.priceCents / 100).toFixed(2)).replace(".", ",") : row.unitPrice,
    });
  }

  function updateCommission(id: string, patch: Partial<CommissionRow>) {
    setCommissions((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <form action={createManualOrder} className="glass" style={{ padding: 24, display: "grid", gap: 18 }}>
      <input type="hidden" name="items_json" value={JSON.stringify(serializedItems)} />
      <input type="hidden" name="commissions_json" value={JSON.stringify(serializedCommissions)} />
      <input type="hidden" name="expected_date" value={expectedDate} />

      <Section eyebrow="Origem" title="1. Cliente e origem">
        <Field label="Canal da venda">
          <GlassSelect name="manual_channel" options={MANUAL_CHANNELS} defaultValue="atendimento_direto" inlineMenu />
        </Field>
        <Field label="Origem detalhada"><input className="input" name="origin_label" placeholder="Ex: WhatsApp Ana, feira, vendedor João..." /></Field>
        <Field label="Nome do cliente"><input className="input" name="customer_name" placeholder="Nome completo ou razão social" /></Field>
        <Field label="E-mail"><input className="input" name="customer_email" required placeholder="cliente@email.com" /></Field>
        <Field label="Telefone"><input className="input" name="customer_phone" placeholder="(00) 00000-0000" /></Field>
        <Field label="Tags do cliente"><input className="input" name="customer_tags" placeholder="vip, b2b, revenda..." /></Field>
        <label style={checkboxStyle}><input type="checkbox" name="accepts_marketing" /> Cliente autorizou comunicação de marketing</label>
        <Field label="Motivo do cadastro"><input className="input" name="creation_reason" placeholder="Venda assistida, orçamento aprovado, reposição..." /></Field>
      </Section>

      <Section eyebrow="Itens" title="2. Itens do pedido">
        <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12 }}>
          {items.map((item, index) => (
            <div key={item.id} className="glass" style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(6, minmax(110px, 1fr))", gap: 10 }}>
              <Field label={`Item ${index + 1}`}>
                <GlassSelect value={item.variantId} options={productsForSelect} onChange={(value) => chooseProduct(item, value)} inlineMenu />
              </Field>
              <Field label="Nome"><input className="input" value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} placeholder="Produto, kit, serviço..." /></Field>
              <Field label="SKU"><input className="input" value={item.sku} onChange={(e) => updateItem(item.id, { sku: e.target.value })} placeholder="SKU" /></Field>
              <Field label="Quantidade"><input className="input" inputMode="decimal" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: e.target.value })} /></Field>
              <Field label="Preço unitário"><input className="input" inputMode="decimal" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })} /></Field>
              <Field label="Desconto"><input className="input" inputMode="decimal" value={item.discount} onChange={(e) => updateItem(item.id, { discount: e.target.value })} /></Field>
              <Field label="Observação do item"><input className="input" value={item.notes} onChange={(e) => updateItem(item.id, { notes: e.target.value })} placeholder="Personalização, embalagem, brinde..." /></Field>
              <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))} disabled={items.length === 1}>
                Remover item
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-gold" style={{ ...smallButtonStyle, justifySelf: "start" }} onClick={() => setItems((current) => [...current, newItem()])}>
            + Adicionar item
          </button>
        </div>
      </Section>

      <Section eyebrow="Valores" title="3. Preços, descontos e pagamento">
        <Field label="Desconto global"><input className="input" name="global_discount" inputMode="decimal" placeholder="0,00" /></Field>
        <Field label="Frete cobrado"><input className="input" name="shipping_cents" inputMode="decimal" placeholder="0,00" /></Field>
        <Field label="Status do pagamento"><GlassSelect name="payment_status" options={PAYMENT_STATUS} defaultValue="pending" inlineMenu /></Field>
        <Field label="Forma de pagamento"><GlassSelect name="payment_method" options={PAYMENT_METHODS} defaultValue="pix" inlineMenu /></Field>
        <Field label="Valor pago"><input className="input" name="paid_cents" inputMode="decimal" placeholder="0,00" /></Field>
        <Field label="Parcelas"><input className="input" name="installments" placeholder="1, 2, 3..." /></Field>
        <Field label="Vencimentos"><input className="input" name="due_dates" placeholder="30/60/90 dias ou datas combinadas" /></Field>
        <Field label="Condição"><input className="input" name="payment_terms" placeholder="PIX à vista, boleto 15 dias..." /></Field>
        <Field label="Adquirente"><input className="input" name="acquirer" placeholder="Stripe, banco, maquininha..." /></Field>
        <Field label="Identificador"><input className="input" name="payment_identifier" placeholder="ID externo, NSU, comprovante..." /></Field>
        <Field label="Observação do pagamento"><textarea className="input" name="payment_notes" rows={3} placeholder="Condição negociada, aprovação, comprovantes..." /></Field>
        <div className="glass" style={{ padding: 16, alignSelf: "end" }}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Resumo parcial</p>
          <strong style={{ display: "block", color: "var(--gold-light)", fontSize: 24 }}>{moneyFromCents(itemSubtotal - itemDiscount)}</strong>
          <span className="muted" style={{ fontSize: 11 }}>antes de desconto global e frete</span>
        </div>
      </Section>

      <Section eyebrow="Entrega" title="4. Entrega, logística e observação do cliente">
        <Field label="Tipo de entrega"><GlassSelect name="delivery_mode" options={DELIVERY_MODES} defaultValue="carrier" inlineMenu /></Field>
        <Field label="Transportadora"><input className="input" name="carrier" placeholder="Correios, Loggi, Melhor Envio..." /></Field>
        <Field label="Serviço"><input className="input" name="shipping_service" placeholder="PAC, Sedex, entrega local..." /></Field>
        <Field label="Prazo"><input className="input" name="shipping_deadline" placeholder="3 dias úteis" /></Field>
        <Field label="Rastreamento"><input className="input" name="tracking_code" placeholder="Será gerado após expedição, se vazio" /></Field>
        <Field label="Data prevista"><GlassDateInput value={expectedDate} onChange={setExpectedDate} placeholder="Selecionar" inlinePopover /></Field>
        <Field label="Peso"><input className="input" name="weight" placeholder="800 g" /></Field>
        <Field label="Dimensões"><input className="input" name="dimensions" placeholder="20 x 15 x 8 cm" /></Field>
        <Field label="Embalagem"><input className="input" name="package" placeholder="Caixa, kit premium..." /></Field>
        <Field label="Responsável expedição"><input className="input" name="shipping_responsible" placeholder="Operador" /></Field>
        <Field label="Observação do cliente"><textarea className="input" name="customer_observation" rows={3} placeholder="Mensagem, preferência de entrega, restrição..." /></Field>
      </Section>

      <Section eyebrow="Endereço" title="5. Endereço de entrega">
        <Field label="Destinatário"><input className="input" name="shipping_recipient" placeholder="Nome para a etiqueta" /></Field>
        <Field label="CPF/CNPJ"><input className="input" name="shipping_document" placeholder="Documento" /></Field>
        <Field label="Telefone"><input className="input" name="shipping_phone" placeholder="Contato de entrega" /></Field>
        <Field label="Rua"><input className="input" name="shipping_street" placeholder="Rua / avenida" /></Field>
        <Field label="Número"><input className="input" name="shipping_number" placeholder="Número" /></Field>
        <Field label="Complemento"><input className="input" name="shipping_complement" placeholder="Apartamento, sala..." /></Field>
        <Field label="Bairro"><input className="input" name="shipping_district" placeholder="Bairro" /></Field>
        <Field label="Cidade"><input className="input" name="shipping_city" placeholder="Cidade" /></Field>
        <Field label="UF"><input className="input" name="shipping_state" placeholder="SP" /></Field>
        <Field label="CEP"><input className="input" name="shipping_zip" placeholder="00000-000" /></Field>
        <Field label="Observação do endereço"><textarea className="input" name="shipping_notes" rows={3} placeholder="Portaria, referência, horário..." /></Field>
      </Section>

      <Section eyebrow="Fiscal" title="6. Dados fiscais">
        <label style={checkboxStyle}><input type="checkbox" name="emit_invoice" /> Enviar para fila fiscal</label>
        <Field label="Tipo de nota"><GlassSelect name="invoice_kind" options={INVOICE_KINDS} defaultValue="sale" inlineMenu /></Field>
        <Field label="Natureza da operação"><input className="input" name="operation_nature" placeholder="Venda de mercadoria" /></Field>
        <Field label="CFOP"><input className="input" name="cfop" placeholder="5102, 6102..." /></Field>
        <label style={checkboxStyle}><input type="checkbox" name="customer_taxpayer" /> Cliente contribuinte</label>
        <label style={checkboxStyle}><input type="checkbox" name="final_customer" defaultChecked /> Consumidor final</label>
        <Field label="Observações fiscais"><textarea className="input" name="fiscal_notes" rows={3} placeholder="Série, ambiente, ressalvas, contador..." /></Field>
      </Section>

      <Section eyebrow="Comissões" title="7. Comissões e responsáveis">
        <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12 }}>
          {commissions.map((row) => (
            <div key={row.id} className="glass" style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(5, minmax(130px, 1fr))", gap: 10 }}>
              <Field label="Função"><GlassSelect value={row.role} options={COMMISSION_ROLES} onChange={(value) => updateCommission(row.id, { role: value })} inlineMenu /></Field>
              <Field label="Nome"><input className="input" value={row.name} onChange={(e) => updateCommission(row.id, { name: e.target.value })} /></Field>
              <Field label="Tipo"><GlassSelect value={row.type} options={COMMISSION_TYPES} onChange={(value) => updateCommission(row.id, { type: value })} inlineMenu /></Field>
              <Field label="Valor"><input className="input" value={row.value} onChange={(e) => updateCommission(row.id, { value: e.target.value })} placeholder="5% ou R$ 20,00" /></Field>
              <Field label="Observação"><input className="input" value={row.notes} onChange={(e) => updateCommission(row.id, { notes: e.target.value })} /></Field>
              <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={() => setCommissions((current) => current.filter((item) => item.id !== row.id))}>
                Remover comissão
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" style={{ ...smallButtonStyle, justifySelf: "start" }} onClick={() => setCommissions((current) => [...current, newCommission()])}>
            + Adicionar comissão
          </button>
        </div>
      </Section>

      <Section eyebrow="Revisão" title="8. Observações, tags e confirmação">
        <Field label="Tags do pedido"><input className="input" name="order_tags" placeholder="B2B, prioridade, presente..." /></Field>
        <Field label="Observações internas"><textarea className="input" name="internal_notes" rows={4} placeholder="Histórico da negociação, aprovação, risco, próximos passos..." /></Field>
        <label style={checkboxStyle}><input type="checkbox" name="save_as_draft" /> Salvar como rascunho operacional</label>
        <div className="glass" style={{ padding: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Conferência final</p>
          <strong style={{ color: "var(--gold-light)", fontSize: 22 }}>{moneyFromCents(itemSubtotal - itemDiscount)}</strong>
          <p className="muted" style={{ fontSize: 11, marginTop: 5 }}>O valor final também considera desconto global e frete no servidor.</p>
        </div>
      </Section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button className="btn btn-gold" style={{ padding: "13px 26px", fontSize: 10 }}>
          Criar pedido manual
        </button>
      </div>
    </form>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="glass" style={{ padding: 18 }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</p>
      <h2 style={{ margin: "0 0 16px", fontSize: 22, color: "var(--cream)" }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ color: "var(--cream-dim)", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</span>
      {children}
    </label>
  );
}

const checkboxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 42,
  color: "var(--cream-soft)",
  fontSize: 12,
};

const smallButtonStyle: CSSProperties = {
  padding: "9px 14px",
  fontSize: 9.5,
  alignSelf: "end",
};
