import {
  archiveStripePrice,
  createStripePrice,
  createStripeProduct,
  retrieveStripePrice,
  retrieveStripeProduct,
  type StripeEnvironment,
} from "@flora/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeSecret } from "./env";

type JobRow = {
  id: string;
  tenant_id: string;
  environment: StripeEnvironment;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  created_by: string | null;
};

type Candidate = {
  productId: string;
  variantId: string;
  name: string;
  description: string | null;
  slug: string;
  sku: string;
  currency: string;
  priceCents: number;
  stripeProductId: string | null;
  stripePriceId: string | null;
  lookupKey: string;
};

export async function processStripeJobs({
  supabase,
  tenantId,
  environment,
  limit = 5,
  actorId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  environment: StripeEnvironment;
  limit?: number;
  actorId?: string;
}) {
  const { data: jobs, error } = await supabase
    .from("stripe_sync_jobs")
    .select("id, tenant_id, environment, action, entity_type, entity_id, idempotency_key, payload, attempts, max_attempts, created_by")
    .eq("tenant_id", tenantId)
    .eq("environment", environment)
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; message: string }> = [];
  for (const job of (jobs ?? []) as unknown as JobRow[]) {
    results.push(await processOneJob({ supabase, job, actorId }));
  }
  return results;
}

async function processOneJob({
  supabase,
  job,
  actorId,
}: {
  supabase: SupabaseClient;
  job: JobRow;
  actorId?: string;
}) {
  await supabase
    .from("stripe_sync_jobs")
    .update({ status: "running", attempts: job.attempts + 1, started_at: new Date().toISOString(), last_error: null })
    .eq("id", job.id);

  try {
    const apiKey = await getStripeSecret(job.environment);
    if (!apiKey) {
      throw new Error(
        `Stripe não está configurado para ${job.environment === "test" ? "teste" : "produção"}. Configure STRIPE_TEST_SECRET_KEY/STRIPE_LIVE_SECRET_KEY ou STRIPE_SECRET_KEY no Worker.`
      );
    }

    let message = "Ação processada.";
    if (job.action === "test_connection") {
      const result = await retrieveStripeProduct(apiKey, "prod_nao_existe_apenas_teste");
      if (!result.ok && result.status === 401) throw new Error(result.error);
      message = "Chave Stripe respondeu; conexão backend operacional.";
      await markConnection(supabase, job.tenant_id, job.environment, "online", "stored", null);
    } else if (job.action === "create_product") {
      const candidate = await loadCandidate(supabase, job);
      const productId = await ensureStripeProduct({ supabase, apiKey, job, candidate, actorId });
      message = `Product criado/vinculado: ${productId}.`;
    } else if (job.action === "create_price") {
      const candidate = await loadCandidate(supabase, job);
      const productId = await ensureStripeProduct({ supabase, apiKey, job, candidate, actorId });
      const priceId = await createAndStorePrice({ supabase, apiKey, job, candidate: { ...candidate, stripeProductId: productId }, actorId });
      message = `Price criado/vinculado: ${priceId}.`;
    } else if (job.action === "sync_now" || job.action === "publish_catalog") {
      if (job.entity_id) {
        const candidate = await loadCandidate(supabase, job);
        const productId = await ensureStripeProduct({ supabase, apiKey, job, candidate, actorId });
        const priceId = await createAndStorePrice({ supabase, apiKey, job, candidate: { ...candidate, stripeProductId: productId }, actorId });
        message = `Item sincronizado: ${productId} / ${priceId}.`;
      } else {
        message = await publishCatalogBatch({ supabase, apiKey, job, actorId });
      }
    } else if (job.action === "replace_price") {
      const candidate = await loadCandidate(supabase, job);
      const productId = await ensureStripeProduct({ supabase, apiKey, job, candidate, actorId });
      const previous = await activePriceForCandidate(supabase, job.tenant_id, job.environment, candidate.variantId);
      const nextPriceId = await createAndStorePrice({
        supabase,
        apiKey,
        job,
        candidate: { ...candidate, stripeProductId: productId },
        actorId,
        reason: "Substituição de preço solicitada no CMS.",
      });
      if (previous?.stripe_price_id) {
        await archiveStripePrice(apiKey, previous.stripe_price_id, `${job.idempotency_key}:archive:${previous.stripe_price_id}`);
        await supabase
          .from("stripe_prices")
          .update({ status: "archived", active: false, valid_until: new Date().toISOString() })
          .eq("id", previous.id);
      }
      message = `Novo Price criado: ${nextPriceId}; Price anterior arquivado quando existia.`;
    } else if (job.action === "archive_price") {
      const candidate = await loadCandidate(supabase, job);
      const price = await activePriceForCandidate(supabase, job.tenant_id, job.environment, candidate.variantId);
      if (!price?.stripe_price_id) throw new Error("Nenhum Price ativo encontrado para arquivar.");
      const archived = await archiveStripePrice(apiKey, price.stripe_price_id, `${job.idempotency_key}:archive:${price.stripe_price_id}`);
      if (!archived.ok) throw new Error(archived.error);
      await supabase
        .from("stripe_prices")
        .update({ status: "archived", active: false, valid_until: new Date().toISOString(), last_synced_at: new Date().toISOString() })
        .eq("id", price.id);
      message = `Price arquivado: ${price.stripe_price_id}.`;
    } else if (job.action === "reconcile_catalog") {
      message = await reconcileTenantCatalog({ supabase, apiKey, job });
    } else {
      message = "Ação registrada; executor específico será conectado na próxima etapa.";
    }

    await completeJob(supabase, job, true, message, actorId);
    return { id: job.id, ok: true, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado na fila Stripe.";
    await completeJob(supabase, job, false, message, actorId);
    return { id: job.id, ok: false, message };
  }
}

async function loadCandidate(supabase: SupabaseClient, job: JobRow): Promise<Candidate> {
  if (job.entity_type !== "product_variant" || !job.entity_id) {
    throw new Error("Esta ação exige uma variante de produto vinculada.");
  }

  const { data, error } = await supabase
    .from("product_variants")
    .select("id, sku, price_cents, currency, stripe_product_id, stripe_price_id, stripe_lookup_key, products!inner(id, name, slug, subtitle, tenant_id)")
    .eq("id", job.entity_id)
    .eq("tenant_id", job.tenant_id)
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? "Variante não encontrada.");
  const product = Array.isArray(data.products) ? data.products[0] : data.products;
  const slug = product.slug as string;
  return {
    productId: product.id as string,
    variantId: data.id as string,
    name: product.name as string,
    description: (product.subtitle as string | null) ?? null,
    slug,
    sku: data.sku as string,
    currency: (data.currency as string | null) ?? "BRL",
    priceCents: data.price_cents as number,
    stripeProductId: data.stripe_product_id as string | null,
    stripePriceId: data.stripe_price_id as string | null,
    lookupKey: (data.stripe_lookup_key as string | null) ?? `flora_${slug.replace(/[^a-z0-9]+/g, "_")}_brl`,
  };
}

