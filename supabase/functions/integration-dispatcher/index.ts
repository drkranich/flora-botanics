// Edge Function: integration-dispatcher
//
// Processa a fila operacional da Central de Integrações:
//   - integration_sync_runs
//   - integration_events
//   - integration_event_deliveries
//   - integration_alerts
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
  request_payload?: Record<string, unknown>;
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
    error: `Adapter ${providerKey} ainda não foi implementado.`,
    payload: { adapter: providerKey, status: "pending_implementation" },
  };
}

// ─── Melhor Envio Adapter ─────────────────────────────────────────────────────

async function dispatchMelhorEnvio(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<DispatchResult> {
  // 1. Ler configurações do tenant
  const { data: settingsRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "integration_melhor_envio")
    .maybeSingle();

  const cfg = (settingsRow?.value ?? {}) as Record<string, string>;
  const accessToken = cfg.access_token?.trim();

  if (!accessToken) {
    return {
      ok: false,
      retryable: false,
      error: "Melhor Envio: access_token não configurado. Acesse Configurações → Integrações para configurar.",
    };
  }

  const sandbox = cfg.sandbox === "true";
  const baseUrl = sandbox
    ? "https://sandbox.melhorenvio.com.br/api/v2"
    : "https://www.melhorenvio.com.br/api/v2";

  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Flora Botanics / integracao@florabotanics.com.br",
  };

  if (action === "create_shipping_label") {
    return await melhorEnvioCreateLabel(supabase, tenantId, payload, baseUrl, headers, cfg);
  }

  if (action === "quote_shipping") {
    return await melhorEnvioQuote(supabase, tenantId, payload, baseUrl, headers, cfg);
  }

  return {
    ok: false,
    retryable: false,
    error: `Melhor Envio: ação "${action}" não suportada.`,
  };
}

