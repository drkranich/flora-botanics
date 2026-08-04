"use client";

import type { CSSProperties, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import {
  createExportComplianceCheck,
  createExportOperation,
  createExchangeRate,
  createFiscalRegistration,
  createInternationalDocument,
  createInternationalShippingQuote,
  createInternationalTaxRule,
  createJurisdiction,
  updateJurisdiction,
  seedInternationalTradeCenter,
  closeExportAlert,
  deleteInternationalTaxRule,
  deleteInternationalDocument,
  deleteInternationalShippingQuote,
  deleteFiscalRegistration,
  deleteExportComplianceCheck,
  deleteExchangeRate,
  createCustomsClassification,
  deleteCustomsClassification,
  createNfeExportRecord,
  createDueRecord,
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

function TextInput({ name, placeholder, required = false, defaultValue }: { name: string; placeholder?: string; required?: boolean; defaultValue?: string }) {
  return <input name={name} required={required} placeholder={placeholder} defaultValue={defaultValue} className="input" style={inputStyle} />;
}

function TextArea({ name, placeholder, defaultValue }: { name: string; placeholder?: string; defaultValue?: string }) {
  return <textarea name={name} rows={3} placeholder={placeholder} defaultValue={defaultValue} className="input" style={{ ...inputStyle, resize: "vertical" }} />;
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
      <SeedSubmitButton />
    </form>
  );
}

function SeedSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "10px 16px", fontSize: 10 }}>
      {pending ? "Instalando..." : "Instalar pacotes iniciais"}
    </button>
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

const registrationKinds: GlassSelectOption[] = [
  { value: "EORI", label: "EORI (União Europeia)" },
  { value: "IOSS", label: "IOSS (vendas distância UE)" },
  { value: "OSS", label: "OSS (regime One Stop Shop)" },
  { value: "VAT", label: "VAT (Europa / Reino Unido)" },
  { value: "GST", label: "GST (Canadá / Austrália)" },
  { value: "Sales Tax", label: "Sales Tax (EUA)" },
  { value: "QST", label: "QST (Quebec)" },
  { value: "PST", label: "PST (BC / Saskatchewan)" },
  { value: "HST", label: "HST (Ontario / Atlantic)" },
  { value: "CNPJ", label: "CNPJ (Brasil)" },
  { value: "IE", label: "IE (Inscrição Estadual)" },
  { value: "Outros", label: "Outros" },
];

