"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import {
  FISCAL_GOVERNMENT_PROVIDERS,
  fiscalGovernmentProvider,
  type FiscalGovernmentProviderKey,
} from "@/lib/fiscal/government-providers";

const FISCAL_PATH = "/backoffice/notas-fiscais";

export type FiscalActionResult = { ok: true; message?: string } | { ok: false; error: string };

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} é obrigatório.`);
  return value;
}

function cents(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(/\./g, "").replace(",", ".").trim();
  const value = Number(raw || 0);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function decimal(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(/\./g, "").replace(",", ".").trim();
  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

function jsonArray(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value === "on" || value === "true" || value === "1";
}

function publicCredentialsPreview(formData: FormData) {
  return {
    cnpj: text(formData, "cnpj"),
    inscricao_estadual: text(formData, "state_registration"),
    inscricao_municipal: text(formData, "municipal_registration"),
    municipio: text(formData, "city"),
    uf: text(formData, "state"),
    certificado_ref: text(formData, "certificate_ref"),
    procuracao_ref: text(formData, "proxy_ref"),
    segredo_ref: text(formData, "credentials_ref"),
  };
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    tenantId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    afterData?: Record<string, unknown>;
    justification?: string | null;
  }
) {
  await supabase.from("fiscal_audit_events").insert({
    tenant_id: input.tenantId,
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    after_data: input.afterData ?? {},
    justification: input.justification,
  });
}

export async function configureFiscalGovernmentConnection(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) return;

  const providerKey = requiredText(formData, "provider_key", "Provedor") as FiscalGovernmentProviderKey;
  const provider = fiscalGovernmentProvider(providerKey);
  if (!provider) throw new Error("Provedor fiscal inválido.");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const credentialsRef = text(formData, "credentials_ref");
  const certificateRef = text(formData, "certificate_ref");
  const proxyRef = text(formData, "proxy_ref");

  const payload = {
    tenant_id: staff.tenantId,
    provider_key: provider.key,
    display_name: provider.title,
    environment: requiredText(formData, "environment", "Ambiente"),
    status: credentialsRef || certificateRef || proxyRef ? "pending_auth" : "offline",
    credentials_status: credentialsRef || certificateRef || proxyRef ? "stored" : "missing",
    credentials_ref: credentialsRef,
    credentials_preview: publicCredentialsPreview(formData),
    settings: {
      fiscal_scope: provider.scope,
      cnpj: text(formData, "cnpj"),
      state_registration: text(formData, "state_registration"),
      municipal_registration: text(formData, "municipal_registration"),
      city: text(formData, "city"),
      state: text(formData, "state"),
      certificate_ref: certificateRef,
      proxy_ref: proxyRef,
      auto_create_guides: booleanValue(formData, "auto_create_guides"),
      sync_window_days: Number(text(formData, "sync_window_days") ?? 45),
      notes: text(formData, "notes"),
      required_access: provider.requiredAccess,
      guide_types: provider.guideTypes,
    },
    auto_sync_enabled: booleanValue(formData, "auto_sync_enabled"),
    sync_interval_minutes: Number(text(formData, "sync_interval_minutes") ?? 360),
    last_error: null,
    updated_at: now,
    created_by: staff.id,
  };

  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(payload, { onConflict: "tenant_id,provider_key,environment" })
    .select("id")
    .single();

  if (!error && data) {
    await audit(supabase, {
      tenantId: staff.tenantId,
      actorId: staff.id,
      action: "configured_government_fiscal_connection",
      entityType: "integration_connection",
      entityId: data.id,
      afterData: {
        provider_key: provider.key,
        environment: payload.environment,
        auto_sync_enabled: payload.auto_sync_enabled,
        credentials_status: payload.credentials_status,
      },
    });
  }

  revalidatePath(FISCAL_PATH);
}

export async function requestFiscalGovernmentSync(providerKey: FiscalGovernmentProviderKey): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) return;

  const provider = fiscalGovernmentProvider(providerKey);
  if (!provider) return;

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, credentials_status, status")
    .eq("tenant_id", staff.tenantId)
    .eq("provider_key", provider.key)
    .eq("environment", "production")
    .maybeSingle();

  const idempotencyKey = `fiscal_gov_sync:${staff.tenantId}:${provider.key}:${new Date().toISOString().slice(0, 10)}`;
  const configured = connection?.credentials_status === "stored";

  await supabase.from("integration_sync_runs").insert({
    tenant_id: staff.tenantId,
    connection_id: connection?.id ?? null,
    provider_key: provider.key,
    action: provider.syncAction,
    trigger: "manual",
    status: configured ? "queued" : "failed",
    records_in: 0,
    records_out: 0,
    request_payload: {
      provider_key: provider.key,
      expected_guides: provider.guideTypes,
      source: "fiscal_center",
    },
    response_payload: configured
      ? {
          next_step: "Executor oficial deve consultar o provedor e gravar fiscal_guides com provider_key/external_id.",
        }
      : null,
    error: configured
      ? null
      : "Credenciais/certificado/procuração ainda não configurados para este provedor.",
    created_by: staff.id,
    started_at: configured ? null : now,
    finished_at: configured ? null : now,
  });

  await supabase.from("fiscal_queue_jobs").upsert(
    {
      tenant_id: staff.tenantId,
      job_type: provider.syncAction,
      entity_type: "integration_connection",
      entity_id: connection?.id ?? null,
      status: configured ? "queued" : "failed",
      priority: configured ? 80 : 30,
      idempotency_key: idempotencyKey,
      payload: {
        provider_key: provider.key,
        provider_title: provider.title,
        guide_types: provider.guideTypes,
        requires: provider.requiredAccess,
        official_docs_url: provider.docsUrl,
        outcome:
          "Quando o adaptador oficial estiver com acesso válido, as guias retornadas serão criadas/atualizadas em fiscal_guides.",
      },
      last_error: configured ? null : "Configuração incompleta: informe referência segura, certificado ou procuração.",
      next_attempt_at: now,
      max_attempts: 5,
    },
    { onConflict: "tenant_id,idempotency_key" }
  );

  await supabase
    .from("integration_connections")
    .update({
      status: configured ? "pending_auth" : "error",
      last_sync_at: now,
      last_error: configured
        ? "Sincronização enfileirada. Aguardando executor oficial do provedor fiscal."
        : "Credenciais/certificado/procuração ausentes.",
      updated_at: now,
    })
    .eq("tenant_id", staff.tenantId)
    .eq("provider_key", provider.key)
    .eq("environment", "production");

  await audit(supabase, {
    tenantId: staff.tenantId,
    actorId: staff.id,
    action: "requested_government_fiscal_sync",
    entityType: "integration_connection",
    entityId: connection?.id ?? null,
    afterData: {
      provider_key: provider.key,
      queued: configured,
      idempotency_key: idempotencyKey,
    },
  });

  revalidatePath(FISCAL_PATH);
}

export async function seedFiscalGovernmentConnections(): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) return;

  const supabase = await createClient();
  const rows = FISCAL_GOVERNMENT_PROVIDERS.map((provider) => ({
    tenant_id: staff.tenantId,
    provider_key: provider.key,
    display_name: provider.title,
    environment: "production",
    status: "offline",
    credentials_status: "missing",
    settings: {
      fiscal_scope: provider.scope,
      auto_create_guides: true,
      required_access: provider.requiredAccess,
      guide_types: provider.guideTypes,
    },
    sync_interval_minutes: 360,
    created_by: staff.id,
  }));

  await supabase
    .from("integration_connections")
    .upsert(rows, { onConflict: "tenant_id,provider_key,environment" });

  await audit(supabase, {
    tenantId: staff.tenantId,
    actorId: staff.id,
    action: "seeded_government_fiscal_connections",
    entityType: "integration_connections",
    afterData: { providers: rows.map((row) => row.provider_key) },
  });

  revalidatePath(FISCAL_PATH);
}

/**
 * Cria um rascunho de NF-e a partir de um pedido pago, usando a numeração/série
 * configurada em fiscal_configs. A emissão real (assinatura + envio à SEFAZ)
 * depende do certificado digital e webservice — ainda não implementados
 * (ver Seção 14 do blueprint). Esta ação apenas reserva o número e cria o
 * registro em status "rascunho".
 */
export async function createDraftNfe(orderId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();

  const [{ data: order }, { data: fiscal }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, total_cents")
      .eq("id", orderId)
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
    supabase
      .from("fiscal_configs")
      .select("serie_nfe, proximo_numero_nfe, ambiente")
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
  ]);

  // Pedido inexistente ou dados fiscais ainda não configurados: não há onde
  // exibir um erro a partir de uma form action sem valor de retorno, então
  // a tela de Notas Fiscais já orienta o usuário a configurar tudo antes
  // (ver banner "Configure os dados fiscais" em /notas-fiscais).
  if (!order || !fiscal) {
    return;
  }

  const { data: existing } = await supabase
    .from("nfe_documents")
    .select("id")
    .eq("tenant_id", staff.tenantId)
    .eq("order_id", order.id)
    .neq("status", "cancelada")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    revalidatePath("/backoffice/notas-fiscais");
    return;
  }

  const { error: insertError } = await supabase.from("nfe_documents").insert({
    tenant_id: staff.tenantId,
    order_id: order.id,
    numero: fiscal.proximo_numero_nfe,
    serie: fiscal.serie_nfe,
    ambiente: fiscal.ambiente,
    status: "rascunho",
    valor_total_cents: order.total_cents,
  });

  // system_logs não tem policy de insert para staff (somente leitura/atualização),
  // então erros aqui não são registrados em log — apenas abortamos sem criar
  // a NF-e e sem consumir o número reservado.
  if (insertError) {
    return;
  }

  await supabase
    .from("fiscal_configs")
    .update({ proximo_numero_nfe: fiscal.proximo_numero_nfe + 1 })
    .eq("tenant_id", staff.tenantId);

  await supabase.from("fiscal_documents").insert({
    tenant_id: staff.tenantId,
    order_id: order.id,
    document_type: "nfe_sale",
    direction: "out",
    number: String(fiscal.proximo_numero_nfe),
    series: String(fiscal.serie_nfe),
    status: "draft",
    environment: fiscal.ambiente,
    total_cents: order.total_cents,
    payment_status: "open",
    verification_status: "pending",
    origin: "order",
    metadata: {
      source: "nfe_draft",
      order_number: order.number,
      rule: "Não transmitir sem certificado e validação fiscal.",
    },
    created_by: staff.id,
  });

  await supabase.from("fiscal_queue_jobs").insert({
    tenant_id: staff.tenantId,
    job_type: "prepare_nfe",
    entity_type: "order",
    entity_id: order.id,
    idempotency_key: `prepare_nfe:${staff.tenantId}:${order.id}`,
    payload: {
      order_id: order.id,
      order_number: order.number,
      number: fiscal.proximo_numero_nfe,
      series: fiscal.serie_nfe,
      environment: fiscal.ambiente,
    },
  });

  await audit(supabase, {
    tenantId: staff.tenantId,
    actorId: staff.id,
    action: "created_nfe_draft",
    entityType: "order",
    entityId: order.id,
    afterData: { number: fiscal.proximo_numero_nfe, series: fiscal.serie_nfe, environment: fiscal.ambiente },
  });

  revalidatePath(FISCAL_PATH);
}

export async function cancelNfeDraft(nfeId: string) {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("nfe_documents")
    .update({ status: "cancelada" })
    .eq("id", nfeId)
    .eq("tenant_id", staff.tenantId)
    .eq("status", "rascunho");

  await audit(supabase, {
    tenantId: staff.tenantId,
    actorId: staff.id,
    action: "cancelled_nfe_draft",
    entityType: "nfe_document",
    entityId: nfeId,
    justification: "Cancelamento de rascunho antes de transmissão.",
  });

  revalidatePath(FISCAL_PATH);
}

export async function createManualFiscalDocument(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();

  const payload = {
    tenant_id: staff.tenantId,
    document_type: requiredText(formData, "document_type", "Tipo de documento"),
    direction: requiredText(formData, "direction", "Direção"),
    number: text(formData, "number"),
    series: text(formData, "series"),
    access_key: text(formData, "access_key"),
    protocol: text(formData, "protocol"),
    status: requiredText(formData, "status", "Status"),
    environment: requiredText(formData, "environment", "Ambiente"),
    party_name: text(formData, "party_name"),
    party_document: text(formData, "party_document"),
    competence: text(formData, "competence"),
    due_date: dateValue(formData, "due_date"),
    total_cents: cents(formData, "total"),
    tax_total_cents: cents(formData, "tax_total"),
    payment_status: requiredText(formData, "payment_status", "Pagamento"),
    verification_status: requiredText(formData, "verification_status", "Verificação"),
    origin: requiredText(formData, "origin", "Origem"),
    source_channel: text(formData, "source_channel"),
    tags: jsonArray(formData, "tags"),
    metadata: { notes: text(formData, "notes") },
    created_by: staff.id,
  };

  const { data, error } = await supabase.from("fiscal_documents").insert(payload).select("id").single();
  if (!error && data) {
    await audit(supabase, {
      tenantId: staff.tenantId,
      actorId: staff.id,
      action: "created_fiscal_document",
      entityType: "fiscal_document",
      entityId: data.id,
      afterData: payload,
    });
  }
  revalidatePath(FISCAL_PATH);
}

export async function createFiscalObligation(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    name: requiredText(formData, "name", "Obrigação"),
    obligation_type: requiredText(formData, "obligation_type", "Tipo"),
    competence: text(formData, "competence"),
    due_date: dateValue(formData, "due_date"),
    company_label: text(formData, "company_label"),
    establishment: text(formData, "establishment"),
    recurrence: text(formData, "recurrence"),
    status: requiredText(formData, "status", "Status"),
    priority: requiredText(formData, "priority", "Prioridade"),
    dependencies: jsonArray(formData, "dependencies"),
    documents: jsonArray(formData, "documents"),
    applicability: { regime: text(formData, "tax_regime"), state: text(formData, "state_scope") },
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_obligations").insert(payload).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_obligation", entityType: "fiscal_obligation", entityId: data.id, afterData: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createFiscalGuide(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const original = cents(formData, "original");
  const interest = cents(formData, "interest");
  const penalty = cents(formData, "penalty");
  const updated = cents(formData, "updated") || original + interest + penalty;
  const payload = {
    tenant_id: staff.tenantId,
    guide_type: requiredText(formData, "guide_type", "Tipo de guia"),
    document_name: requiredText(formData, "document_name", "Documento"),
    competence: text(formData, "competence"),
    due_date: dateValue(formData, "due_date"),
    original_cents: original,
    interest_cents: interest,
    penalty_cents: penalty,
    updated_cents: updated,
    payment_status: requiredText(formData, "payment_status", "Status de pagamento"),
    verification_status: requiredText(formData, "verification_status", "Verificação"),
    barcode: text(formData, "barcode"),
    digitable_line: text(formData, "digitable_line"),
    qr_code: text(formData, "qr_code"),
    official_identifier: text(formData, "official_identifier"),
    guide_path: text(formData, "guide_path"),
    receipt_path: text(formData, "receipt_path"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_guides").insert(payload).select("id").single();
  if (!error && data) {
    await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_fiscal_guide", entityType: "fiscal_guide", entityId: data.id, afterData: payload });
  }
  revalidatePath(FISCAL_PATH);
}

export async function registerFiscalGuidePayment(guideId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    payment_status: requiredText(formData, "payment_status", "Pagamento"),
    payment_date: dateValue(formData, "payment_date"),
    paid_cents: cents(formData, "paid"),
    bank_account: text(formData, "bank_account"),
    payment_method: text(formData, "payment_method"),
    receipt_path: text(formData, "receipt_path"),
    notes: text(formData, "notes"),
  };
  await supabase.from("fiscal_guides").update(payload).eq("id", guideId).eq("tenant_id", staff.tenantId);
  await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "registered_guide_payment", entityType: "fiscal_guide", entityId: guideId, afterData: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createFiscalVaultDocument(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    name: requiredText(formData, "name", "Nome do documento"),
    document_type: requiredText(formData, "document_type", "Tipo"),
    category: text(formData, "category"),
    department: text(formData, "department"),
    competence: text(formData, "competence"),
    issued_at: dateValue(formData, "issued_at"),
    due_date: dateValue(formData, "due_date"),
    value_cents: cents(formData, "value"),
    cnpj: text(formData, "cnpj"),
    cpf: text(formData, "cpf"),
    access_key: text(formData, "access_key"),
    number: text(formData, "number"),
    series: text(formData, "series"),
    origin: requiredText(formData, "origin", "Origem"),
    status: requiredText(formData, "status", "Status"),
    storage_path: text(formData, "storage_path"),
    tags: jsonArray(formData, "tags"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_vault_documents").insert(payload).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_vault_document", entityType: "fiscal_vault_document", entityId: data.id, afterData: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createFiscalDocumentEvent(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    document_id: text(formData, "document_id"),
    event_type: requiredText(formData, "event_type", "Evento"),
    status: requiredText(formData, "status", "Status"),
    justification: requiredText(formData, "justification", "Justificativa"),
    payload: {
      correction: text(formData, "correction"),
      range_start: text(formData, "range_start"),
      range_end: text(formData, "range_end"),
    },
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_document_events").insert(payload).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_fiscal_event", entityType: "fiscal_document_event", entityId: data.id, afterData: payload, justification: payload.justification });
  revalidatePath(FISCAL_PATH);
}

export async function createAccountantRequest(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    title: requiredText(formData, "title", "Título"),
    description: text(formData, "description"),
    request_type: requiredText(formData, "request_type", "Tipo"),
    competence: text(formData, "competence"),
    due_date: dateValue(formData, "due_date"),
    priority: requiredText(formData, "priority", "Prioridade"),
    status: requiredText(formData, "status", "Status"),
    department: text(formData, "department"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("accountant_requests").insert(payload).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_accountant_request", entityType: "accountant_request", entityId: data.id, afterData: payload });
  revalidatePath(FISCAL_PATH);
}

export async function upsertAccountantProfile(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    office_name: text(formData, "office_name"),
    legal_name: text(formData, "legal_name"),
    cnpj: text(formData, "cnpj"),
    main_contact: text(formData, "main_contact"),
    fiscal_contact: text(formData, "fiscal_contact"),
    accounting_contact: text(formData, "accounting_contact"),
    payroll_contact: text(formData, "payroll_contact"),
    financial_contact: text(formData, "financial_contact"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    business_hours: text(formData, "business_hours"),
    address: text(formData, "address"),
    services: jsonArray(formData, "services"),
    sla_rules: {
      response_hours: decimal(formData, "sla_response_hours"),
      approval_hours: decimal(formData, "sla_approval_hours"),
      monthly_close_day: decimal(formData, "monthly_close_day"),
    },
    access_settings: {
      accountant_portal: text(formData, "accountant_portal"),
      emergency_contact: text(formData, "emergency_contact"),
    },
    created_by: staff.id,
  };
  await supabase.from("accountant_profiles").upsert(payload, { onConflict: "tenant_id" });
  await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "upserted_accountant_profile", entityType: "accountant_profile", afterData: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createFiscalCertificate(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    holder_name: requiredText(formData, "holder_name", "Titular"),
    holder_document: text(formData, "holder_document"),
    certificate_type: requiredText(formData, "certificate_type", "Tipo"),
    issuer: text(formData, "issuer"),
    serial_number: text(formData, "serial_number"),
    valid_until: dateValue(formData, "valid_until"),
    environment: requiredText(formData, "environment", "Ambiente"),
    status: requiredText(formData, "status", "Status"),
    company_label: text(formData, "company_label"),
    secure_secret_ref: text(formData, "secure_secret_ref"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_certificates").insert(payload).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_certificate_metadata", entityType: "fiscal_certificate", entityId: data.id, afterData: { ...payload, secure_secret_ref: payload.secure_secret_ref ? "[referência segura]" : null } });
  revalidatePath(FISCAL_PATH);
}

export async function createFiscalProductRule(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    scope: requiredText(formData, "scope", "Escopo"),
    ncm: text(formData, "ncm"),
    cest: text(formData, "cest"),
    origin_code: text(formData, "origin_code"),
    commercial_unit: text(formData, "commercial_unit"),
    taxable_unit: text(formData, "taxable_unit"),
    gtin: text(formData, "gtin"),
    cfop_in: text(formData, "cfop_in"),
    cfop_out: text(formData, "cfop_out"),
    cfop_interstate: text(formData, "cfop_interstate"),
    cst: text(formData, "cst"),
    csosn: text(formData, "csosn"),
    ipi_code: text(formData, "ipi_code"),
    icms_percent: decimal(formData, "icms_percent"),
    ipi_percent: decimal(formData, "ipi_percent"),
    pis_percent: decimal(formData, "pis_percent"),
    cofins_percent: decimal(formData, "cofins_percent"),
    fcp_percent: decimal(formData, "fcp_percent"),
    base_reduction_percent: decimal(formData, "base_reduction_percent"),
    fiscal_benefit: text(formData, "fiscal_benefit"),
    state_scope: text(formData, "state_scope"),
    tax_regime: text(formData, "tax_regime"),
    effective_from: dateValue(formData, "effective_from"),
    effective_until: dateValue(formData, "effective_until"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_product_rules").insert(payload).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_product_fiscal_rule", entityType: "fiscal_product_rule", entityId: data.id, afterData: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createFiscalAssessment(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    assessment_type: requiredText(formData, "assessment_type", "Tipo de apuração"),
    competence: requiredText(formData, "competence", "Competência"),
    establishment: text(formData, "establishment"),
    status: requiredText(formData, "status", "Status"),
    source_summary: {
      esocial: text(formData, "esocial_status"),
      reinf: text(formData, "reinf_status"),
      mit: text(formData, "mit_status"),
    },
    debit_cents: cents(formData, "debit"),
    credit_cents: cents(formData, "credit"),
    compensation_cents: cents(formData, "compensation"),
    balance_cents: cents(formData, "balance"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_tax_assessments").insert(payload).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_tax_assessment", entityType: "fiscal_tax_assessment", entityId: data.id, afterData: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createMonthlyClosing(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    competence: requiredText(formData, "competence", "Competência"),
    status: requiredText(formData, "status", "Status"),
    progress_percent: decimal(formData, "progress_percent"),
    missing_documents: jsonArray(formData, "missing_documents"),
    blockers: jsonArray(formData, "blockers"),
    checklist: [
      "Importar documentos",
      "Verificar notas",
      "Verificar bancos",
      "Verificar despesas",
      "Verificar folha",
      "Conferir impostos",
      "Aprovar guias",
      "Anexar comprovantes",
      "Fechar competência",
      "Gerar relatório",
    ],
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_monthly_closings").upsert(payload, { onConflict: "tenant_id,competence" }).select("id").single();
  if (!error && data) await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "upserted_monthly_closing", entityType: "fiscal_monthly_closing", entityId: data.id, afterData: payload });
  revalidatePath(FISCAL_PATH);
}