async function melhorEnvioCreateLabel(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  payload: Record<string, unknown>,
  baseUrl: string,
  headers: Record<string, string>,
  cfg: Record<string, string>
): Promise<DispatchResult> {
  const shipmentId = payload.shipment_id as string | undefined;
  const orderId = payload.order_id as string | undefined;

  if (!shipmentId || !orderId) {
    return { ok: false, retryable: false, error: "Melhor Envio: shipment_id e order_id são obrigatórios no payload." };
  }

  // Carregar dados da remessa e dos pacotes
  const [{ data: shipment }, { data: packages }, { data: order }] = await Promise.all([
    supabase
      .from("shipments")
      .select("id, carrier, service, tracking_code, label_url, status")
      .eq("id", shipmentId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("shipment_packages")
      .select("weight_grams, width_cm, height_cm, length_cm, declared_value_cents")
      .eq("shipment_id", shipmentId)
      .eq("tenant_id", tenantId),
    supabase
      .from("orders")
      .select("id, number, shipping_address, total_cents, order_items(name, quantity, unit_price_cents)")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  if (!shipment) return { ok: false, retryable: true, error: "Remessa não encontrada no banco." };
  if (!order) return { ok: false, retryable: true, error: "Pedido não encontrado no banco." };

  // Montar recipient snapshot (do payload ou do order)
  const recipientSnap = (payload.recipient_snapshot ?? order.shipping_address ?? {}) as Record<string, unknown>;

  const pkg = packages?.[0];
  const volume = {
    weight: Math.max(0.1, ((pkg?.weight_grams ?? 300) / 1000)),
    width:  Math.max(1,  pkg?.width_cm  ?? 12),
    height: Math.max(1,  pkg?.height_cm ?? 5),
    length: Math.max(1,  pkg?.length_cm ?? 17),
  };

  const declaredValueCents = pkg?.declared_value_cents ?? order.total_cents ?? 0;
  const insuranceValue = Math.max(0, declaredValueCents / 100);

  const orderItems = (order.order_items ?? []) as Array<{ name: string; quantity: number; unit_price_cents: number }>;
  const products = orderItems.length > 0
    ? orderItems.map((i) => ({ name: i.name, quantity: i.quantity, unitary_value: i.unit_price_cents / 100 }))
    : [{ name: "Produto", quantity: 1, unitary_value: insuranceValue || 1 }];

  // Mapear service para ID Melhor Envio (best_rate = null = ME escolhe)
  const serviceId: number | null = payload.service === "best_rate" ? null : (Number(payload.service) || null);

  const cartBody = {
    ...(serviceId !== null && { service: serviceId }),
    agency: null,
    from: {
      name:    cfg.from_name ?? "Flora Botanics",
      email:   "contato@florabotanics.com.br",
      postal_code: (cfg.from_cep ?? "").replace(/\D/g, ""),
      address: cfg.from_address ?? "",
      number:  cfg.from_number ?? "s/n",
      district: cfg.from_district ?? "",
      city:    cfg.from_city ?? "",
      state_abbr: cfg.from_state ?? "MG",
      country_id: "BR",
    },
    to: {
      name:    String(recipientSnap.recipient ?? recipientSnap.name ?? "Destinatário"),
      email:   String(recipientSnap.email ?? ""),
      phone:   String(recipientSnap.phone ?? "").replace(/\D/g, ""),
      document: String(recipientSnap.document ?? "").replace(/\D/g, ""),
      postal_code: String(recipientSnap.postal_code ?? recipientSnap.zip ?? "").replace(/\D/g, ""),
      address: String(recipientSnap.address ?? recipientSnap.street ?? ""),
      number:  String(recipientSnap.number ?? "s/n"),
      complement: String(recipientSnap.complement ?? ""),
      district: String(recipientSnap.district ?? recipientSnap.neighborhood ?? ""),
      city:    String(recipientSnap.city ?? ""),
      state_abbr: String(recipientSnap.state ?? recipientSnap.uf ?? ""),
      country_id: "BR",
    },
    products,
    volumes: [volume],
    options: {
      insurance_value: insuranceValue,
      receipt:  false,
      own_hand: false,
      reverse:  false,
      non_commercial: false,
      invoice:  { key: "" },
      platform: "Flora Botanics",
      tags: [{ tag: `pedido_${order.number}`, url: null }],
    },
  };

  // 1. Adicionar ao carrinho
  const cartResp = await fetch(`${baseUrl}/me/cart`, {
    method: "POST",
    headers,
    body: JSON.stringify(cartBody),
  });

  if (!cartResp.ok) {
    const errText = await cartResp.text().catch(() => "");
    return {
      ok: false,
      retryable: cartResp.status >= 500,
      error: `Melhor Envio: falha ao adicionar carrinho (HTTP ${cartResp.status}): ${errText.slice(0, 300)}`,
    };
  }

  const cartData = (await cartResp.json()) as { id?: string; error?: string };
  const cartItemId = cartData.id;

  if (!cartItemId) {
    return {
      ok: false,
      retryable: false,
      error: `Melhor Envio: resposta do carrinho sem ID: ${JSON.stringify(cartData).slice(0, 200)}`,
    };
  }

  // 2. Checkout (debitar saldo / confirmar compra)
  const checkoutResp = await fetch(`${baseUrl}/me/shipment/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orders: [cartItemId] }),
  });

  if (!checkoutResp.ok) {
    const errText = await checkoutResp.text().catch(() => "");
    // Remover do carrinho e retornar erro
    await fetch(`${baseUrl}/me/cart/${cartItemId}`, { method: "DELETE", headers }).catch(() => undefined);
    return {
      ok: false,
      retryable: checkoutResp.status >= 500,
      error: `Melhor Envio: falha no checkout (HTTP ${checkoutResp.status}): ${errText.slice(0, 300)}`,
    };
  }

  // 3. Gerar etiqueta
  const genResp = await fetch(`${baseUrl}/me/shipment/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orders: [cartItemId] }),
  });

  if (!genResp.ok) {
    const errText = await genResp.text().catch(() => "");
    return {
      ok: false,
      retryable: genResp.status >= 500,
      error: `Melhor Envio: falha ao gerar etiqueta (HTTP ${genResp.status}): ${errText.slice(0, 300)}`,
    };
  }

  const genData = (await genResp.json()) as Record<string, unknown>;
  const meTrackingCode = String(
    (genData as Record<string, unknown>)[cartItemId]?.tracking ?? ""
  );

  // 4. Obter URL da etiqueta
  const printResp = await fetch(`${baseUrl}/me/shipment/print`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "private", orders: [cartItemId] }),
  });

  let labelUrl = "";
  if (printResp.ok) {
    const printData = (await printResp.json()) as { url?: string };
    labelUrl = printData.url ?? "";
  }

  // 5. Atualizar shipment no banco
  await supabase
    .from("shipments")
    .update({
      status: "label_created",
      tracking_code: meTrackingCode || cartItemId,
      label_url: labelUrl || null,
      carrier: "melhor_envio",
    })
    .eq("id", shipmentId)
    .eq("tenant_id", tenantId);

  return {
    ok: true,
    recordsOut: 1,
    payload: {
      cart_item_id: cartItemId,
      tracking_code: meTrackingCode || cartItemId,
      label_url: labelUrl,
    },
  };
}

