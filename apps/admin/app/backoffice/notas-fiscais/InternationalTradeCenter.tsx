import type { CSSProperties } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { money } from "@/lib/format";
import {
  ExchangeRateForm,
  ExportComplianceForm,
  FiscalRegistrationForm,
  InternationalDocumentForm,
  InternationalOperationForm,
  InternationalRuleForm,
  InternationalShippingForm,
  SeedInternationalTradeButton,
} from "./InternationalTradeForms";
import { reviewJurisdictionPackage, runInternationalProviderAction } from "./international-actions";

const SUBSECTIONS = [
  { id: "visao-geral", label: "Visão geral", description: "Mapa operacional, pacotes, alertas e estado do centro internacional." },
  { id: "simulador-internacional", label: "Simulador internacional", description: "Cenários por país, canal, Incoterm, moeda, imposto, frete e margem." },
  { id: "calculadora-de-landed-cost", label: "Calculadora de landed cost", description: "Memória de cálculo, custo no destino, DDP/DAP e preço recomendado." },
  { id: "operacoes-de-exportacao", label: "Operações de exportação", description: "Pedidos internacionais, responsáveis, importador, destino e histórico." },
  { id: "nfe-de-exportacao", label: "NF-e de exportação", description: "Preparação fiscal brasileira, vínculo com operação e documentos oficiais." },
  { id: "du-e", label: "DU-E", description: "Protocolo, Portal Único, LPCO e documentos de despacho." },
  { id: "documentos-internacionais", label: "Documentos internacionais", description: "Commercial Invoice, Pro Forma, Packing List, certificados e relatórios." },
  { id: "commercial-invoice", label: "Commercial Invoice", description: "Documento comercial internacional com itens, valores, Incoterm e comprador." },
  { id: "pro-forma-invoice", label: "Pro Forma Invoice", description: "Proposta comercial internacional antes da cobrança ou envio." },
  { id: "packing-list", label: "Packing List", description: "Volumes, pesos, caixas, lote, SKU, dimensões e embalagem." },
  { id: "declaracoes-aduaneiras", label: "Declarações aduaneiras", description: "Declarações, certificados, LPCO e anexos regulatórios." },
  { id: "classificacao-fiscal", label: "Classificação fiscal", description: "NCM, HS Code, códigos locais, fonte e confiança." },
  { id: "ncm-hs-code-e-codigos-locais", label: "NCM, HS Code e códigos locais", description: "Tabela de códigos por jurisdição e produto." },
  { id: "jurisdicoes", label: "Jurisdições", description: "Pacotes por país/bloco com fonte, versão, revisão e validação." },
  { id: "regras-tributarias", label: "Regras tributárias", description: "Regras versionadas por produto, canal, cliente, Incoterm e vigência." },
  { id: "iva-vat-gst-e-sales-tax", label: "IVA, VAT, GST e Sales Tax", description: "Tributos do destino separados da NF-e brasileira." },
  { id: "tarifas-aduaneiras", label: "Tarifas aduaneiras", description: "Duty, HTS, TARIC, UKGT, CBSA e custos de importação." },
  { id: "incoterms", label: "Incoterms", description: "Responsabilidades, riscos, documentos e custo por modalidade." },
  { id: "frete-internacional", label: "Frete internacional", description: "Cotações, provedores, modais, tracking e SLA." },
  { id: "seguro", label: "Seguro", description: "Seguro internacional, avaria, extravio, cobertura e custo." },
  { id: "cambio", label: "Câmbio", description: "Moedas, fonte da taxa, data, spread e impacto no landed cost." },
  { id: "comissoes", label: "Comissões", description: "Representantes, marketplaces, afiliados e taxas por canal." },
  { id: "marketplaces-internacionais", label: "Marketplaces internacionais", description: "Pedidos, facilitador fiscal, comissões e regras de destino." },
  { id: "registros-fiscais", label: "Registros fiscais", description: "EORI, IOSS, OSS, VAT/GST/Sales Tax e inscrições locais." },
  { id: "produtos-e-conformidade", label: "Produtos e conformidade", description: "Cosméticos, ingredientes, rótulo, idioma, dossiê e mercado aprovado." },
  { id: "cofre-internacional", label: "Cofre internacional", description: "Pastas, documentos, versões, hash, retenção e permissões." },
  { id: "relatorios", label: "Relatórios", description: "Exportações, impostos, frete, landed cost, margem e documentos." },
  { id: "integracoes", label: "Integrações", description: "Providers desacoplados, credenciais, testes e sincronização." },
  { id: "configuracoes", label: "Configurações", description: "Parâmetros, revisões, fontes confiáveis e regras de operação." },
] as const;

export type InternationalTradeModuleId = (typeof SUBSECTIONS)[number]["id"];

export function isInternationalTradeModuleId(value: string): value is InternationalTradeModuleId {
  return SUBSECTIONS.some((item) => item.id === value);
}

function internationalModuleHref(id: InternationalTradeModuleId) {
  return id === "visao-geral"
    ? "/backoffice/notas-fiscais/comercio-exterior"
    : `/backoffice/notas-fiscais/comercio-exterior/${id}`;
}

function showModule(activeModule: InternationalTradeModuleId, modules: InternationalTradeModuleId[]) {
  return activeModule === "visao-geral" || modules.includes(activeModule);
}

