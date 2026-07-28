"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

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

function datetime(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? new Date(value).toISOString() : null;
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

export async function createMarketingAudience(formData: FormData) {
  const { session, tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("marketing_audiences").insert({
    tenant_id: tenantId,
    name: requiredText(formData, "name", "o nome do público"),
    description: nullableText(formData, "description"),
    audience_type: String(formData.get("audience_type") ?? "dynamic"),
    filters: jsonObject(formData, "filters"),
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
    filters: jsonObject(formData, "filters"),
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
    payload: jsonObject(formData, "payload"),
    run_at: datetime(formData, "run_at") ?? new Date().toISOString(),
    priority: Number(String(formData.get("priority") ?? "5")) || 5,
    idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(error.message);
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

export async function createMarketingTemplate(formData: FormData) {
  const { tenantId } = await requireMarketingAdmin();
  const supabase = await supabaseServer();
  const name = requiredText(formData, "name", "o nome do template");
  const channel = requiredText(formData, "channel", "o canal");
  const body = requiredText(formData, "body", "o conteúdo");
  const variables = jsonArray(formData, "variables");

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
