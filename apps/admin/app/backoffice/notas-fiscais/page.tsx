import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { money } from "@/lib/format";
import { FISCAL_GOVERNMENT_PROVIDERS } from "@/lib/fiscal/government-providers";
import { createDraftNfe, cancelNfeDraft } from "./actions";
import { FiscalGovernmentPanel } from "./FiscalGovernmentPanel";
import { InternationalTradeCenter } from "./InternationalTradeCenter";
import {
  AccountantProfileForm,
  AccountantRequestForm,
  FiscalAssessmentForm,
  FiscalCertificateForm,
  FiscalDocumentForm,
  FiscalEventForm,
  FiscalGuideForm,
  FiscalObligationForm,
  FiscalProductRuleForm,
  FiscalVaultForm,
  GuidePaymentForm,
  MonthlyClosingForm,
} from "./FiscalForms";
import { VaultDocumentActions } from "./VaultDocumentActions";

const NFE_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviando: "Enviando",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  inutilizada: "Inutilizada",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  validating: "Em validação",
  ready_to_transmit: "Pronta para transmissão",
  transmitting: "Transmitindo",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  denied: "Denegada",
  cancelled: "Cancelada",
  voided: "Inutilizada",
  corrected: "Corrigida",
  divergent: "Divergente",
  open: "Em aberto",
  scheduled: "Programada",
  near_due: "Próxima do vencimento",
  overdue: "Vencida",
  partial: "Parcialmente paga",
  paid: "Paga",
  compensated: "Compensada",
  pending: "Pendente",
  review: "Em análise",
  verified: "Verificado",
  verified_with_notes: "Verificado com ressalvas",
  not_started: "Não iniciada",
  waiting_accounting: "Aguardando escrituração",
  in_progress: "Em andamento",
  transmitted: "Transmitida",
  with_pending_items: "Com pendências",
  archived: "Arquivada",
  queued: "Na fila",
  failed: "Falhou",
  dead: "Morta",
  succeeded: "Concluída",
  processing: "Processando",
  active: "Ativo",
  expiring: "Vencendo",
  expired: "Vencido",
  received: "Recebido",
  not_applicable: "Não se aplica",
  unclassified: "Sem classificação",
  unpaid: "Não pago",
  waiting_approval: "Aguardando aprovação",
  approved_for_payment: "Aprovado para pagamento",
  due_today: "Vence hoje",
  paid_with_interest: "Paga com juros",
  paid_with_discount: "Paga com desconto",
  installment: "Parcelada",
  suspended: "Suspensa",
  disputed: "Contestada",
  reversed: "Estornada",
  refunded: "Reembolsada",
  reconciled: "Conciliada",
  waiting_receipt: "Aguardando comprovante",
  receipt_review: "Comprovante em verificação",
  missing: "Sem comprovante",
  sent: "Comprovante enviado",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  nfe_sale: "NF-e de venda",
  nfe_entry: "NF-e de entrada",
  nfe_return: "NF-e de devolução",
  nfe_complement: "NF-e complementar",
  nfe_adjustment: "NF-e de ajuste",
  nfe_shipment: "NF-e de remessa",
  nfce: "NFC-e",
  nfse: "NFS-e",
  import_document: "Importação",
  other: "Outro",
};

const GUIDE_TYPE_LABELS: Record<string, string> = {
  darf: "DARF",
  darf_dctfweb: "DARF DCTFWeb",
  das: "DAS",
  fgts: "FGTS",
  inss: "INSS",
  icms: "ICMS",
  icms_st: "ICMS-ST",
  difal: "DIFAL",
  fcp: "FCP",
  ipi: "IPI",
  pis: "PIS",
  cofins: "COFINS",
  irpj: "IRPJ",
  csll: "CSLL",
  iss: "ISS",
  payroll: "Folha e pró-labore",
  other: "Outra guia",
};

const SUBSECTIONS = [
  ["Visão geral", "#visao-geral"],
  ["Conexão Governo", "#governo"],
  ["Comércio Exterior", "#comercio-exterior"],
  ["Documentos fiscais", "#documentos"],
  ["Emissão de NF-e", "#emissao"],
  ["Pedidos sem nota", "#pedidos-sem-nota"],
  ["Eventos fiscais", "#eventos"],
  ["Rejeições SEFAZ", "#rejeicoes"],
  ["Cadastros fiscais", "#cadastros"],
  ["Apuração de tributos", "#apuracao"],
  ["DCTFWeb", "#apuracao"],
  ["MIT", "#apuracao"],
  ["EFD-Reinf", "#apuracao"],
  ["eSocial", "#apuracao"],
  ["Guias e pagamentos", "#guias"],
  ["Agenda fiscal", "#agenda"],
  ["Certificados digitais", "#certificados"],
  ["Cofre fiscal", "#cofre"],
  ["Central do Contador", "#contador"],
  ["Aprovações", "#aprovacoes"],
  ["Filas", "#filas"],
  ["Auditoria", "#auditoria"],
  ["Relatórios", "#relatorios"],
  ["Integrações", "#integracoes"],
] as const;

const ELIGIBLE_STATUSES = ["paid", "processing", "shipped", "delivered"];