async function ensureStripeProduct({
  supabase,
  apiKey,
  job,
  candidate,
  actorId,
}: {
  supabase: SupabaseClient;
  apiKey: string;
  job: JobRow;
  candidate: Candidate;
  actorId?: string;
}) {
  const existing = await supabase
    .from("stripe_products")
    .select("id, stripe_product_id")
    .eq("tenant_id", job.tenant_id)
    .eq("environment", job.environment)
    .eq("entity_type", "product_variant")
    .eq("entity_id", candidate.variantId)
    .maybeSingle();

  if (existing.data?.stripe_product_id) return existing.data.stripe_product_id as string;
  if (candidate.stripeProductId) return candidate.stripeProductId;

  const result = await createStripeProduct(apiKey, {
    name: candidate.name,
    description: candidate.description,
    idempotencyKey: `${job.idempotency_key}:product:${candidate.variantId}`,
    metadata: {
      flora_entity_id: candidate.variantId,
      flora_entity_type: "product_variant",
      flora_product_id: candidate.productId,
      flora_sku: candidate.sku,
      flora_slug: candidate.slug,
      flora_environment: job.environment,
      flora_created_by: actorId ?? job.created_by ?? "",
    },
  });
  if (!result.ok) throw new Error(result.error);

  const payload = {
    tenant_id: job.tenant_id,
    entity_type: "product_variant",
    entity_id: candidate.variantId,
    internal_code: candidate.sku,
    sku: candidate.sku,
    slug: candidate.slug,
    name: candidate.name,
    description: candidate.description,
    environment: job.environment,
    stripe_product_id: result.data.id,
    lookup_key_base: candidate.lookupKey,
    source_of_truth: "flora",
    sync_status: "connected",
    stripe_status: result.data.active ? "active" : "inactive",
    metadata: result.data.metadata ?? {},
    last_synced_at: new Date().toISOString(),
    last_error: null,
    last_changed_by: actorId ?? job.created_by,
    created_by: actorId ?? job.created_by,
  };

  if (existing.data?.id) {
    await supabase.from("stripe_products").update(payload).eq("id", existing.data.id);
  } else {
    await supabase.from("stripe_products").insert(payload);
  }

  await supabase
    .from("product_variants")
    .update({
      stripe_product_id: result.data.id,
      stripe_lookup_key: candidate.lookupKey,
      stripe_sync_status: "connected",
      stripe_last_sync_at: new Date().toISOString(),
      stripe_last_error: null,
    })
    .eq("id", candidate.variantId)
    .eq("tenant_id", job.tenant_id);

  return result.data.id;
}

