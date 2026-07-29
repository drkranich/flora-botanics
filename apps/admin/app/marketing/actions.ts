"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { isResendConfigured, sendEmail } from "@/lib/email/resend";
import { nextRetryIso, renderMarketingEmail, type MarketingTemplate } from "@/lib/marketing/queue";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

type QueueItem = {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  campaign_channel_id: string | null;
  journey_id: string | null;
  template_id: string | null;
  customer_id: string | null;
  lead_id: string | null;
  channel: string;
  recipient: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
};

type QueueProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

function nullableText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = nullableText(formData, key);
  if (!value) throw new Error(`Informe ${label}.`);
  return value;
}

function textList(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function booleanValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value === "on" || value === "true" || value === "1";
}

function jsonObject(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error(`O campo ${key} precisa ser um JSON válido.`);
  }
}

function jsonArray(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error(`O campo ${key} precisa ser uma lista JSON válida.`);
  }
}

function textListOrJsonArray(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) return jsonArray(formData, key).map(String);
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function guidedFilters(formData: FormData) {
  const raw = jsonObject(formData, "filters");
  const filters: Record<string, unknown> = { ...raw };
  const entries = [
    ["city", "cidade"],
    ["state", "estado"],
    ["source", "origem"],
    ["channel", "canal"],
    ["product_interest", "produto"],
    ["consent_channel", "consentimento"],
    ["cart_total_min", "valor_minimo_carrinho"],
    ["orders_min", "pedidos_minimos"],
    ["last_purchase_days", "dias_desde_ultima_compra"],
  ] as const;

  for (const [field, key] of entries) {
    const value = nullableText(formData, field);
    if (!value) continue;
    filters[key] = ["cart_total_min", "orders_min", "last_purchase_days"].includes(field)
      ? Number(value.replace(",", "."))
      : value;
  }

  return filters;
}

function guidedLandingBlocks(formData: FormData) {
  const raw = jsonArray(formData, "blocks");
  if (raw.length) return raw;

  return [
    {
      type: "benefit",
      title: nullableText(formData, "benefit_title"),
      text: nullableText(formData, "benefit_text"),
    },
    {
      type: "product",
      title: nullableText(formData, "product_title"),
      text: nullableText(formData, "product_text"),
    },
    {
      type: "testimonial",
      title: nullableText(formData, "testimonial_title"),
      text: nullableText(formData, "testimonial_text"),
    },
  ].filter((block) => block.title || block.text);
}

function guidedQueuePayload(formData: FormData) {
  const raw = jsonObject(formData, "payload");
  const payload: Record<string, unknown> = { ...raw };
  const entries = [
    ["customer_first_name", "customer.first_name"],
    ["customer_name", "customer.name"],
    ["order_number", "order.number"],
    ["order_value", "order.value"],
    ["shipment_tracking_code", "shipment.tracking_code"],
    ["shipment_tracking_url", "shipment.tracking_url"],
    ["coupon_code", "coupon.code"],
    ["coupon_expires_at", "coupon.expires_at"],
    ["subscription_next_billing_date", "subscription.next_billing_date"],
    ["cta_url", "cta.url"],
  ] as const;

  for (const [field, key] of entries) {
    const value = nullableText(formData, field);
    if (value) payload[key] = value;
  }

  return payload;
}

function guidedAbVariants(formData: FormData) {
  const raw = jsonArray(formData, "variants");
  if (raw.length) return raw;

  return [
    {
      name: "A",
      subject: nullableText(formData, "variant_a_subject"),
      preheader: nullableText(formData, "variant_a_preheader"),
      cta: nullableText(formData, "variant_a_cta"),
    },
    {
      name: "B",
      subject: nullableText(formData, "variant_b_subject"),
      preheader: nullableText(formData, "variant_b_preheader"),
      cta: nullableText(formData, "variant_b_cta"),
    },
  ].filter((variant) => variant.subject || variant.preheader || variant.cta);
}

