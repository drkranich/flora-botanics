"use client";

import type { CSSProperties, ReactNode } from "react";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import {
  createExportComplianceCheck,
  createExportOperation,
  createInternationalDocument,
  createInternationalShippingQuote,
  createInternationalTaxRule,
  seedInternationalTradeCenter,
} from "./international-actions";

const statuses: GlassSelectOption[] = [
  { value: "draft", label: "Rascunho" },
  { value: "review", label: "Em revisão" },
  { value: "validated", label: "Validado" },
  { value: "approved", label: "Aprovado" },
  { value: "blocked", label: "Bloqueado" },
];

const saleTypes: GlassSelectOption[] = [
  { value: "b2c", label: "B2C" },
  { value: "b2b", label: "B2B" },
  { value: "wholesale", label: "Atacado" },
  { value: "retail", label: "Varejo" },
  { value: "marketplace", label: "Marketplace" },
  { value: "subscription", label: "Assinatura" },
  { value: "sample", label: "Amostra" },
  { value: "gift", label: "Presente" },
  { value: "replacement", label: "Reposição" },
  { value: "return", label: "Devolução" },
];

const saleChannels: GlassSelectOption[] = [
  { value: "ecommerce_flora", label: "E-commerce Flora" },
  { value: "marketplace", label: "Marketplace" },
  { value: "internal_sale", label: "Venda interna" },
  { value: "representative", label: "Representante" },
  { value: "b2b_partner", label: "Parceiro B2B" },
  { value: "subscription", label: "Assinatura" },
];

const itemTypes: GlassSelectOption[] = [
  { value: "product", label: "Produto individual" },
  { value: "kit", label: "Kit" },
  { value: "combo", label: "Combo" },
  { value: "subscription", label: "Assinatura" },
  { value: "sample", label: "Amostra" },
  { value: "gift", label: "Brinde" },
  { value: "package", label: "Embalagem" },
  { value: "service", label: "Serviço associado" },
];

const incoterms: GlassSelectOption[] = [
  { value: "DAP", label: "DAP — comprador paga importação" },
  { value: "DDP", label: "DDP — Flora assume destino" },
  { value: "FCA", label: "FCA" },
  { value: "FOB", label: "FOB" },
  { value: "CIF", label: "CIF" },
  { value: "CIP", label: "CIP" },
  { value: "EXW", label: "EXW" },
];

const responsibilities: GlassSelectOption[] = [
  { value: "buyer", label: "Comprador / DAP" },
  { value: "flora", label: "Flora / DDP" },
  { value: "marketplace", label: "Marketplace responsável" },
  { value: "importer", label: "Importador responsável" },
];

const currencies: GlassSelectOption[] = [
  { value: "BRL", label: "BRL" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "CAD", label: "CAD" },
  { value: "AUD", label: "AUD" },
  { value: "JPY", label: "JPY" },
];

const taxKinds: GlassSelectOption[] = [
  { value: "vat", label: "VAT / IVA" },
  { value: "gst", label: "GST" },
  { value: "sales_tax", label: "Sales Tax" },
  { value: "customs_duty", label: "Tarifa aduaneira" },
  { value: "import_fee", label: "Taxa de importação" },
  { value: "processing_fee", label: "Taxa de processamento" },
  { value: "registration", label: "Registro fiscal" },
  { value: "marketplace_collection", label: "Recolhimento marketplace" },
];

const taxBases: GlassSelectOption[] = [
  { value: "customs_value", label: "Valor aduaneiro" },
  { value: "cif", label: "CIF" },
  { value: "fob", label: "FOB" },
  { value: "sale_value", label: "Valor de venda" },
  { value: "landed_cost", label: "Landed cost" },
];

const ruleStatuses: GlassSelectOption[] = [
  { value: "simulation", label: "Simulação" },
  { value: "official_manual", label: "Oficial importada manualmente" },
  { value: "specialist_validated", label: "Validada por especialista" },
  { value: "official_integrated", label: "Oficial integrada" },
  { value: "outdated", label: "Desatualizada" },
  { value: "waiting_review", label: "Aguardando revisão" },
];