const registrationStatuses: GlassSelectOption[] = [
  { value: "not_started", label: "Não iniciado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "pending_review", label: "Aguardando revisão" },
  { value: "active", label: "Ativo" },
  { value: "expired", label: "Vencido" },
  { value: "cancelled", label: "Cancelado" },
];

const scenarios: GlassSelectOption[] = [
  { value: "current", label: "Taxa atual" },
  { value: "contracted", label: "Taxa contratada" },
  { value: "projected", label: "Projeção" },
  { value: "historical", label: "Histórico" },
];

export function ExchangeRateForm() {
  return (
    <FormShell eyebrow="Câmbio" title="Registrar taxa de câmbio" action={createExchangeRate} buttonLabel="Salvar taxa">
      <Field label="Moeda base">
        <GlassSelect name="base_currency" options={currencies} defaultValue="USD" inlineMenu />
      </Field>
      <Field label="Moeda cotada">
        <GlassSelect name="quote_currency" options={currencies} defaultValue="BRL" inlineMenu />
      </Field>
      <Field label="Taxa (ex: 5,45 por 1 USD)">
        <TextInput name="rate" placeholder="5,4500" required />
      </Field>
      <Field label="Taxa comercial">
        <TextInput name="commercial_rate" placeholder="5,4200" />
      </Field>
      <Field label="Spread %">
        <TextInput name="spread_percent" placeholder="0,50" />
      </Field>
      <Field label="Taxa fixa">
        <TextInput name="fee" placeholder="0,00" />
      </Field>
      <Field label="Fonte">
        <TextInput name="source" placeholder="Banco, contrato, Banco Central..." />
      </Field>
      <Field label="Data da taxa">
        <GlassDateInput name="rate_date" placeholder="Data de referência" inlinePopover />
      </Field>
      <Field label="Cenário">
        <GlassSelect name="scenario" options={scenarios} defaultValue="current" inlineMenu />
      </Field>
      <Field label="Travado até">
        <GlassDateInput name="locked_until" placeholder="Data de travamento" inlinePopover />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="Contrato, hedge, variação esperada..." />
      </Field>
    </FormShell>
  );
}

export function FiscalRegistrationForm({ jurisdictions }: { jurisdictions: GlassSelectOption[] }) {
  const jurisdictionOptions = jurisdictions.length ? jurisdictions : [{ value: "", label: "Instale os pacotes iniciais" }];
  return (
    <FormShell eyebrow="Registros fiscais" title="Cadastrar EORI, IOSS, OSS, VAT, GST ou Sales Tax" action={createFiscalRegistration} buttonLabel="Salvar registro">
      <Field label="Jurisdição">
        <GlassSelect name="jurisdiction_id" options={[{ value: "", label: "Sem jurisdição vinculada" }, ...jurisdictionOptions]} inlineMenu />
      </Field>
      <Field label="Tipo de registro">
        <GlassSelect name="registration_kind" options={registrationKinds} defaultValue="EORI" inlineMenu />
      </Field>
      <Field label="Número / ID">
        <TextInput name="registration_number" placeholder="EU1234567890, GB123456789..." />
      </Field>
      <Field label="Autoridade / órgão">
        <TextInput name="authority" placeholder="HMRC, autoridade tributária local..." />
      </Field>
      <Field label="Responsável">
        <TextInput name="responsible_party" placeholder="Representante fiscal, empresa..." />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={registrationStatuses} defaultValue="not_started" inlineMenu />
      </Field>
      <Field label="Vigência inicial">
        <GlassDateInput name="effective_from" placeholder="Data inicial" inlinePopover />
      </Field>
      <Field label="Vigência final">
        <GlassDateInput name="effective_until" placeholder="Data final" inlinePopover />
      </Field>
      <Field label="Renovação prevista">
        <GlassDateInput name="renewal_due_at" placeholder="Data de renovação" inlinePopover />
      </Field>
      <Field label="Referência de credenciais">
        <TextInput name="credentials_ref" placeholder="Cofre, pasta ou referência interna" />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="Limite de faturamento, condições, renovação automática..." />
      </Field>
    </FormShell>
  );
}

// ── JurisdictionForm ──────────────────────────────────────────────────────────

const packageStatuses: GlassSelectOption[] = [
  { value: "draft",        label: "Rascunho" },
  { value: "needs_review", label: "Precisa revisão" },
  { value: "operational",  label: "Operacional" },
  { value: "simulation",   label: "Simulação" },
  { value: "blocked",      label: "Bloqueado" },
];

const confidenceStatuses: GlassSelectOption[] = [
  { value: "simulation",           label: "Simulação" },
  { value: "waiting_review",       label: "Aguardando revisão" },
  { value: "specialist_validated", label: "Validada por especialista" },
  { value: "official_imported",    label: "Oficial importada" },
  { value: "official_integrated",  label: "Oficial integrada" },
];

const scopeOptions: GlassSelectOption[] = [
  { value: "country", label: "País" },
  { value: "bloc",    label: "Bloco econômico" },
  { value: "state",   label: "Estado / Província" },
  { value: "city",    label: "Município" },
];

type JurisdictionFormProps = {
  /** undefined = modo criação, objeto = modo edição */
  editing?: {
    id: string;
    code: string;
    name: string;
    scope: string;
    currency: string;
    language: string;
    tax_system: string | null;
    package_status: string;
    confidence_status: string;
    official_sources: string[] | null;
    alerts: string[] | null;
    version: string;
    notes: string | null;
    effective_from: string | null;
    effective_until: string | null;
  };
};

export function JurisdictionForm({ editing }: JurisdictionFormProps) {
  const isEdit = Boolean(editing);
  const action = isEdit ? updateJurisdiction : createJurisdiction;
  const title  = isEdit ? `Editar: ${editing!.code} · ${editing!.name}` : "Novo mercado / jurisdição";

  return (
    <FormShell
      eyebrow="Pacote de jurisdição"
      title={title}
      action={action}
      buttonLabel={isEdit ? "Salvar alterações" : "Criar mercado"}
    >
      {isEdit && <input type="hidden" name="id" value={editing!.id} />}

      <Field label="Código *">
        <TextInput name="code" required placeholder="BR, EU, US, GB, CA..." defaultValue={editing?.code} />
      </Field>
      <Field label="Nome *">
        <TextInput name="name" required placeholder="Brasil, União Europeia..." defaultValue={editing?.name} />
      </Field>
      <Field label="Escopo *">
        <GlassSelect
          name="scope"
          options={scopeOptions}
          defaultValue={editing?.scope ?? "country"}
          ariaLabel="Escopo"
        />
      </Field>
      <Field label="Moeda *">
        <TextInput name="currency" required placeholder="BRL, EUR, USD, GBP..." defaultValue={editing?.currency} />
      </Field>
      <Field label="Idioma">
        <TextInput name="language" placeholder="pt, en, fr, de..." defaultValue={editing?.language ?? "en"} />
      </Field>
      <Field label="Versão">
        <TextInput name="version" placeholder="1.0" defaultValue={editing?.version ?? "1.0"} />
      </Field>
      <Field label="Status do pacote">
        <GlassSelect
          name="package_status"
          options={packageStatuses}
          defaultValue={editing?.package_status ?? "draft"}
          ariaLabel="Status do pacote"
        />
      </Field>
      <Field label="Confiança">
        <GlassSelect
          name="confidence_status"
          options={confidenceStatuses}
          defaultValue={editing?.confidence_status ?? "simulation"}
          ariaLabel="Confiança"
        />
      </Field>
      <Field label="Sistema tributário">
        <TextInput name="tax_system" placeholder="VAT, GST, Sales Tax, IVA..." defaultValue={editing?.tax_system ?? ""} />
      </Field>
      <Field label="Fontes oficiais (separadas por vírgula)">
        <TextInput
          name="official_sources"
          placeholder="SEFAZ, HMRC, IRS, CRA..."
          defaultValue={(editing?.official_sources ?? []).join(", ")}
        />
      </Field>
      <Field label="Alertas (separados por vírgula)">
        <TextInput
          name="alerts"
          placeholder="Não transmitir sem certificado..."
          defaultValue={(editing?.alerts ?? []).join(", ")}
        />
      </Field>
      <Field label="Vigência de">
        <GlassDateInput name="effective_from" defaultValue={editing?.effective_from ?? ""} />
      </Field>
      <Field label="Vigência até">
        <GlassDateInput name="effective_until" defaultValue={editing?.effective_until ?? ""} />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="Notas internas, restrições, contexto..." defaultValue={editing?.notes ?? ""} />
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

// ── Delete / fechar alerta ─────────────────────────────────────────────────────

export function CloseAlertButton({ alertId }: { alertId: string }) {
  return (
    <form action={closeExportAlert.bind(null, alertId)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 28, padding: "4px 10px", fontSize: 9 }}>
        Fechar
      </button>
    </form>
  );
}

export function DeleteTaxRuleButton({ id }: { id: string }) {
  return (
    <form action={deleteInternationalTaxRule.bind(null, id)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 26, padding: "4px 9px", fontSize: 8.5, opacity: 0.6 }}
        onClick={(e) => { if (!window.confirm("Excluir esta regra?")) e.preventDefault(); }}>
        ✕
      </button>
    </form>
  );
}

export function DeleteDocumentButton({ id }: { id: string }) {
  return (
    <form action={deleteInternationalDocument.bind(null, id)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 26, padding: "4px 9px", fontSize: 8.5, opacity: 0.6 }}
        onClick={(e) => { if (!window.confirm("Excluir este documento?")) e.preventDefault(); }}>
        ✕
      </button>
    </form>
  );
}