function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return money(Number(cents));
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function label(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return "—";
  return map[value] ?? value;
}

function statusTone(status: string | null | undefined) {
  if (!status) return "draft";
  if (["authorized", "autorizada", "paid", "verified", "transmitted", "succeeded", "active"].includes(status)) return "ok";
  if (["rejected", "rejeitada", "cancelled", "cancelada", "overdue", "expired", "failed", "dead", "divergent"].includes(status)) return "danger";
  if (["near_due", "with_pending_items", "expiring", "pending", "review", "queued"].includes(status)) return "warn";
  return "draft";
}

function StatusChip({ status }: { status: string | null | undefined }) {
  const tone = statusTone(status);
  return <span className={`fiscal-chip fiscal-chip-${tone}`}>{label(STATUS_LABELS, status)}</span>;
}

function adminApiPath(path: string) {
  const base = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH?.replace(/\/+$/, "");
  return `${base || "/admin"}${path}`;
}

function FileLink({ path, children }: { path: string | null | undefined; children: ReactNode }) {
  if (!path) return null;
  return (
    <a
      href={adminApiPath(`/api/fiscal-files?path=${encodeURIComponent(path)}`)}
      target="_blank"
      rel="noreferrer"
      className="fiscal-file-link"
    >
      {children}
    </a>
  );
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 7 }}>{eyebrow}</p>
        <h2 className="display" style={{ fontSize: 30, lineHeight: 1.05 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Kpi({ label: title, value, note, tone = "neutral" }: { label: string; value: string; note: string; tone?: "neutral" | "warn" | "danger" | "ok" }) {
  return (
    <article className={`glass fiscal-kpi fiscal-kpi-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function EmptyState({ title, action }: { title: string; action: string }) {
  return (
    <div style={emptyStateStyle}>
      <strong>{title}</strong>
      <span>{action}</span>
    </div>
  );
}

type FiscalConfigRow = {
  cnpj: string;
  ambiente: string;
  serie_nfe: number;
  proximo_numero_nfe: number;
  certificado_nome: string | null;
  certificado_valido_at: string | null;
};

type NfeRow = {
  id: string;
  order_id: string | null;
  numero: number | null;
  serie: number | null;
  ambiente: string;
  status: string;
  valor_total_cents: number | null;
  emitida_at: string | null;
  created_at: string;
  orders: { number: string } | null;
};

type OrderRow = {
  id: string;
  number: string;
  total_cents: number;
  placed_at: string | null;
  created_at: string;
};

type FiscalDocumentRow = {
  id: string;
  document_type: string;
  direction: string;
  number: string | null;
  series: string | null;
  access_key: string | null;
  party_name: string | null;
  party_document: string | null;
  competence: string | null;
  due_date: string | null;
  total_cents: number;
  tax_total_cents: number;
  status: string;
  payment_status: string;
  verification_status: string;
  origin: string;
  updated_at: string;
};

type FiscalGuideRow = {
  id: string;
  guide_type: string;
  document_name: string;
  competence: string | null;
  due_date: string | null;
  original_cents: number;
  updated_cents: number;
  paid_cents: number;
  payment_status: string;
  verification_status: string;
  digitable_line: string | null;
  barcode: string | null;
  guide_path: string | null;
  receipt_path: string | null;
};

type FiscalObligationRow = {
  id: string;
  name: string;
  obligation_type: string;
  competence: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  company_label: string | null;
};

type VaultRow = {
  id: string;
  name: string;
  document_type: string;
  category: string | null;
  department: string | null;
  competence: string | null;
  due_date: string | null;
  value_cents: number;
  status: string;
  verification_status: string;
  visibility_status: string;
  origin: string;
  storage_path: string | null;
  financial_control_id: string | null;
  archived_at: string | null;
  favorite: boolean | null;
};

type VaultControlRow = {
  source_id: string | null;
  payment_status: string;
  paid_cents: number;
  remaining_cents: number;
  due_date: string | null;
  proof_status: string;
};

type EventRow = {
  id: string;
  event_type: string;
  status: string;
  justification: string;
  protocol: string | null;
  created_at: string;
};

type RejectionRow = {
  id: string;
  code: string | null;
  message: string;
  step: string | null;
  probable_cause: string | null;
  recommendation: string | null;
  attempts: number;
  status: string;
};

type CertificateRow = {
  id: string;
  holder_name: string;
  certificate_type: string;
  environment: string;
  status: string;
  valid_until: string | null;
  secure_secret_ref: string | null;
};

type AssessmentRow = {
  id: string;
  assessment_type: string;
  competence: string;
  status: string;
  debit_cents: number;
  credit_cents: number;
  compensation_cents: number;
  balance_cents: number;
  source_summary: Record<string, string | null>;
};

type QueueRow = {
  id: string;
  job_type: string;
  entity_type: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
};

type AccountantRequestRow = {
  id: string;
  title: string;
  request_type: string;
  competence: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  department: string | null;
};

type AccountantProfileRow = {
  office_name: string | null;
  main_contact: string | null;
  email: string | null;
  phone: string | null;
  business_hours: string | null;
};

type ClosingRow = {
  id: string;
  competence: string;
  status: string;
  progress_percent: number;
  missing_documents: string[] | null;
  blockers: string[] | null;
};

type IntegrationRow = {
  provider_key: string;
  display_name: string | null;
  environment: string;
  status: string;
  credentials_status: string;
  credentials_ref: string | null;
  settings: Record<string, unknown> | null;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_error: string | null;
};

export default async function NotasFiscaisPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const [
    fiscalRes,
    nfeRes,
    ordersRes,
    fiscalDocsRes,
    guidesRes,
    obligationsRes,
    vaultRes,
    eventsRes,
    rejectionsRes,
    certificatesRes,
    assessmentsRes,
    queueRes,
    accountantRequestsRes,
    accountantProfileRes,
    closingsRes,
    integrationsRes,
  ] = await Promise.all([
    supabase
      .from("fiscal_configs")
      .select("cnpj, ambiente, serie_nfe, proximo_numero_nfe, certificado_nome, certificado_valido_at")
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
    supabase
      .from("nfe_documents")
      .select("id, order_id, numero, serie, ambiente, status, valor_total_cents, emitida_at, created_at, orders(number)")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("orders")
      .select("id, number, total_cents, placed_at, created_at")
      .eq("tenant_id", staff.tenantId)
      .in("status", ELIGIBLE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("fiscal_documents")
      .select("id, document_type, direction, number, series, access_key, party_name, party_document, competence, due_date, total_cents, tax_total_cents, status, payment_status, verification_status, origin, updated_at")
      .eq("tenant_id", staff.tenantId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("fiscal_guides")
      .select("id, guide_type, document_name, competence, due_date, original_cents, updated_cents, paid_cents, payment_status, verification_status, digitable_line, barcode, guide_path, receipt_path")
      .eq("tenant_id", staff.tenantId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(80),
    supabase
      .from("fiscal_obligations")
      .select("id, name, obligation_type, competence, due_date, status, priority, company_label")
      .eq("tenant_id", staff.tenantId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(80),
    supabase
      .from("fiscal_vault_documents")
      .select("id, name, document_type, category, department, competence, due_date, value_cents, status, verification_status, visibility_status, origin, storage_path, financial_control_id, archived_at, favorite")
      .eq("tenant_id", staff.tenantId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("fiscal_document_events")
      .select("id, event_type, status, justification, protocol, created_at")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("fiscal_rejections")
      .select("id, code, message, step, probable_cause, recommendation, attempts, status")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("fiscal_certificates")
      .select("id, holder_name, certificate_type, environment, status, valid_until, secure_secret_ref")
      .eq("tenant_id", staff.tenantId)
      .order("valid_until", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("fiscal_tax_assessments")
      .select("id, assessment_type, competence, status, debit_cents, credit_cents, compensation_cents, balance_cents, source_summary")
      .eq("tenant_id", staff.tenantId)
      .order("competence", { ascending: false })
      .limit(60),
    supabase
      .from("fiscal_queue_jobs")
      .select("id, job_type, entity_type, status, attempts, max_attempts, next_attempt_at, last_error")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("accountant_requests")
      .select("id, title, request_type, competence, due_date, priority, status, department")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("accountant_profiles")
      .select("office_name, main_contact, email, phone, business_hours")
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
    supabase
      .from("fiscal_monthly_closings")
      .select("id, competence, status, progress_percent, missing_documents, blockers")
      .eq("tenant_id", staff.tenantId)
      .order("competence", { ascending: false })
      .limit(24),
    supabase
      .from("integration_connections")
      .select("provider_key, display_name, environment, status, credentials_status, credentials_ref, settings, auto_sync_enabled, sync_interval_minutes, last_sync_at, last_error")
      .eq("tenant_id", staff.tenantId)
      .in("provider_key", FISCAL_GOVERNMENT_PROVIDERS.map((provider) => provider.key))
      .limit(20),
  ]);

  const fiscal = fiscalRes.data as FiscalConfigRow | null;
  const nfes = (nfeRes.data ?? []) as unknown as NfeRow[];
  const orders = (ordersRes.data ?? []) as OrderRow[];
  const migrationPending = Boolean(fiscalDocsRes.error || guidesRes.error || obligationsRes.error || vaultRes.error);
  const fiscalDocs = (fiscalDocsRes.data ?? []) as unknown as FiscalDocumentRow[];
  const guides = (guidesRes.data ?? []) as unknown as FiscalGuideRow[];
  const obligations = (obligationsRes.data ?? []) as unknown as FiscalObligationRow[];
  const vaultDocs = (vaultRes.data ?? []) as unknown as VaultRow[];
  const events = (eventsRes.data ?? []) as unknown as EventRow[];
  const rejections = (rejectionsRes.data ?? []) as unknown as RejectionRow[];
  const certificates = (certificatesRes.data ?? []) as unknown as CertificateRow[];
  const assessments = (assessmentsRes.data ?? []) as unknown as AssessmentRow[];
  const queue = (queueRes.data ?? []) as unknown as QueueRow[];
  const accountantRequests = (accountantRequestsRes.data ?? []) as unknown as AccountantRequestRow[];
  const accountant = accountantProfileRes.data as AccountantProfileRow | null;
  const closings = (closingsRes.data ?? []) as unknown as ClosingRow[];
  const integrations = (integrationsRes.data ?? []) as unknown as IntegrationRow[];
  const vaultControlRes = vaultDocs.length
    ? await supabase
        .from("document_financial_controls")
        .select("source_id, payment_status, paid_cents, remaining_cents, due_date, proof_status")
        .eq("tenant_id", staff.tenantId)
        .eq("source_table", "fiscal_vault_documents")
        .in("source_id", vaultDocs.map((doc) => doc.id))
    : { data: [] };
  const vaultControls = new Map(
    ((vaultControlRes.data ?? []) as unknown as VaultControlRow[])
      .filter((control) => control.source_id)
      .map((control) => [control.source_id as string, control])
  );

  const ordersWithNfe = new Set(nfes.map((n) => n.order_id).filter(Boolean));
  const pendingOrders = orders.filter((o) => !ordersWithNfe.has(o.id));
  const docsForSelect = fiscalDocs.map((doc) => ({
    value: doc.id,
    label: `${label(DOC_TYPE_LABELS, doc.document_type)} ${doc.number ?? "sem número"} - ${doc.party_name ?? "sem parte"}`,
  }));
  const authorizedDocs = fiscalDocs.filter((doc) => ["authorized", "autorizada"].includes(doc.status)).length + nfes.filter((n) => n.status === "autorizada").length;
  const rejectedDocs = fiscalDocs.filter((doc) => ["rejected", "divergent"].includes(doc.status)).length + nfes.filter((n) => n.status === "rejeitada").length;
  const openGuides = guides.filter((guide) => ["open", "scheduled", "near_due", "overdue", "partial"].includes(guide.payment_status));
  const overdueGuides = guides.filter((guide) => guide.payment_status === "overdue");
  const totalTax = guides.reduce((sum, guide) => sum + Number(guide.updated_cents ?? 0), 0);
  const openRequests = accountantRequests.filter((item) => !["closed", "archived", "paid"].includes(item.status));
  const queueProblems = queue.filter((job) => ["failed", "dead"].includes(job.status));

  return (
    <div style={pageStyle}>
      <header>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Centro fiscal, tributário e documental</p>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="display" style={{ fontSize: 46, lineHeight: 1 }}>Fiscal e Tributário</h1>
            <p className="muted" style={{ marginTop: 10, maxWidth: 780, lineHeight: 1.7 }}>
              NF-e, eventos, apurações, DCTFWeb, MIT, EFD-Reinf, eSocial, guias, cofre fiscal,
              pagamentos, contador, auditoria e filas operacionais em uma única área.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/backoffice/config" className="btn btn-ghost" style={topButtonStyle}>Config fiscal</Link>
            <Link href="/config/integracoes#integration_sefaz" className="btn btn-ghost" style={topButtonStyle}>SEFAZ</Link>
            <Link href="/backoffice/notas-fiscais/exportar?format=pdf" className="btn btn-gold" style={topButtonStyle}>Exportar PDF</Link>
          </div>
        </div>
      </header>

      {migrationPending ? (
        <section className="glass" style={{ ...noticeStyle, borderColor: "rgba(232,160,160,0.45)" }}>
          <p className="eyebrow" style={{ color: "#e8a0a0", marginBottom: 8 }}>Migration pendente</p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Aplique `supabase/migrations/20260729003359_fiscal_tax_center_foundation.sql` no Supabase para liberar guias,
            cofre, contador, obrigações e apurações. A tela antiga de NF-e continua funcionando, mas o centro completo depende dessa migration.
          </p>
        </section>
      ) : null}

      <section className="glass" style={{ padding: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Subseções do módulo</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUBSECTIONS.map(([name, href]) => (
            <a key={`${href}-${name}`} href={href} className="fiscal-subsection-link">{name}</a>
          ))}
        </div>
      </section>

      <section id="visao-geral" style={kpiGridStyle}>
        <Kpi label="Notas autorizadas" value={`${authorizedDocs}`} note="NF-e e documentos fiscais autorizados" tone="ok" />
        <Kpi label="Pedidos sem nota" value={`${pendingOrders.length}`} note="pedidos pagos aguardando emissão" tone={pendingOrders.length ? "warn" : "ok"} />
        <Kpi label="Rejeições e divergências" value={`${rejectedDocs + rejections.filter((r) => r.status === "open").length}`} note="exigem correção antes de retransmitir" tone={rejectedDocs ? "danger" : "neutral"} />
        <Kpi label="Guias em aberto" value={`${openGuides.length}`} note={`${overdueGuides.length} vencida(s)`} tone={overdueGuides.length ? "danger" : "neutral"} />
        <Kpi label="Tributos do período" value={formatBRL(totalTax)} note="soma das guias cadastradas" />
        <Kpi label="Cofre fiscal" value={`${vaultDocs.length}`} note="documentos arquivados e classificáveis" />
        <Kpi label="Solicitações ao contador" value={`${openRequests.length}`} note={accountant?.office_name ?? "escritório ainda não configurado"} tone={openRequests.length ? "warn" : "neutral"} />
        <Kpi label="Fila fiscal" value={`${queue.length}`} note={`${queueProblems.length} com falha ou dead-letter`} tone={queueProblems.length ? "danger" : "neutral"} />
      </section>

      <FiscalGovernmentPanel connections={integrations} />

      <section id="integracoes" className="glass" style={noticeStyle}>
        <SectionTitle eyebrow="Integrações oficiais" title="Ambiente fiscal e SEFAZ">
          <span className={`fiscal-chip fiscal-chip-${fiscal?.ambiente === "producao" ? "ok" : "warn"}`}>
            {fiscal?.ambiente === "producao" ? "Produção" : "Homologação"}
          </span>
        </SectionTitle>
        <div style={integrationGridStyle}>
          <div>
            <p style={paragraphStyle}>
              CNPJ: <strong>{fiscal?.cnpj ?? "não configurado"}</strong> · Série NF-e: <strong>{fiscal?.serie_nfe ?? "—"}</strong> · Próximo número:{" "}
              <strong>{fiscal?.proximo_numero_nfe ?? "—"}</strong>
            </p>
            <p className="muted" style={{ lineHeight: 1.7, margin: "8px 0 0" }}>
              O sistema prepara documentos e filas, mas não finge transmissão oficial. Para transmitir,
              exige certificado, autorização, ambiente correto, leiaute vigente e integração habilitada.
            </p>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {integrations.length ? integrations.map((item) => (
              <div key={`${item.provider_key}-${item.environment}`} style={compactRowStyle}>
                <span>
                  <strong>{item.display_name ?? "SEFAZ / NF-e"}</strong>
                  <small>{item.environment === "production" ? "Produção" : "Teste"} · credenciais {item.credentials_status}</small>
                </span>
                <StatusChip status={item.status} />
              </div>
            )) : (
              <EmptyState title="SEFAZ ainda não conectada" action="Abra Configurações → Integrações para cadastrar credenciais e ambiente." />
            )}
          </div>
        </div>
      </section>

      <section id="pedidos-sem-nota" style={twoColumnStyle}>
        <section id="emissao" className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Emissão de NF-e" title="Pedidos pagos sem nota" />
          {pendingOrders.length === 0 ? (
            <EmptyState title="Nenhum pedido pendente de NF-e" action="Quando uma venda for paga, ela entrará aqui para emissão automática ou manual assistida." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pendingOrders.slice(0, 12).map((order) => (
                <div key={order.id} style={compactRowStyle}>
                  <span>
                    <strong>Pedido #{order.number}</strong>
                    <small>{formatDateTime(order.placed_at ?? order.created_at)} · {formatBRL(order.total_cents)}</small>
                  </span>
                  <form action={createDraftNfe.bind(null, order.id)}>
                    <button className="btn btn-gold" disabled={!fiscal} style={smallButtonStyle}>Criar NF-e</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Rascunhos e NF-e" title="Notas vinculadas a pedidos" />
          {nfes.length === 0 ? (
            <EmptyState title="Nenhuma NF-e criada" action="Use pedidos pagos, importação XML ou cadastro manual para iniciar o histórico fiscal." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {nfes.slice(0, 12).map((nfe) => (
                <div key={nfe.id} style={compactRowStyle}>
                  <span>
                    <strong>{nfe.numero ?? "—"}{nfe.serie ? ` / série ${nfe.serie}` : ""}</strong>
                    <small>Pedido {nfe.orders?.number ? `#${nfe.orders.number}` : "—"} · {formatBRL(nfe.valor_total_cents)} · {formatDateTime(nfe.created_at)}</small>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`fiscal-chip fiscal-chip-${statusTone(nfe.status)}`}>{NFE_STATUS_LABELS[nfe.status] ?? nfe.status}</span>
                    {nfe.status === "rascunho" ? (
                      <form action={cancelNfeDraft.bind(null, nfe.id)}>
                        <button className="btn btn-ghost" style={smallButtonStyle}>Cancelar</button>
                      </form>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <section id="documentos" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Documentos fiscais" title="Listagem profissional">
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/backoffice/notas-fiscais/exportar?format=csv" className="btn btn-ghost" style={smallButtonStyle}>CSV</Link>
            <Link href="/backoffice/notas-fiscais/exportar?format=xlsx" className="btn btn-ghost" style={smallButtonStyle}>XLSX</Link>
          </div>
        </SectionTitle>
        {fiscalDocs.length === 0 ? (
          <EmptyState title="Nenhum documento fiscal completo no centro" action="Cadastre manualmente, crie NF-e por pedido ou importe XML/DANFE para alimentar o cofre e a auditoria." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="fiscal-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Parte</th>
                  <th>Competência</th>
                  <th>Valor</th>
                  <th>Tributos</th>
                  <th>Pagamento</th>
                  <th>Verificação</th>
                  <th>Situação</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {fiscalDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong>{label(DOC_TYPE_LABELS, doc.document_type)}</strong>
                      <span>{doc.number ?? "sem número"}{doc.series ? ` · série ${doc.series}` : ""}</span>
                      {doc.access_key ? <span>Chave {doc.access_key.slice(0, 12)}...</span> : null}
                    </td>
                    <td>
                      <strong>{doc.party_name ?? "—"}</strong>
                      <span>{doc.party_document ?? "sem CPF/CNPJ"}</span>
                    </td>
                    <td>{doc.competence ?? "—"}<span>{formatDate(doc.due_date)}</span></td>
                    <td>{formatBRL(doc.total_cents)}</td>
                    <td>{formatBRL(doc.tax_total_cents)}</td>
                    <td><StatusChip status={doc.payment_status} /></td>
                    <td><StatusChip status={doc.verification_status} /></td>
                    <td><StatusChip status={doc.status} /></td>
                    <td>{doc.origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="fiscal-form-grid">
        <FiscalDocumentForm />
        <FiscalProductRuleForm />
      </div>

      <section id="eventos" style={twoColumnStyle}>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Eventos fiscais" title="Correções, cancelamentos e inutilizações" />
          {events.length === 0 ? (
            <EmptyState title="Nenhum evento fiscal registrado" action="Crie carta de correção, cancelamento, inutilização ou retificação com justificativa auditável." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {events.map((event) => (
                <div key={event.id} style={compactRowStyle}>
                  <span>
                    <strong>{label({ correction_letter: "Carta de correção", cancellation: "Cancelamento", number_void: "Inutilização", recalculation: "Recálculo", rectification: "Retificação", manifestation: "Manifestação" }, event.event_type)}</strong>
                    <small>{event.justification} · {formatDateTime(event.created_at)}</small>
                  </span>
                  <StatusChip status={event.status} />
                </div>
              ))}
            </div>
          )}
        </div>
        <FiscalEventForm documents={docsForSelect} />
      </section>

      <section id="rejeicoes" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Rejeições SEFAZ" title="Correção orientada por causa, campo e tentativa" />
        {rejections.length === 0 ? (
          <EmptyState title="Nenhuma rejeição registrada" action="Falhas de validação e retorno de integração aparecerão aqui com causa provável e orientação." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rejections.map((item) => (
              <div key={item.id} style={compactRowStyle}>
                <span>
                  <strong>{item.code ? `Código ${item.code}` : "Rejeição sem código"} · {item.message}</strong>
                  <small>{item.step ?? "etapa não informada"} · {item.probable_cause ?? "causa em análise"} · {item.recommendation ?? "corrigir e retransmitir"}</small>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="fiscal-chip fiscal-chip-warn">{item.attempts} tentativa(s)</span>
                  <StatusChip status={item.status} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="apuracao" style={twoColumnStyle}>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="DCTFWeb · MIT · EFD-Reinf · eSocial" title="Apurações e escriturações" />
          {assessments.length === 0 ? (
            <EmptyState title="Nenhuma apuração preparada" action="Cadastre competências para acompanhar débitos, créditos, recibos, DARF e retificações sem criar declaração paralela." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {assessments.map((item) => (
                <div key={item.id} style={compactRowStyle}>
                  <span>
                    <strong>{label({ dctfweb: "DCTFWeb", mit: "MIT", efd_reinf: "EFD-Reinf", esocial: "eSocial", monthly_tax: "Apuração mensal" }, item.assessment_type)} · {item.competence}</strong>
                    <small>Débitos {formatBRL(item.debit_cents)} · Créditos {formatBRL(item.credit_cents)} · Saldo {formatBRL(item.balance_cents)}</small>
                    <small>Origem: eSocial {item.source_summary?.esocial ?? "—"} · Reinf {item.source_summary?.reinf ?? "—"} · MIT {item.source_summary?.mit ?? "—"}</small>
                  </span>
                  <StatusChip status={item.status} />
                </div>
              ))}
            </div>
          )}
        </div>
        <FiscalAssessmentForm />
      </section>

      <section id="guias" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Guias e pagamentos" title="Controle, vencimento, pagamento e conciliação" />
        {guides.length === 0 ? (
          <EmptyState title="Nenhuma guia cadastrada" action="Importe PDF/XML, cadastre manualmente ou vincule a DCTFWeb/MIT/Reinf para controlar vencimento e comprovante." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="fiscal-table">
              <thead>
                <tr>
                  <th>Guia</th>
                  <th>Competência</th>
                  <th>Vencimento</th>
                  <th>Valor original</th>
                  <th>Atualizado</th>
                  <th>Pago</th>
                  <th>Status</th>
                  <th>Verificação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((guide) => (
                  <tr key={guide.id}>
                    <td>
                      <strong>{label(GUIDE_TYPE_LABELS, guide.guide_type)}</strong>
                      <span>{guide.document_name}</span>
                      {guide.digitable_line ? <span>{guide.digitable_line.slice(0, 24)}...</span> : null}
                      <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                        <FileLink path={guide.guide_path}>Abrir guia</FileLink>
                        <FileLink path={guide.receipt_path}>Abrir comprovante</FileLink>
                      </span>
                    </td>
                    <td>{guide.competence ?? "—"}</td>
                    <td>{formatDate(guide.due_date)}</td>
                    <td>{formatBRL(guide.original_cents)}</td>
                    <td>{formatBRL(guide.updated_cents)}</td>
                    <td>{formatBRL(guide.paid_cents)}</td>
                    <td><StatusChip status={guide.payment_status} /></td>
                    <td><StatusChip status={guide.verification_status} /></td>
                    <td><GuidePaymentForm guideId={guide.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="fiscal-form-grid">
        <FiscalGuideForm />
        <FiscalObligationForm />
      </div>

      <section id="agenda" style={twoColumnStyle}>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Agenda fiscal" title="Obrigações, vencimentos e alertas" />
          {obligations.length === 0 ? (
            <EmptyState title="Nenhuma obrigação na agenda" action="Crie DCTFWeb, MIT, EFD-Reinf, eSocial, PGDAS-D, licenças e obrigações estaduais ou municipais." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {obligations.map((obligation) => (
                <div key={obligation.id} style={compactRowStyle}>
                  <span>
                    <strong>{obligation.name}</strong>
                    <small>{label({ dctfweb: "DCTFWeb", mit: "MIT", efd_reinf: "EFD-Reinf", esocial: "eSocial" }, obligation.obligation_type)} · {obligation.competence ?? "sem competência"} · vence {formatDate(obligation.due_date)}</small>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="fiscal-chip fiscal-chip-warn">{obligation.priority}</span>
                    <StatusChip status={obligation.status} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Fechamento mensal" title="Competências" />
          {closings.length === 0 ? (
            <EmptyState title="Nenhuma competência aberta" action="Abra uma competência para acompanhar documentos faltantes, bloqueios, guias e fechamento." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {closings.map((closing) => (
                <div key={closing.id} style={compactRowStyle}>
                  <span>
                    <strong>{closing.competence}</strong>
                    <small>{Number(closing.progress_percent ?? 0).toFixed(0)}% concluído · faltantes {(closing.missing_documents ?? []).join(", ") || "nenhum"}</small>
                  </span>
                  <StatusChip status={closing.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="fiscal-form-grid">
        <MonthlyClosingForm />
        <FiscalCertificateForm />
      </div>

      <section id="certificados" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Certificados digitais" title="Metadados seguros e validade" />
        {certificates.length === 0 ? (
          <EmptyState title="Nenhum certificado cadastrado" action="Cadastre apenas metadados e referência segura. Senha/certificado real devem ficar em secret seguro, nunca no navegador." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {certificates.map((cert) => (
              <div key={cert.id} style={compactRowStyle}>
                <span>
                  <strong>{cert.holder_name} · {cert.certificate_type}</strong>
                  <small>{cert.environment === "producao" ? "Produção" : "Homologação"} · validade {formatDate(cert.valid_until)} · referência {cert.secure_secret_ref ? "segura informada" : "não informada"}</small>
                </span>
                <StatusChip status={cert.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="cofre" style={twoColumnStyle}>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Cofre fiscal" title="Arquivo permanente e documentos de competência" />
          {vaultDocs.length === 0 ? (
            <EmptyState title="Cofre vazio" action="Arquive XML, DANFE, DARF, DAS, comprovantes, contratos, licenças, certidões e documentos do contador." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {vaultDocs.map((doc) => {
                const control = vaultControls.get(doc.id);
                return (
                  <div key={doc.id} style={vaultRowStyle}>
                    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                      <div>
                        <strong>{doc.favorite ? "★ " : ""}{doc.name}</strong>
                        <small>
                          {doc.document_type} · {doc.department ?? "sem departamento"} · {doc.competence ?? "permanente"} · {formatBRL(doc.value_cents)}
                        </small>
                        <small>
                          {doc.archived_at ? `Arquivado em ${formatDate(doc.archived_at)}` : "Documento ativo no cofre"} · origem {doc.origin}
                        </small>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <FileLink path={doc.storage_path}>Abrir arquivo</FileLink>
                        <StatusChip status={doc.status} />
                        <StatusChip status={doc.visibility_status} />
                        <StatusChip status={doc.verification_status} />
                        {control ? <StatusChip status={control.payment_status} /> : null}
                        <span className={`fiscal-chip fiscal-chip-${doc.financial_control_id ? "ok" : "warn"}`}>
                          {doc.financial_control_id ? "Financeiro vinculado" : "Classificar financeiro"}
                        </span>
                      </div>
                      {control ? (
                        <small>
                          Financeiro: pago {formatBRL(control.paid_cents)} · saldo {formatBRL(control.remaining_cents)} · vencimento {formatDate(control.due_date)} · comprovante {label(STATUS_LABELS, control.proof_status)}
                        </small>
                      ) : null}
                    </div>
                    <VaultDocumentActions documentId={doc.id} compact />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <FiscalVaultForm />
      </section>

      <section id="contador" style={twoColumnStyle}>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Central do Contador" title="Solicitações, SLA e colaboração" />
          <div style={{ ...noticeStyle, padding: 14, marginBottom: 12 }}>
            <strong>{accountant?.office_name ?? "Escritório não configurado"}</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {accountant?.main_contact ?? "Defina o contador principal"} · {accountant?.email ?? "e-mail não cadastrado"} · {accountant?.business_hours ?? "horário não informado"}
            </p>
          </div>
          {accountantRequests.length === 0 ? (
            <EmptyState title="Nenhuma solicitação aberta" action="Use esta área para pedir documentos, comprovantes, correções, aprovações e esclarecimentos ao contador." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {accountantRequests.map((request) => (
                <div key={request.id} style={compactRowStyle}>
                  <span>
                    <strong>{request.title}</strong>
                    <small>{request.department ?? "sem departamento"} · {request.competence ?? "sem competência"} · prazo {formatDate(request.due_date)}</small>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="fiscal-chip fiscal-chip-warn">{request.priority}</span>
                    <StatusChip status={request.status} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <AccountantRequestForm />
          <AccountantProfileForm />
        </div>
      </section>

      <section id="aprovacoes" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Aprovações e segurança" title="Regras críticas do centro fiscal" />
        <div style={rulesGridStyle}>
          {[
            "Nota com valor elevado exige aprovação.",
            "NCM ausente, CFOP excepcional ou tributação divergente bloqueiam transmissão automática.",
            "Cancelamento, inutilização e carta de correção exigem justificativa auditável.",
            "Guia paga precisa de comprovante ou conciliação.",
            "Documento oficial não pode ser recalculado com fórmula genérica sem fonte válida.",
            "Certificado e senha nunca aparecem no navegador nem em logs.",
          ].map((rule) => (
            <div key={rule} style={ruleStyle}>{rule}</div>
          ))}
        </div>
      </section>

      <section id="filas" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Filas e processamento assíncrono" title="Idempotência, retentativas e dead-letter" />
        {queue.length === 0 ? (
          <EmptyState title="Nenhum job fiscal enfileirado" action="Preparação de NF-e, transmissão, download, consulta e armazenamento entrarão aqui com chave idempotente." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {queue.map((job) => (
              <div key={job.id} style={compactRowStyle}>
                <span>
                  <strong>{job.job_type}</strong>
                  <small>{job.entity_type ?? "sem entidade"} · tentativa {job.attempts}/{job.max_attempts} · próxima execução {formatDateTime(job.next_attempt_at)}</small>
                  {job.last_error ? <small style={{ color: "#e8a0a0" }}>{job.last_error}</small> : null}
                </span>
                <StatusChip status={job.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <InternationalTradeCenter />

      <section id="relatorios" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Relatórios" title="Exportação fiscal, documental e contábil">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/backoffice/notas-fiscais/exportar?format=csv" className="btn btn-ghost" style={smallButtonStyle}>CSV</Link>
            <Link href="/backoffice/notas-fiscais/exportar?format=pdf" className="btn btn-gold" style={smallButtonStyle}>PDF</Link>
            <Link href="/backoffice/notas-fiscais/exportar?format=xlsx" className="btn btn-ghost" style={smallButtonStyle}>XLSX</Link>
            <Link href="/backoffice/notas-fiscais/exportar?format=json" className="btn btn-ghost" style={smallButtonStyle}>JSON</Link>
          </div>
        </SectionTitle>
        <p className="muted" style={{ lineHeight: 1.7, margin: 0 }}>
          Exporta documentos fiscais, guias, obrigações, cofre, solicitações do contador, fila e apurações.
          XMLs e documentos oficiais devem permanecer no cofre privado e ser baixados por URL assinada quando essa camada estiver conectada.
        </p>
      </section>

      <section id="auditoria" className="glass" style={cardStyle}>
        <SectionTitle eyebrow="Auditoria fiscal" title="Trilha obrigatória de operação" />
        <p className="muted" style={{ lineHeight: 1.7, margin: 0 }}>
          Toda criação por formulário registra ação em `fiscal_audit_events`: usuário, entidade, valores, justificativa e resultado.
          Operações críticas como emissão, cancelamento, correção, inutilização, recálculo, pagamento e alteração de certificado ficam preparadas
          para revisão por auditor, contador e administração.
        </p>
      </section>
    </div>
  );
}

const pageStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  padding: "24px 28px 56px",
};

const cardStyle: CSSProperties = {
  padding: 22,
};

const noticeStyle: CSSProperties = {
  padding: 18,
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  background: "var(--glass-bg-strong)",
};

const paragraphStyle: CSSProperties = {
  margin: 0,
  color: "var(--cream)",
  lineHeight: 1.7,
};

const topButtonStyle: CSSProperties = {
  padding: "10px 16px",
  fontSize: 10,
};

const smallButtonStyle: CSSProperties = {
  padding: "7px 12px",
  fontSize: 9,
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
  alignItems: "start",
};

const integrationGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1.2fr) minmax(280px, 0.8fr)",
  gap: 18,
};

const compactRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(242, 236, 223, 0.055)",
};

const vaultRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, 1fr) minmax(280px, 420px)",
  gap: 16,
  alignItems: "start",
  padding: "14px",
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  background: "rgba(242, 236, 223, 0.055)",
  backdropFilter: "blur(18px) saturate(1.18)",
  WebkitBackdropFilter: "blur(18px) saturate(1.18)",
};

const emptyStateStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 16,
  border: "1px dashed var(--glass-border)",
  borderRadius: 12,
  color: "var(--cream-dim)",
};

const rulesGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const ruleStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(185, 146, 77, 0.25)",
  background: "rgba(185, 146, 77, 0.10)",
  color: "var(--cream)",
  fontSize: 13,
  lineHeight: 1.55,
};