const documentScopes: GlassSelectOption[] = [
  { value: "brazil", label: "Documento emitido no Brasil" },
  { value: "commercial", label: "Documento comercial internacional" },
  { value: "destination_tax", label: "Documento tributário do destino" },
  { value: "customs", label: "Documento aduaneiro" },
  { value: "transport", label: "Documento de transporte" },
];

const documentTypes: GlassSelectOption[] = [
  { value: "nfe_export", label: "NF-e de exportação" },
  { value: "due", label: "DU-E" },
  { value: "lpco", label: "LPCO" },
  { value: "commercial_invoice", label: "Commercial Invoice" },
  { value: "proforma_invoice", label: "Pro Forma Invoice" },
  { value: "packing_list", label: "Packing List" },
  { value: "certificate_origin", label: "Certificado de origem" },
  { value: "customs_declaration", label: "Declaração aduaneira" },
  { value: "ioss_vat_report", label: "Relatório IOSS/VAT" },
  { value: "shipping_document", label: "Documento de transporte" },
  { value: "insurance", label: "Seguro" },
];

const requirementStatuses: GlassSelectOption[] = [
  { value: "required", label: "Obrigatório" },
  { value: "potentially_required", label: "Potencialmente obrigatório" },
  { value: "optional", label: "Opcional" },
  { value: "not_applicable", label: "Não aplicável" },
  { value: "pending_confirmation", label: "Pendente de confirmação" },
];

const transportModes: GlassSelectOption[] = [
  { value: "postal", label: "Postal" },
  { value: "courier", label: "Courier" },
  { value: "air_cargo", label: "Carga aérea" },
  { value: "sea_cargo", label: "Carga marítima" },
  { value: "road", label: "Rodoviário" },
  { value: "fulfillment", label: "Fulfillment" },
  { value: "forwarder", label: "Freight forwarder" },
];

const quoteStatuses: GlassSelectOption[] = [
  { value: "quoted", label: "Cotado" },
  { value: "selected", label: "Selecionado" },
  { value: "booked", label: "Reservado" },
  { value: "shipped", label: "Expedido" },
  { value: "delivered", label: "Entregue" },
  { value: "failed", label: "Falhou" },
];

const complianceStatuses: GlassSelectOption[] = [
  { value: "not_reviewed", label: "Não analisado" },
  { value: "in_review", label: "Em análise" },
  { value: "documents_pending", label: "Documentos pendentes" },
  { value: "approved_for_market", label: "Aprovado para o mercado" },
  { value: "restricted", label: "Restrito" },
  { value: "blocked", label: "Bloqueado" },
  { value: "expired", label: "Vencido" },
];