async function melhorEnvioQuote(
  _supabase: ReturnType<typeof createClient>,
  _tenantId: string,
  _payload: Record<string, unknown>,
  baseUrl: string,
  headers: Record<string, string>,
  cfg: Record<string, string>
): Promise<DispatchResult> {
  // Cotação de frete — retorna lista de serviços com preço e prazo
  const fromCep = (cfg.from_cep ?? "").replace(/\D/g, "");
  const toCep = String((_payload as Record<string, unknown>).to_cep ?? "").replace(/\D/g, "");

  if (!fromCep || !toCep) {
    return { ok: false, retryable: false, error: "Melhor Envio: from_cep e to_cep são obrigatórios para cotação." };
  }

  const quoteResp = await fetch(`${baseUrl}/me/shipment/calculate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: { postal_code: fromCep },
      to: { postal_code: toCep },
      package: {
        height: Number((_payload as Record<string, unknown>).height ?? 5),
        width:  Number((_payload as Record<string, unknown>).width  ?? 12),
        length: Number((_payload as Record<string, unknown>).length ?? 17),
        weight: Number((_payload as Record<string, unknown>).weight ?? 0.3),
      },
      options: { insurance_value: Number((_payload as Record<string, unknown>).value ?? 50), receipt: false, own_hand: false },
      services: (_payload as Record<string, unknown>).services ?? undefined,
    }),
  });

  if (!quoteResp.ok) {
    const errText = await quoteResp.text().catch(() => "");
    return { ok: false, retryable: quoteResp.status >= 500, error: `Melhor Envio: falha na cotação: ${errText.slice(0, 200)}` };
  }

  const quotes = await quoteResp.json();
  return { ok: true, recordsIn: Array.isArray(quotes) ? quotes.length : 0, payload: { quotes } };
}

// ─── Resend Healthcheck ───────────────────────────────────────────────────────

async function dispatchResend(): Promise<DispatchResult> {
  const configured = Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("RESEND_FROM_EMAIL"));
  if (!configured) {
    return {
      ok: false,
      retryable: false,
      error: "RESEND_API_KEY ou RESEND_FROM_EMAIL não configurados nos secrets do Supabase.",
    };
  }
  return { ok: true, recordsIn: 0, recordsOut: 0, payload: { healthcheck: "configured" } };
}

// ─── Router principal ─────────────────────────────────────────────────────────

async function dispatchSyncRun(
  supabase: ReturnType<typeof createClient>,
  run: SyncRun
): Promise<DispatchResult> {
  switch (run.provider_key) {
    case "resend":
      return dispatchResend();
    case "melhor_envio":
      return dispatchMelhorEnvio(supabase, run.tenant_id, run.action, run.request_payload ?? {});
    default:
      return adapterPending(run.provider_key);
  }
}

async function dispatchEvent(
  _supabase: ReturnType<typeof createClient>,
  event: EventRow
): Promise<DispatchResult> {
  const providerKey = String(event.payload?.provider_key ?? event.aggregate_id ?? "");
  // Eventos de integração: por ora apenas log; adapters futuros aqui
  return adapterPending(providerKey || "indefinido");
}

// ─── Infra: processar fila ────────────────────────────────────────────────────

function nextAttemptIsoFromAttempts(attempts: number) {
  const minutes = Math.min(240, Math.max(5, 2 ** attempts * 5));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
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

  const result = await dispatchSyncRun(supabase, run);
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - started;

  if (result.ok) {
    await supabase
      .from("integration_sync_runs")
      .update({
        status: "succeeded",
        records_in:       result.recordsIn  ?? 0,
        records_out:      result.recordsOut ?? 0,
        response_payload: result.payload    ?? {},
        finished_at:      finishedAt,
        duration_ms:      durationMs,
      })
      .eq("id", run.id);

    if (run.connection_id) {
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
    }

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

  const result = await dispatchEvent(supabase, event);
  const finishedAt = new Date().toISOString();

  if (result.ok) {
    await supabase
      .from("integration_event_deliveries")
      .update({ status: "succeeded", response_payload: result.payload ?? {}, finished_at: finishedAt })
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
      next_attempt_at: reachedLimit ? finishedAt : nextAttemptIsoFromAttempts(attempt),
    })
    .eq("id", delivery?.id);

  await supabase
    .from("integration_events")
    .update({
      status: reachedLimit ? "dead" : "failed",
      last_error: result.error,
      next_attempt_at: reachedLimit ? finishedAt : nextAttemptIsoFromAttempts(attempt),
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

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase     = createClient(supabaseUrl, serviceKey);
  const now          = new Date().toISOString();

  const [{ data: syncRuns, error: syncError }, { data: events, error: eventError }] = await Promise.all([
    supabase
      .from("integration_sync_runs")
      .select("id, tenant_id, connection_id, provider_key, action, trigger, request_payload")
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

  let syncProcessed  = 0;
  let eventProcessed = 0;

  for (const run of (syncRuns ?? []) as SyncRun[]) {
    await processSyncRun(supabase, run);
    syncProcessed++;
  }

  for (const event of (events ?? []) as EventRow[]) {
    await processEvent(supabase, event);
    eventProcessed++;
  }

  return Response.json({ ok: true, sync_processed: syncProcessed, event_processed: eventProcessed });
});
