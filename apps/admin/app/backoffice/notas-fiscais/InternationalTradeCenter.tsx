import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { money } from "@/lib/format";
import {
  ExportComplianceForm,
  InternationalDocumentForm,
  InternationalOperationForm,
  InternationalRuleForm,
  InternationalShippingForm,
  SeedInternationalTradeButton,
} from "./InternationalTradeForms";

const SUBSECTIONS = [
  "Visão geral",
  "Simulador internacional",
  "Calculadora de landed cost",
  "Operações de exportação",
  "NF-e de exportação",
  "DU-E",
  "Documentos internacionais",
  "Commercial Invoice",
  "Pro Forma Invoice",
  "Packing List",
  "Declarações aduaneiras",
  "Classificação fiscal",
  "NCM, HS Code e códigos locais",
  "Jurisdições",
  "Regras tributárias",
  "IVA, VAT, GST e Sales Tax",
  "Tarifas aduaneiras",
  "Incoterms",
  "Frete internacional",
  "Seguro",
  "Câmbio",
  "Comissões",
  "Marketplaces internacionais",
  "Registros fiscais",
  "Produtos e conformidade",
  "Cofre internacional",
  "Relatórios",
  "Integrações",
  "Configurações",
];

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

export async function InternationalTradeCenter() {
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
  ] = await Promise.all([
    supabase
      .from("jurisdictions")
      .select("id, code, name, scope, currency, package_status, confidence_status, tax_system, official_sources, alerts, version, last_reviewed_at")
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
            <a key={item} href="#comercio-exterior" className="btn btn-ghost" style={subsectionButtonStyle}>{item}</a>
          ))}
        </div>
      </div>

      <div style={kpiGridStyle}>
        <Kpi label="Pacotes de jurisdição" value={String(jurisdictions.length)} note="Brasil, UE, Reino Unido, EUA, Canadá e próximos mercados versionados." />
        <Kpi label="Operações de exportação" value={String(operations.length)} note="Rascunhos, simulações, cotações, documentos e remessas." />
        <Kpi label="Documentos e obrigações" value={String(documents.length)} note={`${docsPending} com obrigatoriedade ou confirmação pendente.`} />
        <Kpi label="Alertas críticos" value={String(openAlerts)} note="Margem, câmbio, Incoterm, compliance, impostos e documentos." />
      </div>

      <div className="glass" style={noticeStyle}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Escopo documental</p>
        <p style={paragraphStyle}>
          O Brasil emite NF-e de exportação e eventos fiscais brasileiros. Documentos como Commercial Invoice, Pro Forma Invoice e Packing List são
          documentos comerciais internacionais. Relatórios de VAT, GST, Sales Tax, IOSS, OSS, EORI e declarações locais são obrigações do destino.
          O sistema não chama tudo de nota fiscal e não transmite nada a órgão oficial sem integração, autorização e validação.
        </p>
      </div>

      <section style={twoColumnStyle}>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Pacotes de jurisdição" title="Mercados, vigência, fonte e confiança" />
          {jurisdictions.length === 0 ? (
            <Empty title="Nenhum pacote instalado" text="Use o botão de instalação para criar Brasil, União Europeia, Reino Unido, Estados Unidos e Canadá como base editável." />
          ) : (
            <div style={rowGridStyle}>
              {jurisdictions.map((item) => (
                <article key={item.id} style={rowStyle}>
                  <div>
                    <strong>{item.code} · {item.name}</strong>
                    <small>{item.scope} · {item.currency} · versão {item.version} · revisão {formatDate(item.last_reviewed_at)}</small>
                    <small>{item.tax_system ?? "Sistema tributário em estruturação."}</small>
                    <small>Fontes: {(item.official_sources ?? []).join(", ") || "não informadas"}</small>
                  </div>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Chip value={item.package_status} />
                    <Chip value={item.confidence_status} />
                  </span>
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

      <InternationalOperationForm jurisdictions={jurisdictionOptions} />

      <section style={twoColumnStyle}>
        <InternationalRuleForm jurisdictions={jurisdictionOptions} />
        <InternationalDocumentForm operations={operationOptions} />
      </section>

      <section style={twoColumnStyle}>
        <InternationalShippingForm operations={operationOptions} />
        <ExportComplianceForm jurisdictions={jurisdictionOptions} operations={operationOptions} />
      </section>

      <section style={twoColumnStyle}>
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

      <section className="glass" style={cardStyle}>
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

      <section style={twoColumnStyle}>
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

      <section style={twoColumnStyle}>
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

      <section style={twoColumnStyle}>
        <div className="glass" style={cardStyle}>
          <SectionTitle eyebrow="Cofre internacional" title="Pastas documentais automáticas" />
          <div style={folderGridStyle}>
            {[
              "Comércio Exterior",
              "Operações",
              "NF-e de exportação",
              "DU-E",
              "Commercial Invoices",
              "Pro Forma Invoices",
              "Packing Lists",
              "Certificados de origem",
              "LPCO",
              "Documentos sanitários",
              "Fretes",
              "Seguros",
              "Câmbio",
              "Impostos no destino",
              "Comprovantes",
              "Registros fiscais",
              "Importadores",
              "Marketplaces",
            ].map((folder) => (
              <span key={folder} className="fiscal-chip fiscal-chip-draft">{folder}</span>
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
                  <a href="#comercio-exterior" className="btn btn-ghost" style={miniButtonStyle}>Configurar</a>
                  <a href="#comercio-exterior" className="btn btn-ghost" style={miniButtonStyle}>Sincronizar</a>
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