const severities: GlassSelectOption[] = [
  { value: "info", label: "Informativo" },
  { value: "warning", label: "Atenção" },
  { value: "critical", label: "Crítico" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function TextInput({ name, placeholder, required = false }: { name: string; placeholder?: string; required?: boolean }) {
  return <input name={name} required={required} placeholder={placeholder} className="input" style={inputStyle} />;
}

function TextArea({ name, placeholder }: { name: string; placeholder?: string }) {
  return <textarea name={name} rows={3} placeholder={placeholder} className="input" style={{ ...inputStyle, resize: "vertical" }} />;
}

function FormShell({
  eyebrow,
  title,
  children,
  action,
  buttonLabel,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  buttonLabel: string;
}) {
  return (
    <form action={action} className="glass" style={formStyle}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</p>
      <h3 style={{ margin: "0 0 16px", fontSize: 20 }}>{title}</h3>
      <div style={formGridStyle}>{children}</div>
      <button type="submit" className="btn btn-gold" style={{ marginTop: 16, padding: "10px 18px", fontSize: 10 }}>
        {buttonLabel}
      </button>
    </form>
  );
}

export function SeedInternationalTradeButton() {
  return (
    <form action={seedInternationalTradeCenter}>
      <button className="btn btn-gold" style={{ padding: "10px 16px", fontSize: 10 }}>
        Instalar pacotes iniciais
      </button>
    </form>
  );
}

export function InternationalOperationForm({
  jurisdictions,
}: {
  jurisdictions: GlassSelectOption[];
}) {
  const jurisdictionOptions = jurisdictions.length ? jurisdictions : [{ value: "", label: "Instale os pacotes iniciais" }];
  return (
    <FormShell eyebrow="Simulador internacional" title="Criar operação e memória de landed cost" action={createExportOperation} buttonLabel="Calcular exportação">
      <Field label="Título">
        <TextInput name="title" placeholder="Exportação Europa - Serum" required />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={statuses} defaultValue="draft" inlineMenu />
      </Field>
      <Field label="Tipo de venda">
        <GlassSelect name="sale_type" options={saleTypes} defaultValue="b2c" inlineMenu />
      </Field>
      <Field label="Canal">
        <GlassSelect name="sale_channel" options={saleChannels} defaultValue="ecommerce_flora" inlineMenu />
      </Field>
      <Field label="Jurisdição">
        <GlassSelect name="destination_jurisdiction_id" options={jurisdictionOptions} inlineMenu />
      </Field>
      <Field label="País de destino">
        <TextInput name="destination_country" placeholder="DE, US, GB..." required />
      </Field>
      <Field label="Estado, província ou região">
        <TextInput name="destination_region" placeholder="Flórida, Baviera..." />
      </Field>
      <Field label="Cidade">
        <TextInput name="destination_city" placeholder="Miami, Berlin..." />
      </Field>
      <Field label="Código postal">
        <TextInput name="destination_postal_code" placeholder="ZIP/Postal code" />
      </Field>
      <Field label="Comprador">
        <TextInput name="buyer_name" placeholder="Cliente, empresa ou loja" />
      </Field>
      <Field label="Destinatário">
        <TextInput name="consignee_name" placeholder="Recebedor no destino" />
      </Field>
      <Field label="Importador responsável">
        <TextInput name="importer_of_record" placeholder="Importer of Record" />
      </Field>
      <Field label="Transportadora">
        <TextInput name="carrier_name" placeholder="DHL, FedEx, Correios..." />
      </Field>
      <Field label="Marketplace">
        <TextInput name="marketplace_name" placeholder="Amazon, Etsy..." />
      </Field>
      <Field label="Representante fiscal">
        <TextInput name="fiscal_representative" placeholder="Parceiro local, IOSS, VAT..." />
      </Field>
      <Field label="Incoterm">
        <GlassSelect name="incoterm" options={incoterms} defaultValue="DAP" inlineMenu />
      </Field>
      <Field label="Responsabilidade por tributos">
        <GlassSelect name="tax_responsibility" options={responsibilities} defaultValue="buyer" inlineMenu />
      </Field>
      <Field label="Moeda da operação">
        <GlassSelect name="currency" options={currencies} defaultValue="USD" inlineMenu />
      </Field>
      <Field label="Moeda do destino">
        <GlassSelect name="destination_currency" options={currencies} defaultValue="USD" inlineMenu />
      </Field>
      <Field label="Taxa cambial">
        <TextInput name="exchange_rate" placeholder="5,45" />
      </Field>
      <Field label="Fonte do câmbio">
        <TextInput name="exchange_source" placeholder="Banco, contrato, cotação..." />
      </Field>
      <Field label="Data do câmbio">
        <GlassDateInput name="exchange_date" placeholder="Selecionar data" inlinePopover />
      </Field>
      <Field label="Condição de pagamento">
        <TextInput name="payment_terms" placeholder="Stripe, wire, cartão..." />
      </Field>
      <Field label="Tipo do item">
        <GlassSelect name="item_type" options={itemTypes} defaultValue="product" inlineMenu />
      </Field>
      <Field label="Descrição do item">
        <TextInput name="item_description" placeholder="Serum facial 30 ml" required />
      </Field>
      <Field label="SKU">
        <TextInput name="sku" placeholder="SKU" />
      </Field>
      <Field label="NCM">
        <TextInput name="ncm" placeholder="3304..." />
      </Field>
      <Field label="HS Code">
        <TextInput name="hs_code" placeholder="3304.99" />
      </Field>
      <Field label="Código local">
        <TextInput name="local_tariff_code" placeholder="HTS, TARIC, UKGT..." />
      </Field>
      <Field label="Quantidade">
        <TextInput name="quantity" placeholder="1" />
      </Field>
      <Field label="Unidade">
        <TextInput name="unit" placeholder="un" />
      </Field>
      <Field label="Peso líquido kg">
        <TextInput name="net_weight_kg" placeholder="0,12" />
      </Field>
      <Field label="Peso bruto kg">
        <TextInput name="gross_weight_kg" placeholder="0,20" />
      </Field>
      <Field label="Volume m³">
        <TextInput name="volume_m3" placeholder="0,001" />
      </Field>
      <Field label="Preço unitário">
        <TextInput name="unit_price" placeholder="49,90" />
      </Field>
      <Field label="Valor dos produtos">
        <TextInput name="product_value" placeholder="49,90" />
      </Field>
      <Field label="Custo de produção">
        <TextInput name="production_cost" placeholder="12,00" />
      </Field>
      <Field label="Embalagem internacional">
        <TextInput name="packaging" placeholder="4,50" />
      </Field>
      <Field label="Custos brasileiros de exportação">
        <TextInput name="brazilian_export_cost" placeholder="15,00" />
      </Field>
      <Field label="Frete internacional">
        <TextInput name="international_freight" placeholder="85,00" />
      </Field>
      <Field label="Seguro">
        <TextInput name="insurance" placeholder="6,00" />
      </Field>
      <Field label="Tarifa aduaneira %">
        <TextInput name="customs_duty_percent" placeholder="4,5" />
      </Field>
      <Field label="VAT, GST ou IVA %">
        <TextInput name="destination_tax_percent" placeholder="19" />
      </Field>
      <Field label="Sales Tax %">
        <TextInput name="sales_tax_percent" placeholder="0" />
      </Field>
      <Field label="Comissão %">
        <TextInput name="commission_percent" placeholder="12" />
      </Field>
      <Field label="Gateway %">
        <TextInput name="payment_fee_percent" placeholder="3,9" />
      </Field>
      <Field label="Compliance e registros">
        <TextInput name="compliance_cost" placeholder="0,00" />
      </Field>
      <Field label="Contingência %">
        <TextInput name="contingency_percent" placeholder="8" />
      </Field>
      <Field label="Margem alvo %">
        <TextInput name="target_margin_percent" placeholder="35" />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="Riscos, premissas, revisão fiscal..." />
      </Field>
    </FormShell>
  );
}

export function InternationalRuleForm({ jurisdictions }: { jurisdictions: GlassSelectOption[] }) {
  const jurisdictionOptions = jurisdictions.length ? jurisdictions : [{ value: "", label: "Instale os pacotes iniciais" }];
  return (
    <FormShell eyebrow="Regras tributárias" title="Cadastrar regra por jurisdição e vigência" action={createInternationalTaxRule} buttonLabel="Salvar regra">
      <Field label="Jurisdição">
        <GlassSelect name="jurisdiction_id" options={jurisdictionOptions} inlineMenu />
      </Field>
      <Field label="Imposto">
        <TextInput name="tax_name" placeholder="VAT Alemanha, Sales Tax Florida..." required />
      </Field>
      <Field label="Tipo">
        <GlassSelect name="tax_kind" options={taxKinds} defaultValue="vat" inlineMenu />
      </Field>
      <Field label="Base">
        <GlassSelect name="base_kind" options={taxBases} defaultValue="customs_value" inlineMenu />
      </Field>
      <Field label="Responsável">
        <GlassSelect name="responsibility" options={responsibilities} defaultValue="buyer" inlineMenu />
      </Field>
      <Field label="Alíquota %">
        <TextInput name="rate_percent" placeholder="19" />
      </Field>
      <Field label="Valor fixo">
        <TextInput name="fixed_amount" placeholder="0,00" />
      </Field>
      <Field label="Limite">
        <TextInput name="threshold" placeholder="0,00" />
      </Field>
      <Field label="Moeda">
        <GlassSelect name="currency" options={currencies} defaultValue="USD" inlineMenu />
      </Field>
      <Field label="Status da regra">
        <GlassSelect name="rule_status" options={ruleStatuses} defaultValue="simulation" inlineMenu />
      </Field>
      <Field label="NCM">
        <TextInput name="ncm" placeholder="3304..." />
      </Field>
      <Field label="HS Code">
        <TextInput name="hs_code" placeholder="3304.99" />
      </Field>
      <Field label="Código local">
        <TextInput name="local_tariff_code" placeholder="TARIC, HTS..." />
      </Field>
      <Field label="Incoterm">
        <GlassSelect name="incoterm" options={incoterms} defaultValue="DAP" inlineMenu />
      </Field>
      <Field label="Fonte oficial">
        <TextInput name="official_source" placeholder="CBP, HMRC, Comissão Europeia..." />
      </Field>
      <Field label="URL da fonte">
        <TextInput name="source_url" placeholder="https://..." />
      </Field>
      <Field label="Vigência inicial">
        <GlassDateInput name="effective_from" placeholder="Data inicial" inlinePopover />
      </Field>
      <Field label="Vigência final">
        <GlassDateInput name="effective_until" placeholder="Data final" inlinePopover />
      </Field>
      <Field label="Versão">
        <TextInput name="version" placeholder="2026.1" />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="Não exibir estimativa como valor definitivo." />
      </Field>
    </FormShell>
  );
}

export function InternationalDocumentForm({ operations }: { operations: GlassSelectOption[] }) {
  return (
    <FormShell eyebrow="Documentos internacionais" title="Registrar documento, invoice ou comprovante" action={createInternationalDocument} buttonLabel="Salvar documento">
      <Field label="Operação">
        <GlassSelect name="operation_id" options={[{ value: "", label: "Sem operação vinculada" }, ...operations]} inlineMenu />
      </Field>
      <Field label="Escopo documental">
        <GlassSelect name="document_scope" options={documentScopes} defaultValue="commercial" inlineMenu />
      </Field>
      <Field label="Tipo">
        <GlassSelect name="document_type" options={documentTypes} defaultValue="commercial_invoice" inlineMenu />
      </Field>
      <Field label="Título">
        <TextInput name="title" placeholder="Commercial Invoice EXP..." required />
      </Field>
      <Field label="Número">
        <TextInput name="document_number" placeholder="CI-0001" />
      </Field>
      <Field label="País">
        <TextInput name="country_code" placeholder="US, DE, GB..." />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={statuses} defaultValue="draft" inlineMenu />
      </Field>
      <Field label="Obrigatoriedade">
        <GlassSelect name="requirement_status" options={requirementStatuses} defaultValue="pending_confirmation" inlineMenu />
      </Field>
      <Field label="Idioma">
        <TextInput name="language" placeholder="pt-BR, en-US..." />
      </Field>
      <Field label="Emitido em">
        <GlassDateInput name="issued_at" placeholder="Data de emissão" inlinePopover />
      </Field>
      <Field label="Vence em">
        <GlassDateInput name="expires_at" placeholder="Data de validade" inlinePopover />
      </Field>
      <Field label="Arquivo no cofre">
        <TextInput name="storage_path" placeholder="caminho privado no cofre" />
      </Field>
      <Field label="Exportador">
        <TextInput name="exporter" placeholder="Flora Botanics" />
      </Field>
      <Field label="Consignee">
        <TextInput name="consignee" placeholder="Recebedor" />
      </Field>
      <Field label="Moeda">
        <GlassSelect name="currency" options={currencies} defaultValue="USD" inlineMenu />
      </Field>
      <Field label="Incoterm">
        <GlassSelect name="incoterm" options={incoterms} defaultValue="DAP" inlineMenu />
      </Field>
      <Field label="Declaração">
        <TextArea name="declaration" placeholder="Declaração comercial, finalidade da remessa, origem..." />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="Versão, assinatura, pendências..." />
      </Field>
    </FormShell>
  );
}

export function InternationalShippingForm({ operations }: { operations: GlassSelectOption[] }) {
  return (
    <FormShell eyebrow="Frete internacional" title="Cotação, transportadora e rastreamento" action={createInternationalShippingQuote} buttonLabel="Salvar cotação">
      <Field label="Operação">
        <GlassSelect name="operation_id" options={[{ value: "", label: "Sem operação vinculada" }, ...operations]} inlineMenu />
      </Field>
      <Field label="Provedor">
        <TextInput name="provider_key" placeholder="dhl, fedex, correios..." required />
      </Field>
      <Field label="Serviço">
        <TextInput name="service_name" placeholder="Express Worldwide" required />
      </Field>
      <Field label="Modal">
        <GlassSelect name="transport_mode" options={transportModes} defaultValue="courier" inlineMenu />
      </Field>
      <Field label="Origem">
        <TextInput name="origin_country" placeholder="BR" />
      </Field>
      <Field label="Destino">
        <TextInput name="destination_country" placeholder="US, DE..." required />
      </Field>
      <Field label="Peso real kg">
        <TextInput name="real_weight_kg" placeholder="0,30" />
      </Field>
      <Field label="Peso cubado kg">
        <TextInput name="volumetric_weight_kg" placeholder="0,45" />
      </Field>
      <Field label="Volumes">
        <TextInput name="packages_count" placeholder="1" />
      </Field>
      <Field label="Frete">
        <TextInput name="freight" placeholder="85,00" />
      </Field>
      <Field label="Seguro">
        <TextInput name="insurance" placeholder="6,00" />
      </Field>
      <Field label="Combustível">
        <TextInput name="fuel_surcharge" placeholder="0,00" />
      </Field>
      <Field label="Handling">
        <TextInput name="handling" placeholder="0,00" />
      </Field>
      <Field label="Tributos antecipados">
        <TextInput name="taxes_prepaid" placeholder="0,00" />
      </Field>
      <Field label="Entrega local">
        <TextInput name="delivery" placeholder="0,00" />
      </Field>
      <Field label="Moeda">
        <GlassSelect name="currency" options={currencies} defaultValue="USD" inlineMenu />
      </Field>
      <Field label="Prazo em dias">
        <TextInput name="estimated_days" placeholder="7" />
      </Field>
      <Field label="Incoterm">
        <GlassSelect name="incoterm" options={incoterms} defaultValue="DAP" inlineMenu />
      </Field>
      <Field label="Código de rastreio">
        <TextInput name="tracking_code" placeholder="TRK..." />
      </Field>
      <Field label="Link de rastreio">
        <TextInput name="tracking_url" placeholder="https://..." />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={quoteStatuses} defaultValue="quoted" inlineMenu />
      </Field>
      <Field label="Risco">
        <TextInput name="risk_score" placeholder="0 a 100" />
      </Field>
    </FormShell>
  );
}

export function ExportComplianceForm({
  jurisdictions,
  operations,
}: {
  jurisdictions: GlassSelectOption[];
  operations: GlassSelectOption[];
}) {
  const jurisdictionOptions = jurisdictions.length ? jurisdictions : [{ value: "", label: "Instale os pacotes iniciais" }];
  return (
    <FormShell eyebrow="Cosméticos e conformidade" title="Criar verificação de mercado" action={createExportComplianceCheck} buttonLabel="Salvar verificação">
      <Field label="Operação">
        <GlassSelect name="operation_id" options={[{ value: "", label: "Sem operação vinculada" }, ...operations]} inlineMenu />
      </Field>
      <Field label="Jurisdição">
        <GlassSelect name="jurisdiction_id" options={jurisdictionOptions} inlineMenu />
      </Field>
      <Field label="Tipo de verificação">
        <TextInput name="check_type" placeholder="INCI, rótulo, responsável local..." required />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={complianceStatuses} defaultValue="not_reviewed" inlineMenu />
      </Field>
      <Field label="Severidade">
        <GlassSelect name="severity" options={severities} defaultValue="warning" inlineMenu />
      </Field>
      <Field label="Título">
        <TextInput name="title" placeholder="Rótulo em idioma local pendente" required />
      </Field>
      <Field label="Prazo">
        <GlassDateInput name="due_date" placeholder="Prazo de revisão" inlinePopover />
      </Field>
      <Field label="Documentos exigidos">
        <TextInput name="required_documents" placeholder="Dossiê, INCI, testes..." />
      </Field>
      <Field label="Detalhes">
        <TextArea name="details" placeholder="Fórmula, alegações, requisitos de rotulagem, restrições..." />
      </Field>
    </FormShell>
  );
}

const formStyle: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  minWidth: 0,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.4,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
};
