"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  listStripePrices,
  retrieveStripePrice,
  retrieveStripeProduct,
  type StripeEnvironment,
  type StripePrice,
} from "@flora/core";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStripeSecret } from "@/lib/stripe/env";
import { processStripeJobs } from "@/lib/stripe/queue";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

const ACTIONS = new Set([
  "test_connection",
  "search_stripe",
  "link_existing",
  "unlink",
  "create_product",
  "create_price",
  "publish_catalog",
  "sync_now",
  "replace_price",
  "archive_price",
  "activate_price",
  "compare_data",
  "reconcile_catalog",
  "copy_test_to_production",
  "test_checkout",
  "import_from_stripe",
]);

const ENVIRONMENTS = new Set(["test", "production"]);
const ENTITY_TYPES = new Set([
  "product",
  "product_variant",
  "kit",
  "combo",
  "gift_box",
  "subscription_plan",
  "service",
  "premium_packaging",
  "custom_item",
  "b2b_offer",
  "campaign_offer",
  "wholesale_product",
  "physical_store_product",
  "marketplace_product",
  "one_off_charge",
  "recurring_item",
  "price_table",
  "commercial_quote",
]);
const BILLING_TYPES = new Set(["one_time", "recurring", "custom_quote"]);
const INTERVALS = new Set(["day", "week", "month", "year"]);

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = getText(formData, key);
  return value || null;
}

function getEnvironment(formData: FormData): StripeEnvironment {
  const value = getText(formData, "environment") || "test";
  return ENVIRONMENTS.has(value) ? (value as StripeEnvironment) : "test";
}

function getEntityType(formData: FormData) {
  const value = getText(formData, "entity_type") || "product_variant";
  return ENTITY_TYPES.has(value) ? value : "product_variant";
}

function parseCents(formData: FormData, key: string) {
  const raw = getText(formData, key).replace(/\./g, "").replace(",", ".");
  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function parseIntValue(formData: FormData, key: string, fallback: number) {
  const number = Number(getText(formData, key));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.round(number));
}

function productIdFromPrice(price: StripePrice) {
  return typeof price.product === "string" ? price.product : price.product.id;
}

function validateStripeId(value: string | null, prefix: "prod" | "price", label: string) {
  if (!value) return null;
  const pattern = prefix === "prod" ? /^prod_[A-Za-z0-9_]+$/ : /^price_[A-Za-z0-9_]+$/;
  if (!pattern.test(value)) {
    throw new Error(`${label} inválido. O código deve começar com ${prefix}_.`);
  }
  return value;
}

function validateLookupKey(value: string | null) {
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_:-]{2,160}$/.test(value)) {
    throw new Error("Lookup Key inválido. Use letras minúsculas, números, hífen, dois-pontos ou underline.");
  }
  return value;
}

async function ensureAdmin() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");
  const tenantId = await effectiveTenantId();
  return { session, tenantId };
}

function jobKey({
  tenantId,
  action,
  environment,
  entityType,
  entityId,
}: {
  tenantId: string;
  action: string;
  environment: string;
  entityType: string | null;
  entityId: string | null;
}) {
  const scope = entityType && entityId ? `${entityType}:${entityId}` : "catalog";
  return `stripe:${tenantId}:${environment}:${action}:${scope}`;
}