export function DeleteShippingButton({ id }: { id: string }) {
  return (
    <form action={deleteInternationalShippingQuote.bind(null, id)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 26, padding: "4px 9px", fontSize: 8.5, opacity: 0.6 }}
        onClick={(e) => { if (!window.confirm("Excluir esta cotação?")) e.preventDefault(); }}>
        ✕
      </button>
    </form>
  );
}

export function DeleteFiscalRegButton({ id }: { id: string }) {
  return (
    <form action={deleteFiscalRegistration.bind(null, id)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 26, padding: "4px 9px", fontSize: 8.5, opacity: 0.6 }}
        onClick={(e) => { if (!window.confirm("Excluir este registro?")) e.preventDefault(); }}>
        ✕
      </button>
    </form>
  );
}

export function DeleteComplianceButton({ id }: { id: string }) {
  return (
    <form action={deleteExportComplianceCheck.bind(null, id)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 26, padding: "4px 9px", fontSize: 8.5, opacity: 0.6 }}
        onClick={(e) => { if (!window.confirm("Excluir esta verificação?")) e.preventDefault(); }}>
        ✕
      </button>
    </form>
  );
}

export function DeleteExchangeRateButton({ id }: { id: string }) {
  return (
    <form action={deleteExchangeRate.bind(null, id)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 26, padding: "4px 9px", fontSize: 8.5, opacity: 0.6 }}
        onClick={(e) => { if (!window.confirm("Excluir esta taxa?")) e.preventDefault(); }}>
        ✕
      </button>
    </form>
  );
}

