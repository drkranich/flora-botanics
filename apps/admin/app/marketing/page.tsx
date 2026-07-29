import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import {
  createCampaignChannel,
  createMarketingAbTest,
  createMarketingAttributionEvent,
  createMarketingAudience,
  createMarketingCalendarItem,
  createMarketingCostEntry,
  createMarketingJourney,
  createMarketingLandingPage,
  createMarketingQueueItem,
  createMarketingReportExport,
  createMarketingSegment,
  processMarketingQueueNow,
  recordMarketingConsent,
  requeueMarketingDeadLetters,
  requestCampaignApproval,
  reviewCampaignApproval,
  testMarketingProviderConnection,
  upsertMarketingProviderConnection,
} from "./actions";

type CampaignRow = {
  id: string;
  title: string;
  status: string;
  channel: string | null;
  budget_cents: number;
  cost_cents: number;
  revenue_cents: number;
  starts_at: string | null;
};

type NamedRow = { id: string; name: string; status?: string; description?: string | null };
type TemplateRow = { id: string; name: string; channel: string; subject: string | null };
type BlueprintRow = { id: string; name: string; channel: string; category: string; description: string; variables: string[] };
type EventRow = { event_type: string; revenue_cents: number; cost_cents: number; channel: string | null };
type QueueRow = { id: string; channel: string; recipient: string; status: string; run_at: string; attempts: number; last_error: string | null; provider: string | null; external_id: string | null; delivered_at: string | null; opened_at: string | null; clicked_at: string | null };
type CalendarRow = { id: string; title: string; item_type: string; channel: string | null; starts_at: string; status: string; owner_name: string | null };
type ApprovalRow = { id: string; campaign_id: string; status: string; reason: string | null; decision_notes: string | null; requested_at: string };
type CostRow = { id: string; campaign_id: string | null; channel: string | null; provider: string | null; cost_type: string; description: string; quantity: number; unit_cost_cents: number; total_cost_cents: number; occurred_at: string };
type ProviderRow = {
  id: string;
  provider_key: string;
  provider_type: string;
  display_name: string;
  status: string;
  environment: string;
  last_sync_at: string | null;
  last_error: string | null;
  config: Record<string, unknown> | null;
  scopes: string[] | null;
};
type WebhookRow = { id: string; provider: string; event_type: string; created_at: string; queue_id: string | null };
type ProviderLogRow = { id: string; provider: string; action: string; status: string; latency_ms: number | null; error_message: string | null; created_at: string };
type TimelineRow = { id: string; channel: string | null; event_type: string; title: string; description: string | null; occurred_at: string };
type ExportRow = { id: string; report_type: string; format: string; status: string; file_url: string | null; created_at: string };
type AbTestRow = { id: string; name: string; status: string; variable: string; winner_metric: string | null; starts_at: string | null; ends_at: string | null };

const ITEM_TYPE_OPTIONS: GlassSelectOption[] = [
  { value: "campaign", label: "Campanha" },
  { value: "send", label: "Envio" },
  { value: "ad", label: "Anúncio" },
  { value: "launch", label: "Lançamento" },
  { value: "holiday", label: "Data comemorativa" },
  { value: "coupon", label: "Cupom" },
  { value: "landing_page", label: "Landing page" },
  { value: "content", label: "Conteúdo" },
  { value: "task", label: "Tarefa" },
];

const CALENDAR_STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "planned", label: "Planejado" },
  { value: "draft", label: "Rascunho" },
  { value: "review", label: "Em revisão" },
  { value: "approved", label: "Aprovado" },
  { value: "scheduled", label: "Agendado" },
  { value: "active", label: "Ativo" },
  { value: "done", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

const COST_TYPE_OPTIONS: GlassSelectOption[] = [
  { value: "media", label: "Mídia" },
  { value: "message", label: "Mensagem" },
  { value: "creative", label: "Criativo" },
  { value: "tool", label: "Ferramenta" },
  { value: "agency", label: "Agência" },
  { value: "coupon", label: "Cupom" },
  { value: "shipping", label: "Frete" },
  { value: "other", label: "Outro" },
];

const PROVIDER_TYPE_OPTIONS: GlassSelectOption[] = [
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "analytics", label: "Analytics" },
  { value: "crm", label: "CRM" },
  { value: "webhook", label: "Webhook" },
];

const PROVIDER_STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "pending", label: "Pendente" },
  { value: "error", label: "Erro" },
  { value: "paused", label: "Pausado" },
];

const PROVIDER_ENVIRONMENT_OPTIONS: GlassSelectOption[] = [
  { value: "production", label: "Produção" },
  { value: "test", label: "Teste" },
];

const REPORT_FORMAT_OPTIONS: GlassSelectOption[] = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "XLSX" },
];

const AB_STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "draft", label: "Rascunho" },
  { value: "running", label: "Rodando" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

const SUBSECTIONS = [
  "Visão geral",
  "Campanhas",
  "Automação",
  "E-mail marketing",
  "Templates",
  "SMS",
  "WhatsApp Business",
  "Mensagens transacionais",
  "Pós-venda",
  "Carrinhos abandonados",
  "Segmentos",
  "Públicos",
  "Jornadas",
  "Cupons",
  "Landing pages",
  "Meta Ads",
  "Google Ads",
  "Atribuição",
  "Conversões",
  "Leads",
  "Relatórios",
  "Consentimentos",
  "Configurações",
  "Logs e integrações",
];

const CHANNEL_OPTIONS: GlassSelectOption[] = [
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp Business" },
  { value: "internal", label: "Notificação interna" },
  { value: "landing_page", label: "Landing page" },
  { value: "coupon", label: "Cupom" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "remarketing", label: "Público de remarketing" },
];

const STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendada" },
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "sent", label: "Enviada" },
  { value: "cancelled", label: "Cancelada" },
];

const AUDIENCE_TYPE_OPTIONS: GlassSelectOption[] = [
  { value: "dynamic", label: "Dinâmico" },
  { value: "static", label: "Estático" },
];

const CONSENT_CHANNEL_OPTIONS: GlassSelectOption[] = [
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ads", label: "Anúncios" },
  { value: "personalization", label: "Personalização" },
  { value: "cookies", label: "Cookies" },
  { value: "remarketing", label: "Remarketing" },
  { value: "transactional", label: "Transacional" },
];

const CONSENT_STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "granted", label: "Concedido" },
  { value: "revoked", label: "Revogado" },
];

const JOURNEY_TRIGGER_OPTIONS: GlassSelectOption[] = [
  { value: "customer_created", label: "Cliente cadastrado" },
  { value: "lead_captured", label: "Lead capturado" },
  { value: "purchase_completed", label: "Compra realizada" },
  { value: "payment_approved", label: "Pagamento aprovado" },
  { value: "order_shipped", label: "Pedido expedido" },
  { value: "order_delivered", label: "Pedido entregue" },
  { value: "cart_abandoned", label: "Carrinho abandonado" },
  { value: "subscription_created", label: "Assinatura criada" },
  { value: "subscription_renewed", label: "Assinatura renovada" },
  { value: "payment_failed", label: "Pagamento recusado" },
  { value: "birthday", label: "Aniversário" },
  { value: "inactivity", label: "Inatividade" },
  { value: "review_sent", label: "Avaliação enviada" },
  { value: "link_clicked", label: "Link clicado" },
  { value: "campaign_viewed", label: "Campanha acessada" },
  { value: "quote_created", label: "Orçamento criado" },
  { value: "quote_approved", label: "Orçamento aprovado" },
];

const JOURNEY_STEP_OPTIONS: GlassSelectOption[] = [
  { value: "send_email", label: "Enviar e-mail" },
  { value: "send_sms", label: "Enviar SMS" },
  { value: "send_whatsapp", label: "Enviar WhatsApp" },
  { value: "add_tag", label: "Adicionar tag" },
  { value: "create_alert", label: "Criar alerta" },
  { value: "send_coupon", label: "Enviar cupom" },
  { value: "wait", label: "Aguardar" },
  { value: "check_condition", label: "Verificar condição" },
];

const PAGE_STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendada" },
  { value: "published", label: "Publicada" },
  { value: "paused", label: "Pausada" },
];

const SEGMENT_PRESET_OPTIONS: GlassSelectOption[] = [
  { value: "", label: "Escolha um modelo" },
  { value: "cart_total_min", label: "Carrinho acima de um valor" },
  { value: "orders_min", label: "Clientes com compras recorrentes" },
  { value: "last_purchase_days", label: "Cliente sem comprar há X dias" },
  { value: "product_interest", label: "Interesse por produto ou kit" },
  { value: "consent_channel", label: "Consentimento por canal" },
];