export async function enqueueStripeCatalogJob(formData: FormData) {
  const { session, tenantId } = await ensureAdmin();
  const action = getText(formData, "action");
  if (!ACTIONS.has(action)) throw new Error("Ação Stripe inválida.");

  const environment = getEnvironment(formData);
  const entityType = optionalText(formData, "entity_type");
  const entityId = optionalText(formData, "entity_id");
  const reason = optionalText(formData, "reason");
  const supabase = await supabaseServer();

  const idempotencyKey = jobKey({ tenantId, action, environment, entityType, entityId });
  const payload = {
    reason,
    entity_name: optionalText(formData, "entity_name"),
    sku: optionalText(formData, "sku"),
    lookup_key: optionalText(formData, "lookup_key"),
    stripe_product_id: optionalText(formData, "stripe_product_id"),
    stripe_price_id: optionalText(formData, "stripe_price_id"),
    requested_from: "cms",
  };

  const { data: existing } = await supabase
    .from("stripe_sync_jobs")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", idempotencyKey)
    .in("status", ["queued", "running", "failed"])
    .maybeSingle();

  if (existing) {
    await supabase.from("stripe_sync_logs").insert({
      tenant_id: tenantId,
      job_id: existing.id,
      environment,
      action,
      level: "info",
      message: "Solicitação reaproveitada por idempotência; a tarefa já existe na fila.",
      entity_type: entityType,
      entity_id: entityId,
      request_payload: payload,
      created_by: session.userId,
    });
    revalidatePath("/financeiro/stripe");
    return;
  }

  const { data: job, error } = await supabase
    .from("stripe_sync_jobs")
    .insert({
      tenant_id: tenantId,
      environment,
      action,
      entity_type: entityType,
      entity_id: entityId,
      idempotency_key: idempotencyKey,
      payload,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !job) throw new Error(error?.message ?? "Não foi possível enfileirar a ação Stripe.");

  await Promise.all([
    supabase.from("stripe_sync_logs").insert({
      tenant_id: tenantId,
      job_id: job.id,
      environment,
      action,
      level: "info",
      message: "Ação registrada na fila Stripe pelo CMS.",
      entity_type: entityType,
      entity_id: entityId,
      request_payload: payload,
      created_by: session.userId,
    }),
    supabase.from("finance_audit_events").insert({
      tenant_id: tenantId,
      entity_type: "stripe_sync_job",
      entity_id: job.id,
      action: `stripe_${action}_queued`,
      after_data: { environment, entity_type: entityType, entity_id: entityId, payload },
      created_by: session.userId,
    }),
  ]);

  revalidatePath("/financeiro/stripe");
}

export async function processStripeQueue(formData: FormData) {
  const { session, tenantId } = await ensureAdmin();
  const environment = getEnvironment(formData);
  const limit = Math.min(parseIntValue(formData, "limit", 5), 20);
  const supabase = await supabaseServer();

  const results = await processStripeJobs({
    supabase,
    tenantId,
    environment,
    limit,
    actorId: session.userId,
  });

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "stripe_sync_queue",
    action: "stripe_queue_processed",
    after_data: { environment, limit, results },
    created_by: session.userId,
  });

  revalidatePath("/financeiro/stripe");
}