const DOC_MATRIX = [
  ["NF-e de exportação", "Brasil", "Obrigatório quando aplicável", "Não é invoice estrangeira."],
  ["DU-E", "Brasil", "Obrigatório na exportação formal", "Preparar dados e importar protocolo se não houver integração."],
  ["Commercial Invoice", "Comercial internacional", "Obrigatório em muitos envios", "Documento comercial, não é NF-e."],
  ["Pro Forma Invoice", "Comercial internacional", "Negociação", "Pode virar pedido, invoice ou cobrança."],
  ["Packing List", "Aduaneiro e logístico", "Frequentemente obrigatório", "Relaciona volumes, pesos, itens e lotes."],
  ["Certificado de origem", "Aduaneiro", "Conforme país/produto", "Exige fonte e validade."],
  ["LPCO", "Portal Único", "Quando houver controle administrativo", "Depende de produto, NCM e destino."],
  ["Relatório VAT/GST/Sales Tax", "Destino", "Conforme registro", "Não confundir com nota fiscal brasileira."],
];

const INTEGRATIONS = [
  ["Portal Único Siscomex", "DU-E, LPCO, cargas e protocolos"],
  ["SEFAZ", "NF-e de exportação, eventos, XML e DANFE"],
  ["Classif", "Classificação fiscal e consulta assistida"],
  ["Fontes tarifárias", "TARIC, HTS, UKGT e bases locais"],
  ["Provedores VAT/GST/Sales Tax", "Registros, alíquotas e relatórios"],
  ["Couriers e freight forwarders", "Cotação, despacho, tracking e DDP/DAP"],
  ["Stripe", "Cobrança internacional, câmbio e taxas"],
  ["Marketplaces", "Comissões, facilitador fiscal e pedidos internacionais"],
  ["Cofre documental", "Documentos, versões, assinatura, hash e permissões"],
];

type JurisdictionRow = {
  id: string;
  code: string;
  name: string;
  scope: string;
  currency: string;
  package_status: string;
  confidence_status: string;
  tax_system: string | null;
  official_sources: string[] | null;
  alerts: string[] | null;
  version: string;
  last_reviewed_at: string | null;
  next_review_at: string | null;
};

type OperationRow = {
  id: string;
  operation_number: string;
  title: string;
  status: string;
  sale_type: string;
  destination_country: string;
  destination_region: string | null;
  incoterm: string;
  tax_responsibility: string;
  currency: string;
  created_at: string;
};

type CalculationRow = {
  id: string;
  operation_id: string | null;
  scenario_name: string;
  total_landed_cost_cents: number;
  recommended_price_cents: number;
  profit_net_cents: number;
  margin_net_percent: number;
  taxes_paid_by_flora_cents: number;
  taxes_paid_by_buyer_cents: number;
  currency: string;
  warnings: string[] | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  document_scope: string;
  document_type: string;
  title: string;
  status: string;
  requirement_status: string;
  country_code: string | null;
  expires_at: string | null;
};

type TaxRuleRow = {
  id: string;
  tax_name: string;
  tax_kind: string;
  rate_percent: number;
  responsibility: string;
  rule_status: string;
  official_source: string | null;
  effective_from: string | null;
  effective_until: string | null;
  jurisdictions: { name: string; code: string } | null;
};

type ShippingRow = {
  id: string;
  provider_key: string;
  service_name: string;
  transport_mode: string;
  destination_country: string | null;
  freight_cents: number;
  insurance_cents: number;
  taxes_prepaid_cents: number;
  currency: string;
  estimated_days: number | null;
  tracking_code: string | null;
  status: string;
};

type ComplianceRow = {
  id: string;
  check_type: string;
  status: string;
  severity: string;
  title: string;
  details: string | null;
  due_date: string | null;
  jurisdictions: { name: string; code: string } | null;
};

type AlertRow = {
  id: string;
  severity: string;
  title: string;
  status: string;
  created_at: string;
};

type IncotermsRow = {
  id: string;
  code: string;
  name: string;
  risk_transfer_point: string | null;
  seller_responsibilities: string[] | null;
  buyer_responsibilities: string[] | null;
  required_documents: string[] | null;
  review_warning: string | null;
};

type ExchangeRateRow = {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  commercial_rate: number | null;
  spread_percent: number;
  source: string | null;
  rate_date: string;
  scenario: string;
  locked_until: string | null;
};

type FiscalRegRow = {
  id: string;
  registration_kind: string;
  registration_number: string | null;
  authority: string | null;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  renewal_due_at: string | null;
  jurisdictions: { name: string; code: string } | null;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function statusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    review: "Em revisão",
    validated: "Validado",
    approved: "Aprovado",
    blocked: "Bloqueado",
    operational: "Operacional",
    needs_review: "Precisa revisão",
    simulation: "Simulação",
    official_imported: "Oficial importada",
    official_integrated: "Oficial integrada",
    specialist_validated: "Validada por especialista",
    outdated: "Desatualizada",
    waiting_review: "Aguardando revisão",
    required: "Obrigatório",
    potentially_required: "Potencial",
    optional: "Opcional",
    not_applicable: "Não aplicável",
    pending_confirmation: "Confirmar",
    quoted: "Cotado",
    selected: "Selecionado",
    booked: "Reservado",
    shipped: "Expedido",
    delivered: "Entregue",
    failed: "Falhou",
    not_reviewed: "Não analisado",
    in_review: "Em análise",
    documents_pending: "Docs pendentes",
    approved_for_market: "Aprovado",
    restricted: "Restrito",
    expired: "Vencido",
    open: "Aberto",
    warning: "Atenção",
    critical: "Crítico",
    info: "Info",
  };
  return labels[value ?? ""] ?? value ?? "—";
}

