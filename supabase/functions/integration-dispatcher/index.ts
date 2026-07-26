// Edge Function: integration-dispatcher
//
// Processa a fila operacional da Central de Integrações:
//   - integration_sync_runs
//   - integration_events
//   - integration_event_deliveries
//   - integration_alerts
//
// Esta função é a base desacoplada para adapters reais de transportadoras,
// marketplaces, SEFAZ, e-commerce hub e mensageria.
//
// Deploy:
//   supabase functions deploy integration-dispatcher --project-ref mbpvzhcrimdwcqkqvoqr

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 25;

interface SyncRun {
  id: string;
  tenant_id: string;
  connection_id: string | null;
  provider_key: string;
  action: string;
  trigger: string;
  attempts?: number;
}

interface EventRow {
  id: string;
  tenant_id: string;
  event_type: string;
  source: string;
  source_id: string | null;
  aggregate_type: string | null;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

type DispatchResult =
  | { ok: true; recordsIn?: number; recordsOut?: number; payload?: Record<string, unknown> }
  | { ok: false; retryable: boolean; error: string; payload?: Record<string, unknown> };

function nextAttemptIso(attempts: number) {
  const minutes = Math.min(240, Math.max(5, 2 ** attempts * 5));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function adapterPending(providerKey: string): DispatchResult {
  return {
    ok: false,
    retryable: false,
    error: `Adapter ${providerKey} ainda não foi implementado. A conexão já está registrada para receber o provider real.`,
    payload: { adapter: providerKey, status: "pending_implementation" },
  };
}

async function dispatchProvider(providerKey: string): Promise<DispatchResult> {
  if (providerKey === "resend") {
    const configured = Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("RESEND_FROM_EMAIL"));
    if (!configured) {
      return {
        ok: false,
        retryable: false,
        error: "RESEND_API_KEY ou RESEND_FROM_EMAIL não configurados nos secrets do Supabase.",
      };
    }
    return {
      ok: true,
      recordsIn: 0,
      recordsOut: 0,
      payload: { healthcheck: "configured" },
    };
  }

  return adapterPending(providerKey);
}

async function createAlert(
  supabase: ReturnType<typeof createClient>,
  input: {
    tenantId: string;
    connectionId?: string | null;
    providerKey?: string | null;
    severity: "warning" | "error" | "critical";
    title: string;
    message: string;
    context?: Record<string, unknown>;
  }
) {
  await supabase.from("integration_alerts").insert({
    tenant_id: input.tenantId,
    connection_id: input.connectionId ?? null,
    provider_key: input.providerKey ?? null,
    severity: input.severity,
    title: input.title,
    message: input.message,
    context: input.context ?? {},
  });
}

async function processSyncRun(supabase: ReturnType<typeof createClient>, run: SyncRun) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();

  await supabase
    .from("integration_sync_runs")
    .update({ status: "running", started_at: startedAt })
    .eq("id", run.id)
    .eq("status", "queued");

  const result = await dispatchProvider(run.provider_key);
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - started;

  if (result.ok) {
    await supabase
      .from("integration_sync_runs")
      .update({
        status: "succeeded",
        records_in: result.recordsIn ?? 0,
        records_out: result.recordsOut ?? 0,
        response_payload: result.payload ?? {},
        finished_at: finishedAt,
        duration_ms: durationMs,
      })
      .eq("id", run.id);

    await supabase
      .from("integration_connections")
      .update({
        status: "online",
        last_sync_at: finishedAt,
        last_healthcheck_at: finishedAt,
        last_error: null,
        latency_ms: durationMs,
      })
      .eq("id", run.connection_id);

    return { ok: true };
  }

  await supabase
    .from("integration_sync_runs")
    .update({
      status: "failed",
      response_payload: result.payload ?? {},
      error: result.error,
      finished_at: finishedAt,
      duration_ms: durationMs,
    })
    .eq("id", run.id);

  if (run.connection_id) {
    await supabase
      .from("integration_connections")
      .update({
        status: result.retryable ? "error" : "paused",
        last_error: result.error,
        error_count: 1,
        latency_ms: durationMs,
      })
      .eq("id", run.connection_id);
  }

