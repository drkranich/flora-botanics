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
  createMarketingAttributionEvent,
  createMarketingAudience,
  createMarketingJourney,
  createMarketingLandingPage,
  createMarketingQueueItem,
  createMarketingSegment,
  recordMarketingConsent,
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
type QueueRow = { id: string; channel: string; recipient: string; status: string; run_at: string; attempts: number; last_error: string | null };

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

function optionRows(rows: { id: string; name?: string; title?: string }[], emptyLabel: string): GlassSelectOption[] {
  return [{ value: "", label: emptyLabel }, ...rows.map((row) => ({ value: row.id, label: row.name ?? row.title ?? row.id }))];
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
      .select("id, channel, recipient, status, run_at, attempts, last_error")
      .eq("tenant_id", tenantId)
      .order("run_at", { ascending: false })
      .limit(30),
    supabase
      .from("marketing_landing_pages")
      .select("id, name:title, status, description:slug")
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
    landingPagesRes.error;

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
  const channels = channelsRes.data ?? [];
  const consents = consentsRes.data ?? [];

  const sent = events.filter((e) => e.event_type === "sent").length;
  const delivered = events.filter((e) => e.event_type === "delivered").length;
  const opened = events.filter((e) => e.event_type === "opened").length;
  const clicked = events.filter((e) => e.event_type === "clicked").length;
  const conversions = events.filter((e) => e.event_type === "conversion").length;
  const failures = events.filter((e) => e.event_type === "failure").length;
  const revenue = campaigns.reduce((sum, row) => sum + (row.revenue_cents ?? 0), 0) + events.reduce((sum, row) => sum + (row.revenue_cents ?? 0), 0);
  const cost = campaigns.reduce((sum, row) => sum + ((row.cost_cents ?? 0) || (row.budget_cents ?? 0)), 0) + events.reduce((sum, row) => sum + (row.cost_cents ?? 0), 0);
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
  const activeCampaigns = campaigns.filter((c) => ["active", "ativa"].includes(c.status)).length;
  const scheduledCampaigns = campaigns.filter((c) => ["scheduled", "agendada"].includes(c.status)).length;
  const finishedCampaigns = campaigns.filter((c) => ["ended", "completed", "concluida", "concluída"].includes(c.status)).length;
  const grantedConsents = consents.filter((c) => c.status === "granted").length;

  const campaignOptions = optionRows(campaigns, "Selecione a campanha");
  const audienceOptions = optionRows(audiences, "Sem público específico");
  const segmentOptions = optionRows(segments, "Sem segmento específico");
  const templateOptions = optionRows(templates, "Sem template");

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

      <section id="campanhas" style={twoColumnStyle}>
        <Panel title="Campanhas multicanal" eyebrow="Campanhas" actionHref="/vendas/campanhas" actionLabel="Abrir campanhas">
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
        <Panel title="Biblioteca de templates" eyebrow="Templates / Resend" actionHref="/backoffice/mensagens" actionLabel="Abrir editor visual">
          <p className="muted" style={mutedTextStyle}>
            Modelos Flora prontos para lançamento, promoção, boas-vindas, rastreamento,
            carrinho abandonado, pós-venda, B2B, orçamento e datas comemorativas.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {blueprints.slice(0, 10).map((template) => (
              <div key={template.id} style={rowStyle}>
                <span className="chip chip-draft">{template.category}</span>
                <strong>{template.name}</strong>
                <span className="muted">{template.variables.slice(0, 4).join(", ") || "Sem variáveis"}</span>
              </div>
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
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Filtros em JSON</label>
              <textarea name="filters" rows={4} style={textareaStyle} placeholder='{"cidade":"São Paulo","pedidos_minimos":2}' />
            </div>
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
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Filtros em JSON</label>
              <textarea name="filters" rows={4} style={textareaStyle} placeholder='{"cart_total_min":15000,"consent.email":"granted"}' />
            </div>
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
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Regras de agenda</label>
              <textarea name="schedule_rules" rows={3} style={textareaStyle} placeholder='{"timezone":"America/Sao_Paulo","quiet_hours":["21:00","08:00"]}' />
            </div>
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
            <Field label="Template">
              <input name="template_key" style={inputStyle} placeholder="editorial-campanha" />
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
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Payload JSON</label>
              <textarea name="payload" rows={3} style={textareaStyle} placeholder='{"customer.first_name":"Gustavo","order.number":"1001"}' />
            </div>
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
          <ListEmpty when={!queue.length} text="Nenhum envio enfileirado ainda." />
          <div style={{ display: "grid", gap: 10 }}>
            {queue.slice(0, 8).map((item) => (
              <div key={item.id} style={rowStyle}>
                <span className="chip chip-draft">{channelLabel(item.channel)}</span>
                <strong>{item.recipient}</strong>
                <span className="muted">{statusLabel(item.status)} · tentativas {item.attempts}</span>
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
      <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
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
    Templates: "#e-mail-marketing",
    SMS: "#campanhas",
    "WhatsApp Business": "#campanhas",
    "Mensagens transacionais": "#jornadas",
    "Pós-venda": "#jornadas",
    "Carrinhos abandonados": "/vendas/carrinhos",
    Segmentos: "#segmentos",
    Públicos: "#segmentos",
    Jornadas: "#jornadas",
    Cupons: "/vendas/cupons",
    "Landing pages": "#landing-pages",
    "Meta Ads": "#atribuicao",
    "Google Ads": "#atribuicao",
    Atribuição: "#atribuicao",
    Conversões: "#atribuicao",
    Leads: "/inbox",
    Relatórios: "#relatorios",
    Consentimentos: "#consentimentos",
    Configurações: "/canais",
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