export async function saveManualStripeLink(formData: FormData) {
  const { session, tenantId } = await ensureAdmin();
  const environment = getEnvironment(formData);
  const entityType = getEntityType(formData);
  const entityId = optionalText(formData, "entity_id");
  const name = getText(formData, "name") || "Item comercial Flora";
  const sku = optionalText(formData, "sku");
  const slug = optionalText(formData, "slug");
  let stripeProductId = validateStripeId(optionalText(formData, "stripe_product_id"), "prod", "Product ID");
  let stripePriceId = validateStripeId(optionalText(formData, "stripe_price_id"), "price", "Price ID");
  const lookupKey = validateLookupKey(optionalText(formData, "lookup_key"));
  const currency = (getText(formData, "currency") || "BRL").toUpperCase();
  const unitAmountCents = parseCents(formData, "unit_amount_cents");
  const billingTypeRaw = getText(formData, "billing_type") || "one_time";
  let billingType = BILLING_TYPES.has(billingTypeRaw) ? billingTypeRaw : "one_time";
  const intervalRaw = optionalText(formData, "recurring_interval");
  let recurringInterval = intervalRaw && INTERVALS.has(intervalRaw) ? intervalRaw : null;
  let recurringIntervalCount = parseIntValue(formData, "recurring_interval_count", 1);
  const channel = optionalText(formData, "channel");

  if (!stripeProductId && !stripePriceId && !lookupKey) {
    throw new Error("Informe Product ID, Price ID ou Lookup Key para criar o vínculo.");
  }

  if (billingType === "recurring" && !recurringInterval) {
    throw new Error("Preço recorrente precisa de intervalo de cobrança.");
  }

  const apiKey = await getStripeSecret(environment);
  if (!apiKey) {
    throw new Error(`Stripe ${environment === "test" ? "teste" : "produção"} não está configurado no Worker do admin.`);
  }

  let remotePrice: StripePrice | null = null;
  if (stripePriceId) {
    const price = await retrieveStripePrice(apiKey, stripePriceId);
    if (!price.ok) throw new Error(`Price ID não validado no Stripe: ${price.error}`);
    remotePrice = price.data;
  } else if (lookupKey) {
    const prices = await listStripePrices(apiKey, { lookupKeys: [lookupKey], active: true, limit: 2 });
    if (!prices.ok) throw new Error(`Lookup Key não validada no Stripe: ${prices.error}`);
    if (prices.data.data.length > 1) {
      throw new Error("Lookup Key retornou mais de um Price ativo no Stripe. Resolva a duplicidade antes de vincular.");
    }
    remotePrice = prices.data.data[0] ?? null;
    if (!remotePrice) throw new Error("Lookup Key não encontrada no Stripe. Use Criar Price ou informe um Price ID existente.");
    stripePriceId = remotePrice.id;
  }

  if (remotePrice) {
    if (!remotePrice.active) throw new Error("O Price informado está arquivado/inativo no Stripe.");
    const remoteProductId = productIdFromPrice(remotePrice);
    if (stripeProductId && stripeProductId !== remoteProductId) {
      throw new Error("O Price informado pertence a outro Product no Stripe.");
    }
    stripeProductId = stripeProductId ?? remoteProductId;

    if (remotePrice.currency.toUpperCase() !== currency) {
      throw new Error(`Moeda incompatível: Flora usa ${currency}, Stripe usa ${remotePrice.currency.toUpperCase()}.`);
    }
    if (unitAmountCents > 0 && remotePrice.unit_amount !== unitAmountCents) {
      throw new Error(`Valor incompatível: Flora usa ${unitAmountCents} centavos, Stripe usa ${remotePrice.unit_amount ?? 0}.`);
    }

    if (remotePrice.recurring) {
      billingType = "recurring";
      recurringInterval = remotePrice.recurring.interval;
      recurringIntervalCount = remotePrice.recurring.interval_count;
    } else if (billingType === "recurring") {
      throw new Error("O Price informado não é recorrente no Stripe.");
    }
  }

  if (stripeProductId) {
    const product = await retrieveStripeProduct(apiKey, stripeProductId);
    if (!product.ok) throw new Error(`Product ID não validado no Stripe: ${product.error}`);
    if (!product.data.active) throw new Error("O Product informado está inativo no Stripe.");
  }

  const supabase = await supabaseServer();
  const { data: existingProduct } = entityId
    ? await supabase
        .from("stripe_products")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("environment", environment)
        .maybeSingle()
    : await supabase
        .from("stripe_products")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", entityType)
        .is("entity_id", null)
        .eq("environment", environment)
        .eq("name", name)
        .maybeSingle();

  const productPayload = {
    tenant_id: tenantId,
    entity_type: entityType,
    entity_id: entityId,
    internal_code: sku,
    sku,
    slug,
    name,
    environment,
    stripe_product_id: stripeProductId,
    lookup_key_base: lookupKey,
    source_of_truth: "approval",
    sync_status: "connected",
    stripe_status: stripeProductId ? "linked" : "lookup_only",
    metadata: {
      flora_entity_type: entityType,
      flora_entity_id: entityId,
      flora_sku: sku,
      flora_slug: slug,
      flora_environment: environment,
    },
    last_synced_at: new Date().toISOString(),
    last_error: null,
    last_changed_by: session.userId,
    created_by: session.userId,
  };

  const productResult = existingProduct
    ? await supabase.from("stripe_products").update(productPayload).eq("id", existingProduct.id).select("id").single()
    : await supabase.from("stripe_products").insert(productPayload).select("id").single();

  if (productResult.error || !productResult.data) {
    throw new Error(productResult.error?.message ?? "Não foi possível salvar o vínculo do Product.");
  }

  const { data: existingPrice } = stripePriceId
    ? await supabase
        .from("stripe_prices")
        .select("id, stripe_price_id, unit_amount_cents")
        .eq("tenant_id", tenantId)
        .eq("environment", environment)
        .eq("stripe_price_id", stripePriceId)
        .maybeSingle()
    : await supabase
        .from("stripe_prices")
        .select("id, stripe_price_id, unit_amount_cents")
        .eq("tenant_id", tenantId)
        .eq("environment", environment)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("is_default", true)
        .maybeSingle();

  const pricePayload = {
    tenant_id: tenantId,
    stripe_product_ref: productResult.data.id,
    entity_type: entityType,
    entity_id: entityId,
    stripe_product_id: stripeProductId,
    stripe_price_id: stripePriceId,
    lookup_key: lookupKey,
    environment,
    currency,
    unit_amount_cents: unitAmountCents,
    billing_type: billingType,
    recurring_interval: billingType === "recurring" ? recurringInterval : null,
    recurring_interval_count: recurringIntervalCount,
    collection_mode: billingType === "recurring" ? "subscription" : "checkout",
    channel,
    status: stripePriceId || lookupKey ? "active" : "not_linked",
    active: true,
    is_default: true,
    source: "manual",
    metadata: {
      flora_entity_type: entityType,
      flora_entity_id: entityId,
      flora_sku: sku,
      flora_slug: slug,
      flora_channel: channel,
      flora_environment: environment,
    },
    last_synced_at: new Date().toISOString(),
    last_error: null,
    last_changed_by: session.userId,
    created_by: session.userId,
  };

  const priceResult = existingPrice
    ? await supabase.from("stripe_prices").update(pricePayload).eq("id", existingPrice.id).select("id").single()
    : await supabase.from("stripe_prices").insert(pricePayload).select("id").single();

  if (priceResult.error || !priceResult.data) {
    throw new Error(priceResult.error?.message ?? "Não foi possível salvar o vínculo do Price.");
  }

  await Promise.all([
    supabase.from("price_history").insert({
      tenant_id: tenantId,
      stripe_price_ref: priceResult.data.id,
      entity_type: entityType,
      entity_id: entityId,
      environment,
      stripe_product_id: stripeProductId,
      previous_stripe_price_id: existingPrice?.stripe_price_id ?? null,
      new_stripe_price_id: stripePriceId,
      lookup_key: lookupKey,
      previous_amount_cents: existingPrice?.unit_amount_cents ?? null,
      new_amount_cents: unitAmountCents,
      currency,
      billing_type: billingType,
      recurring_interval: billingType === "recurring" ? recurringInterval : null,
      recurring_interval_count: recurringIntervalCount,
      channel,
      status: "recorded",
      reason: getText(formData, "reason") || "Vínculo manual criado pelo CMS.",
      after_data: pricePayload,
      created_by: session.userId,
    }),
    supabase.from("finance_audit_events").insert({
      tenant_id: tenantId,
      entity_type: "stripe_price",
      entity_id: priceResult.data.id,
      action: "stripe_manual_link_saved",
      after_data: { product: productPayload, price: pricePayload },
      created_by: session.userId,
    }),
  ]);

  if (entityType === "product" && entityId) {
    await supabase
      .from("products")
      .update({
        stripe_product_id: stripeProductId,
        stripe_lookup_key: lookupKey,
        stripe_sync_status: "connected",
        stripe_last_sync_at: new Date().toISOString(),
        stripe_last_error: null,
      })
      .eq("id", entityId)
      .eq("tenant_id", tenantId);
  }

  if (entityType === "product_variant" && entityId) {
    await supabase
      .from("product_variants")
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        stripe_lookup_key: lookupKey,
        stripe_sync_status: "connected",
        stripe_last_sync_at: new Date().toISOString(),
        stripe_last_error: null,
      })
      .eq("id", entityId)
      .eq("tenant_id", tenantId);
  }

  revalidatePath("/financeiro/stripe");
  revalidatePath("/catalogo");
}