async function createAndStorePrice({
  supabase,
  apiKey,
  job,
  candidate,
  actorId,
  reason = "Price criado pelo executor Stripe.",
}: {
  supabase: SupabaseClient;
  apiKey: string;
  job: JobRow;
  candidate: Candidate;
  actorId?: string;
  reason?: string;
}) {
  if (!candidate.stripeProductId) throw new Error("Product Stripe ausente para criar Price.");

  const current = await activePriceForCandidate(supabase, job.tenant_id, job.environment, candidate.variantId);
  if (current?.stripe_price_id && current.unit_amount_cents === candidate.priceCents) {
    await supabase
      .from("product_variants")
      .update({
        stripe_product_id: candidate.stripeProductId,
        stripe_price_id: current.stripe_price_id,
        stripe_lookup_key: candidate.lookupKey,
        stripe_sync_status: "synced",
        stripe_last_sync_at: new Date().toISOString(),
        stripe_last_error: null,
      })
      .eq("id", candidate.variantId)
      .eq("tenant_id", job.tenant_id);
    return current.stripe_price_id;
  }

  const result = await createStripePrice(apiKey, {
    productId: candidate.stripeProductId,
    currency: candidate.currency,
    unitAmountCents: candidate.priceCents,
    lookupKey: candidate.lookupKey,
    transferLookupKey: true,
    nickname: candidate.name,
    idempotencyKey: `${job.idempotency_key}:price:${candidate.variantId}:${candidate.priceCents}`,
    metadata: {
      flora_entity_id: candidate.variantId,
      flora_entity_type: "product_variant",
      flora_product_id: candidate.productId,
      flora_sku: candidate.sku,
      flora_slug: candidate.slug,
      flora_environment: job.environment,
      flora_created_by: actorId ?? job.created_by ?? "",
    },
  });
  if (!result.ok) throw new Error(result.error);

  const productRef = await supabase
    .from("stripe_products")
    .select("id")
    .eq("tenant_id", job.tenant_id)
    .eq("environment", job.environment)
    .eq("entity_type", "product_variant")
    .eq("entity_id", candidate.variantId)
    .maybeSingle();

  const { data: existingPrice } = await supabase
    .from("stripe_prices")
    .select("id, stripe_price_id, unit_amount_cents")
    .eq("tenant_id", job.tenant_id)
    .eq("environment", job.environment)
    .eq("stripe_price_id", result.data.id)
    .maybeSingle();

  const pricePayload = {
    tenant_id: job.tenant_id,
    stripe_product_ref: productRef.data?.id ?? null,
    entity_type: "product_variant",
    entity_id: candidate.variantId,
    stripe_product_id: candidate.stripeProductId,
    stripe_price_id: result.data.id,
    lookup_key: candidate.lookupKey,
    environment: job.environment,
    currency: candidate.currency,
    unit_amount_cents: candidate.priceCents,
    billing_type: "one_time",
    recurring_interval: null,
    recurring_interval_count: 1,
    collection_mode: "checkout",
    channel: "site",
    status: result.data.active ? "active" : "inactive",
    active: result.data.active,
    is_default: true,
    source: "flora",
    metadata: result.data.metadata ?? {},
    last_synced_at: new Date().toISOString(),
    last_error: null,
    last_changed_by: actorId ?? job.created_by,
    created_by: actorId ?? job.created_by,
  };

  if (existingPrice?.id) {
    await supabase.from("stripe_prices").update(pricePayload).eq("id", existingPrice.id);
  } else {
    await supabase.from("stripe_prices").insert(pricePayload);
  }

  await Promise.all([
    supabase
      .from("product_variants")
      .update({
        stripe_product_id: candidate.stripeProductId,
        stripe_price_id: result.data.id,
        stripe_lookup_key: candidate.lookupKey,
        stripe_sync_status: "synced",
        stripe_last_sync_at: new Date().toISOString(),
        stripe_last_error: null,
      })
      .eq("id", candidate.variantId)
      .eq("tenant_id", job.tenant_id),
    supabase.from("price_history").insert({
      tenant_id: job.tenant_id,
      entity_type: "product_variant",
      entity_id: candidate.variantId,
      environment: job.environment,
      stripe_product_id: candidate.stripeProductId,
      previous_stripe_price_id: existingPrice?.stripe_price_id ?? null,
      new_stripe_price_id: result.data.id,
      lookup_key: candidate.lookupKey,
      previous_amount_cents: existingPrice?.unit_amount_cents ?? null,
      new_amount_cents: candidate.priceCents,
      currency: candidate.currency,
      billing_type: "one_time",
      channel: "site",
      status: "recorded",
      reason,
      after_data: pricePayload,
      created_by: actorId ?? job.created_by,
    }),
  ]);

  return result.data.id;
}