export function DeleteClassificationButton({ id }: { id: string }) {
  return (
    <form action={deleteCustomsClassification.bind(null, id)} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 26, padding: "4px 9px", fontSize: 8.5, opacity: 0.6 }}
        onClick={(e) => { if (!window.confirm("Excluir esta classificação?")) e.preventDefault(); }}>
        ✕
      </button>
    </form>
  );
}

// ── Classificação aduaneira ────────────────────────────────────────────────────

const classificationSystems: GlassSelectOption[] = [
  { value: "NCM",   label: "NCM (Brasil)" },
  { value: "HS",    label: "HS Code (Internacional)" },
  { value: "HTS",   label: "HTS (Estados Unidos)" },
  { value: "TARIC", label: "TARIC (União Europeia)" },
  { value: "UKGT",  label: "UK Global Tariff" },
  { value: "CBSA",  label: "CBSA (Canadá)" },
];

const classificationStatuses: GlassSelectOption[] = [
  { value: "suggested",  label: "Sugerido" },
  { value: "confirmed",  label: "Confirmado" },
  { value: "challenged", label: "Contestado" },
  { value: "outdated",   label: "Desatualizado" },
];

const classificationConfidence: GlassSelectOption[] = [
  { value: "needs_review",         label: "Precisa revisão" },
  { value: "specialist_validated", label: "Validado por especialista" },
  { value: "official_imported",    label: "Oficial importado" },
];

export function CustomsClassificationForm({ jurisdictions }: { jurisdictions: GlassSelectOption[] }) {
  const jurisdictionOptions = jurisdictions.length ? jurisdictions : [{ value: "", label: "Instale os pacotes iniciais" }];
  return (
    <FormShell
      eyebrow="NCM / HS Code / Tarifas"
      title="Cadastrar classificação aduaneira"
      action={createCustomsClassification}
      buttonLabel="Salvar classificação"
    >
      <Field label="Sistema *">
        <GlassSelect name="classification_system" options={classificationSystems} defaultValue="NCM" inlineMenu />
      </Field>
      <Field label="Código *">
        <TextInput name="code" required placeholder="3304.99, 3304.99.90..." />
      </Field>
      <Field label="Descrição *">
        <TextInput name="description" required placeholder="Preparações de beleza, maquiagem..." />
      </Field>
      <Field label="Jurisdição">
        <GlassSelect name="jurisdiction_id" options={[{ value: "", label: "Global / sem jurisdição" }, ...jurisdictionOptions]} inlineMenu />
      </Field>
      <Field label="Fonte">
        <TextInput name="source" placeholder="TIPI, CBP, HMRC..." />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={classificationStatuses} defaultValue="suggested" inlineMenu />
      </Field>
      <Field label="Confiança">
        <GlassSelect name="confidence_status" options={classificationConfidence} defaultValue="needs_review" inlineMenu />
      </Field>
      <Field label="Justificativa">
        <TextArea name="justification" placeholder="Base legal, decisão de consulta, fundamentação..." />
      </Field>
    </FormShell>
  );
}

// ── NF-e de exportação: preparação ────────────────────────────────────────────

const nfeStatuses: GlassSelectOption[] = [
  { value: "draft",     label: "Rascunho" },
  { value: "review",    label: "Em revisão" },
  { value: "validated", label: "Validado internamente" },
  { value: "approved",  label: "Autorizado (protocolo importado)" },
];

