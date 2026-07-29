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
const FISCAL_REVALIDATE_PATHS = [
  FISCAL_PATH,
  `${FISCAL_PATH}/governo`,
  `${FISCAL_PATH}/comercio-exterior`,
  `${FISCAL_PATH}/documentos`,
  `${FISCAL_PATH}/emissao`,
  `${FISCAL_PATH}/eventos`,
  `${FISCAL_PATH}/rejeicoes`,
  `${FISCAL_PATH}/apuracao`,
  `${FISCAL_PATH}/guias`,
  `${FISCAL_PATH}/agenda`,
  `${FISCAL_PATH}/certificados`,
  `${FISCAL_PATH}/cofre`,
  `${FISCAL_PATH}/contador`,
  `${FISCAL_PATH}/aprovacoes`,
  `${FISCAL_PATH}/filas`,
  `${FISCAL_PATH}/relatorios`,
  `${FISCAL_PATH}/auditoria`,
];

function revalidateFiscalCenter() {
  for (const path of FISCAL_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

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

function fileTitleFromPath(path: string | null) {
  if (!path) return null;
  const name = path.split("/").pop() ?? path;
  return name
    .replace(/^\d+-[0-9a-f-]+-/i, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fileTypeFromPath(path: string | null) {
  if (!path) return null;
  const ext = path.split(".").pop()?.toUpperCase().trim();
  if (!ext || ext === path.toUpperCase()) return null;
  return ext;
}

function booleanValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value === "on" || value === "true" || value === "1";
}

function slugPath(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uploadFolderFromPath(path: string | null) {
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  const kindIndex = parts.indexOf("cofre");
  if (kindIndex < 0 || kindIndex >= parts.length - 2) return null;
  return parts.slice(kindIndex + 1, -1).join("/");
}

async function ensureDefaultVaultFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staff: NonNullable<Awaited<ReturnType<typeof currentStaff>>>
) {
  const { data: existing } = await supabase
    .from("document_vault_folders")
    .select("id")
    .eq("tenant_id", staff.tenantId)
    .eq("name", "Entrada geral")
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("document_vault_folders")
    .insert({
      tenant_id: staff.tenantId,
      name: "Entrada geral",
      description: "Pasta padrão para documentos enviados antes de uma classificação específica.",
      icon: "arquivo",
      color: "gold",
      department: "fiscal",
      access_level: "internal",
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(`Não foi possível criar a pasta padrão do cofre: ${error?.message ?? "sem retorno"}.`);
  return data.id as string;
}

async function resolveVaultFolderId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staff: NonNullable<Awaited<ReturnType<typeof currentStaff>>>,
  formData: FormData,
  storagePath: string | null
) {
  const selectedFolderId = text(formData, "folder_id");
  if (selectedFolderId) return selectedFolderId;

  const uploadFolder = uploadFolderFromPath(storagePath);
  if (uploadFolder) {
    const { data: folders } = await supabase
      .from("document_vault_folders")
      .select("id, name")
      .eq("tenant_id", staff.tenantId)
      .is("deleted_at", null);

    const matched = (folders ?? []).find((folder) => slugPath(folder.name) === uploadFolder);
    if (matched?.id) return matched.id as string;
  }

  return ensureDefaultVaultFolder(supabase, staff);
}

function paymentStatusForFinancialControl(status: string | null) {
  if (!status) return "open";
  const map: Record<string, string> = {
    open: "open",
    pending: "open",
    scheduled: "scheduled",
    near_due: "near_due",
    overdue: "overdue",
    partial: "partial",
    paid: "paid",
    paid_with_interest: "paid_with_interest",
    paid_with_discount: "paid_with_discount",
    compensated: "compensated",
    cancelled: "cancelled",
    disputed: "disputed",
    not_applicable: "not_applicable",
    unclassified: "unclassified",
    unpaid: "unpaid",
    waiting_approval: "waiting_approval",
    approved_for_payment: "approved_for_payment",
    due_today: "due_today",
    installment: "installment",
    suspended: "suspended",
    reversed: "reversed",
    refunded: "refunded",
    reconciled: "reconciled",
    divergent: "divergent",
    waiting_receipt: "waiting_receipt",
    receipt_review: "receipt_review",
  };
  return map[status] ?? status;
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

  revalidateFiscalCenter();
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

  revalidateFiscalCenter();
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

  revalidateFiscalCenter();
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
    revalidateFiscalCenter();
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

  revalidateFiscalCenter();
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

  revalidateFiscalCenter();
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
    payment_status: text(formData, "payment_status") ?? "paid",
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
  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
}

export async function createFiscalGuide(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const original = cents(formData, "original");
  const interest = cents(formData, "interest");
  const penalty = cents(formData, "penalty");
  const updated = cents(formData, "updated") || original + interest + penalty;
  const guidePath = text(formData, "guide_path");
  const receiptPath = text(formData, "receipt_path");
  const inferredName = fileTitleFromPath(guidePath ?? receiptPath);
  const payload = {
    tenant_id: staff.tenantId,
    guide_type: text(formData, "guide_type") ?? "other",
    document_name: text(formData, "document_name") ?? inferredName ?? "Guia fiscal importada",
    competence: text(formData, "competence"),
    due_date: dateValue(formData, "due_date"),
    original_cents: original,
    interest_cents: interest,
    penalty_cents: penalty,
    updated_cents: updated,
    payment_status: text(formData, "payment_status") ?? "open",
    verification_status: requiredText(formData, "verification_status", "Verificação"),
    barcode: text(formData, "barcode"),
    digitable_line: text(formData, "digitable_line"),
    qr_code: text(formData, "qr_code"),
    official_identifier: text(formData, "official_identifier"),
    guide_path: guidePath,
    receipt_path: receiptPath,
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_guides").insert(payload).select("id").single();
  if (!error && data) {
    await supabase.from("document_financial_controls").insert({
      tenant_id: staff.tenantId,
      source_module: "fiscal",
      source_table: "fiscal_guides",
      source_id: data.id,
      document_name: payload.document_name,
      financial_nature: "tax_guide",
      document_category: payload.guide_type,
      competence: payload.competence,
      due_date: payload.due_date,
      original_cents: payload.original_cents,
      interest_cents: payload.interest_cents,
      penalty_cents: payload.penalty_cents,
      updated_cents: payload.updated_cents,
      paid_cents: 0,
      remaining_cents: payload.updated_cents,
      payment_status: paymentStatusForFinancialControl(payload.payment_status),
      proof_status: payload.receipt_path ? "sent" : "missing",
      guide_id: data.id,
      storage_path: payload.guide_path,
      receipt_paths: payload.receipt_path ? [payload.receipt_path] : [],
      notes: payload.notes,
      created_by: staff.id,
    });
    await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_fiscal_guide", entityType: "fiscal_guide", entityId: data.id, afterData: payload });
  }
  revalidateFiscalCenter();
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
  const { data: control } = await supabase
    .from("document_financial_controls")
    .select("id, updated_cents")
    .eq("tenant_id", staff.tenantId)
    .eq("source_table", "fiscal_guides")
    .eq("source_id", guideId)
    .maybeSingle();

  if (control) {
    const updatedCents = Number(control.updated_cents ?? 0);
    await supabase
      .from("document_financial_controls")
      .update({
        payment_status: paymentStatusForFinancialControl(payload.payment_status),
        paid_cents: payload.paid_cents,
        remaining_cents: Math.max(0, updatedCents - payload.paid_cents),
        payment_method: payload.payment_method,
        bank_account: payload.bank_account,
        proof_status: payload.receipt_path ? "sent" : "missing",
        receipt_paths: payload.receipt_path ? [payload.receipt_path] : [],
      })
      .eq("id", control.id)
      .eq("tenant_id", staff.tenantId);

    await supabase.from("document_financial_payments").insert({
      tenant_id: staff.tenantId,
      control_id: control.id,
      payment_kind: payload.payment_status === "scheduled" ? "scheduled" : payload.payment_status === "partial" ? "partial" : "full",
      status: payload.payment_status === "scheduled" ? "scheduled" : "registered",
      amount_cents: payload.paid_cents,
      paid_at: payload.payment_date,
      bank_account: payload.bank_account,
      payment_method: payload.payment_method,
      proof_paths: payload.receipt_path ? [payload.receipt_path] : [],
      notes: payload.notes,
      created_by: staff.id,
    });
  }
  await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "registered_guide_payment", entityType: "fiscal_guide", entityId: guideId, afterData: payload });
  revalidateFiscalCenter();
}

export async function createVaultFolder(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const name = requiredText(formData, "name", "Nome da pasta");
  const payload = {
    tenant_id: staff.tenantId,
    parent_id: text(formData, "parent_id"),
    name,
    description: text(formData, "description"),
    icon: text(formData, "icon") ?? "pasta",
    color: text(formData, "color") ?? "gold",
    department: text(formData, "department") ?? "fiscal",
    retention_rule: text(formData, "retention_rule"),
    access_level: text(formData, "access_level") ?? "internal",
    tags: jsonArray(formData, "tags"),
    created_by: staff.id,
  };

  const { data, error } = await supabase.from("document_vault_folders").insert(payload).select("id").single();
  if (error || !data?.id) throw new Error(`Não foi possível criar a pasta: ${error?.message ?? "registro não retornado"}.`);

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    folder_id: data.id,
    action: "folder_created",
    new_value: payload,
    actor_id: staff.id,
  });

  revalidateFiscalCenter();
}

export async function updateVaultFolder(folderId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    parent_id: text(formData, "parent_id"),
    name: requiredText(formData, "name", "Nome da pasta"),
    description: text(formData, "description"),
    icon: text(formData, "icon") ?? "pasta",
    color: text(formData, "color") ?? "gold",
    department: text(formData, "department") ?? "fiscal",
    retention_rule: text(formData, "retention_rule"),
    access_level: text(formData, "access_level") ?? "internal",
    tags: jsonArray(formData, "tags"),
  };

  const { data, error } = await supabase
    .from("document_vault_folders")
    .update(payload)
    .eq("id", folderId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Não foi possível editar a pasta: ${error.message}.`);
  if (!data) throw new Error("Pasta não encontrada ou sem permissão para editar.");

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    folder_id: folderId,
    action: "folder_updated",
    new_value: payload,
    actor_id: staff.id,
  });

  revalidateFiscalCenter();
}

export async function archiveVaultFolder(folderId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const reason = text(formData, "reason") ?? "Pasta arquivada no cofre fiscal.";

  const { data, error } = await supabase
    .from("document_vault_folders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Não foi possível arquivar a pasta: ${error.message}.`);
  if (!data) throw new Error("Pasta não encontrada ou sem permissão para arquivar.");

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    folder_id: folderId,
    action: "folder_archived",
    reason,
    actor_id: staff.id,
  });

  revalidateFiscalCenter();
}

