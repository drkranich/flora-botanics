"use client";

import type { CSSProperties, ReactNode } from "react";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import {
  createAccountantRequest,
  createFiscalAssessment,
  createFiscalCertificate,
  createFiscalDocumentEvent,
  createFiscalGuide,
  createFiscalObligation,
  createFiscalProductRule,
  createFiscalVaultDocument,
  createManualFiscalDocument,
  createMonthlyClosing,
  registerFiscalGuidePayment,
  upsertAccountantProfile,
} from "./actions";

const documentTypes: GlassSelectOption[] = [
  { value: "nfe_sale", label: "NF-e de venda" },
  { value: "nfe_entry", label: "NF-e de entrada" },
  { value: "nfe_return", label: "NF-e de devolução" },
  { value: "nfe_complement", label: "NF-e complementar" },
  { value: "nfe_adjustment", label: "NF-e de ajuste" },
  { value: "nfe_shipment", label: "NF-e de remessa" },
  { value: "nfce", label: "NFC-e" },
  { value: "nfse", label: "NFS-e" },
  { value: "import_document", label: "Documento de importação" },
  { value: "other", label: "Outro documento" },
];

const documentStatuses: GlassSelectOption[] = [
  { value: "draft", label: "Rascunho" },
  { value: "validating", label: "Em validação" },
  { value: "ready_to_transmit", label: "Pronta para transmissão" },
  { value: "transmitting", label: "Transmitindo" },
  { value: "authorized", label: "Autorizada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "denied", label: "Denegada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "voided", label: "Inutilizada" },
  { value: "corrected", label: "Corrigida" },
  { value: "divergent", label: "Divergente" },
];

const environmentOptions: GlassSelectOption[] = [
  { value: "homologacao", label: "Homologação" },
  { value: "producao", label: "Produção" },
];