const READY_TEMPLATE_CARDS = [
  {
    title: "Pedido expedido",
    category: "Transacional",
    text: "E-mail com transportadora, código de rastreio, link de acompanhamento e histórico do cliente.",
    variables: ["customer.first_name", "order.number", "shipment.tracking_code"],
  },
  {
    title: "Carrinho abandonado",
    category: "Remarketing",
    text: "Modelo editorial com chamada de retorno, benefício, CTA de compra e parada automática ao converter.",
    variables: ["customer.first_name", "cart.link", "coupon.code"],
  },
  {
    title: "Pós-venda ritual",
    category: "Relacionamento",
    text: "Sequência para instruções de uso, avaliação, recompra e cuidado depois da entrega.",
    variables: ["customer.first_name", "product.name", "review.link"],
  },
  {
    title: "Proposta B2B",
    category: "Comercial",
    text: "Template para lojas, clínicas, hotéis e parceiros com proposta, validade e botão de aceite.",
    variables: ["company.name", "quote.number", "cta.url"],
  },
];

const PROVIDER_CARDS = [
  {
    key: "resend",
    name: "Resend",
    type: "email",
    status: "online",
    scopes: "send,templates,webhooks",
    text: "E-mails transacionais, marketing, templates e webhooks de abertura, clique e entrega.",
    secret: "RESEND_API_KEY + RESEND_FROM_EMAIL",
    secretNames: "RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_WEBHOOK_SECRET",
    setup: ["Remetente verificado", "Webhook Resend ativo", "Templates transacionais instalados"],
    fields: {
      account: "contato@florabotanics.com.br",
      webhook: "https://mbpvzhcrimdwcqkqvoqr.supabase.co/functions/v1/resend-webhook",
      sender: "Flora Botanics <contato@florabotanics.com.br>",
    },
  },
  {
    key: "whatsapp_business",
    name: "WhatsApp Business",
    type: "whatsapp",
    status: "pending",
    scopes: "templates,messages,webhooks,opt-out",
    text: "Templates aprovados, rastreamento, pós-venda, respostas e histórico do cliente.",
    secret: "Token do provedor oficial",
    secretNames: "WHATSAPP_PROVIDER_TOKEN, WHATSAPP_WEBHOOK_SECRET",
    setup: ["Conta oficial aprovada", "Templates sincronizados", "Webhook de entrega e resposta"],
    fields: {
      account: "ID da conta WhatsApp Business",
      webhook: "URL do webhook do provedor",
      sender: "Número remetente aprovado",
    },
  },
  {
    key: "sms_provider",
    name: "SMS",
    type: "sms",
    status: "pending",
    scopes: "messages,delivery,costs",
    text: "Avisos curtos, recuperação, entrega e códigos de rastreio com controle de custo.",
    secret: "Chave do provedor de SMS",
    secretNames: "SMS_PROVIDER_API_KEY, SMS_WEBHOOK_SECRET",
    setup: ["Provedor contratado", "Remetente validado", "Status de entrega habilitado"],
    fields: {
      account: "Conta ou subconta SMS",
      webhook: "URL de status de entrega",
      sender: "Nome/número remetente",
    },
  },
  {
    key: "meta_ads",
    name: "Meta Ads",
    type: "meta_ads",
    status: "pending",
    scopes: "campaigns,events,conversions,attribution",
    text: "Campanhas, UTMs, eventos, conversões e receita atribuída sem duplicar eventos.",
    secret: "Token Meta + Pixel",
    secretNames: "META_ACCESS_TOKEN, META_PIXEL_ID",
    setup: ["Conta de anúncios conectada", "Pixel informado", "Deduplicação por event_id"],
    fields: {
      account: "Conta de anúncios / Pixel",
      webhook: "Webhook de conversões",
      sender: "Business Manager",
    },
  },
  {
    key: "google_ads",
    name: "Google Ads",
    type: "google_ads",
    status: "pending",
    scopes: "campaigns,costs,conversions,attribution",
    text: "Custos, cliques, conversões, termos disponíveis e retorno por campanha.",
    secret: "OAuth/conta Google Ads",
    secretNames: "GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN",
    setup: ["OAuth autorizado", "Customer ID vinculado", "Conversões configuradas"],
    fields: {
      account: "Customer ID Google Ads",
      webhook: "Endpoint de conversões",
      sender: "Conta Google autorizada",
    },
  },
];

function optionRows(rows: { id: string; name?: string; title?: string }[], emptyLabel: string): GlassSelectOption[] {
  return [{ value: "", label: emptyLabel }, ...rows.map((row) => ({ value: row.id, label: row.name ?? row.title ?? row.id }))];
}

function visibleTemplateVariables(variables: string[]) {
  return variables.filter((variable) => !variable.toLowerCase().includes("cta"));
}

function humanVariableLabel(variable: string) {
  const labels: Record<string, string> = {
    "customer.first_name": "Nome do cliente",
    "customer.name": "Cliente",
    "order.number": "Pedido",
    "shipment.tracking_code": "Rastreio",
    "shipment.tracking_url": "Link de rastreio",
    "coupon.code": "Cupom",
    "cart.link": "Carrinho",
    "cart.url": "Carrinho",
    "review.link": "Avaliação",
    "review.url": "Avaliação",
    "quote.number": "Orçamento",
    "company.name": "Empresa",
    "product.name": "Produto",
  };
  return labels[variable] ?? variable.replaceAll("_", " ").replaceAll(".", " ");
}