export async function unarchiveVaultFolder(folderId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const reason = text(formData, "reason") ?? "Pasta desarquivada no cofre fiscal.";

  const { data, error } = await supabase
    .from("document_vault_folders")
    .update({ archived_at: null })
    .eq("id", folderId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Não foi possível desarquivar a pasta: ${error.message}.`);
  if (!data) throw new Error("Pasta não encontrada ou sem permissão para desarquivar.");

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    folder_id: folderId,
    action: "folder_unarchived",
    reason,
    actor_id: staff.id,
  });

  revalidateFiscalCenter();
}

export async function deleteVaultFolder(folderId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const reason = text(formData, "reason") ?? "Pasta excluída do cofre fiscal.";

  const { data, error } = await supabase
    .from("document_vault_folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("tenant_id", staff.tenantId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Não foi possível excluir a pasta: ${error.message}.`);
  if (!data) throw new Error("Pasta não encontrada ou sem permissão para excluir.");

  await supabase
    .from("fiscal_vault_documents")
    .update({ folder_id: null })
    .eq("tenant_id", staff.tenantId)
    .eq("folder_id", folderId);

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    folder_id: folderId,
    action: "folder_deleted",
    reason,
    actor_id: staff.id,
  });

  revalidateFiscalCenter();
}

export async function createFiscalVaultDocument(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const storagePath = text(formData, "storage_path");
  const inferredName = fileTitleFromPath(storagePath);
  const financialNature = text(formData, "financial_nature") ?? (cents(formData, "value") > 0 ? "needs_review" : "not_applicable");
  const paymentStatus = text(formData, "payment_status") ?? (financialNature === "not_applicable" ? "not_applicable" : "open");
  const valueCents = cents(formData, "value");
  const folderId = await resolveVaultFolderId(supabase, staff, formData, storagePath);
  const payload = {
    tenant_id: staff.tenantId,
    folder_id: folderId,
    name: text(formData, "name") ?? inferredName ?? "Documento fiscal importado",
    document_type: text(formData, "document_type") ?? fileTypeFromPath(storagePath) ?? "Arquivo fiscal",
    category: text(formData, "category"),
    department: text(formData, "department"),
    competence: text(formData, "competence"),
    issued_at: dateValue(formData, "issued_at"),
    due_date: dateValue(formData, "due_date"),
    value_cents: valueCents,
    cnpj: text(formData, "cnpj"),
    cpf: text(formData, "cpf"),
    access_key: text(formData, "access_key"),
    number: text(formData, "number"),
    series: text(formData, "series"),
    origin: text(formData, "origin") ?? (storagePath ? "upload" : "manual"),
    status: text(formData, "status") ?? "received",
    storage_path: storagePath,
    tags: jsonArray(formData, "tags"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("fiscal_vault_documents").insert(payload).select("id").single();
  if (error || !data) {
    console.error("Falha ao salvar documento no cofre fiscal", {
      tenantId: staff.tenantId,
      storagePath,
      error,
    });
    throw new Error(`Não foi possível guardar o documento no cofre fiscal: ${error?.message ?? "registro não retornado"}.`);
  }

  if (data) {
    if (financialNature !== "not_applicable") {
      const { data: control } = await supabase
        .from("document_financial_controls")
        .insert({
          tenant_id: staff.tenantId,
          source_module: "cofre_fiscal",
          source_table: "fiscal_vault_documents",
          source_id: data.id,
          document_name: payload.name,
          financial_nature: financialNature,
          document_category: payload.category ?? payload.document_type,
          counterparty_document: payload.cnpj ?? payload.cpf,
          document_number: payload.number,
          competence: payload.competence,
          issued_at: payload.issued_at,
          due_date: payload.due_date,
          original_cents: valueCents,
          updated_cents: valueCents,
          remaining_cents: valueCents,
          payment_status: paymentStatusForFinancialControl(paymentStatus),
          proof_status: "missing",
          department: payload.department,
          storage_path: payload.storage_path,
          notes: payload.notes,
          created_by: staff.id,
        })
        .select("id")
        .single();

      if (control) {
        await supabase
          .from("fiscal_vault_documents")
          .update({ financial_control_id: control.id })
          .eq("id", data.id)
          .eq("tenant_id", staff.tenantId);
      }
    }

    await supabase.from("document_vault_versions").insert({
      tenant_id: staff.tenantId,
      vault_document_id: data.id,
      version: 1,
      storage_path: storagePath ?? "sem-arquivo",
      file_name: inferredName ?? payload.name,
      reason: "Versão inicial",
      notes: payload.notes,
      created_by: staff.id,
    });

    await supabase.from("document_vault_audit_events").insert({
      tenant_id: staff.tenantId,
      vault_document_id: data.id,
      action: "created",
      new_value: payload,
      actor_id: staff.id,
    });

    await audit(supabase, { tenantId: staff.tenantId, actorId: staff.id, action: "created_vault_document", entityType: "fiscal_vault_document", entityId: data.id, afterData: payload });
  }
  revalidateFiscalCenter();
}

export async function registerVaultDocumentPayment(vaultDocumentId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const paymentStatus = requiredText(formData, "payment_status", "Status financeiro");
  const paid = cents(formData, "paid");
  const receiptPath = text(formData, "receipt_path");
  const paymentDate = dateValue(formData, "payment_date");

  const { data: doc } = await supabase
    .from("fiscal_vault_documents")
    .select("id, name, value_cents, financial_control_id")
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();
  if (!doc) return;

  let controlId = doc.financial_control_id as string | null;
  if (!controlId) {
    const { data: control } = await supabase
      .from("document_financial_controls")
      .insert({
        tenant_id: staff.tenantId,
        source_module: "cofre_fiscal",
        source_table: "fiscal_vault_documents",
        source_id: vaultDocumentId,
        document_name: doc.name,
        financial_nature: "needs_review",
        original_cents: Number(doc.value_cents ?? 0),
        updated_cents: Number(doc.value_cents ?? 0),
        remaining_cents: Number(doc.value_cents ?? 0),
        payment_status: "open",
        created_by: staff.id,
      })
      .select("id")
      .single();
    controlId = control?.id ?? null;
    if (controlId) {
      await supabase.from("fiscal_vault_documents").update({ financial_control_id: controlId }).eq("id", vaultDocumentId).eq("tenant_id", staff.tenantId);
    }
  }

  if (!controlId) return;

  const updatedCents = Number(doc.value_cents ?? 0);
  await supabase
    .from("document_financial_controls")
    .update({
      payment_status: paymentStatusForFinancialControl(paymentStatus),
      paid_cents: paid,
      remaining_cents: Math.max(0, updatedCents - paid),
      payment_method: text(formData, "payment_method"),
      bank_account: text(formData, "bank_account"),
      proof_status: receiptPath ? "sent" : "missing",
      receipt_paths: receiptPath ? [receiptPath] : [],
    })
    .eq("id", controlId)
    .eq("tenant_id", staff.tenantId);

  await supabase.from("document_financial_payments").insert({
    tenant_id: staff.tenantId,
    control_id: controlId,
    payment_kind: paymentStatus === "scheduled" ? "scheduled" : paymentStatus === "partial" ? "partial" : "full",
    status: paymentStatus === "scheduled" ? "scheduled" : "registered",
    amount_cents: paid,
    paid_at: paymentDate,
    scheduled_for: paymentStatus === "scheduled" ? paymentDate : null,
    bank_account: text(formData, "bank_account"),
    payment_method: text(formData, "payment_method"),
    proof_paths: receiptPath ? [receiptPath] : [],
    notes: text(formData, "notes"),
    created_by: staff.id,
  });

  await supabase
    .from("fiscal_vault_documents")
    .update({ paid_at: paymentDate })
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId);

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    vault_document_id: vaultDocumentId,
    action: "registered_financial_payment",
    new_value: { payment_status: paymentStatus, paid_cents: paid, receipt_path: receiptPath },
    actor_id: staff.id,
  });

  revalidateFiscalCenter();
}