const paymentStatuses: GlassSelectOption[] = [
  { value: "open", label: "Em aberto" },
  { value: "scheduled", label: "Programada" },
  { value: "near_due", label: "Próxima do vencimento" },
  { value: "overdue", label: "Vencida" },
  { value: "partial", label: "Parcialmente paga" },
  { value: "paid", label: "Paga" },
  { value: "compensated", label: "Compensada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "disputed", label: "Em discussão" },
];

const verificationStatuses: GlassSelectOption[] = [
  { value: "pending", label: "Não verificado" },
  { value: "review", label: "Em análise" },
  { value: "verified", label: "Verificado" },
  { value: "verified_with_notes", label: "Verificado com ressalvas" },
  { value: "rejected", label: "Rejeitado" },
];

const directionOptions: GlassSelectOption[] = [
  { value: "out", label: "Saída" },
  { value: "in", label: "Entrada" },
  { value: "internal", label: "Interno" },
];

const guideTypes: GlassSelectOption[] = [
  { value: "darf", label: "DARF" },
  { value: "darf_dctfweb", label: "DARF DCTFWeb" },
  { value: "das", label: "DAS" },
  { value: "fgts", label: "FGTS" },
  { value: "inss", label: "INSS" },
  { value: "icms", label: "ICMS" },
  { value: "icms_st", label: "ICMS-ST" },
  { value: "difal", label: "DIFAL" },
  { value: "fcp", label: "FCP" },
  { value: "ipi", label: "IPI" },
  { value: "pis", label: "PIS" },
  { value: "cofins", label: "COFINS" },
  { value: "irpj", label: "IRPJ" },
  { value: "csll", label: "CSLL" },
  { value: "iss", label: "ISS" },
  { value: "payroll", label: "Folha e pró-labore" },
  { value: "other", label: "Outra guia" },
];

const obligationTypes: GlassSelectOption[] = [
  { value: "dctfweb", label: "DCTFWeb" },
  { value: "mit", label: "MIT" },
  { value: "efd_reinf", label: "EFD-Reinf" },
  { value: "esocial", label: "eSocial" },
  { value: "efd_contributions", label: "EFD-Contribuições" },
  { value: "efd_icms_ipi", label: "EFD ICMS/IPI" },
  { value: "defis", label: "DEFIS" },
  { value: "pgdas", label: "PGDAS-D" },
  { value: "municipal", label: "Declaração municipal" },
  { value: "state", label: "Declaração estadual" },
  { value: "inventory", label: "Inventário" },
  { value: "other", label: "Outra obrigação" },
];

const statusOptions: GlassSelectOption[] = [
  { value: "open", label: "Em aberto" },
  { value: "not_started", label: "Não iniciada" },
  { value: "waiting_accounting", label: "Aguardando escrituração" },
  { value: "in_progress", label: "Em andamento" },
  { value: "ready_to_transmit", label: "Pronta para transmissão" },
  { value: "transmitted", label: "Transmitida" },
  { value: "with_pending_items", label: "Com pendências" },
  { value: "paid", label: "Paga" },
  { value: "archived", label: "Arquivada" },
];

const priorityOptions: GlassSelectOption[] = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const eventTypes: GlassSelectOption[] = [
  { value: "correction_letter", label: "Carta de correção" },
  { value: "cancellation", label: "Cancelamento" },
  { value: "number_void", label: "Inutilização de numeração" },
  { value: "recalculation", label: "Recálculo" },
  { value: "rectification", label: "Retificação" },
  { value: "manifestation", label: "Manifestação" },
];

const departments: GlassSelectOption[] = [
  { value: "fiscal", label: "Fiscal" },
  { value: "accounting", label: "Contábil" },
  { value: "payroll", label: "Departamento Pessoal" },
  { value: "finance", label: "Financeiro" },
  { value: "legal", label: "Jurídico" },
  { value: "logistics", label: "Logística" },
  { value: "sales", label: "Vendas" },
  { value: "management", label: "Diretoria" },
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

function TextArea({ name, placeholder, required = false }: { name: string; placeholder?: string; required?: boolean }) {
  return <textarea name={name} required={required} rows={3} placeholder={placeholder} className="input" style={{ ...inputStyle, resize: "vertical" }} />;
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
    <form action={action} className="glass fiscal-form-card">
      <p className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</p>
      <h3 style={formTitleStyle}>{title}</h3>
      <div style={formGridStyle}>{children}</div>
      <button className="btn btn-gold" style={{ marginTop: 14, padding: "10px 18px", fontSize: 10 }}>
        {buttonLabel}
      </button>
    </form>
  );
}

export function FiscalDocumentForm() {
  return (
    <FormShell eyebrow="Documentos fiscais" title="Cadastrar documento" action={createManualFiscalDocument} buttonLabel="Salvar documento">
      <Field label="Tipo"><GlassSelect name="document_type" options={documentTypes} defaultValue="nfe_sale" inlineMenu /></Field>
      <Field label="Direção"><GlassSelect name="direction" options={directionOptions} defaultValue="out" inlineMenu /></Field>
      <Field label="Status"><GlassSelect name="status" options={documentStatuses} defaultValue="draft" inlineMenu /></Field>
      <Field label="Ambiente"><GlassSelect name="environment" options={environmentOptions} defaultValue="homologacao" inlineMenu /></Field>
      <Field label="Número"><TextInput name="number" placeholder="000123" /></Field>
      <Field label="Série"><TextInput name="series" placeholder="1" /></Field>
      <Field label="Chave de acesso"><TextInput name="access_key" placeholder="44 dígitos, quando houver" /></Field>
      <Field label="Protocolo"><TextInput name="protocol" placeholder="Protocolo SEFAZ" /></Field>
      <Field label="Cliente ou fornecedor"><TextInput name="party_name" placeholder="Nome vinculado ao documento" /></Field>
      <Field label="CPF ou CNPJ"><TextInput name="party_document" placeholder="Documento fiscal" /></Field>
      <Field label="Competência"><TextInput name="competence" placeholder="2026-07" /></Field>
      <Field label="Vencimento"><GlassDateInput name="due_date" placeholder="Opcional" inlinePopover /></Field>
      <Field label="Valor total"><TextInput name="total" placeholder="0,00" /></Field>
      <Field label="Tributos"><TextInput name="tax_total" placeholder="0,00" /></Field>
      <Field label="Pagamento"><GlassSelect name="payment_status" options={paymentStatuses} defaultValue="open" inlineMenu /></Field>
      <Field label="Verificação"><GlassSelect name="verification_status" options={verificationStatuses} defaultValue="pending" inlineMenu /></Field>
      <Field label="Origem"><TextInput name="origin" placeholder="manual, pedido, contador, SEFAZ..." /></Field>
      <Field label="Canal"><TextInput name="source_channel" placeholder="site, marketplace, loja..." /></Field>
      <Field label="Tags"><TextInput name="tags" placeholder="fiscal, entrada, revisão" /></Field>
      <Field label="Observações"><TextArea name="notes" placeholder="Motivo, pendência, procedimento recomendado..." /></Field>
    </FormShell>
  );
}

export function FiscalGuideForm() {
  return (
    <FormShell eyebrow="Guias e pagamentos" title="Cadastrar guia" action={createFiscalGuide} buttonLabel="Salvar guia">
      <Field label="Tipo de guia"><GlassSelect name="guide_type" options={guideTypes} defaultValue="darf_dctfweb" inlineMenu /></Field>
      <Field label="Documento"><TextInput name="document_name" required placeholder="DARF DCTFWeb 07/2026" /></Field>
      <Field label="Competência"><TextInput name="competence" placeholder="2026-07" /></Field>
      <Field label="Vencimento"><GlassDateInput name="due_date" placeholder="Selecionar" inlinePopover /></Field>
      <Field label="Valor original"><TextInput name="original" placeholder="0,00" /></Field>
      <Field label="Juros"><TextInput name="interest" placeholder="0,00" /></Field>
      <Field label="Multa"><TextInput name="penalty" placeholder="0,00" /></Field>
      <Field label="Valor atualizado"><TextInput name="updated" placeholder="0,00" /></Field>
      <Field label="Pagamento"><GlassSelect name="payment_status" options={paymentStatuses} defaultValue="open" inlineMenu /></Field>
      <Field label="Verificação"><GlassSelect name="verification_status" options={verificationStatuses} defaultValue="pending" inlineMenu /></Field>
      <Field label="Código de barras"><TextInput name="barcode" placeholder="Quando retornado pelo órgão" /></Field>
      <Field label="Linha digitável"><TextInput name="digitable_line" placeholder="Linha oficial" /></Field>
      <Field label="QR Code"><TextInput name="qr_code" placeholder="Texto ou URL do QR Code" /></Field>
      <Field label="Identificador"><TextInput name="official_identifier" placeholder="Número oficial" /></Field>
      <Field label="Observações"><TextArea name="notes" placeholder="Fonte, regra, vínculo contábil..." /></Field>
    </FormShell>
  );
}

export function GuidePaymentForm({ guideId }: { guideId: string }) {
  return (
    <form action={registerFiscalGuidePayment.bind(null, guideId)} style={{ display: "grid", gap: 8, minWidth: 220 }}>
      <GlassSelect name="payment_status" options={paymentStatuses} defaultValue="paid" inlineMenu />
      <GlassDateInput name="payment_date" placeholder="Data do pagamento" inlinePopover />
      <input name="paid" placeholder="Valor pago" className="input" style={inputStyle} />
      <input name="bank_account" placeholder="Banco ou conta" className="input" style={inputStyle} />
      <input name="payment_method" placeholder="PIX, boleto, débito..." className="input" style={inputStyle} />
      <input name="receipt_path" placeholder="Comprovante no cofre" className="input" style={inputStyle} />
      <button className="btn btn-gold" style={{ padding: "8px 12px", fontSize: 9 }}>Registrar pagamento</button>
    </form>
  );
}

export function FiscalObligationForm() {
  return (
    <FormShell eyebrow="Agenda fiscal" title="Cadastrar obrigação" action={createFiscalObligation} buttonLabel="Criar obrigação">
      <Field label="Obrigação"><TextInput name="name" required placeholder="DCTFWeb mensal" /></Field>
      <Field label="Tipo"><GlassSelect name="obligation_type" options={obligationTypes} defaultValue="dctfweb" inlineMenu /></Field>
      <Field label="Competência"><TextInput name="competence" placeholder="2026-07" /></Field>
      <Field label="Vencimento"><GlassDateInput name="due_date" placeholder="Selecionar" inlinePopover /></Field>
      <Field label="Empresa"><TextInput name="company_label" placeholder="Flora Botanics" /></Field>
      <Field label="Estabelecimento"><TextInput name="establishment" placeholder="Matriz, filial..." /></Field>
      <Field label="Recorrência"><TextInput name="recurrence" placeholder="mensal, anual..." /></Field>
      <Field label="Status"><GlassSelect name="status" options={statusOptions} defaultValue="open" inlineMenu /></Field>
      <Field label="Prioridade"><GlassSelect name="priority" options={priorityOptions} defaultValue="normal" inlineMenu /></Field>
      <Field label="Regime"><TextInput name="tax_regime" placeholder="Simples, presumido..." /></Field>
      <Field label="Estado"><TextInput name="state_scope" placeholder="SP, MG..." /></Field>
      <Field label="Dependências"><TextInput name="dependencies" placeholder="eSocial, Reinf, MIT" /></Field>
      <Field label="Documentos exigidos"><TextInput name="documents" placeholder="recibo, DARF, comprovante" /></Field>
      <Field label="Observações"><TextArea name="notes" placeholder="Prazos, riscos e etapa atual." /></Field>
    </FormShell>
  );
}

export function FiscalVaultForm() {
  return (
    <FormShell eyebrow="Cofre fiscal" title="Arquivar documento" action={createFiscalVaultDocument} buttonLabel="Guardar no cofre">
      <Field label="Nome"><TextInput name="name" required placeholder="DANFE NF-e 123" /></Field>
      <Field label="Tipo"><TextInput name="document_type" required placeholder="XML, DANFE, DARF, contrato..." /></Field>
      <Field label="Categoria"><TextInput name="category" placeholder="Nota, guia, comprovante..." /></Field>
      <Field label="Departamento"><GlassSelect name="department" options={departments} defaultValue="fiscal" inlineMenu /></Field>
      <Field label="Competência"><TextInput name="competence" placeholder="2026-07" /></Field>
      <Field label="Emissão"><GlassDateInput name="issued_at" placeholder="Data de emissão" inlinePopover /></Field>
      <Field label="Vencimento"><GlassDateInput name="due_date" placeholder="Opcional" inlinePopover /></Field>
      <Field label="Valor"><TextInput name="value" placeholder="0,00" /></Field>
      <Field label="CNPJ"><TextInput name="cnpj" placeholder="CNPJ vinculado" /></Field>
      <Field label="CPF"><TextInput name="cpf" placeholder="CPF vinculado" /></Field>
      <Field label="Chave"><TextInput name="access_key" placeholder="Chave fiscal" /></Field>
      <Field label="Número"><TextInput name="number" placeholder="Número" /></Field>
      <Field label="Série"><TextInput name="series" placeholder="Série" /></Field>
      <Field label="Origem"><TextInput name="origin" placeholder="upload, contador, órgão..." /></Field>
      <Field label="Status"><GlassSelect name="status" options={statusOptions} defaultValue="open" inlineMenu /></Field>
      <Field label="Caminho privado"><TextInput name="storage_path" placeholder="storage privado ou referência" /></Field>
      <Field label="Tags"><TextInput name="tags" placeholder="DCTFWeb, julho, pago" /></Field>
      <Field label="Observações"><TextArea name="notes" placeholder="Relações, retenção e conferência." /></Field>
    </FormShell>
  );
}

export function FiscalEventForm({ documents }: { documents: GlassSelectOption[] }) {
  return (
    <FormShell eyebrow="Eventos fiscais" title="Registrar evento" action={createFiscalDocumentEvent} buttonLabel="Criar evento">
      <Field label="Documento">
        <GlassSelect name="document_id" options={[{ value: "", label: "Sem documento específico" }, ...documents]} defaultValue="" inlineMenu />
      </Field>
      <Field label="Evento"><GlassSelect name="event_type" options={eventTypes} defaultValue="correction_letter" inlineMenu /></Field>
      <Field label="Status"><GlassSelect name="status" options={documentStatuses} defaultValue="draft" inlineMenu /></Field>
      <Field label="Faixa inicial"><TextInput name="range_start" placeholder="Para inutilização" /></Field>
      <Field label="Faixa final"><TextInput name="range_end" placeholder="Para inutilização" /></Field>
      <Field label="Correção"><TextArea name="correction" placeholder="Texto da carta ou orientação do evento." /></Field>
      <Field label="Justificativa"><TextArea name="justification" required placeholder="Justificativa obrigatória para auditoria." /></Field>
    </FormShell>
  );
}

export function AccountantRequestForm() {
  return (
    <FormShell eyebrow="Central do Contador" title="Criar solicitação" action={createAccountantRequest} buttonLabel="Enviar solicitação">
      <Field label="Título"><TextInput name="title" required placeholder="Solicitar comprovante do DARF" /></Field>
      <Field label="Tipo"><TextInput name="request_type" placeholder="documento, aprovação, correção..." /></Field>
      <Field label="Competência"><TextInput name="competence" placeholder="2026-07" /></Field>
      <Field label="Prazo"><GlassDateInput name="due_date" placeholder="Selecionar" inlinePopover /></Field>
      <Field label="Prioridade"><GlassSelect name="priority" options={priorityOptions} defaultValue="normal" inlineMenu /></Field>
      <Field label="Status"><GlassSelect name="status" options={statusOptions} defaultValue="open" inlineMenu /></Field>
      <Field label="Departamento"><GlassSelect name="department" options={departments} defaultValue="fiscal" inlineMenu /></Field>
      <Field label="Descrição"><TextArea name="description" placeholder="Explique o documento, prazo e evidência esperada." /></Field>
    </FormShell>
  );
}

export function AccountantProfileForm() {
  return (
    <FormShell eyebrow="Escritório contábil" title="Dados do contador" action={upsertAccountantProfile} buttonLabel="Salvar contador">
      <Field label="Escritório"><TextInput name="office_name" placeholder="Nome do escritório" /></Field>
      <Field label="Razão social"><TextInput name="legal_name" placeholder="Razão social" /></Field>
      <Field label="CNPJ"><TextInput name="cnpj" placeholder="00.000.000/0001-00" /></Field>
      <Field label="Contato principal"><TextInput name="main_contact" placeholder="Responsável" /></Field>
      <Field label="Contato fiscal"><TextInput name="fiscal_contact" placeholder="Fiscal" /></Field>
      <Field label="Contato contábil"><TextInput name="accounting_contact" placeholder="Contábil" /></Field>
      <Field label="Departamento Pessoal"><TextInput name="payroll_contact" placeholder="Folha" /></Field>
      <Field label="Financeiro"><TextInput name="financial_contact" placeholder="Financeiro" /></Field>
      <Field label="Telefone"><TextInput name="phone" placeholder="(00) 00000-0000" /></Field>
      <Field label="E-mail"><TextInput name="email" placeholder="contador@empresa.com.br" /></Field>
      <Field label="Horário"><TextInput name="business_hours" placeholder="Segunda a sexta, 9h às 18h" /></Field>
      <Field label="Endereço"><TextInput name="address" placeholder="Endereço do escritório" /></Field>
      <Field label="Serviços"><TextInput name="services" placeholder="fiscal, contábil, folha..." /></Field>
      <Field label="SLA resposta"><TextInput name="sla_response_hours" placeholder="24" /></Field>
      <Field label="SLA aprovação"><TextInput name="sla_approval_hours" placeholder="48" /></Field>
      <Field label="Dia de fechamento"><TextInput name="monthly_close_day" placeholder="5" /></Field>
      <Field label="Portal do contador"><TextInput name="accountant_portal" placeholder="URL ou observação" /></Field>
      <Field label="Emergência"><TextInput name="emergency_contact" placeholder="Contato urgente" /></Field>
    </FormShell>
  );
}

export function FiscalCertificateForm() {
  return (
    <FormShell eyebrow="Certificados" title="Cadastrar certificado" action={createFiscalCertificate} buttonLabel="Salvar certificado">
      <Field label="Titular"><TextInput name="holder_name" required placeholder="Flora Botanics" /></Field>
      <Field label="CPF ou CNPJ"><TextInput name="holder_document" placeholder="Documento do titular" /></Field>
      <Field label="Tipo"><GlassSelect name="certificate_type" options={[{ value: "A1", label: "A1" }, { value: "A3", label: "A3" }]} defaultValue="A1" inlineMenu /></Field>
      <Field label="Emissor"><TextInput name="issuer" placeholder="Autoridade certificadora" /></Field>
      <Field label="Número de série"><TextInput name="serial_number" placeholder="Série do certificado" /></Field>
      <Field label="Validade"><GlassDateInput name="valid_until" placeholder="Data de validade" inlinePopover /></Field>
      <Field label="Ambiente"><GlassSelect name="environment" options={environmentOptions} defaultValue="homologacao" inlineMenu /></Field>
      <Field label="Status"><GlassSelect name="status" options={[{ value: "pending", label: "Pendente" }, { value: "active", label: "Ativo" }, { value: "expiring", label: "Vencendo" }, { value: "expired", label: "Vencido" }, { value: "revoked", label: "Revogado" }]} defaultValue="pending" inlineMenu /></Field>
      <Field label="Empresa vinculada"><TextInput name="company_label" placeholder="Matriz, filial..." /></Field>
      <Field label="Referência segura"><TextInput name="secure_secret_ref" placeholder="SEFAZ_CERTIFICATE_PFX" /></Field>
      <Field label="Observações"><TextArea name="notes" placeholder="Nunca cole senha ou certificado aqui." /></Field>
    </FormShell>
  );
}

export function FiscalProductRuleForm() {
  return (
    <FormShell eyebrow="Cadastros fiscais" title="Regra fiscal de produto" action={createFiscalProductRule} buttonLabel="Salvar regra">
      <Field label="Escopo"><GlassSelect name="scope" options={[{ value: "product", label: "Produto" }, { value: "variant", label: "Variação" }, { value: "kit", label: "Kit" }, { value: "combo", label: "Combo" }, { value: "default", label: "Padrão" }]} defaultValue="product" inlineMenu /></Field>
      <Field label="NCM"><TextInput name="ncm" placeholder="3304.99.90" /></Field>
      <Field label="CEST"><TextInput name="cest" placeholder="Quando aplicável" /></Field>
      <Field label="Origem"><TextInput name="origin_code" placeholder="0, 1, 2..." /></Field>
      <Field label="Unidade comercial"><TextInput name="commercial_unit" placeholder="UN" /></Field>
      <Field label="Unidade tributável"><TextInput name="taxable_unit" placeholder="UN" /></Field>
      <Field label="GTIN/EAN"><TextInput name="gtin" placeholder="Código de barras" /></Field>
      <Field label="CFOP entrada"><TextInput name="cfop_in" placeholder="1102" /></Field>
      <Field label="CFOP saída"><TextInput name="cfop_out" placeholder="5102" /></Field>
      <Field label="CFOP interestadual"><TextInput name="cfop_interstate" placeholder="6102" /></Field>
      <Field label="CST"><TextInput name="cst" placeholder="CST" /></Field>
      <Field label="CSOSN"><TextInput name="csosn" placeholder="CSOSN" /></Field>
      <Field label="Enquadramento IPI"><TextInput name="ipi_code" placeholder="Código IPI" /></Field>
      <Field label="ICMS %"><TextInput name="icms_percent" placeholder="0,00" /></Field>
      <Field label="IPI %"><TextInput name="ipi_percent" placeholder="0,00" /></Field>
      <Field label="PIS %"><TextInput name="pis_percent" placeholder="0,00" /></Field>
      <Field label="COFINS %"><TextInput name="cofins_percent" placeholder="0,00" /></Field>
      <Field label="FCP %"><TextInput name="fcp_percent" placeholder="0,00" /></Field>
      <Field label="Redução de base %"><TextInput name="base_reduction_percent" placeholder="0,00" /></Field>
      <Field label="Benefício fiscal"><TextInput name="fiscal_benefit" placeholder="Fundamento ou benefício" /></Field>
      <Field label="Estado"><TextInput name="state_scope" placeholder="SP, RJ, nacional..." /></Field>
      <Field label="Regime"><TextInput name="tax_regime" placeholder="Simples, presumido..." /></Field>
      <Field label="Vigência inicial"><GlassDateInput name="effective_from" placeholder="Início" inlinePopover /></Field>
      <Field label="Vigência final"><GlassDateInput name="effective_until" placeholder="Fim" inlinePopover /></Field>
      <Field label="Observações"><TextArea name="notes" placeholder="Regra, exceção, contador responsável." /></Field>
    </FormShell>
  );
}

export function FiscalAssessmentForm() {
  return (
    <FormShell eyebrow="Apuração" title="Preparar apuração" action={createFiscalAssessment} buttonLabel="Salvar apuração">
      <Field label="Tipo"><GlassSelect name="assessment_type" options={[{ value: "dctfweb", label: "DCTFWeb" }, { value: "mit", label: "MIT" }, { value: "efd_reinf", label: "EFD-Reinf" }, { value: "esocial", label: "eSocial" }, { value: "monthly_tax", label: "Apuração mensal" }]} defaultValue="dctfweb" inlineMenu /></Field>
      <Field label="Competência"><TextInput name="competence" required placeholder="2026-07" /></Field>
      <Field label="Estabelecimento"><TextInput name="establishment" placeholder="Matriz" /></Field>
      <Field label="Status"><GlassSelect name="status" options={statusOptions} defaultValue="not_started" inlineMenu /></Field>
      <Field label="eSocial"><TextInput name="esocial_status" placeholder="fechado, pendente..." /></Field>
      <Field label="EFD-Reinf"><TextInput name="reinf_status" placeholder="fechada, aberta..." /></Field>
      <Field label="MIT"><TextInput name="mit_status" placeholder="validado, pendente..." /></Field>
      <Field label="Débitos"><TextInput name="debit" placeholder="0,00" /></Field>
      <Field label="Créditos"><TextInput name="credit" placeholder="0,00" /></Field>
      <Field label="Compensações"><TextInput name="compensation" placeholder="0,00" /></Field>
      <Field label="Saldo"><TextInput name="balance" placeholder="0,00" /></Field>
      <Field label="Observações"><TextArea name="notes" placeholder="Origem, divergência, recibos e próximos passos." /></Field>
    </FormShell>
  );
}

export function MonthlyClosingForm() {
  return (
    <FormShell eyebrow="Fechamento mensal" title="Abrir ou atualizar competência" action={createMonthlyClosing} buttonLabel="Salvar fechamento">
      <Field label="Competência"><TextInput name="competence" required placeholder="2026-07" /></Field>
      <Field label="Status"><GlassSelect name="status" options={statusOptions} defaultValue="open" inlineMenu /></Field>
      <Field label="Progresso %"><TextInput name="progress_percent" placeholder="0" /></Field>
      <Field label="Documentos faltantes"><TextInput name="missing_documents" placeholder="extrato, comprovante..." /></Field>
      <Field label="Bloqueios"><TextInput name="blockers" placeholder="contador, banco, guia..." /></Field>
    </FormShell>
  );
}

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
  minHeight: 42,
};

const formTitleStyle: CSSProperties = {
  color: "var(--cream)",
  fontSize: 20,
  lineHeight: 1.15,
  margin: 0,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 16,
};