function chipTone(status: string | null | undefined) {
  if (["approved", "operational", "official_integrated", "validated", "selected", "delivered", "approved_for_market"].includes(status ?? "")) return "ok";
  if (["blocked", "failed", "expired", "critical"].includes(status ?? "")) return "danger";
  if (["needs_review", "waiting_review", "warning", "documents_pending", "restricted", "pending_confirmation"].includes(status ?? "")) return "warn";
  return "draft";
}

function Chip({ value }: { value: string | null | undefined }) {
  return <span className={`fiscal-chip fiscal-chip-${chipTone(value)}`}>{statusLabel(value)}</span>;
}

function SectionTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div style={{ display: "grid", gap: 7, marginBottom: 16 }}>
      <p className="eyebrow" style={{ margin: 0 }}>{eyebrow}</p>
      <h2 className="display" style={{ fontSize: 30, lineHeight: 1.05 }}>{title}</h2>
      {note ? <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>{note}</p> : null}
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="glass fiscal-kpi" style={{ minHeight: 116 }}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div style={emptyStyle}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export async function InternationalTradeCenter({
  activeModule = "visao-geral",
}: {
  activeModule?: InternationalTradeModuleId;
}) {
  const staff = await currentStaff();
  if (!staff) return null;
  const supabase = await createClient();

  const [
    jurisdictionsRes,
    operationsRes,
    calculationsRes,
    documentsRes,
    taxRulesRes,
    shippingRes,
    complianceRes,
    alertsRes,
    incotermsRes,
    exchangeRatesRes,
    fiscalRegsRes,
  ] = await Promise.all([
    supabase
      .from("jurisdictions")
      .select("id, code, name, scope, currency, package_status, confidence_status, tax_system, official_sources, alerts, version, last_reviewed_at, next_review_at")
      .eq("tenant_id", staff.tenantId)
      .order("code"),
    supabase
      .from("export_operations")
      .select("id, operation_number, title, status, sale_type, destination_country, destination_region, incoterm, tax_responsibility, currency, created_at")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("landed_cost_calculations")
      .select("id, operation_id, scenario_name, total_landed_cost_cents, recommended_price_cents, profit_net_cents, margin_net_percent, taxes_paid_by_flora_cents, taxes_paid_by_buyer_cents, currency, warnings, created_at")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("international_documents")
      .select("id, document_scope, document_type, title, status, requirement_status, country_code, expires_at")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("international_tax_rules")
      .select("id, tax_name, tax_kind, rate_percent, responsibility, rule_status, official_source, effective_from, effective_until, jurisdictions(name, code)")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("international_shipping_quotes")
      .select("id, provider_key, service_name, transport_mode, destination_country, freight_cents, insurance_cents, taxes_prepaid_cents, currency, estimated_days, tracking_code, status")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("export_compliance_checks")
      .select("id, check_type, status, severity, title, details, due_date, jurisdictions(name, code)")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("export_alerts")
      .select("id, severity, title, status, created_at")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("incoterms")
      .select("id, code, name, risk_transfer_point, seller_responsibilities, buyer_responsibilities, required_documents, review_warning")
      .eq("tenant_id", staff.tenantId)
      .order("code"),
    supabase
      .from("exchange_rates")
      .select("id, base_currency, quote_currency, rate, commercial_rate, spread_percent, source, rate_date, scenario, locked_until")
      .eq("tenant_id", staff.tenantId)
      .order("rate_date", { ascending: false })
      .limit(30),
    supabase
      .from("fiscal_registrations")
      .select("id, registration_kind, registration_number, authority, status, effective_from, effective_until, renewal_due_at, jurisdictions(name, code)")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const migrationPending = Boolean(jurisdictionsRes.error || operationsRes.error || calculationsRes.error);
  const jurisdictions = (jurisdictionsRes.data ?? []) as unknown as JurisdictionRow[];
  const operations = (operationsRes.data ?? []) as unknown as OperationRow[];
  const calculations = (calculationsRes.data ?? []) as unknown as CalculationRow[];
  const documents = (documentsRes.data ?? []) as unknown as DocumentRow[];
  const taxRules = (taxRulesRes.data ?? []) as unknown as TaxRuleRow[];
  const shippingQuotes = (shippingRes.data ?? []) as unknown as ShippingRow[];
  const complianceChecks = (complianceRes.data ?? []) as unknown as ComplianceRow[];
  const alerts = (alertsRes.data ?? []) as unknown as AlertRow[];
  const incotermsData = (incotermsRes.data ?? []) as unknown as IncotermsRow[];
  const exchangeRates = (exchangeRatesRes.data ?? []) as unknown as ExchangeRateRow[];
  const fiscalRegs = (fiscalRegsRes.data ?? []) as unknown as FiscalRegRow[];

  const jurisdictionOptions = jurisdictions.map((item) => ({
    value: item.id,
    label: `${item.code} · ${item.name}`,
  }));
  const operationOptions = operations.map((item) => ({
    value: item.id,
    label: `${item.operation_number} · ${item.title}`,
  }));
  const lastCalculation = calculations[0];
  const openAlerts = alerts.filter((alert) => alert.status === "open").length;
  const docsPending = documents.filter((doc) => ["required", "potentially_required", "pending_confirmation"].includes(doc.requirement_status)).length;

  return (
    <section id="comercio-exterior" style={{ display: "grid", gap: 18 }}>
      <div className="glass" style={heroStyle}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Comércio Exterior</p>
          <h2 className="display" style={{ fontSize: 38, lineHeight: 1.02 }}>Centro internacional de exportação, tributação e landed cost</h2>
          <p className="muted" style={{ maxWidth: 880, lineHeight: 1.7, marginTop: 12 }}>
            Planeje exportações, compare jurisdições, calcule landed cost, prepare NF-e de exportação, DU-E, Commercial Invoice, Pro Forma, Packing List,
            compliance cosmético, câmbio, frete internacional, registros fiscais, documentos e memória de cálculo auditável.
          </p>
        </div>
        <SeedInternationalTradeButton />
      </div>

      {migrationPending ? (
        <div className="glass" style={{ ...noticeStyle, borderColor: "rgba(232, 160, 160, 0.4)" }}>
          <strong>Migration pendente</strong>
          <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
            Aplique `supabase/migrations/20260729191230_international_export_center.sql` para liberar o banco do Comércio Exterior.
          </p>
        </div>
      ) : null}

      <div className="glass" style={cardStyle}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Subseções do módulo</p>
        <div style={subsectionGridStyle}>
          {SUBSECTIONS.map((item) => (
            <Link
              key={item.id}
              href={internationalModuleHref(item.id)}
              className={activeModule === item.id ? "btn btn-gold" : "btn btn-ghost"}
              style={subsectionButtonStyle}
              title={item.description}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {activeModule !== "visao-geral" ? (
        <div className="glass" style={activeModuleIntroStyle}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Módulo aberto</p>
          <h3 style={{ margin: 0, fontSize: 24 }}>{SUBSECTIONS.find((item) => item.id === activeModule)?.label}</h3>
          <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
            {SUBSECTIONS.find((item) => item.id === activeModule)?.description}
          </p>
        </div>
      ) : null}

      <div style={activeModule === "visao-geral" ? kpiGridStyle : hiddenStyle}>
        <Kpi label="Pacotes de jurisdição" value={String(jurisdictions.length)} note="Brasil, UE, Reino Unido, EUA, Canadá e próximos mercados versionados." />
        <Kpi label="Operações de exportação" value={String(operations.length)} note="Rascunhos, simulações, cotações, documentos e remessas." />
        <Kpi label="Documentos e obrigações" value={String(documents.length)} note={`${docsPending} com obrigatoriedade ou confirmação pendente.`} />
        <Kpi label="Alertas críticos" value={String(openAlerts)} note="Margem, câmbio, Incoterm, compliance, impostos e documentos." />
      </div>

      <div className="glass" style={activeModule === "visao-geral" ? noticeStyle : hiddenStyle}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Escopo documental</p>
        <p style={paragraphStyle}>
          O Brasil emite NF-e de exportação e eventos fiscais brasileiros. Documentos como Commercial Invoice, Pro Forma Invoice e Packing List são
          documentos comerciais internacionais. Relatórios de VAT, GST, Sales Tax, IOSS, OSS, EORI e declarações locais são obrigações do destino.
          O sistema não chama tudo de nota fiscal e não transmite nada a órgão oficial sem integração, autorização e validação.
        </p>
      </div>

      <section
        style={
          showModule(activeModule, [
            "jurisdicoes",
            "classificacao-fiscal",
            "ncm-hs-code-e-codigos-locais",
            "simulador-internacional",
            "calculadora-de-landed-cost",
          ])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Pacotes de jurisdição" title="Mercados, vigência, fonte e confiança" />
          {jurisdictions.length === 0 ? (
            <Empty title="Nenhum pacote instalado" text="Use o botão de instalação para criar Brasil, União Europeia, Reino Unido, Estados Unidos e Canadá como base editável." />
          ) : (
            <div style={jurisdictionGridStyle}>
              {jurisdictions.map((item) => (
                <article key={item.id} style={jurisdictionCardStyle}>
                  <div style={jurisdictionHeaderStyle}>
                    <span style={marketAvatarStyle}>{item.code}</span>
                    <div style={rowContentStyle}>
                      <strong style={jurisdictionTitleStyle}>{item.code} · {item.name}</strong>
                      <span style={jurisdictionMetaStyle}>
                        <span>{statusLabel(item.scope)}</span>
                        <span>{item.currency}</span>
                        <span>Versão {item.version}</span>
                        <span>Revisão {formatDate(item.last_reviewed_at)}</span>
                        <span>Próxima {formatDate(item.next_review_at)}</span>
                      </span>
                    </div>
                    <span style={statusStackStyle}>
                      <Chip value={item.package_status} />
                      <Chip value={item.confidence_status} />
                    </span>
                  </div>

                  <p style={providerDescriptionStyle}>{item.tax_system ?? "Sistema tributário em estruturação."}</p>

                  <div style={folderGridStyle}>
                    {(item.official_sources ?? []).length ? (
                      (item.official_sources ?? []).map((source) => (
                        <span key={source} className="fiscal-chip fiscal-chip-draft">{source}</span>
                      ))
                    ) : (
                      <span className="fiscal-chip fiscal-chip-warn">Fonte não informada</span>
                    )}
                  </div>

                  {(item.alerts ?? []).length ? (
                    <div style={alertGridStyle}>
                      {(item.alerts ?? []).map((alert) => (
                        <span key={alert} style={alertLineStyle}>{alert}</span>
                      ))}
                    </div>
                  ) : null}

                  <div style={jurisdictionActionsStyle}>
                    <form action={reviewJurisdictionPackage.bind(null, item.id, "review")}>
                      <button type="submit" className="btn btn-ghost" style={miniButtonStyle}>Revisar agora</button>
                    </form>
                    <form action={reviewJurisdictionPackage.bind(null, item.id, "validate")}>
                      <button type="submit" className="btn btn-gold" style={miniButtonStyle}>Validar pacote</button>
                    </form>
                    <form action={reviewJurisdictionPackage.bind(null, item.id, "draft")}>
                      <button type="submit" className="btn btn-ghost" style={miniButtonStyle}>Voltar a rascunho</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Memória mais recente" title="Resultado do landed cost" />
          {lastCalculation ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={resultGridStyle}>
                <span><small>Custo no destino</small><strong>{money(lastCalculation.total_landed_cost_cents, lastCalculation.currency)}</strong></span>
                <span><small>Preço recomendado</small><strong>{money(lastCalculation.recommended_price_cents, lastCalculation.currency)}</strong></span>
                <span><small>Lucro líquido</small><strong>{money(lastCalculation.profit_net_cents, lastCalculation.currency)}</strong></span>
                <span><small>Margem líquida</small><strong>{lastCalculation.margin_net_percent.toFixed(1)}%</strong></span>
              </div>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                Tributos Flora: {money(lastCalculation.taxes_paid_by_flora_cents, lastCalculation.currency)} ·
                Tributos comprador: {money(lastCalculation.taxes_paid_by_buyer_cents, lastCalculation.currency)} ·
                {formatDate(lastCalculation.created_at)}
              </p>
              {(lastCalculation.warnings ?? []).length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {(lastCalculation.warnings ?? []).map((warning) => (
                    <span key={warning} className="fiscal-chip fiscal-chip-warn">{warning}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <Empty title="Nenhuma simulação calculada" text="Crie uma operação para gerar landed cost, preço recomendado, DDP/DAP, margem e alertas." />
          )}
        </div>
      </section>

      {showModule(activeModule, ["simulador-internacional", "calculadora-de-landed-cost", "operacoes-de-exportacao"]) ? (
        <InternationalOperationForm jurisdictions={jurisdictionOptions} />
      ) : null}

      <section
        style={
          showModule(activeModule, [
            "regras-tributarias",
            "iva-vat-gst-e-sales-tax",
            "tarifas-aduaneiras",
            "classificacao-fiscal",
            "ncm-hs-code-e-codigos-locais",
            "documentos-internacionais",
            "nfe-de-exportacao",
            "du-e",
            "commercial-invoice",
            "pro-forma-invoice",
            "packing-list",
            "declaracoes-aduaneiras",
          ])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <InternationalRuleForm jurisdictions={jurisdictionOptions} />
        <InternationalDocumentForm operations={operationOptions} />
      </section>

      <section
        style={
          showModule(activeModule, [
            "frete-internacional",
            "seguro",
            "produtos-e-conformidade",
            "classificacao-fiscal",
            "operacoes-de-exportacao",
          ])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <InternationalShippingForm operations={operationOptions} />
        <ExportComplianceForm jurisdictions={jurisdictionOptions} operations={operationOptions} />
      </section>

      <section
        style={
          showModule(activeModule, [
            "operacoes-de-exportacao",
            "simulador-internacional",
            "calculadora-de-landed-cost",
            "regras-tributarias",
            "iva-vat-gst-e-sales-tax",
            "tarifas-aduaneiras",
            "cambio",
            "comissoes",
            "marketplaces-internacionais",
            "registros-fiscais",
            "configuracoes",
          ])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Operações de exportação" title="Pedidos, simulações e responsabilidades" />
          {operations.length === 0 ? (
            <Empty title="Nenhuma operação criada" text="A operação reúne cliente, destino, produtos, classificação, Incoterm, impostos, documentos e remessa." />
          ) : (
            <div style={rowGridStyle}>
              {operations.map((item) => (
                <article key={item.id} style={rowStyle}>
                  <div>
                    <strong>{item.operation_number} · {item.title}</strong>
                    <small>{item.sale_type} · {item.destination_country}{item.destination_region ? `/${item.destination_region}` : ""} · {item.currency}</small>
                    <small>{item.incoterm} · tributos: {statusLabel(item.tax_responsibility)} · criada em {formatDate(item.created_at)}</small>
                  </div>
                  <Chip value={item.status} />
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Regras tributárias internacionais" title="Sem alíquota fixa no frontend" />
          {taxRules.length === 0 ? (
            <Empty title="Nenhuma regra cadastrada" text="Cadastre VAT, GST, Sales Tax, tarifa aduaneira, taxa de importação e regras com fonte, vigência e versão." />
          ) : (
            <div style={rowGridStyle}>
              {taxRules.map((rule) => (
                <article key={rule.id} style={rowStyle}>
                  <div>
                    <strong>{rule.tax_name} · {rule.rate_percent}%</strong>
                    <small>{rule.jurisdictions?.name ?? "jurisdição"} · {rule.tax_kind} · responsável {statusLabel(rule.responsibility)}</small>
                    <small>{rule.official_source ?? "fonte não informada"} · vigência {formatDate(rule.effective_from)} a {formatDate(rule.effective_until)}</small>
                  </div>
                  <Chip value={rule.rule_status} />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        className="glass"
        style={
          showModule(activeModule, [
            "documentos-internacionais",
            "nfe-de-exportacao",
            "du-e",
            "commercial-invoice",
            "pro-forma-invoice",
            "packing-list",
            "declaracoes-aduaneiras",
            "relatorios",
          ])
            ? cardStyle
            : hiddenStyle
        }
      >
        <SectionTitle eyebrow="Matriz documental" title="Brasil, comércio internacional e tributos do destino" />
        <div style={{ overflowX: "auto" }}>
          <table className="fiscal-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Família</th>
                <th>Obrigatoriedade</th>
                <th>Regra operacional</th>
              </tr>
            </thead>
            <tbody>
              {DOC_MATRIX.map(([name, family, requirement, rule]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{family}</td>
                  <td>{requirement}</td>
                  <td>{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={
          showModule(activeModule, [
            "documentos-internacionais",
            "nfe-de-exportacao",
            "du-e",
            "commercial-invoice",
            "pro-forma-invoice",
            "packing-list",
            "declaracoes-aduaneiras",
            "cofre-internacional",
            "frete-internacional",
            "seguro",
          ])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Documentos internacionais" title="Invoices, packing list, DU-E e cofre" />
          {documents.length === 0 ? (
            <Empty title="Nenhum documento internacional registrado" text="Registre NF-e exportação, DU-E, Commercial Invoice, Pro Forma, Packing List, certificados, seguros e relatórios do destino." />
          ) : (
            <div style={rowGridStyle}>
              {documents.map((doc) => (
                <article key={doc.id} style={rowStyle}>
                  <div>
                    <strong>{doc.title}</strong>
                    <small>{doc.document_scope} · {doc.document_type} · {doc.country_code ?? "sem país"} · vence {formatDate(doc.expires_at)}</small>
                  </div>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Chip value={doc.status} />
                    <Chip value={doc.requirement_status} />
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Frete internacional" title="Cotação, DDP/DAP e rastreamento" />
          {shippingQuotes.length === 0 ? (
            <Empty title="Nenhuma cotação registrada" text="Compare postal, courier, carga aérea, marítima, fulfillment e forwarder por custo, prazo, cobertura, risco e tributos." />
          ) : (
            <div style={rowGridStyle}>
              {shippingQuotes.map((quote) => (
                <article key={quote.id} style={rowStyle}>
                  <div>
                    <strong>{quote.provider_key} · {quote.service_name}</strong>
                    <small>{quote.transport_mode} · {quote.destination_country ?? "destino"} · prazo {quote.estimated_days ?? 0} dia(s)</small>
                    <small>Frete {money(quote.freight_cents, quote.currency)} · seguro {money(quote.insurance_cents, quote.currency)} · tributos antecipados {money(quote.taxes_prepaid_cents, quote.currency)}</small>
                    {quote.tracking_code ? <small>Rastreio: {quote.tracking_code}</small> : null}
                  </div>
                  <Chip value={quote.status} />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        style={
          showModule(activeModule, [
            "produtos-e-conformidade",
            "classificacao-fiscal",
            "relatorios",
          ])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Produtos cosméticos e conformidade" title="Mercado aprovado não depende só de imposto" />
          {complianceChecks.length === 0 ? (
            <Empty title="Nenhuma verificação aberta" text="Crie checks de INCI, ingredientes, rótulo, alegações, responsável técnico, dossiê, idioma e registro local." />
          ) : (
            <div style={rowGridStyle}>
              {complianceChecks.map((check) => (
                <article key={check.id} style={rowStyle}>
                  <div>
                    <strong>{check.title}</strong>
                    <small>{check.jurisdictions?.name ?? "jurisdição"} · {check.check_type} · prazo {formatDate(check.due_date)}</small>
                    <small>{check.details ?? "Sem detalhes adicionais."}</small>
                  </div>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Chip value={check.status} />
                    <Chip value={check.severity} />
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Alertas e auditoria" title="Nada recalcula ou transmite em silêncio" />
          {alerts.length === 0 ? (
            <Empty title="Nenhum alerta aberto" text="O sistema alerta classificação ausente, regra vencida, margem negativa, DDP incompleto, câmbio desatualizado e documento vencido." />
          ) : (
            <div style={rowGridStyle}>
              {alerts.map((alert) => (
                <article key={alert.id} style={rowStyle}>
                  <div>
                    <strong>{alert.title}</strong>
                    <small>{formatDate(alert.created_at)}</small>
                  </div>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Chip value={alert.severity} />
                    <Chip value={alert.status} />
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Incoterms ─────────────────────────────────────────────────── */}
      <section
        style={
          showModule(activeModule, ["incoterms", "frete-internacional", "simulador-internacional", "configuracoes"])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <div className="glass" style={cardStyle}>
          <SectionTitle
            eyebrow="Incoterms 2020"
            title="Responsabilidades, riscos e documentos"
            note="Cada Incoterm define quem paga o frete, o seguro, os tributos no destino e o ponto de transferência de risco. Use o simulador para calcular o impacto no preço."
          />
          {incotermsData.length === 0 ? (
            <Empty title="Nenhum Incoterm instalado" text='Clique em "Instalar pacotes iniciais" para criar os 11 Incoterms 2020 como base editável.' />
          ) : (
            <div style={incotermsGridStyle}>
              {incotermsData.map((inc) => (
                <article key={inc.id} style={incotermsCardStyle}>
                  <div style={incotermsHeaderStyle}>
                    <span style={incotermsCodeStyle}>{inc.code}</span>
                    <div>
                      <strong style={{ color: "var(--cream)", fontSize: 15, lineHeight: 1.2 }}>{inc.name}</strong>
                      {inc.risk_transfer_point ? (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--cream-dim)", lineHeight: 1.4 }}>
                          Risco: {inc.risk_transfer_point}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {inc.review_warning ? (
                    <p style={{ margin: 0, fontSize: 11, color: "var(--cream-dim)", lineHeight: 1.5, borderLeft: "2px solid rgba(217,184,122,0.4)", paddingLeft: 10 }}>
                      {inc.review_warning}
                    </p>
                  ) : null}
                  <div style={incotermsRespStyle}>
                    {(inc.seller_responsibilities ?? []).length ? (
                      <div>
                        <p style={incotermsLabelStyle}>Vendedor</p>
                        {(inc.seller_responsibilities ?? []).map((r) => (
                          <span key={r} style={incotermsRespItemStyle}>· {r}</span>
                        ))}
                      </div>
                    ) : null}
                    {(inc.buyer_responsibilities ?? []).length ? (
                      <div>
                        <p style={incotermsLabelStyle}>Comprador</p>
                        {(inc.buyer_responsibilities ?? []).map((r) => (
                          <span key={r} style={incotermsRespItemStyle}>· {r}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {(inc.required_documents ?? []).length ? (
                    <div style={folderGridStyle}>
                      {(inc.required_documents ?? []).map((doc) => (
                        <span key={doc} className="fiscal-chip fiscal-chip-draft">{doc}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Câmbio" title="Taxas de referência por operação" />
          {exchangeRates.length === 0 ? (
            <Empty title="Nenhuma taxa registrada" text="Registre taxas de referência por moeda, data e cenário para o simulador de landed cost." />
          ) : (
            <div style={rowGridStyle}>
              {exchangeRates.map((rate) => (
                <article key={rate.id} style={rowStyle}>
                  <div>
                    <strong style={{ color: "var(--cream)" }}>{rate.base_currency} → {rate.quote_currency}: {Number(rate.rate).toFixed(4)}</strong>
                    <small>{rate.scenario} · {rate.source ?? "fonte não informada"} · {formatDate(rate.rate_date)}</small>
                    {rate.commercial_rate ? <small>Taxa comercial: {Number(rate.commercial_rate).toFixed(4)} · spread {Number(rate.spread_percent).toFixed(2)}%</small> : null}
                    {rate.locked_until ? <small>Travado até {formatDate(rate.locked_until)}</small> : null}
                  </div>
                  <span className={`fiscal-chip fiscal-chip-${rate.locked_until ? "ok" : "draft"}`}>
                    {rate.locked_until ? "Travado" : rate.scenario}
                  </span>
                </article>
              ))}
            </div>
          )}
          <ExchangeRateForm />
        </div>
      </section>

      {/* ── Registros fiscais ──────────────────────────────────────────── */}
      <section
        style={
          showModule(activeModule, ["registros-fiscais", "iva-vat-gst-e-sales-tax", "configuracoes"])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <div className="glass" style={cardStyle}>
          <SectionTitle
            eyebrow="Registros fiscais internacionais"
            title="EORI, IOSS, OSS, VAT, GST, Sales Tax"
            note="Cada mercado exige registros específicos. Não confundir com obrigações brasileiras. Valide com representante fiscal local."
          />
          {fiscalRegs.length === 0 ? (
            <Empty title="Nenhum registro cadastrado" text="Adicione EORI (UE), IOSS (vendas à distância UE), OSS, VAT/GST (quando obrigatório) e Sales Tax nos estados onde há nexo." />
          ) : (
            <div style={rowGridStyle}>
              {fiscalRegs.map((reg) => (
                <article key={reg.id} style={rowStyle}>
                  <div>
                    <strong style={{ color: "var(--cream)" }}>{reg.registration_kind} {reg.registration_number ? `· ${reg.registration_number}` : ""}</strong>
                    <small>{(reg.jurisdictions as { name: string; code: string } | null)?.name ?? "jurisdição não vinculada"} · {reg.authority ?? "autoridade não informada"}</small>
                    <small>Vigência {formatDate(reg.effective_from)} a {formatDate(reg.effective_until)}</small>
                    {reg.renewal_due_at ? <small>Renovação: {formatDate(reg.renewal_due_at)}</small> : null}
                  </div>
                  <Chip value={reg.status} />
                </article>
              ))}
            </div>
          )}
        </div>

        <FiscalRegistrationForm jurisdictions={jurisdictionOptions} />
      </section>

      {/* ── Cofre + Integrações ────────────────────────────────────────── */}
      <section
        style={
          showModule(activeModule, [
            "cofre-internacional",
            "integracoes",
            "configuracoes",
            "marketplaces-internacionais",
          ])
            ? twoColumnStyle
            : hiddenStyle
        }
      >
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Cofre internacional" title="Pastas documentais automáticas" />
          <p className="muted" style={{ margin: "0 0 14px", fontSize: 12, lineHeight: 1.6 }}>
            Clique em uma pasta para abrir o cofre documental filtrado. Cada pasta centraliza os documentos da operação correspondente.
          </p>
          <div style={folderGridStyle}>
            {[
              { label: "Comércio Exterior", folder: "comercio-exterior" },
              { label: "Operações", folder: "operacoes" },
              { label: "NF-e de exportação", folder: "nfe-exportacao" },
              { label: "DU-E", folder: "due" },
              { label: "Commercial Invoices", folder: "commercial-invoices" },
              { label: "Pro Forma Invoices", folder: "proforma-invoices" },
              { label: "Packing Lists", folder: "packing-lists" },
              { label: "Certificados de origem", folder: "certificados-origem" },
              { label: "LPCO", folder: "lpco" },
              { label: "Documentos sanitários", folder: "sanitarios" },
              { label: "Fretes", folder: "fretes" },
              { label: "Seguros", folder: "seguros" },
              { label: "Câmbio", folder: "cambio" },
              { label: "Impostos no destino", folder: "impostos-destino" },
              { label: "Comprovantes", folder: "comprovantes" },
              { label: "Registros fiscais", folder: "registros-fiscais" },
              { label: "Importadores", folder: "importadores" },
              { label: "Marketplaces", folder: "marketplaces" },
            ].map(({ label, folder }) => (
              <Link
                key={folder}
                href={`/backoffice/documentos?pasta=${folder}`}
                className="fiscal-chip fiscal-chip-draft"
                style={{ cursor: "pointer", textDecoration: "none" }}
                title={`Abrir pasta ${label} no cofre`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Integrações preparadas" title="Providers desacoplados e auditáveis" />
          <div style={rowGridStyle}>
            {INTEGRATIONS.map(([name, description]) => (
              <article key={name} style={providerRowStyle}>
                <div style={rowContentStyle}>
                  <strong style={providerTitleStyle}>{name}</strong>
                  <small style={providerDescriptionStyle}>{description}</small>
                </div>
                <div style={providerActionsStyle}>
                  <Chip value="waiting_review" />
                  <form action={runInternationalProviderAction.bind(null, name, "configure")}>
                    <button type="submit" className="btn btn-ghost" style={miniButtonStyle}>Configurar</button>
                  </form>
                  <form action={runInternationalProviderAction.bind(null, name, "sync")}>
                    <button type="submit" className="btn btn-gold" style={miniButtonStyle}>Sincronizar</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

const heroStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  padding: 24,
  borderRadius: 18,
};

const cardStyle: CSSProperties = {
  padding: 22,
  borderRadius: 16,
  minWidth: 0,
};

const noticeStyle: CSSProperties = {
  padding: 18,
  borderRadius: 16,
};

const activeModuleIntroStyle: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  borderColor: "rgba(217, 184, 122, 0.26)",
  background: "linear-gradient(135deg, rgba(185, 146, 77, 0.1), rgba(10, 22, 11, 0.2))",
};

const hiddenStyle: CSSProperties = {
  display: "none",
};

const paragraphStyle: CSSProperties = {
  margin: 0,
  lineHeight: 1.72,
  color: "var(--cream)",
};

const subsectionGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const subsectionButtonStyle: CSSProperties = {
  padding: "8px 13px",
  fontSize: 9,
  minHeight: 34,
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

const rowGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const jurisdictionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const jurisdictionCardStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
  borderRadius: 16,
  border: "1px solid var(--glass-border)",
  background: "linear-gradient(135deg, rgba(242, 236, 223, 0.075), rgba(10, 22, 11, 0.24))",
  boxShadow: "0 12px 34px rgba(0, 0, 0, 0.24)",
};

const jurisdictionHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr) auto",
  alignItems: "flex-start",
  gap: 12,
};

const marketAvatarStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(185, 146, 77, 0.16)",
  border: "1px solid rgba(217, 184, 122, 0.34)",
  color: "var(--gold-light)",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
};

const jurisdictionTitleStyle: CSSProperties = {
  color: "var(--cream)",
  fontSize: 17,
  lineHeight: 1.18,
};

const jurisdictionMetaStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  color: "var(--cream-dim)",
  fontSize: 11,
};

const statusStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

const alertGridStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const alertLineStyle: CSSProperties = {
  borderLeft: "2px solid rgba(232, 160, 160, 0.6)",
  paddingLeft: 10,
  color: "var(--cream-dim)",
  fontSize: 12,
  lineHeight: 1.5,
};

const jurisdictionActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid var(--glass-border)",
  background: "rgba(242, 236, 223, 0.055)",
  minWidth: 0,
};

const providerRowStyle: CSSProperties = {
  ...rowStyle,
  alignItems: "center",
};

const rowContentStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const providerTitleStyle: CSSProperties = {
  color: "var(--cream)",
  fontSize: 15,
  lineHeight: 1.2,
};

const providerDescriptionStyle: CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 12,
  lineHeight: 1.45,
};

const providerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const miniButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: "6px 10px",
  fontSize: 8.5,
};

const emptyStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 16,
  borderRadius: 14,
  border: "1px dashed var(--glass-border)",
  color: "var(--cream-dim)",
};

const resultGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const folderGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const incotermsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const incotermsCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: "1px solid var(--glass-border)",
  background: "linear-gradient(135deg, rgba(242,236,223,0.06), rgba(10,22,11,0.22))",
};

const incotermsHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  alignItems: "flex-start",
  gap: 12,
};

const incotermsCodeStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "rgba(185,146,77,0.18)",
  border: "1px solid rgba(217,184,122,0.36)",
  color: "var(--gold-light)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const incotermsRespStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const incotermsLabelStyle: CSSProperties = {
  margin: "0 0 4px",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: "var(--cream-dim)",
};

const incotermsRespItemStyle: CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "var(--cream-dim)",
  lineHeight: 1.5,
};