export async function updateVaultDocument(vaultDocumentId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const storagePath = text(formData, "storage_path");
  const valueCents = cents(formData, "value");
  const paymentStatus = text(formData, "payment_status");
  const folderId = await resolveVaultFolderId(supabase, staff, formData, storagePath);

  const payload = {
    folder_id: folderId,
    name: requiredText(formData, "name", "Nome"),
    document_type: requiredText(formData, "document_type", "Tipo"),
    category: text(formData, "category"),
    department: text(formData, "department"),
    competence: text(formData, "competence"),
    issued_at: dateValue(formData, "issued_at"),
    due_date: dateValue(formData, "due_date"),
    value_cents: valueCents,
    cnpj: text(formData, "cnpj"),
    cpf: text(formData, "cpf"),
    access_key: text(formData, "access_key"),
    number: text(formData, "number"),
    series: text(formData, "series"),
    origin: text(formData, "origin") ?? "manual",
    status: requiredText(formData, "status", "Status do cofre"),
    verification_status: requiredText(formData, "verification_status", "Verificação"),
    visibility_status: text(formData, "visibility_status") ?? "unread",
    storage_path: storagePath,
    tags: jsonArray(formData, "tags"),
    notes: text(formData, "notes"),
  };

  const { data: previous } = await supabase
    .from("fiscal_vault_documents")
    .select("id, storage_path, financial_control_id, folder_id")
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!previous) return;

  const { error } = await supabase
    .from("fiscal_vault_documents")
    .update(payload)
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId);

  if (error) throw new Error(`Não foi possível editar o documento: ${error.message}.`);

  if (previous.financial_control_id) {
    await supabase
      .from("document_financial_controls")
      .update({
        document_name: payload.name,
        document_category: payload.category ?? payload.document_type,
        counterparty_document: payload.cnpj ?? payload.cpf,
        document_number: payload.number,
        competence: payload.competence,
        issued_at: payload.issued_at,
        due_date: payload.due_date,
        original_cents: valueCents,
        updated_cents: valueCents,
        remaining_cents: valueCents,
        payment_status: paymentStatusForFinancialControl(paymentStatus),
        department: payload.department,
        storage_path: payload.storage_path,
        notes: payload.notes,
      })
      .eq("id", previous.financial_control_id)
      .eq("tenant_id", staff.tenantId);
  }

  if (storagePath && storagePath !== previous.storage_path) {
    const { data: latestVersion } = await supabase
      .from("document_vault_versions")
      .select("version")
      .eq("tenant_id", staff.tenantId)
      .eq("vault_document_id", vaultDocumentId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("document_vault_versions").insert({
      tenant_id: staff.tenantId,
      vault_document_id: vaultDocumentId,
      version: Number(latestVersion?.version ?? 0) + 1,
      storage_path: storagePath,
      file_name: fileTitleFromPath(storagePath) ?? payload.name,
      reason: "Arquivo substituído no cofre fiscal",
      notes: payload.notes,
      created_by: staff.id,
    });
  }

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    vault_document_id: vaultDocumentId,
    action: "updated",
    new_value: payload,
    actor_id: staff.id,
  });

  await audit(supabase, {
    tenantId: staff.tenantId,
    actorId: staff.id,
    action: "updated_vault_document",
    entityType: "fiscal_vault_document",
    entityId: vaultDocumentId,
    afterData: payload,
  });

  revalidateFiscalCenter();
}