function datetime(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? new Date(value).toISOString() : null;
}

function dateOnly(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function cents(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").replace(",", ".").trim();
  if (!value) return 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

async function requireMarketingAdmin() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");
  const tenantId = await effectiveTenantId();
  return { session, tenantId };
}

function isRetryableMarketingError(error: string) {
  return !/não está configurado|nao esta configurado|domínio não verificado|dominio nao verificado|domain is not verified|template não encontrado|template nao encontrado|não é de e-mail|nao e de e-mail|canal ainda não possui provedor/i.test(error);
}

async function logMarketingProvider(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  input: {
    tenantId: string;
    action: string;
    status: "success" | "warning" | "error";
    latencyMs?: number;
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
    error?: string;
  }
) {
  await supabase.from("marketing_provider_logs").insert({
    tenant_id: input.tenantId,
    provider: "resend",
    action: input.action,
    status: input.status,
    latency_ms: input.latencyMs ?? null,
    request_payload: input.request ?? {},
    response_payload: input.response ?? {},
    error_message: input.error ?? null,
  });
}

async function registerMarketingEvent(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  item: QueueItem,
  input: { type: "sent" | "failure"; provider?: string; externalId?: string; error?: string }
) {
  await supabase.from("marketing_events").insert({
    tenant_id: item.tenant_id,
    campaign_id: item.campaign_id,
    campaign_channel_id: item.campaign_channel_id,
    customer_id: item.customer_id,
    lead_id: item.lead_id,
    channel: item.channel,
    event_type: input.type,
    provider: input.provider ?? "resend",
    external_id: input.externalId ?? null,
    metadata: {
      queue_id: item.id,
      journey_id: item.journey_id,
      template_id: item.template_id,
      recipient: item.recipient,
      ...(input.error ? { error: input.error } : {}),
    },
  });
}

async function failMarketingQueueItem(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  item: QueueItem,
  error: string,
  attempt: number
) {
  const retryable = isRetryableMarketingError(error);
  const nextStatus = retryable && attempt < item.max_attempts ? "queued" : "dead";
  const nextRunAt = nextStatus === "queued" ? nextRetryIso(attempt) : new Date().toISOString();

  await supabase
    .from("marketing_message_queue")
    .update({
      attempts: attempt,
      status: nextStatus,
      run_at: nextRunAt,
      last_error: error,
      dead_reason: nextStatus === "dead" ? error : null,
      failed_at: new Date().toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  await registerMarketingEvent(supabase, item, { type: "failure", error });
  await logMarketingProvider(supabase, {
    tenantId: item.tenant_id,
    action: "send_email",
    status: retryable ? "warning" : "error",
    request: { queue_id: item.id, template_id: item.template_id, recipient: item.recipient },
    error,
  });
}

export async function createMarketingAudience(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_audiences").insert({
    tenant_id: tenantId,
    name: requiredText(formData, "name", "o nome do público"),
    description: nullableText(formData, "description"),
    audience_type: String(formData.get("audience_type") ?? "dynamic"),
    filters: guidedFilters(formData),
    tags: textList(formData, "tags"),
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function createMarketingSegment(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_segments").insert({
    tenant_id: tenantId,
    audience_id: nullableText(formData, "audience_id"),
    name: requiredText(formData, "name", "o nome do segmento"),
    description: nullableText(formData, "description"),
    segment_type: String(formData.get("segment_type") ?? "dynamic"),
    filters: guidedFilters(formData),
    tags: textList(formData, "tags"),
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function createCampaignChannel(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const campaignId = requiredText(formData, "campaign_id", "a campanha");
  const channel = requiredText(formData, "channel", "o canal");

  const { error } = await supabase.from("marketing_campaign_channels").insert({
    tenant_id: tenantId,
    campaign_id: campaignId,
    channel,
    template_id: nullableText(formData, "template_id"),
    segment_id: nullableText(formData, "segment_id"),
    audience_id: nullableText(formData, "audience_id"),
    subject: nullableText(formData, "subject"),
    preheader: nullableText(formData, "preheader"),
    message: nullableText(formData, "message"),
    send_at: datetime(formData, "send_at"),
    utm: {
      source: nullableText(formData, "utm_source"),
      medium: nullableText(formData, "utm_medium"),
      campaign: nullableText(formData, "utm_campaign"),
      content: nullableText(formData, "utm_content"),
    },
    status: String(formData.get("status") ?? "draft"),
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
  revalidatePath("/vendas/campanhas");
}

export async function createMarketingJourney(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { data: journey, error } = await supabase
    .from("marketing_journeys")
    .insert({
      tenant_id: tenantId,
      name: requiredText(formData, "name", "o nome da jornada"),
      description: nullableText(formData, "description"),
      trigger_key: requiredText(formData, "trigger_key", "o gatilho"),
      status: String(formData.get("status") ?? "draft"),
      filters: jsonObject(formData, "filters"),
      schedule_rules: jsonObject(formData, "schedule_rules"),
      approval_required: String(formData.get("approval_required") ?? "") === "on",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !journey) throw new Error(error?.message ?? "Não foi possível criar a jornada.");

  const firstStep = String(formData.get("first_step") ?? "send_email");
  await supabase.from("marketing_journey_steps").insert({
    tenant_id: tenantId,
    journey_id: journey.id,
    step_order: 1,
    step_type: firstStep,
    config: {
      template_id: nullableText(formData, "template_id"),
      wait_days: Number(String(formData.get("wait_days") ?? "0")) || 0,
    },
  });

  revalidatePath("/marketing");
}

export async function createMarketingLandingPage(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_landing_pages").insert({
    tenant_id: tenantId,
    campaign_id: nullableText(formData, "campaign_id"),
    slug: requiredText(formData, "slug", "o slug"),
    title: requiredText(formData, "title", "o título"),
    template_key: nullableText(formData, "template_key"),
    status: String(formData.get("status") ?? "draft"),
    publish_at: datetime(formData, "publish_at"),
    content: {
      eyebrow: nullableText(formData, "eyebrow"),
      headline: nullableText(formData, "headline") ?? requiredText(formData, "title", "o título"),
      intro: nullableText(formData, "intro"),
      body: nullableText(formData, "body"),
      cta_label: nullableText(formData, "cta_label"),
      cta_url: nullableText(formData, "cta_url"),
      blocks: guidedLandingBlocks(formData),
    },
    seo: {
      title: nullableText(formData, "seo_title"),
      description: nullableText(formData, "seo_description"),
    },
    utm: {
      source: nullableText(formData, "utm_source"),
      medium: nullableText(formData, "utm_medium"),
      campaign: nullableText(formData, "utm_campaign"),
    },
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function recordMarketingConsent(formData: FormData) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_consents").insert({
    tenant_id: tenantId,
    email: nullableText(formData, "email"),
    phone: nullableText(formData, "phone"),
    channel: requiredText(formData, "channel", "o canal"),
    purpose: requiredText(formData, "purpose", "a finalidade"),
    status: requiredText(formData, "status", "o status"),
    source: nullableText(formData, "source"),
    text_presented: nullableText(formData, "text_presented"),
    consent_version: nullableText(formData, "consent_version"),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function createMarketingQueueItem(formData: FormData) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const recipient = requiredText(formData, "recipient", "o destinatário");
  const channel = requiredText(formData, "channel", "o canal");
  const idempotencyKey = `${tenantId}:${channel}:${recipient}:${Date.now()}`;

  const { error } = await supabase.from("marketing_message_queue").insert({
    tenant_id: tenantId,
    campaign_id: nullableText(formData, "campaign_id"),
    template_id: nullableText(formData, "template_id"),
    channel,
    recipient,
    payload: guidedQueuePayload(formData),
    run_at: datetime(formData, "run_at") ?? new Date().toISOString(),
    priority: Number(String(formData.get("priority") ?? "5")) || 5,
    idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function processMarketingQueueNow(): Promise<void> {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("marketing_message_queue")
    .select(
      "id, tenant_id, campaign_id, campaign_channel_id, journey_id, template_id, customer_id, lead_id, channel, recipient, payload, attempts, max_attempts"
    )
    .eq("tenant_id", tenantId)
    .in("status", ["queued", "failed"])
    .lte("run_at", now)
    .order("priority", { ascending: true })
    .order("run_at", { ascending: true })
    .limit(15);

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as QueueItem[]).filter((item) => item.attempts < item.max_attempts);
  const result: QueueProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  for (const item of rows) {
    result.processed += 1;
    const attempt = item.attempts + 1;

    const { error: lockError } = await supabase
      .from("marketing_message_queue")
      .update({
        status: "processing",
        attempts: attempt,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .in("status", ["queued", "failed"]);

    if (lockError) {
      result.skipped += 1;
      continue;
    }

    if (item.channel !== "email") {
      await failMarketingQueueItem(
        supabase,
        item,
        `Canal ${item.channel} ainda não possui provedor ativo. O envio ficou registrado para ativação futura.`,
        attempt
      );
      result.failed += 1;
      continue;
    }

    if (!item.template_id) {
      await failMarketingQueueItem(supabase, item, "Selecione um template antes de enviar.", attempt);
      result.failed += 1;
      continue;
    }

    const { data: template, error: templateError } = await supabase
      .from("message_templates")
      .select("id, name, channel, subject, body, variables, blocks")
      .eq("tenant_id", tenantId)
      .eq("id", item.template_id)
      .maybeSingle();

    if (templateError || !template) {
      await failMarketingQueueItem(supabase, item, templateError?.message ?? "Template não encontrado.", attempt);
      result.failed += 1;
      continue;
    }

    const rendered = renderMarketingEmail(template as MarketingTemplate, item.payload);
    if (!rendered.ok) {
      await failMarketingQueueItem(supabase, item, rendered.error, attempt);
      result.failed += 1;
      continue;
    }

    const started = Date.now();
    const sent = await sendEmail({
      to: item.recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    const latencyMs = Date.now() - started;

    if (!sent.ok) {
      await failMarketingQueueItem(supabase, item, sent.error, attempt);
      result.failed += 1;
      continue;
    }

    await supabase
      .from("marketing_message_queue")
      .update({
        status: "sent",
        provider: "resend",
        external_id: sent.id,
        sent_at: new Date().toISOString(),
        last_error: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    await registerMarketingEvent(supabase, item, {
      type: "sent",
      provider: "resend",
      externalId: sent.id,
    });
    await logMarketingProvider(supabase, {
      tenantId,
      action: "send_email",
      status: "success",
      latencyMs,
      request: { queue_id: item.id, template_id: item.template_id, recipient: item.recipient },
      response: { id: sent.id },
    });
    result.sent += 1;
  }

  revalidatePath("/marketing");
}

export async function createMarketingAttributionEvent(formData: FormData) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_attribution_events").insert({
    tenant_id: tenantId,
    campaign_id: nullableText(formData, "campaign_id"),
    event_name: requiredText(formData, "event_name", "o evento"),
    source: nullableText(formData, "source"),
    medium: nullableText(formData, "medium"),
    campaign: nullableText(formData, "campaign"),
    term: nullableText(formData, "term"),
    content: nullableText(formData, "content"),
    model: nullableText(formData, "model"),
    revenue_cents: cents(formData, "revenue"),
    metadata: jsonObject(formData, "metadata"),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function createMarketingCalendarItem(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_calendar_items").insert({
    tenant_id: tenantId,
    campaign_id: nullableText(formData, "campaign_id"),
    title: requiredText(formData, "title", "o título do compromisso"),
    item_type: String(formData.get("item_type") ?? "campaign"),
    channel: nullableText(formData, "channel"),
    starts_at: datetime(formData, "starts_at") ?? new Date().toISOString(),
    ends_at: datetime(formData, "ends_at"),
    status: String(formData.get("status") ?? "planned"),
    owner_name: nullableText(formData, "owner_name") ?? session.email,
    metadata: jsonObject(formData, "metadata"),
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function requestCampaignApproval(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const campaignId = requiredText(formData, "campaign_id", "a campanha");

  const { error } = await supabase.from("marketing_campaign_approvals").insert({
    tenant_id: tenantId,
    campaign_id: campaignId,
    requested_by: session.userId,
    reason: requiredText(formData, "reason", "o motivo da aprovação"),
  });

  if (error) throw new Error(error.message);
  await supabase
    .from("campaigns")
    .update({ approval_status: "review", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", campaignId);
  revalidatePath("/marketing");
  revalidatePath("/vendas/campanhas");
}

export async function reviewCampaignApproval(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const approvalId = requiredText(formData, "approval_id", "a aprovação");
  const campaignId = requiredText(formData, "campaign_id", "a campanha");
  const status = String(formData.get("status") ?? "approved");
  const approved = status === "approved";

  const { error } = await supabase
    .from("marketing_campaign_approvals")
    .update({
      status,
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
      decision_notes: nullableText(formData, "decision_notes"),
    })
    .eq("tenant_id", tenantId)
    .eq("id", approvalId);

  if (error) throw new Error(error.message);
  await supabase
    .from("campaigns")
    .update({
      approval_status: approved ? "approved" : "rejected",
      approved_by: approved ? session.userId : null,
      approved_at: approved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", campaignId);
  revalidatePath("/marketing");
  revalidatePath("/vendas/campanhas");
}

export async function createMarketingCostEntry(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_cost_entries").insert({
    tenant_id: tenantId,
    campaign_id: nullableText(formData, "campaign_id"),
    channel: nullableText(formData, "channel"),
    provider: nullableText(formData, "provider"),
    cost_type: String(formData.get("cost_type") ?? "media"),
    description: requiredText(formData, "description", "a descrição do custo"),
    quantity: Number(String(formData.get("quantity") ?? "1").replace(",", ".")) || 1,
    unit_cost_cents: cents(formData, "unit_cost"),
    occurred_at: dateOnly(formData, "occurred_at"),
    metadata: jsonObject(formData, "metadata"),
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function upsertMarketingProviderConnection(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const providerKey = requiredText(formData, "provider_key", "o provedor");
  const environment = String(formData.get("environment") ?? "production");
  const providerType = requiredText(formData, "provider_type", "o tipo do provedor");
  const displayName = requiredText(formData, "display_name", "o nome do provedor");
  const status = String(formData.get("status") ?? "pending");
  const secretNames = textList(formData, "secret_names");
  const scopes = textList(formData, "scopes");
  const config = {
    secret_names: secretNames,
    secret_reference: nullableText(formData, "secret_reference"),
    account_identifier: nullableText(formData, "account_identifier"),
    webhook_url: nullableText(formData, "webhook_url"),
    webhook_secret_name: nullableText(formData, "webhook_secret_name"),
    sender_identity: nullableText(formData, "sender_identity"),
    daily_limit: nullableText(formData, "daily_limit"),
    cost_per_message_cents: nullableText(formData, "cost_per_message_cents"),
    auto_sync: booleanValue(formData, "auto_sync"),
    transactional_enabled: booleanValue(formData, "transactional_enabled"),
    marketing_enabled: booleanValue(formData, "marketing_enabled"),
    notes: nullableText(formData, "notes"),
  };

  const { error } = await supabase.from("marketing_provider_connections").upsert(
    {
      tenant_id: tenantId,
      provider_key: providerKey,
      provider_type: providerType,
      display_name: displayName,
      status,
      environment,
      last_sync_at: datetime(formData, "last_sync_at"),
      last_error: nullableText(formData, "last_error"),
      config,
      scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider_key,environment" }
  );

  if (error) throw new Error(error.message);

  await supabase.from("marketing_provider_logs").insert({
    tenant_id: tenantId,
    provider: providerKey,
    action: "provider_connection_saved",
    environment,
    status: status === "error" ? "error" : "success",
    request_payload: {
      provider_key: providerKey,
      provider_type: providerType,
      display_name: displayName,
      scopes,
      configured_by: session.userId,
    },
    response_payload: {
      secret_names: secretNames,
      has_secret_reference: Boolean(config.secret_reference),
      has_account_identifier: Boolean(config.account_identifier),
      auto_sync: config.auto_sync,
    },
    error_message: nullableText(formData, "last_error"),
  });

  revalidatePath("/marketing");
  revalidatePath("/canais");
}

export async function testMarketingProviderConnection(providerKey: string) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { data: connection } = await supabase
    .from("marketing_provider_connections")
    .select("id, provider_key, provider_type, display_name, environment, config")
    .eq("tenant_id", tenantId)
    .eq("provider_key", providerKey)
    .maybeSingle();

  const environment = String(connection?.environment ?? "production");
  const config = (connection?.config ?? {}) as Record<string, unknown>;
  const started = Date.now();
  let ok = false;
  let message = "";
  let responsePayload: Record<string, unknown> = {};

  if (providerKey === "resend") {
    ok = await isResendConfigured();
    message = ok
      ? "Resend configurado no runtime do Worker."
      : "Resend sem RESEND_API_KEY e/ou RESEND_FROM_EMAIL disponíveis no runtime do Worker.";
    responsePayload = { checked_runtime: "cloudflare_worker", required: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] };
  } else {
    const hasReference = Boolean(config.secret_reference || config.account_identifier || config.webhook_url);
    ok = hasReference;
    message = hasReference
      ? "Referência operacional cadastrada. A sincronização real depende do adaptador/provedor oficial."
      : "Informe referência segura, conta/OAuth ou webhook do provedor antes de ativar.";
    responsePayload = {
      checked_runtime: "cms_configuration",
      has_secret_reference: Boolean(config.secret_reference),
      has_account_identifier: Boolean(config.account_identifier),
      has_webhook_url: Boolean(config.webhook_url),
    };
  }

  await supabase.from("marketing_provider_logs").insert({
    tenant_id: tenantId,
    provider: providerKey,
    action: "provider_healthcheck",
    environment,
    status: ok ? "success" : "warning",
    latency_ms: Date.now() - started,
    request_payload: { provider_key: providerKey },
    response_payload: responsePayload,
    error_message: ok ? null : message,
  });

  await supabase
    .from("marketing_provider_connections")
    .update({
      status: ok ? "online" : "pending",
      last_sync_at: new Date().toISOString(),
      last_error: ok ? null : message,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("provider_key", providerKey);

  revalidatePath("/marketing");
  revalidatePath("/canais");
}

export async function createMarketingReportExport(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const reportType = requiredText(formData, "report_type", "o tipo de relatório");
  const format = requiredText(formData, "format", "o formato");
  const filters = guidedFilters(formData);
  const params = new URLSearchParams({ format, report: reportType });

  const { error } = await supabase.from("marketing_report_exports").insert({
    tenant_id: tenantId,
    report_type: reportType,
    format,
    filters,
    status: "ready",
    file_url: `/marketing/exportar?${params.toString()}`,
    finished_at: new Date().toISOString(),
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function createMarketingAbTest(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_ab_tests").insert({
    tenant_id: tenantId,
    campaign_id: nullableText(formData, "campaign_id"),
    name: requiredText(formData, "name", "o nome do teste"),
    hypothesis: nullableText(formData, "hypothesis"),
    variable: requiredText(formData, "variable", "a variável testada"),
    sample_size: Number(String(formData.get("sample_size") ?? "")) || null,
    winner_metric: nullableText(formData, "winner_metric"),
    status: String(formData.get("status") ?? "draft"),
    variants: guidedAbVariants(formData),
    starts_at: datetime(formData, "starts_at"),
    ends_at: datetime(formData, "ends_at"),
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function requeueMarketingDeadLetters(formData: FormData) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const queueId = nullableText(formData, "queue_id");

  let query = supabase
    .from("marketing_message_queue")
    .update({
      status: "queued",
      locked_at: null,
      last_error: null,
      dead_reason: null,
      run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("status", "dead");

  if (queueId) query = query.eq("id", queueId);

  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function installMarketingTemplateBlueprint(formData: FormData) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const blueprintId = requiredText(formData, "blueprint_id", "o modelo");

  const { data: blueprint, error: blueprintError } = await supabase
    .from("marketing_template_blueprints")
    .select("id, name, channel, category, subject, description, variables, blocks")
    .eq("id", blueprintId)
    .maybeSingle();

  if (blueprintError || !blueprint) {
    throw new Error(blueprintError?.message ?? "Modelo Flora não encontrado.");
  }

  const blocks = Array.isArray(blueprint.blocks) ? blueprint.blocks : [];
  const body = JSON.stringify({ blocks });

  const { error } = await supabase.from("message_templates").upsert(
    {
      tenant_id: tenantId,
      name: blueprint.name,
      channel: blueprint.channel,
      category: blueprint.category,
      subject: blueprint.subject,
      body,
      variables: blueprint.variables ?? [],
      status: "draft",
      language: "pt-BR",
      preview: blueprint.description,
      blocks,
      metadata: {
        source: "marketing_template_blueprints",
        blueprint_id: blueprint.id,
      },
    },
    { onConflict: "tenant_id,name", ignoreDuplicates: false }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
  revalidatePath("/marketing/templates");
  revalidatePath("/backoffice/mensagens");
}

export async function installAllMarketingTemplateBlueprints() {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { data: blueprints, error: blueprintError } = await supabase
    .from("marketing_template_blueprints")
    .select("id, name, channel, category, subject, description, variables, blocks");

  if (blueprintError) throw new Error(blueprintError.message);

  const rows = (blueprints ?? []).map((blueprint) => {
    const blocks = Array.isArray(blueprint.blocks) ? blueprint.blocks : [];
    return {
      tenant_id: tenantId,
      name: blueprint.name,
      channel: blueprint.channel,
      category: blueprint.category,
      subject: blueprint.subject,
      body: JSON.stringify({ blocks }),
      variables: blueprint.variables ?? [],
      status: "draft",
      language: "pt-BR",
      preview: blueprint.description,
      blocks,
      metadata: {
        source: "marketing_template_blueprints",
        blueprint_id: blueprint.id,
      },
    };
  });

  if (rows.length) {
    const { error } = await supabase
      .from("message_templates")
      .upsert(rows, { onConflict: "tenant_id,name", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/templates");
  revalidatePath("/backoffice/mensagens");
}

export async function createMarketingTemplate(formData: FormData) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const name = requiredText(formData, "name", "o nome do template");
  const channel = requiredText(formData, "channel", "o canal");
  const body = requiredText(formData, "body", "o conteúdo");
  const variables = textListOrJsonArray(formData, "variables");

  const { error } = await supabase.from("message_templates").insert({
    tenant_id: tenantId,
    name,
    channel,
    category: nullableText(formData, "category"),
    subject: nullableText(formData, "subject"),
    body,
    variables,
    status: String(formData.get("status") ?? "draft"),
    language: String(formData.get("language") ?? "pt-BR"),
    preview: nullableText(formData, "preview"),
    metadata: {
      source: "marketing_manual_template",
    },
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
  revalidatePath("/marketing/templates");
  revalidatePath("/backoffice/mensagens");
}
