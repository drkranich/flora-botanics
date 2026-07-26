interface IntegrationEventInput {
  tenantId: string;
  eventType: string;
  source: string;
  sourceId?: string;
  aggregateType?: string;
  aggregateId?: string;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
}

interface IntegrationSyncInput {
  tenantId: string;
  providerKey: string;
  connectionId?: string | null;
  action: string;
  trigger: "manual" | "automatic" | "webhook" | "event" | "retry";
  requestPayload?: Record<string, unknown>;
  createdBy?: string | null;
}

type DbClient = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  };
};

export async function enqueueIntegrationEvent(db: DbClient, input: IntegrationEventInput) {
  return db.from("integration_events").insert({
    tenant_id: input.tenantId,
    event_type: input.eventType,
    source: input.source,
    source_id: input.sourceId ?? null,
    aggregate_type: input.aggregateType ?? null,
    aggregate_id: input.aggregateId ?? null,
    payload: input.payload ?? {},
    idempotency_key: input.idempotencyKey,
  });
}

export async function enqueueIntegrationSync(db: DbClient, input: IntegrationSyncInput) {
  return db.from("integration_sync_runs").insert({
    tenant_id: input.tenantId,
    connection_id: input.connectionId ?? null,
    provider_key: input.providerKey,
    action: input.action,
    trigger: input.trigger,
    status: "queued",
    request_payload: input.requestPayload ?? {},
    created_by: input.createdBy ?? null,
  });
}