export async function moveVaultDocumentToFolder(vaultDocumentId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const selectedFolderId = text(formData, "folder_id");
  const folderId = selectedFolderId === "__entrada_geral__"
    ? await ensureDefaultVaultFolder(supabase, staff)
    : selectedFolderId;

  if (!folderId) throw new Error("Escolha uma pasta para mover o documento.");

  const { data: previous } = await supabase
    .from("fiscal_vault_documents")
    .select("id, folder_id, name")
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!previous) throw new Error("Documento não encontrado no cofre fiscal.");

  const { data: folder } = await supabase
    .from("document_vault_folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!folder) throw new Error("Pasta de destino não encontrada.");

  const { error } = await supabase
    .from("fiscal_vault_documents")
    .update({ folder_id: folder.id })
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId);

  if (error) throw new Error(`Não foi possível mover o documento: ${error.message}.`);

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    vault_document_id: vaultDocumentId,
    folder_id: folder.id,
    action: "moved_to_folder",
    previous_value: { folder_id: previous.folder_id },
    new_value: { folder_id: folder.id, folder_name: folder.name },
    reason: text(formData, "reason") ?? "Movido pelo cofre fiscal.",
    actor_id: staff.id,
  });

  await audit(supabase, {
    tenantId: staff.tenantId,
    actorId: staff.id,
    action: "moved_vault_document_to_folder",
    entityType: "fiscal_vault_document",
    entityId: vaultDocumentId,
    afterData: {
      previous_folder_id: previous.folder_id,
      folder_id: folder.id,
      folder_name: folder.name,
    },
  });

  revalidateFiscalCenter();
}