  await createAlert(supabase, {
    tenantId: run.tenant_id,
    connectionId: run.connection_id,
    providerKey: run.provider_key,
    severity: result.retryable ? "error" : "warning",
    title: `Sincronização de ${run.provider_key} não concluída`,
    message: result.error,
    context: { run_id: run.id, action: run.action, trigger: run.trigger },
  });

  return { ok: false };
}

async function processEvent(supabase: ReturnType<typeof createClient>, event: EventRow) {
  const providerKey = String(event.payload?.provider_key ?? event.aggregate_id ?? "");
  const action = String(event.payload?.action ?? event.event_type);
  const attempt = event.attempts + 1;
  const startedAt = new Date().toISOString();

  await supabase
    .from("integration_events")
    .update({ status: "processing", attempts: attempt })
    .eq("id", event.id)
    .in("status", ["queued", "failed"]);

  const { data: delivery } = await supabase
    .from("integration_event_deliveries")
    .insert({
      tenant_id: event.tenant_id,
      event_id: event.id,
      provider_key: providerKey || null,
      action,
      status: "running",
      attempts: 1,
      request_payload: event.payload,
      started_at: startedAt,
    })
    .select("id")
    .single();

  const result = providerKey ? await dispatchProvider(providerKey) : adapterPending("indefinido");
  const finishedAt = new Date().toISOString();

  if (result.ok) {
    await supabase
      .from("integration_event_deliveries")
      .update({
        status: "succeeded",
        response_payload: result.payload ?? {},
        finished_at: finishedAt,
      })
      .eq("id", delivery?.id);

    await supabase
      .from("integration_events")
      .update({ status: "succeeded", processed_at: finishedAt, last_error: null })
      .eq("id", event.id);

    return { ok: true };
  }

  const reachedLimit = attempt >= event.max_attempts || !result.retryable;
  await supabase
    .from("integration_event_deliveries")
    .update({
      status: reachedLimit ? "dead" : "failed",
      response_payload: result.payload ?? {},
      error: result.error,
      finished_at: finishedAt,
      next_attempt_at: reachedLimit ? finishedAt : nextAttemptIso(attempt),
    })
    .eq("id", delivery?.id);

  await supabase
    .from("integration_events")
    .update({
      status: reachedLimit ? "dead" : "failed",
      last_error: result.error,
      next_attempt_at: reachedLimit ? finishedAt : nextAttemptIso(attempt),
    })
    .eq("id", event.id);

  await createAlert(supabase, {
    tenantId: event.tenant_id,
    providerKey: providerKey || null,
    severity: reachedLimit ? "critical" : "error",
    title: `Evento ${event.event_type} não processado`,
    message: result.error,
    context: { event_id: event.id, source: event.source, attempt },
  });

  return { ok: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date().toISOString();

  const [{ data: syncRuns, error: syncError }, { data: events, error: eventError }] = await Promise.all([
    supabase
      .from("integration_sync_runs")
      .select("id, tenant_id, connection_id, provider_key, action, trigger")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE),
    supabase
      .from("integration_events")
      .select("id, tenant_id, event_type, source, source_id, aggregate_type, aggregate_id, payload, attempts, max_attempts")
      .in("status", ["queued", "failed"])
      .lte("next_attempt_at", now)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE),
  ]);

  if (syncError || eventError) {
    return Response.json(
      { ok: false, error: syncError?.message ?? eventError?.message },
      { status: 500 }
    );
  }

  let syncProcessed = 0;
  let eventProcessed = 0;

  for (const run of (syncRuns ?? []) as SyncRun[]) {
    await processSyncRun(supabase, run);
    syncProcessed++;
  }

  for (const event of (events ?? []) as EventRow[]) {
    await processEvent(supabase, event);
    eventProcessed++;
  }

  return Response.json({
    ok: true,
    sync_processed: syncProcessed,
    event_processed: eventProcessed,
  });
});