async function publishCatalogBatch({
  supabase,
  apiKey,
  job,
  actorId,
}: {
  supabase: SupabaseClient;
  apiKey: string;
  job: JobRow;
  actorId?: string;
}) {
  const { data: variants, error } = await supabase
    .from("product_variants")
    .select("id")
    .eq("tenant_id", job.tenant_id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);

  let published = 0;
  let failed = 0;
  for (const variant of variants ?? []) {
    const itemJob: JobRow = {
      ...job,
      action: "sync_now",
      entity_type: "product_variant",
      entity_id: variant.id as string,
      idempotency_key: `${job.idempotency_key}:variant:${variant.id}`,
    };

    try {
      const candidate = await loadCandidate(supabase, itemJob);
      const productId = await ensureStripeProduct({ supabase, apiKey, job: itemJob, candidate, actorId });
      await createAndStorePrice({ supabase, apiKey, job: itemJob, candidate: { ...candidate, stripeProductId: productId }, actorId });
      published += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao publicar item do catálogo.";
      failed += 1;
      await supabase.from("stripe_sync_logs").insert({
        tenant_id: job.tenant_id,
        job_id: job.id,
        environment: job.environment,
        action: job.action,
        level: "error",
        message,
        entity_type: "product_variant",
        entity_id: variant.id,
        error_message: message,
        created_by: actorId ?? job.created_by,
      });
    }
  }

  return `Publicação em lote concluída: ${published} variante(s) sincronizada(s), ${failed} falha(s).`;
}

async function activePriceForCandidate(
  supabase: SupabaseClient,
  tenantId: string,
  environment: StripeEnvironment,
  variantId: string
) {
  const { data } = await supabase
    .from("stripe_prices")
    .select("id, stripe_price_id, unit_amount_cents")
    .eq("tenant_id", tenantId)
    .eq("environment", environment)
    .eq("entity_type", "product_variant")
    .eq("entity_id", variantId)
    .eq("active", true)
    .eq("is_default", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; stripe_price_id: string | null; unit_amount_cents: number | null } | null;
}