export default async function MarketingPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [
    campaignsRes,
    audiencesRes,
    segmentsRes,
    channelsRes,
    journeysRes,
    templatesRes,
    blueprintsRes,
    consentsRes,
    eventsRes,
    queueRes,
    landingPagesRes,
    calendarRes,
    approvalsRes,
    costsRes,
    providersRes,
    providerLogsRes,
    webhooksRes,
    timelineRes,
    exportsRes,
    abTestsRes,
    leadsRes,
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, status, channel, budget_cents, cost_cents, revenue_cents, starts_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("marketing_audiences")
      .select("id, name, status, description")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("marketing_segments")
      .select("id, name, status, description")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("marketing_campaign_channels")
      .select("id, channel, status, subject, send_at, campaign_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("marketing_journeys")
      .select("id, name, status, description")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("message_templates")
      .select("id, name, channel, subject")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("marketing_template_blueprints")
      .select("id, name, channel, category, description, variables")
      .order("category")
      .limit(80),
    supabase
      .from("marketing_consents")
      .select("id, channel, status")
      .eq("tenant_id", tenantId)
      .order("changed_at", { ascending: false })
      .limit(200),
    supabase
      .from("marketing_events")
      .select("event_type, revenue_cents, cost_cents, channel")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false })
      .limit(500),
    supabase
      .from("marketing_message_queue")
      .select("id, channel, recipient, status, run_at, attempts, last_error, provider, external_id, delivered_at, opened_at, clicked_at")
      .eq("tenant_id", tenantId)
      .order("run_at", { ascending: false })
      .limit(30),
    supabase
      .from("marketing_landing_pages")
      .select("id, name:title, status, description:slug")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("marketing_calendar_items")
      .select("id, title, item_type, channel, starts_at, status, owner_name")
      .eq("tenant_id", tenantId)
      .order("starts_at", { ascending: true })
      .limit(60),
    supabase
      .from("marketing_campaign_approvals")
      .select("id, campaign_id, status, reason, decision_notes, requested_at")
      .eq("tenant_id", tenantId)
      .order("requested_at", { ascending: false })
      .limit(40),
    supabase
      .from("marketing_cost_entries")
      .select("id, campaign_id, channel, provider, cost_type, description, quantity, unit_cost_cents, total_cost_cents, occurred_at")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false })
      .limit(80),
    supabase
      .from("marketing_provider_connections")
      .select("id, provider_key, provider_type, display_name, status, environment, last_sync_at, last_error, config, scopes")
      .eq("tenant_id", tenantId)
      .order("provider_type")
      .limit(40),
    supabase
      .from("marketing_provider_logs")
      .select("id, provider, action, status, latency_ms, error_message, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("marketing_webhook_events")
      .select("id, provider, event_type, created_at, queue_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("marketing_customer_timeline")
      .select("id, channel, event_type, title, description, occurred_at")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false })
      .limit(40),
    supabase
      .from("marketing_report_exports")
      .select("id, report_type, format, status, file_url, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("marketing_ab_tests")
      .select("id, name, status, variable, winner_metric, starts_at, ends_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  const foundationError =
    campaignsRes.error ||
    audiencesRes.error ||
    segmentsRes.error ||
    channelsRes.error ||
    journeysRes.error ||
    blueprintsRes.error ||
    consentsRes.error ||
    eventsRes.error ||
    queueRes.error ||
    landingPagesRes.error ||
    calendarRes.error ||
    approvalsRes.error ||
    costsRes.error ||
    providersRes.error ||
    providerLogsRes.error ||
    webhooksRes.error ||
    timelineRes.error ||
    exportsRes.error ||
    abTestsRes.error;

  if (foundationError) {
    return (
      <main style={pageStyle}>
        <Header />
        <section className="glass rise" style={{ padding: 22, borderColor: "rgba(232,160,160,0.45)" }}>
          <p className="eyebrow" style={{ color: "#e8a0a0", marginBottom: 8 }}>Migration pendente</p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Aplique a migration `20260728215919_marketing_relationship_foundation.sql` para liberar
            Marketing e Relacionamento. Depois desta aplicação, a página passa a exibir públicos,
            jornadas, consentimentos, filas e biblioteca de templates.
          </p>
        </section>
      </main>
    );
  }

  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const audiences = (audiencesRes.data ?? []) as NamedRow[];
  const segments = (segmentsRes.data ?? []) as NamedRow[];
  const journeys = (journeysRes.data ?? []) as NamedRow[];
  const templates = (templatesRes.data ?? []) as TemplateRow[];
  const blueprints = (blueprintsRes.data ?? []) as BlueprintRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const queue = (queueRes.data ?? []) as QueueRow[];
  const landingPages = (landingPagesRes.data ?? []) as NamedRow[];
  const calendarItems = (calendarRes.data ?? []) as CalendarRow[];
  const approvals = (approvalsRes.data ?? []) as ApprovalRow[];
  const costs = (costsRes.data ?? []) as CostRow[];
  const providers = (providersRes.data ?? []) as ProviderRow[];
  const providerLogs = (providerLogsRes.data ?? []) as ProviderLogRow[];
  const webhooks = (webhooksRes.data ?? []) as WebhookRow[];
  const timeline = (timelineRes.data ?? []) as TimelineRow[];
  const reportExports = (exportsRes.data ?? []) as ExportRow[];
  const abTests = (abTestsRes.data ?? []) as AbTestRow[];
  const channels = channelsRes.data ?? [];
  const consents = consentsRes.data ?? [];

  const sent = events.filter((e) => e.event_type === "sent").length;
  const delivered = events.filter((e) => e.event_type === "delivered").length;
  const opened = events.filter((e) => e.event_type === "opened").length;
  const clicked = events.filter((e) => e.event_type === "clicked").length;
  const conversions = events.filter((e) => e.event_type === "conversion").length;
  const failures = events.filter((e) => e.event_type === "failure").length;
  const revenue = campaigns.reduce((sum, row) => sum + (row.revenue_cents ?? 0), 0) + events.reduce((sum, row) => sum + (row.revenue_cents ?? 0), 0);
  const cost =
    campaigns.reduce((sum, row) => sum + ((row.cost_cents ?? 0) || (row.budget_cents ?? 0)), 0) +
    events.reduce((sum, row) => sum + (row.cost_cents ?? 0), 0) +
    costs.reduce((sum, row) => sum + (row.total_cost_cents ?? 0), 0);
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
  const activeCampaigns = campaigns.filter((c) => ["active", "ativa"].includes(c.status)).length;
  const scheduledCampaigns = campaigns.filter((c) => ["scheduled", "agendada"].includes(c.status)).length;
  const finishedCampaigns = campaigns.filter((c) => ["ended", "completed", "concluida", "concluída"].includes(c.status)).length;
  const grantedConsents = consents.filter((c) => c.status === "granted").length;

  const campaignOptions = optionRows(campaigns, "Selecione a campanha");
  const audienceOptions = optionRows(audiences, "Sem público específico");
  const segmentOptions = optionRows(segments, "Sem segmento específico");
  const templateOptions = optionRows(templates, "Sem template");
  const pendingApprovals = approvals.filter((item) => item.status === "pending");
  const deadQueue = queue.filter((item) => item.status === "dead");
  const onlineProviders = providers.filter((item) => item.status === "online").length;

  return (
    <main style={pageStyle}>
      <Header />

      <section id="visao-geral" className="rise" style={kpiGridStyle}>
        <Kpi label="Campanhas ativas" value={`${activeCampaigns}`} note={`${scheduledCampaigns} agendadas · ${finishedCampaigns} concluídas`} />
        <Kpi label="Contatos e leads" value={`${leadsRes.count ?? 0}`} note={`${audiences.length} públicos · ${segments.length} segmentos`} />
        <Kpi label="Mensagens" value={`${sent}`} note={`${delivered} entregues · ${opened} abertas · ${clicked} cliques`} />
        <Kpi label="Conversões" value={`${conversions}`} note={`${money(revenue)} atribuídos · ROI ${roi.toFixed(1)}%`} tone="rose" />
        <Kpi label="Consentimentos" value={`${grantedConsents}`} note="marketing separado de mensagens transacionais" />
        <Kpi label="Falhas" value={`${failures}`} note={`${queue.filter((q) => q.status === "queued").length} itens na fila`} tone={failures ? "alert" : "default"} />
        <Kpi label="Aprovações" value={`${pendingApprovals.length}`} note={`${approvals.length} solicitações registradas`} tone={pendingApprovals.length ? "alert" : "default"} />
        <Kpi label="Integrações" value={`${onlineProviders}`} note={`${providers.length} provedores configurados`} />
        <Kpi label="Dead-letter" value={`${deadQueue.length}`} note="mensagens bloqueadas para reprocessamento manual" tone={deadQueue.length ? "alert" : "default"} />
      </section>

      <section className="glass rise rise-1" style={cardStyle}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Subseções do módulo</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUBSECTIONS.map((label) => (
            <a key={label} href={subsectionHref(label)} className="finance-subsection-link">
              {label}
            </a>
          ))}
        </div>
      </section>

      <section className="glass rise rise-1" style={cardStyle}>
        <div style={sectionHeaderInlineStyle}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Templates prontos para usar</p>
            <h2 style={{ margin: 0, fontSize: 28 }}>Modelos Flora editáveis, sem programação</h2>
            <p className="muted" style={{ ...mutedTextStyle, maxWidth: 820, marginTop: 8 }}>
              Escolha um modelo, instale no tenant e ajuste no editor visual. As variáveis são preenchidas pelo
              sistema a partir de clientes, pedidos, carrinhos, etiquetas, cupons e campanhas.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href="/marketing/templates" className="btn btn-gold" style={{ padding: "9px 16px", fontSize: 10 }}>
              Abrir modelos
            </Link>
            <Link href="/backoffice/mensagens" className="btn btn-ghost" style={{ padding: "9px 16px", fontSize: 10 }}>
              Editor visual
            </Link>
          </div>
        </div>
        <div style={readyTemplateGridStyle}>
          {READY_TEMPLATE_CARDS.map((template) => (
            <article key={template.title} style={readyTemplateCardStyle}>
              <span className="chip chip-draft">{template.category}</span>
              <h3 style={{ margin: "14px 0 8px", fontSize: 21 }}>{template.title}</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.65, fontSize: 12.5 }}>{template.text}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                {visibleTemplateVariables(template.variables).map((variable) => (
                  <span key={variable} style={variablePillStyle}>{humanVariableLabel(variable)}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="campanhas" style={twoColumnStyle}>
        <Panel title="Campanhas multicanal" eyebrow="Campanhas" actionHref="./vendas/campanhas" actionLabel="Abrir campanhas">
          <p className="muted" style={mutedTextStyle}>
            Uma campanha pode combinar e-mail, SMS, WhatsApp, landing page, cupons, Meta Ads,
            Google Ads e públicos de remarketing com métricas próprias por canal.
          </p>
          <form action={createCampaignChannel} style={formGridStyle}>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha" inlineMenu />
            </Field>
            <Field label="Canal">
              <GlassSelect name="channel" options={CHANNEL_OPTIONS} ariaLabel="Canal da campanha" inlineMenu />
            </Field>
            <Field label="Template">
              <GlassSelect name="template_id" options={templateOptions} ariaLabel="Template" inlineMenu />
            </Field>
            <Field label="Segmento">
              <GlassSelect name="segment_id" options={segmentOptions} ariaLabel="Segmento" inlineMenu />
            </Field>
            <Field label="Público">
              <GlassSelect name="audience_id" options={audienceOptions} ariaLabel="Público" inlineMenu />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" options={STATUS_OPTIONS} ariaLabel="Status" inlineMenu />
            </Field>
            <Field label="Data e horário">
              <GlassDateInput name="send_at" withTime placeholder="Agendar envio" inlinePopover />
            </Field>
            <Field label="Assunto">
              <input name="subject" style={inputStyle} placeholder="Assunto do e-mail ou campanha" />
            </Field>
            <Field label="Preheader">
              <input name="preheader" style={inputStyle} placeholder="Resumo curto da mensagem" />
            </Field>
            <Field label="UTM origem">
              <input name="utm_source" style={inputStyle} placeholder="ex: newsletter" />
            </Field>
            <Field label="UTM mídia">
              <input name="utm_medium" style={inputStyle} placeholder="ex: email" />
            </Field>
            <Field label="UTM conteúdo">
              <input name="utm_content" style={inputStyle} placeholder="ex: botao-principal" />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Mensagem</label>
              <textarea name="message" rows={4} style={textareaStyle} placeholder="Mensagem própria deste canal." />
            </div>
            <button className="btn btn-gold" style={buttonStyle}>Adicionar canal</button>
          </form>
        </Panel>

        <Panel title="Canais configurados" eyebrow="Operação">
          <ListEmpty when={!channels.length} text="Nenhum canal multicanal cadastrado ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {channels.slice(0, 8).map((row) => (
              <div key={row.id} style={rowStyle}>
                <span className="chip chip-draft">{channelLabel(row.channel)}</span>
                <strong>{row.subject ?? "Sem assunto"}</strong>
                <span className="muted">{statusLabel(row.status)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="e-mail-marketing" style={twoColumnStyle}>
        <Panel title="Biblioteca de templates" eyebrow="Templates / Resend" actionHref="/marketing/templates" actionLabel="Abrir biblioteca">
          <p className="muted" style={mutedTextStyle}>
            Modelos Flora prontos para lançamento, promoção, boas-vindas, rastreamento,
            carrinho abandonado, pós-venda, B2B, orçamento e datas comemorativas.
          </p>
          <div style={readyTemplateGridStyle}>
            {blueprints.slice(0, 10).map((template) => (
              <article key={template.id} style={{ ...readyTemplateCardStyle, minHeight: 220 }}>
                <span className="chip chip-draft" style={{ width: "fit-content" }}>{template.category}</span>
                <h3 style={{ margin: "14px 0 8px", fontSize: 20 }}>{template.name}</h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65, fontSize: 12.5 }}>{template.description}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                  {visibleTemplateVariables(template.variables).slice(0, 3).map((variable) => (
                    <span key={variable} style={variablePillStyle}>{humanVariableLabel(variable)}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Templates editáveis do tenant" eyebrow="E-mail marketing">
          <ListEmpty when={!templates.length} text="Nenhum template salvo ainda. Use a biblioteca Flora em Backoffice > Mensagens para instalar modelos." />
          <div style={{ display: "grid", gap: 10 }}>
            {templates.slice(0, 8).map((template) => (
              <div key={template.id} style={rowStyle}>
                <span className="chip chip-live">{channelLabel(template.channel)}</span>
                <strong>{template.name}</strong>
                <span className="muted">{template.subject ?? "Sem assunto"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="segmentos" style={twoColumnStyle}>
        <Panel title="Criar público" eyebrow="Públicos">
          <form action={createMarketingAudience} style={formGridStyle}>
            <Field label="Nome">
              <input name="name" required style={inputStyle} placeholder="Clientes skincare recorrentes" />
            </Field>
            <Field label="Tipo">
              <GlassSelect name="audience_type" options={AUDIENCE_TYPE_OPTIONS} ariaLabel="Tipo de público" inlineMenu />
            </Field>
            <Field label="Tags">
              <input name="tags" style={inputStyle} placeholder="skincare, recorrente, alto valor" />
            </Field>
            <Field label="Modelo pronto">
              <GlassSelect name="segment_preset" options={SEGMENT_PRESET_OPTIONS} ariaLabel="Modelo do público" inlineMenu />
            </Field>
            <Field label="Cidade">
              <input name="city" style={inputStyle} placeholder="São Paulo" />
            </Field>
            <Field label="Estado">
              <input name="state" style={inputStyle} placeholder="SP" />
            </Field>
            <Field label="Origem">
              <input name="source" style={inputStyle} placeholder="site, campanha, checkout" />
            </Field>
            <Field label="Valor mínimo do carrinho">
              <input name="cart_total_min" style={inputStyle} placeholder="150,00" inputMode="decimal" />
            </Field>
            <Field label="Pedidos mínimos">
              <input name="orders_min" style={inputStyle} placeholder="2" inputMode="numeric" />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Descrição</label>
              <textarea name="description" rows={3} style={textareaStyle} placeholder="Critério comercial e objetivo deste público." />
            </div>
            <button className="btn btn-gold" style={buttonStyle}>Criar público</button>
          </form>
        </Panel>

        <Panel title="Criar segmento" eyebrow="Segmentos">
          <form action={createMarketingSegment} style={formGridStyle}>
            <Field label="Nome">
              <input name="name" required style={inputStyle} placeholder="Carrinho acima de R$ 150" />
            </Field>
            <Field label="Público base">
              <GlassSelect name="audience_id" options={audienceOptions} ariaLabel="Público base" inlineMenu />
            </Field>
            <Field label="Tipo">
              <GlassSelect name="segment_type" options={AUDIENCE_TYPE_OPTIONS} ariaLabel="Tipo de segmento" inlineMenu />
            </Field>
            <Field label="Tags">
              <input name="tags" style={inputStyle} placeholder="carrinho, remarketing" />
            </Field>
            <Field label="Modelo pronto">
              <GlassSelect name="segment_preset" options={SEGMENT_PRESET_OPTIONS} ariaLabel="Modelo do segmento" inlineMenu />
            </Field>
            <Field label="Valor mínimo do carrinho">
              <input name="cart_total_min" style={inputStyle} placeholder="150,00" inputMode="decimal" />
            </Field>
            <Field label="Produto ou kit">
              <input name="product_interest" style={inputStyle} placeholder="Sérum, Ritual das Camadas..." />
            </Field>
            <Field label="Canal com consentimento">
              <GlassSelect name="consent_channel" options={CONSENT_CHANNEL_OPTIONS} ariaLabel="Canal com consentimento" inlineMenu />
            </Field>
            <Field label="Dias sem compra">
              <input name="last_purchase_days" style={inputStyle} placeholder="60" inputMode="numeric" />
            </Field>
            <button className="btn btn-gold" style={buttonStyle}>Criar segmento</button>
          </form>
        </Panel>
      </section>

      <section id="jornadas" style={twoColumnStyle}>
        <Panel title="Criar jornada" eyebrow="Automação">
          <form action={createMarketingJourney} style={formGridStyle}>
            <Field label="Nome">
              <input name="name" required style={inputStyle} placeholder="Pós-venda após entrega" />
            </Field>
            <Field label="Gatilho">
              <GlassSelect name="trigger_key" options={JOURNEY_TRIGGER_OPTIONS} ariaLabel="Gatilho da jornada" inlineMenu />
            </Field>
            <Field label="Primeira ação">
              <GlassSelect name="first_step" options={JOURNEY_STEP_OPTIONS} ariaLabel="Primeira ação" inlineMenu />
            </Field>
            <Field label="Template">
              <GlassSelect name="template_id" options={templateOptions} ariaLabel="Template da jornada" inlineMenu />
            </Field>
            <Field label="Aguardar dias">
              <input name="wait_days" style={inputStyle} placeholder="2" inputMode="numeric" />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" options={STATUS_OPTIONS} ariaLabel="Status da jornada" inlineMenu />
            </Field>
            <input type="hidden" name="schedule_rules" value='{"timezone":"America/Sao_Paulo","quiet_hours":["21:00","08:00"]}' />
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Descrição</label>
              <textarea name="description" rows={3} style={textareaStyle} placeholder="Objetivo, condição de parada e cuidado com consentimento." />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--cream-dim)", fontSize: 12 }}>
              <input type="checkbox" name="approval_required" /> Exigir aprovação antes de ativar
            </label>
            <button className="btn btn-gold" style={buttonStyle}>Criar jornada</button>
          </form>
        </Panel>

        <Panel title="Jornadas ativas" eyebrow="Pós-venda / Carrinhos / Transacional">
          <ListEmpty when={!journeys.length} text="Nenhuma jornada cadastrada ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {journeys.slice(0, 8).map((journey) => (
              <div key={journey.id} style={rowStyle}>
                <span className="chip chip-draft">{statusLabel(journey.status ?? "draft")}</span>
                <strong>{journey.name}</strong>
                <span className="muted">{journey.description ?? "Sem descrição"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="landing-pages" style={twoColumnStyle}>
        <Panel title="Landing page de campanha" eyebrow="Landing pages">
          <form action={createMarketingLandingPage} style={formGridStyle}>
            <Field label="Título">
              <input name="title" required style={inputStyle} placeholder="Lançamento Ritual das Camadas" />
            </Field>
            <Field label="Slug">
              <input name="slug" required style={inputStyle} placeholder="ritual-das-camadas" />
            </Field>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha da landing page" inlineMenu />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" options={PAGE_STATUS_OPTIONS} ariaLabel="Status da landing page" inlineMenu />
            </Field>
            <Field label="Publicar em">
              <GlassDateInput name="publish_at" withTime placeholder="Opcional" inlinePopover />
            </Field>
            <input type="hidden" name="template_key" value="editorial-campanha" />
            <Field label="Chamada curta">
              <input name="eyebrow" style={inputStyle} placeholder="Lançamento Flora" />
            </Field>
            <Field label="Headline pública">
              <input name="headline" style={inputStyle} placeholder="Uma nova rotina para sua pele" />
            </Field>
            <Field label="CTA">
              <input name="cta_label" style={inputStyle} placeholder="Conhecer produtos" />
            </Field>
            <Field label="Link do CTA">
              <input name="cta_url" style={inputStyle} placeholder="/produtos" />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Introdução</label>
              <textarea name="intro" rows={3} style={textareaStyle} placeholder="Resumo editorial da campanha." />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Texto da landing</label>
              <textarea name="body" rows={5} style={textareaStyle} placeholder="Conteúdo principal publicado no storefront." />
            </div>
            <Field label="Bloco 1: benefício">
              <input name="benefit_title" style={inputStyle} placeholder="Benefício principal" />
            </Field>
            <Field label="Texto do benefício">
              <input name="benefit_text" style={inputStyle} placeholder="O que esta campanha entrega para o cliente." />
            </Field>
            <Field label="Bloco 2: produto ou kit">
              <input name="product_title" style={inputStyle} placeholder="Produto, kit ou ritual" />
            </Field>
            <Field label="Texto do produto">
              <input name="product_text" style={inputStyle} placeholder="Resumo curto do item promovido." />
            </Field>
            <Field label="Bloco 3: prova social">
              <input name="testimonial_title" style={inputStyle} placeholder="Depoimento, avaliação ou garantia" />
            </Field>
            <Field label="Texto da prova social">
              <input name="testimonial_text" style={inputStyle} placeholder="Frase de apoio para aumentar confiança." />
            </Field>
            <Field label="SEO título">
              <input name="seo_title" style={inputStyle} placeholder="Título para busca" />
            </Field>
            <Field label="SEO descrição">
              <input name="seo_description" style={inputStyle} placeholder="Descrição curta" />
            </Field>
            <Field label="UTM origem">
              <input name="utm_source" style={inputStyle} placeholder="instagram" />
            </Field>
            <Field label="UTM mídia">
              <input name="utm_medium" style={inputStyle} placeholder="social" />
            </Field>
            <button className="btn btn-gold" style={buttonStyle}>Criar landing page</button>
          </form>
        </Panel>

        <Panel title="Páginas de campanha" eyebrow="Publicação">
          <ListEmpty when={!landingPages.length} text="Nenhuma landing page cadastrada ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {landingPages.slice(0, 8).map((page) => (
              <div key={page.id} style={rowStyle}>
                <span className="chip chip-draft">{statusLabel(page.status ?? "draft")}</span>
                <strong>{page.name}</strong>
                <span className="muted">/{page.description}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="consentimentos" style={twoColumnStyle}>
        <Panel title="Registrar consentimento" eyebrow="LGPD / Preferências">
          <form action={recordMarketingConsent} style={formGridStyle}>
            <Field label="E-mail">
              <input name="email" style={inputStyle} placeholder="cliente@email.com" />
            </Field>
            <Field label="Telefone">
              <input name="phone" style={inputStyle} placeholder="+55..." />
            </Field>
            <Field label="Canal">
              <GlassSelect name="channel" options={CONSENT_CHANNEL_OPTIONS} ariaLabel="Canal do consentimento" inlineMenu />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" options={CONSENT_STATUS_OPTIONS} ariaLabel="Status do consentimento" inlineMenu />
            </Field>
            <Field label="Finalidade">
              <input name="purpose" defaultValue="marketing" style={inputStyle} />
            </Field>
            <Field label="Origem">
              <input name="source" style={inputStyle} placeholder="checkout, conta, landing page" />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Texto apresentado</label>
              <textarea name="text_presented" rows={3} style={textareaStyle} placeholder="Texto aceito ou revogado pelo cliente." />
            </div>
            <button className="btn btn-gold" style={buttonStyle}>Registrar consentimento</button>
          </form>
        </Panel>

        <Panel title="Fila, retentativas e idempotência" eyebrow="Envios seguros">
          <form action={createMarketingQueueItem} style={formGridStyle}>
            <Field label="Canal">
              <GlassSelect name="channel" options={CHANNEL_OPTIONS.filter((c) => ["email", "sms", "whatsapp", "internal"].includes(c.value))} ariaLabel="Canal da fila" inlineMenu />
            </Field>
            <Field label="Destinatário">
              <input name="recipient" required style={inputStyle} placeholder="email, telefone ou usuário interno" />
            </Field>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha da fila" inlineMenu />
            </Field>
            <Field label="Template">
              <GlassSelect name="template_id" options={templateOptions} ariaLabel="Template da fila" inlineMenu />
            </Field>
            <Field label="Executar em">
              <GlassDateInput name="run_at" withTime placeholder="Agora" inlinePopover />
            </Field>
            <Field label="Prioridade">
              <input name="priority" style={inputStyle} placeholder="5" inputMode="numeric" />
            </Field>
            <Field label="Nome do cliente">
              <input name="customer_first_name" style={inputStyle} placeholder="Gustavo" />
            </Field>
            <Field label="Número do pedido">
              <input name="order_number" style={inputStyle} placeholder="1001" />
            </Field>
            <Field label="Valor do pedido">
              <input name="order_value" style={inputStyle} placeholder="R$ 189,90" />
            </Field>
            <Field label="Código de rastreio">
              <input name="shipment_tracking_code" style={inputStyle} placeholder="BR123456789" />
            </Field>
            <Field label="Link de rastreio">
              <input name="shipment_tracking_url" style={inputStyle} placeholder="https://..." />
            </Field>
            <Field label="Cupom">
              <input name="coupon_code" style={inputStyle} placeholder="VOLTE10" />
            </Field>
            <Field label="Link do botão">
              <input name="cta_url" style={inputStyle} placeholder="https://florabotanics.com.br/..." />
            </Field>
            <button className="btn btn-gold" style={buttonStyle}>Enfileirar envio</button>
          </form>
        </Panel>
      </section>

      <section id="atribuicao" style={twoColumnStyle}>
        <Panel title="UTMs, atribuição e conversões" eyebrow="Atribuição">
          <form action={createMarketingAttributionEvent} style={formGridStyle}>
            <Field label="Evento">
              <input name="event_name" required style={inputStyle} placeholder="purchase, lead, add_to_cart" />
            </Field>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha atribuída" inlineMenu />
            </Field>
            <Field label="Origem">
              <input name="source" style={inputStyle} placeholder="meta, google, newsletter" />
            </Field>
            <Field label="Mídia">
              <input name="medium" style={inputStyle} placeholder="cpc, email, social" />
            </Field>
            <Field label="Campanha UTM">
              <input name="campaign" style={inputStyle} placeholder="lançamento-julho" />
            </Field>
            <Field label="Receita">
              <input name="revenue" style={inputStyle} placeholder="0,00" inputMode="decimal" />
            </Field>
            <Field label="Modelo">
              <input name="model" style={inputStyle} placeholder="último contato não direto" />
            </Field>
            <Field label="Conteúdo">
              <input name="content" style={inputStyle} placeholder="criativo-a" />
            </Field>
            <button className="btn btn-gold" style={buttonStyle}>Registrar evento</button>
          </form>
        </Panel>

        <Panel title="Próximos envios" eyebrow="Monitoramento">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <p className="muted" style={{ margin: 0, maxWidth: 520, fontSize: 12.5, lineHeight: 1.6 }}>
              O executor envia e-mails via Resend, registra eventos, guarda logs do provedor e reagenda falhas
              com retentativa automática. SMS e WhatsApp permanecem enfileirados até o provedor oficial ser ativado.
            </p>
            <form action={processMarketingQueueNow}>
              <button className="btn btn-gold" style={{ ...buttonStyle, minWidth: 190 }}>
                Processar fila agora
              </button>
            </form>
          </div>
          <ListEmpty when={!queue.length} text="Nenhum envio enfileirado ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {queue.slice(0, 8).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-draft">{channelLabel(item.channel)}</span>
                <strong>{item.recipient}</strong>
                <span className="muted">{statusLabel(item.status)} · tentativas {item.attempts}</span>
                {item.last_error ? (
                  <span style={{ color: "#e8a0a0", fontSize: 11, lineHeight: 1.5 }}>{item.last_error}</span>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="calendario" style={twoColumnStyle}>
        <Panel title="Calendário de marketing" eyebrow="Agenda operacional">
          <form action={createMarketingCalendarItem} style={formGridStyle}>
            <Field label="Título">
              <input name="title" required style={inputStyle} placeholder="Envio de campanha de recompra" />
            </Field>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha do calendário" inlineMenu />
            </Field>
            <Field label="Tipo">
              <GlassSelect name="item_type" options={ITEM_TYPE_OPTIONS} ariaLabel="Tipo do item" inlineMenu />
            </Field>
            <Field label="Canal">
              <GlassSelect name="channel" options={CHANNEL_OPTIONS} ariaLabel="Canal do item" inlineMenu />
            </Field>
            <Field label="Início">
              <GlassDateInput name="starts_at" withTime placeholder="Data e horário" inlinePopover />
            </Field>
            <Field label="Fim">
              <GlassDateInput name="ends_at" withTime placeholder="Opcional" inlinePopover />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" options={CALENDAR_STATUS_OPTIONS} ariaLabel="Status do calendário" inlineMenu />
            </Field>
            <Field label="Responsável">
              <input name="owner_name" style={inputStyle} placeholder="Equipe ou responsável" />
            </Field>
            <input type="hidden" name="metadata" value="{}" />
            <button className="btn btn-gold" style={buttonStyle}>Adicionar ao calendário</button>
          </form>
        </Panel>

        <Panel title="Próximas ações" eyebrow="Calendário">
          <ListEmpty when={!calendarItems.length} text="Nenhuma ação de marketing agendada ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {calendarItems.slice(0, 8).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-draft">{statusLabel(item.status)}</span>
                <strong>{item.title}</strong>
                <span className="muted">{itemTypeLabel(item.item_type)} · {formatDateTime(item.starts_at)}</span>
                <span className="muted">{item.owner_name ?? channelLabel(item.channel)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="aprovacoes" style={twoColumnStyle}>
        <Panel title="Solicitar aprovação de campanha" eyebrow="Governança">
          <form action={requestCampaignApproval} style={formGridStyle}>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha para aprovação" inlineMenu />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Motivo</label>
              <textarea name="reason" required rows={4} style={textareaStyle} placeholder="Descreva investimento, público, risco, desconto, meta e por que precisa de aprovação." />
            </div>
            <button className="btn btn-gold" style={buttonStyle}>Enviar para aprovação</button>
          </form>
        </Panel>

        <Panel title="Aprovações pendentes" eyebrow="Fluxo de campanha">
          <ListEmpty when={!approvals.length} text="Nenhuma aprovação registrada ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {approvals.slice(0, 8).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className={item.status === "approved" ? "chip chip-live" : "chip chip-draft"}>{statusLabel(item.status)}</span>
                <strong>{campaigns.find((campaign) => campaign.id === item.campaign_id)?.title ?? "Campanha"}</strong>
                <span className="muted">{item.reason ?? "Sem justificativa"} · {formatDateTime(item.requested_at)}</span>
                {item.status === "pending" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", gridColumn: "1 / -1" }}>
                    <form action={reviewCampaignApproval}>
                      <input type="hidden" name="approval_id" value={item.id} />
                      <input type="hidden" name="campaign_id" value={item.campaign_id} />
                      <input type="hidden" name="status" value="approved" />
                      <button className="btn btn-gold" style={{ padding: "7px 12px", fontSize: 9 }}>Aprovar</button>
                    </form>
                    <form action={reviewCampaignApproval}>
                      <input type="hidden" name="approval_id" value={item.id} />
                      <input type="hidden" name="campaign_id" value={item.campaign_id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 9 }}>Reprovar</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="custos" style={twoColumnStyle}>
        <Panel title="Controle de custos por envio e campanha" eyebrow="Custos / ROI">
          <form action={createMarketingCostEntry} style={formGridStyle}>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha do custo" inlineMenu />
            </Field>
            <Field label="Tipo de custo">
              <GlassSelect name="cost_type" options={COST_TYPE_OPTIONS} ariaLabel="Tipo de custo" inlineMenu />
            </Field>
            <Field label="Canal">
              <GlassSelect name="channel" options={CHANNEL_OPTIONS} ariaLabel="Canal do custo" inlineMenu />
            </Field>
            <Field label="Provedor">
              <input name="provider" style={inputStyle} placeholder="resend, meta, google..." />
            </Field>
            <Field label="Quantidade">
              <input name="quantity" style={inputStyle} inputMode="decimal" placeholder="1" />
            </Field>
            <Field label="Custo unitário">
              <input name="unit_cost" style={inputStyle} inputMode="decimal" placeholder="0,00" />
            </Field>
            <Field label="Data">
              <GlassDateInput name="occurred_at" placeholder="Hoje" inlinePopover />
            </Field>
            <Field label="Descrição">
              <input name="description" required style={inputStyle} placeholder="Disparo, criativo, mídia, agência..." />
            </Field>
            <input type="hidden" name="metadata" value="{}" />
            <button className="btn btn-gold" style={buttonStyle}>Registrar custo</button>
          </form>
        </Panel>

        <Panel title="Custos registrados" eyebrow="Rentabilidade">
          <p className="muted" style={mutedTextStyle}>
            Total considerado no ROI: <strong style={{ color: "var(--cream)" }}>{money(cost)}</strong>
          </p>
          <ListEmpty when={!costs.length} text="Nenhum custo de marketing registrado ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {costs.slice(0, 8).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-draft">{costTypeLabel(item.cost_type)}</span>
                <strong>{item.description}</strong>
                <span className="muted">{money(item.total_cost_cents)} · {item.channel ? channelLabel(item.channel) : "Sem canal"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="integracoes" style={twoColumnStyle}>
        <Panel title="Conectar APIs" eyebrow="SMS / WhatsApp / Ads / Webhooks">
          <p className="muted" style={mutedTextStyle}>
            Cadastre a conexão operacional sem expor segredo na tela. As chaves continuam em Secrets do
            Cloudflare/Supabase; aqui o CMS apenas sabe qual provedor está ativo e o que ele pode fazer.
          </p>
          <div style={providerCardGridStyle}>
            {PROVIDER_CARDS.map((provider) => {
              const connection = providers.find((item) => item.provider_key === provider.key);
              const config = providerConfig(connection);
              const logs = providerLogs.filter((log) => log.provider === provider.key).slice(0, 2);
              const status = connection?.status ?? provider.status;

              return (
              <form key={provider.key} action={upsertMarketingProviderConnection} style={providerCardStyle}>
                <input type="hidden" name="provider_key" value={provider.key} />
                <input type="hidden" name="display_name" value={provider.name} />
                <input type="hidden" name="provider_type" value={provider.type} />
                <input type="hidden" name="scopes" value={provider.scopes} />
                <input type="hidden" name="secret_names" value={provider.secretNames} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <span className={status === "online" ? "chip chip-live" : "chip chip-draft"}>
                    {statusLabel(status)}
                  </span>
                  <span className="muted" style={{ fontSize: 10 }}>{provider.secret}</span>
                </div>
                <h3 style={{ margin: "12px 0 8px", fontSize: 20 }}>{provider.name}</h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65, fontSize: 12.5 }}>{provider.text}</p>
                <div style={providerChecklistStyle}>
                  {provider.setup.map((item) => (
                    <span key={item} className="fiscal-chip fiscal-chip-draft">{item}</span>
                  ))}
                </div>
                <div style={providerFormStyle}>
                  <Field label="Status">
                    <GlassSelect name="status" options={PROVIDER_STATUS_OPTIONS} defaultValue={status} ariaLabel={`Status de ${provider.name}`} inlineMenu />
                  </Field>
                  <Field label="Ambiente">
                    <GlassSelect name="environment" options={PROVIDER_ENVIRONMENT_OPTIONS} defaultValue={connection?.environment ?? "production"} ariaLabel={`Ambiente de ${provider.name}`} inlineMenu />
                  </Field>
                  <Field label="Referência segura">
                    <input name="secret_reference" style={inputStyle} placeholder={provider.secretNames} defaultValue={String(config.secret_reference ?? "")} />
                  </Field>
                  <Field label="Conta / identificador">
                    <input name="account_identifier" style={inputStyle} placeholder={provider.fields.account} defaultValue={String(config.account_identifier ?? "")} />
                  </Field>
                  <Field label="Webhook / retorno">
                    <input name="webhook_url" style={inputStyle} placeholder={provider.fields.webhook} defaultValue={String(config.webhook_url ?? "")} />
                  </Field>
                  <Field label="Remetente / origem">
                    <input name="sender_identity" style={inputStyle} placeholder={provider.fields.sender} defaultValue={String(config.sender_identity ?? "")} />
                  </Field>
                  <Field label="Limite diário">
                    <input name="daily_limit" style={inputStyle} inputMode="numeric" placeholder="ex: 5000" defaultValue={String(config.daily_limit ?? "")} />
                  </Field>
                  <Field label="Custo por mensagem">
                    <input name="cost_per_message_cents" style={inputStyle} inputMode="numeric" placeholder="centavos" defaultValue={String(config.cost_per_message_cents ?? "")} />
                  </Field>
                </div>
                <div style={providerToggleGridStyle}>
                  <label style={toggleLabelStyle}><input type="checkbox" name="auto_sync" defaultChecked={Boolean(config.auto_sync)} /> Sincronização automática</label>
                  <label style={toggleLabelStyle}><input type="checkbox" name="transactional_enabled" defaultChecked={Boolean(config.transactional_enabled ?? provider.key === "resend")} /> Transacional</label>
                  <label style={toggleLabelStyle}><input type="checkbox" name="marketing_enabled" defaultChecked={Boolean(config.marketing_enabled ?? provider.key === "resend")} /> Marketing</label>
                </div>
                <textarea name="notes" rows={2} style={textareaStyle} placeholder="Observações, conta, responsável, limites, regra de uso ou etapa pendente." defaultValue={String(config.notes ?? "")} />
                <div style={providerActionsStyle}>
                  <button className={status === "online" ? "btn btn-gold" : "btn btn-ghost"} style={providerButtonStyle}>
                    Salvar configuração
                  </button>
                  <button
                    formAction={testMarketingProviderConnection.bind(null, provider.key)}
                    className="btn btn-ghost"
                    style={providerButtonStyle}
                  >
                    Testar conexão
                  </button>
                </div>
                <div style={providerHealthStyle}>
                  <span className="muted">Última sincronização: {formatDateTime(connection?.last_sync_at ?? null)}</span>
                  {connection?.last_error ? <span style={{ color: "#e8a0a0", fontSize: 11 }}>{connection.last_error}</span> : null}
                  {logs.map((log) => (
                    <span key={log.id} className="muted" style={{ fontSize: 11 }}>
                      {formatDateTime(log.created_at)} · {providerActionLabel(log.action)} · {providerLogStatusLabel(log.status)}
                      {log.latency_ms ? ` · ${log.latency_ms}ms` : ""}
                    </span>
                  ))}
                </div>
                <button hidden aria-hidden="true" className={provider.status === "online" ? "btn btn-gold" : "btn btn-ghost"} style={{ ...buttonStyle, marginTop: 16 }}>
                  Salvar conexão
                </button>
              </form>
              );
            })}
          </div>
        </Panel>

        <Panel title="Status dos provedores" eyebrow="Monitoramento">
          <ListEmpty when={!providers.length} text="Nenhum provedor cadastrado ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {providers.slice(0, 10).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className={item.status === "online" ? "chip chip-live" : "chip chip-draft"}>{statusLabel(item.status)}</span>
                <strong>{item.display_name}</strong>
                <span className="muted">{providerTypeLabel(item.provider_type)} · {item.environment}</span>
                {item.last_error ? <span style={{ color: "#e8a0a0", fontSize: 11 }}>{item.last_error}</span> : null}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="webhooks" style={twoColumnStyle}>
        <Panel title="Eventos reais do Resend" eyebrow="Abertura / clique / entrega">
          <p className="muted" style={mutedTextStyle}>
            A Edge Function <code>resend-webhook</code> valida assinatura Svix, evita duplicidade por evento,
            atualiza a fila e alimenta a linha do tempo do cliente.
          </p>
          <ListEmpty when={!webhooks.length} text="Nenhum webhook recebido ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {webhooks.slice(0, 8).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-live">{item.provider}</span>
                <strong>{item.event_type}</strong>
                <span className="muted">{formatDateTime(item.created_at)} · fila {item.queue_id ? "vinculada" : "não vinculada"}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Dead-letter e reprocessamento" eyebrow="Fila segura">
          <p className="muted" style={mutedTextStyle}>
            Mensagens sem provedor, domínio inválido ou erro não recuperável ficam bloqueadas até revisão humana.
          </p>
          <form action={requeueMarketingDeadLetters} style={{ marginBottom: 12 }}>
            <button className="btn btn-gold" style={{ ...buttonStyle, minWidth: 210 }}>Reprocessar dead-letter</button>
          </form>
          <ListEmpty when={!deadQueue.length} text="Nenhuma mensagem em dead-letter." />
          <div style={{ display: "grid", gap: 10 }}>
            {deadQueue.slice(0, 6).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-draft">{channelLabel(item.channel)}</span>
                <strong>{item.recipient}</strong>
                <span style={{ color: "#e8a0a0", fontSize: 11 }}>{item.last_error ?? "Sem detalhe do erro"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="experimentos" style={twoColumnStyle}>
        <Panel title="Teste A/B" eyebrow="Experimentos">
          <form action={createMarketingAbTest} style={formGridStyle}>
            <Field label="Nome">
              <input name="name" required style={inputStyle} placeholder="Assunto editorial vs. benefício" />
            </Field>
            <Field label="Campanha">
              <GlassSelect name="campaign_id" options={campaignOptions} ariaLabel="Campanha do teste A/B" inlineMenu />
            </Field>
            <Field label="Variável">
              <input name="variable" required style={inputStyle} placeholder="assunto, botão, horário, público..." />
            </Field>
            <Field label="Métrica vencedora">
              <input name="winner_metric" style={inputStyle} placeholder="open_rate, click_rate, conversion_rate" />
            </Field>
            <Field label="Amostra">
              <input name="sample_size" style={inputStyle} inputMode="numeric" placeholder="1000" />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" options={AB_STATUS_OPTIONS} ariaLabel="Status do teste A/B" inlineMenu />
            </Field>
            <Field label="Início">
              <GlassDateInput name="starts_at" withTime placeholder="Opcional" inlinePopover />
            </Field>
            <Field label="Fim">
              <GlassDateInput name="ends_at" withTime placeholder="Opcional" inlinePopover />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Hipótese</label>
              <textarea name="hypothesis" rows={3} style={textareaStyle} placeholder="O assunto com benefício direto deve gerar mais cliques." />
            </div>
            <Field label="Variante A: assunto">
              <input name="variant_a_subject" style={inputStyle} placeholder="Sua rotina Flora chegou" />
            </Field>
            <Field label="Variante A: botão">
              <input name="variant_a_cta" style={inputStyle} placeholder="Conhecer agora" />
            </Field>
            <Field label="Variante B: assunto">
              <input name="variant_b_subject" style={inputStyle} placeholder="10% para repor seu cuidado" />
            </Field>
            <Field label="Variante B: botão">
              <input name="variant_b_cta" style={inputStyle} placeholder="Usar benefício" />
            </Field>
            <button className="btn btn-gold" style={buttonStyle}>Criar teste</button>
          </form>
        </Panel>

        <Panel title="Testes ativos" eyebrow="Otimização">
          <ListEmpty when={!abTests.length} text="Nenhum teste A/B cadastrado ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {abTests.slice(0, 8).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-draft">{statusLabel(item.status)}</span>
                <strong>{item.name}</strong>
                <span className="muted">{item.variable} · vence por {item.winner_metric ?? "métrica a definir"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="timeline-relatorios" style={twoColumnStyle}>
        <Panel title="Linha do tempo do cliente" eyebrow="Histórico de relacionamento">
          <ListEmpty when={!timeline.length} text="Nenhum evento de relacionamento registrado ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {timeline.slice(0, 10).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-live">{channelLabel(item.channel)}</span>
                <strong>{item.title}</strong>
                <span className="muted">{eventTypeLabel(item.event_type)} · {formatDateTime(item.occurred_at)}</span>
                {item.description ? <span className="muted">{item.description}</span> : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Exportações" eyebrow="PDF / CSV / XLSX">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <Link href="./marketing/exportar?format=pdf" className="btn btn-gold" style={{ padding: "8px 14px", fontSize: 10 }}>
              Baixar PDF
            </Link>
            <Link href="./marketing/exportar?format=csv" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>
              Baixar CSV
            </Link>
            <Link href="./marketing/exportar?format=xlsx" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>
              Baixar XLSX
            </Link>
          </div>
          <form action={createMarketingReportExport} style={formGridStyle}>
            <Field label="Relatório">
              <input name="report_type" required style={inputStyle} placeholder="campanhas, eventos, custos, consentimentos..." />
            </Field>
            <Field label="Formato">
              <GlassSelect name="format" options={REPORT_FORMAT_OPTIONS} ariaLabel="Formato do relatório" inlineMenu />
            </Field>
            <Field label="Canal">
              <GlassSelect name="channel" options={CHANNEL_OPTIONS} ariaLabel="Canal do relatório" inlineMenu />
            </Field>
            <Field label="Cidade">
              <input name="city" style={inputStyle} placeholder="São Paulo" />
            </Field>
            <Field label="Origem">
              <input name="source" style={inputStyle} placeholder="newsletter, meta, google..." />
            </Field>
            <button className="btn btn-gold" style={buttonStyle}>Gerar exportação</button>
          </form>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {reportExports.slice(0, 6).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-draft">{item.format.toUpperCase()}</span>
                <strong>{item.report_type}</strong>
                <span className="muted">{statusLabel(item.status)} · {formatDateTime(item.created_at)}</span>
                {item.file_url ? (
                  <Link href={item.file_url} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 10, width: "fit-content" }}>
                    Baixar
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="relatorios" className="glass rise" style={cardStyle}>
        <p className="eyebrow">Relatórios, integrações e segurança</p>
        <div style={reportGridStyle}>
          <ReportCard title="Relatórios" text="Campanhas, canais, e-mails, SMS, WhatsApp, leads, conversões, carrinhos, pós-venda, receita, retorno e falhas. Exportação preparada para PDF, CSV e XLSX." />
          <ReportCard title="Integrações" text="Camada desacoplada para provedor de e-mail, SMS, WhatsApp, Meta, Google, analytics, CRM e webhooks, com logs e retentativas." />
          <ReportCard title="Segurança" text="Credenciais fora do navegador, RBAC, consentimentos, aprovação, rate limiting, idempotência e fila para impedir envios duplicados." />
          <ReportCard title="Histórico do cliente" text="Eventos de campanhas, mensagens, entregas, aberturas, cliques, cupons, pedidos, rastreamentos e descadastros agora possuem base única." />
        </div>
      </section>
    </main>
  );
}

function Header() {
  return (
    <header className="rise" style={{ marginBottom: 26 }}>
      <Link href="./" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
      <h1 className="display" style={{ fontSize: 42, marginTop: 10 }}>Marketing e Relacionamento</h1>
      <p className="muted" style={{ maxWidth: 850, lineHeight: 1.7, marginTop: 10 }}>
        Central integrada para campanhas, públicos, automações, templates, e-mail marketing,
        SMS, WhatsApp, pós-venda, carrinhos abandonados, atribuição, consentimentos e logs.
      </p>
    </header>
  );
}

function Kpi({ label, value, note, tone = "default" }: { label: string; value: string; note: string; tone?: "default" | "rose" | "alert" }) {
  return (
    <div className="glass" style={{ ...kpiStyle, borderColor: tone === "alert" ? "rgba(232,160,160,0.45)" : "var(--glass-border)" }}>
      <p className="eyebrow" style={{ marginBottom: 10, color: tone === "rose" || tone === "alert" ? "#e48a80" : "var(--gold-light)" }}>{label}</p>
      <strong className="display" style={{ fontSize: 30, color: tone === "rose" || tone === "alert" ? "#e48a80" : "var(--cream)" }}>{value}</strong>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{note}</p>
    </div>
  );
}

function Panel({ title, eyebrow, children, actionHref, actionLabel }: { title: string; eyebrow: string; children: ReactNode; actionHref?: string; actionLabel?: string }) {
  return (
    <section className="glass rise" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</p>
          <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10, whiteSpace: "nowrap" }}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ListEmpty({ when, text }: { when: boolean; text: string }) {
  return when ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>{text}</p> : null;
}

function ReportCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={softCardStyle}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>{title}</p>
      <p className="muted" style={{ margin: 0, lineHeight: 1.7, fontSize: 12.5 }}>{text}</p>
    </div>
  );
}

function subsectionHref(label: string) {
  const map: Record<string, string> = {
    "Visão geral": "#visao-geral",
    Campanhas: "#campanhas",
    Automação: "#jornadas",
    "E-mail marketing": "#e-mail-marketing",
    Templates: "./marketing/templates",
    SMS: "#campanhas",
    "WhatsApp Business": "#campanhas",
    "Mensagens transacionais": "#jornadas",
    "Pós-venda": "#jornadas",
    "Carrinhos abandonados": "./vendas/carrinhos",
    Segmentos: "#segmentos",
    Públicos: "#segmentos",
    Jornadas: "#jornadas",
    Cupons: "./vendas/cupons",
    "Landing pages": "#landing-pages",
    "Meta Ads": "#atribuicao",
    "Google Ads": "#atribuicao",
    Atribuição: "#atribuicao",
    Conversões: "#atribuicao",
    Leads: "./inbox",
    Relatórios: "#relatorios",
    Consentimentos: "#consentimentos",
    Configurações: "./canais",
    "Logs e integrações": "#relatorios",
  };
  return map[label] ?? "#visao-geral";
}

function channelLabel(value: string | null) {
  const labels: Record<string, string> = {
    email: "E-mail",
    sms: "SMS",
    whatsapp: "WhatsApp",
    internal: "Interno",
    landing_page: "Landing page",
    coupon: "Cupom",
    meta_ads: "Meta Ads",
    google_ads: "Google Ads",
    remarketing: "Remarketing",
  };
  return value ? labels[value] ?? value : "Sem canal";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    scheduled: "Agendada",
    active: "Ativa",
    paused: "Pausada",
    sent: "Enviada",
    cancelled: "Cancelada",
    failed: "Falhou",
    queued: "Na fila",
    processing: "Processando",
    ended: "Encerrada",
    completed: "Concluída",
  };
  return labels[value] ?? value;
}

function itemTypeLabel(value: string) {
  const labels: Record<string, string> = {
    campaign: "Campanha",
    send: "Envio",
    ad: "Anúncio",
    launch: "Lançamento",
    holiday: "Data comemorativa",
    coupon: "Cupom",
    landing_page: "Landing page",
    content: "Conteúdo",
    task: "Tarefa",
  };
  return labels[value] ?? value;
}

function costTypeLabel(value: string) {
  const labels: Record<string, string> = {
    media: "Mídia",
    message: "Mensagem",
    creative: "Criativo",
    tool: "Ferramenta",
    agency: "Agência",
    coupon: "Cupom",
    shipping: "Frete",
    other: "Outro",
  };
  return labels[value] ?? value;
}

function providerTypeLabel(value: string) {
  const labels: Record<string, string> = {
    email: "E-mail",
    sms: "SMS",
    whatsapp: "WhatsApp",
    meta_ads: "Meta Ads",
    google_ads: "Google Ads",
    analytics: "Analytics",
    crm: "CRM",
    webhook: "Webhook",
  };
  return labels[value] ?? value;
}

function providerConfig(provider: ProviderRow | undefined) {
  return (provider?.config ?? {}) as Record<string, unknown>;
}

function providerLabel(value: string) {
  const provider = PROVIDER_CARDS.find((item) => item.key === value);
  return provider?.name ?? value;
}

function providerActionLabel(value: string) {
  const labels: Record<string, string> = {
    provider_connection_saved: "Configuração salva",
    provider_healthcheck: "Teste de conexão",
    resend_webhook: "Webhook Resend",
    webhook_received: "Webhook recebido",
    sync: "Sincronização",
  };
  return labels[value] ?? value;
}

function providerLogStatusLabel(value: string) {
  const labels: Record<string, string> = {
    success: "Sucesso",
    warning: "Atenção",
    error: "Erro",
  };
  return labels[value] ?? value;
}

function eventTypeLabel(value: string) {
  const labels: Record<string, string> = {
    sent: "Enviado",
    delivered: "Entregue",
    opened: "Aberto",
    clicked: "Clique",
    failure: "Falha",
    conversion: "Conversão",
  };
  return labels[value] ?? value;
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const pageStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "48px 28px 80px",
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const kpiStyle: CSSProperties = {
  padding: 20,
  minHeight: 138,
};

const cardStyle: CSSProperties = {
  padding: 22,
  borderRadius: 16,
  marginBottom: 18,
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 18,
  alignItems: "start",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const sectionHeaderInlineStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  marginBottom: 18,
};

const readyTemplateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const readyTemplateCardStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(135deg, rgba(255,248,234,0.08), rgba(185,146,77,0.06))",
  minHeight: 190,
};

const variablePillStyle: CSSProperties = {
  border: "1px solid rgba(217, 184, 122, 0.34)",
  borderRadius: 999,
  padding: "4px 8px",
  color: "var(--gold-light)",
  background: "rgba(185, 146, 77, 0.10)",
  fontSize: 10,
  fontWeight: 800,
};

const providerCardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 14,
  marginTop: 14,
  alignItems: "stretch",
};

const providerCardStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(10, 22, 11, 0.38)",
  display: "grid",
  gap: 14,
  minHeight: 620,
  gridTemplateRows: "auto auto auto 1fr auto auto auto",
};

const providerCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const providerChecklistStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const providerFormStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const providerToggleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 8,
};

const toggleLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--cream-dim)",
  fontSize: 12,
  lineHeight: 1.4,
};

const providerActionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  alignItems: "stretch",
};

const providerButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: "10px 14px",
  fontSize: 10,
  width: "100%",
  justifyContent: "center",
};

const providerHealthStyle: CSSProperties = {
  borderTop: "1px solid var(--glass-border)",
  paddingTop: 10,
  display: "grid",
  gap: 4,
  minHeight: 58,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "var(--cream-dim)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--glass-border)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "rgba(10, 22, 11, 0.45)",
  color: "var(--cream)",
  font: "inherit",
  fontSize: 13,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 90,
  resize: "vertical",
};

const buttonStyle: CSSProperties = {
  padding: "11px 18px",
  fontSize: 10,
  alignSelf: "end",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(130px, 1fr)",
  gap: "6px 10px",
  alignItems: "center",
  padding: "12px 14px",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(255, 248, 234, 0.045)",
};

const compactLogRowStyle: CSSProperties = {
  ...rowStyle,
  gridTemplateColumns: "auto minmax(110px, 1fr)",
  padding: "10px 12px",
};

const mutedTextStyle: CSSProperties = {
  lineHeight: 1.7,
  fontSize: 13,
  marginTop: 0,
};

const reportGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const softCardStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255,248,234,0.045)",
};