export async function registerVaultDocumentShare(vaultDocumentId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    vault_document_id: vaultDocumentId,
    action: "shared_internal_link",
    reason: "Link interno protegido copiado no cofre fiscal.",
    actor_id: staff.id,
  });

  revalidateFiscalCenter();
}

export async function archiveVaultDocument(vaultDocumentId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const reason = text(formData, "reason") ?? "Arquivamento solicitado no cofre fiscal.";
  const { data: archived, error: archiveError } = await supabase
    .from("fiscal_vault_documents")
    .update({ archived_at: new Date().toISOString(), status: "archived" })
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId)
    .select("id")
    .maybeSingle();

  if (archiveError) throw new Error(`Falha ao arquivar documento: ${archiveError.message}`);
  if (!archived) throw new Error("Documento não encontrado ou sem permissão para arquivar.");

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    vault_document_id: vaultDocumentId,
    action: "archived",
    reason,
    actor_id: staff.id,
  });
  revalidateFiscalCenter();
}

export async function unarchiveVaultDocument(vaultDocumentId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const reason = text(formData, "reason") ?? "Desarquivamento solicitado no cofre fiscal.";
  const { data: restored, error: restoreError } = await supabase
    .from("fiscal_vault_documents")
    .update({ archived_at: null, status: "received" })
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId)
    .select("id")
    .maybeSingle();

  if (restoreError) throw new Error(`Falha ao desarquivar documento: ${restoreError.message}`);
  if (!restored) throw new Error("Documento não encontrado ou sem permissão para desarquivar.");

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    vault_document_id: vaultDocumentId,
    action: "unarchived",
    reason,
    actor_id: staff.id,
  });
  revalidateFiscalCenter();
}

export async function deleteVaultDocument(vaultDocumentId: string, formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const reason = text(formData, "reason") ?? "Exclusão lógica solicitada no cofre fiscal.";

  await supabase
    .from("fiscal_vault_documents")
    .update({
      deleted_at: new Date().toISOString(),
      status: "archived",
      visibility_status: "deleted",
    })
    .eq("id", vaultDocumentId)
    .eq("tenant_id", staff.tenantId);

  await supabase.from("document_vault_audit_events").insert({
    tenant_id: staff.tenantId,
    vault_document_id: vaultDocumentId,
    action: "soft_deleted",
    reason,
    actor_id: staff.id,
  });

  await audit(supabase, {
    tenantId: staff.tenantId,
    actorId: staff.id,
    action: "soft_deleted_vault_document",
    entityType: "fiscal_vault_document",
    entityId: vaultDocumentId,
    justification: reason,
  });

  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
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
  revalidateFiscalCenter();
}