async function reconcileTenantCatalog({ supabase, apiKey, job }: { supabase: SupabaseClient; apiKey: string; job: JobRow }) {
  const { data: prices } = await supabase
    .from("stripe_prices")
    .select("id, entity_type, entity_id, stripe_price_id, stripe_product_id, unit_amount_cents, currency, billing_type")
    .eq("tenant_id", job.tenant_id)
    .eq("environment", job.environment)
    .eq("active", true)
    .limit(50);

  let checked = 0;
  let conflicts = 0;
  for (const price of prices ?? []) {
    if (!price.stripe_price_id) continue;
    checked += 1;
    const remote = await retrieveStripePrice(apiKey, price.stripe_price_id);
    if (!remote.ok) {
      conflicts += 1;
      await supabase.from("stripe_catalog_conflicts").insert({
        tenant_id: job.tenant_id,
        stripe_price_ref: price.id,
        environment: job.environment,
        entity_type: price.entity_type,
        entity_id: price.entity_id,
        conflict_type: remote.status === 404 ? "missing_price" : "api_error",
        field_name: "stripe_price_id",
        flora_value: { stripe_price_id: price.stripe_price_id },
        stripe_value: { error: remote.error },
        severity: "error",
        suggested_action: "Verifique se o Price existe no ambiente correto ou substitua o vínculo no CMS.",
      });
      continue;
    }
    if ((remote.data.unit_amount ?? 0) !== price.unit_amount_cents || remote.data.currency.toUpperCase() !== price.currency) {
      conflicts += 1;
      await supabase.from("stripe_catalog_conflicts").insert({
        tenant_id: job.tenant_id,
        stripe_price_ref: price.id,
        environment: job.environment,
        entity_type: price.entity_type,
        entity_id: price.entity_id,
        conflict_type: (remote.data.unit_amount ?? 0) !== price.unit_amount_cents ? "price_mismatch" : "currency_mismatch",
        field_name: "unit_amount_cents",
        flora_value: { amount: price.unit_amount_cents, currency: price.currency },
        stripe_value: { amount: remote.data.unit_amount, currency: remote.data.currency },
        severity: "warning",
        suggested_action: "Decida se a Flora ou o Stripe deve prevalecer e registre a correção.",
      });
    }
  }
  return `Reconciliação concluída: ${checked} Price(s) verificados, ${conflicts} conflito(s).`;
}

async function markConnection(
  supabase: SupabaseClient,
  tenantId: string,
  environment: StripeEnvironment,
  status: string,
  credentialsStatus: string,
  lastError: string | null
) {
  await supabase
    .from("integration_connections")
    .update({
      status,
      credentials_status: credentialsStatus,
      last_healthcheck_at: new Date().toISOString(),
      last_error: lastError,
    })
    .eq("tenant_id", tenantId)
    .eq("provider_key", "stripe")
    .eq("environment", environment);
}

async function completeJob(
  supabase: SupabaseClient,
  job: JobRow,
  ok: boolean,
  message: string,
  actorId?: string
) {
  const nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** Math.max(job.attempts, 1)) * 60_000).toISOString();
  const finalStatus = ok ? "succeeded" : job.attempts + 1 >= job.max_attempts ? "dead" : "failed";
  await Promise.all([
    supabase
      .from("stripe_sync_jobs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        next_attempt_at: ok ? new Date().toISOString() : nextAttemptAt,
        last_error: ok ? null : message,
      })
      .eq("id", job.id),
    supabase.from("stripe_sync_logs").insert({
      tenant_id: job.tenant_id,
      job_id: job.id,
      environment: job.environment,
      action: job.action,
      level: ok ? "info" : "error",
      message,
      entity_type: job.entity_type,
      entity_id: job.entity_id,
      error_message: ok ? null : message,
      created_by: actorId ?? job.created_by,
    }),
  ]);
}