export function NfeExportForm({ operations }: { operations: GlassSelectOption[] }) {
  return (
    <FormShell
      eyebrow="NF-e de exportação"
      title="Registrar dados de preparação"
      action={createNfeExportRecord}
      buttonLabel="Salvar NF-e"
    >
      <Field label="Operação">
        <GlassSelect name="operation_id" options={[{ value: "", label: "Sem operação vinculada" }, ...operations]} inlineMenu />
      </Field>
      <Field label="Título / referência">
        <TextInput name="title" placeholder="NF-e EXP-20260801-001" />
      </Field>
      <Field label="CFOP">
        <TextInput name="cfop" placeholder="7101, 7102, 7501..." />
      </Field>
      <Field label="NCM">
        <TextInput name="ncm" placeholder="3304.99.90" />
      </Field>
      <Field label="Natureza da operação">
        <TextInput name="natureza_operacao" placeholder="Exportação direta, remessa para embarque..." />
      </Field>
      <Field label="Chave de acesso">
        <TextInput name="chave_acesso" placeholder="44 dígitos (importar após autorização)" />
      </Field>
      <Field label="Protocolo de autorização">
        <TextInput name="protocolo" placeholder="Importar da SEFAZ após transmissão" />
      </Field>
      <Field label="Série">
        <TextInput name="serie" placeholder="1" />
      </Field>
      <Field label="Número">
        <TextInput name="numero" placeholder="000001" />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={nfeStatuses} defaultValue="draft" inlineMenu />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="NF-e de exportação exige integração SEFAZ com certificado A1/A3 para transmissão." />
      </Field>
    </FormShell>
  );
}

// ── DU-E: preparação ───────────────────────────────────────────────────────────

const dueStatuses: GlassSelectOption[] = [
  { value: "draft",     label: "Rascunho (preparação local)" },
  { value: "review",    label: "Em revisão" },
  { value: "validated", label: "Validado internamente" },
  { value: "approved",  label: "Protocolo importado do Portal Único" },
];

const dueModais: GlassSelectOption[] = [
  { value: "aereo",    label: "Aéreo" },
  { value: "maritimo", label: "Marítimo" },
  { value: "rodoviario", label: "Rodoviário" },
  { value: "postal",   label: "Postal" },
];

const dueCanais: GlassSelectOption[] = [
  { value: "verde",    label: "Canal Verde" },
  { value: "amarelo",  label: "Canal Amarelo" },
  { value: "vermelho", label: "Canal Vermelho" },
  { value: "cinza",    label: "Canal Cinza" },
];

export function DueForm({ operations }: { operations: GlassSelectOption[] }) {
  return (
    <FormShell
      eyebrow="DU-E"
      title="Registrar dados do despacho de exportação"
      action={createDueRecord}
      buttonLabel="Salvar DU-E"
    >
      <Field label="Operação">
        <GlassSelect name="operation_id" options={[{ value: "", label: "Sem operação vinculada" }, ...operations]} inlineMenu />
      </Field>
      <Field label="Título / referência">
        <TextInput name="title" placeholder="DU-E EXP-20260801" />
      </Field>
      <Field label="Número DU-E">
        <TextInput name="due_number" placeholder="Importar do Portal Único após registro" />
      </Field>
      <Field label="Protocolo">
        <TextInput name="protocolo" placeholder="Número do protocolo de despacho" />
      </Field>
      <Field label="Recinto aduaneiro">
        <TextInput name="recinto" placeholder="Aeroporto, porto, recinto seco..." />
      </Field>
      <Field label="Modal">
        <GlassSelect name="modal" options={dueModais} defaultValue="aereo" inlineMenu />
      </Field>
      <Field label="LPCO">
        <TextInput name="lpco" placeholder="Número do LPCO se exigido" />
      </Field>
      <Field label="RUC">
        <TextInput name="ruc" placeholder="Registro Único de Carga" />
      </Field>
      <Field label="Canal parametrização">
        <GlassSelect name="canal" options={dueCanais} defaultValue="verde" inlineMenu />
      </Field>
      <Field label="Status">
        <GlassSelect name="status" options={dueStatuses} defaultValue="draft" inlineMenu />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" placeholder="DU-E exige integração com Portal Único Siscomex para registro e protocolo oficiais." />
      </Field>
    </FormShell>
  );
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────

export function ExportCsvButtons() {
  const base = "/admin/api/export-report-csv";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
      <a href={`${base}?type=landed_cost`} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 9.5 }}>
        ↓ CSV Landed Cost
      </a>
      <a href={`${base}?type=operations`} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 9.5 }}>
        ↓ CSV Operações
      </a>
      <a href={`${base}?type=tax_rules`} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 9.5 }}>
        ↓ CSV Regras Tributárias
      </a>
    </div>
  );
}
