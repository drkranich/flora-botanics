"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { enqueueIntegrationEvent, enqueueIntegrationSync } from "@/lib/integrations/event-bus";
import { providerForIntegration, type IntegrationKey } from "@/lib/integrations/providers";

export type { IntegrationKey };

function publicPreview(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      /token|secret|key|password|json|credential/i.test(key)
        ? `••••${val.slice(-4)}`
        : val,
    ])
  );
}

/**
 * Salva (upsert) as credenciais de uma integração no site_settings.
 * formData contém os campos do formulário — os campos vazios são removidos.
 */
export async function saveIntegration(
  integrationKey: IntegrationKey,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const value: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (key === "_integration" || key === "_action") continue;
    const str = String(val).trim();
    if (str) value[key] = str;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    {
      tenant_id: staff.tenantId,
      key: integrationKey,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,key" }
  );

  if (error) return { ok: false, error: error.message };

  const providerKey = providerForIntegration(integrationKey);
  await supabase.from("integration_connections").upsert(
    {
      tenant_id: staff.tenantId,
      provider_key: providerKey,
      display_name: providerKey,
      environment: "production",
      status: "pending_auth",
      credentials_status: Object.keys(value).length > 0 ? "stored" : "missing",
      credentials_ref: `site_settings:${integrationKey}`,
      credentials_preview: publicPreview(value),
      settings: { legacy_key: integrationKey },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider_key,environment" }
  ).then(() => undefined, () => undefined);

  revalidatePath("/config/integracoes");
  return { ok: true };
}

/**
 * Remove as credenciais de uma integração (deleta a row de site_settings).
 */
export async function removeIntegration(
  integrationKey: IntegrationKey
): Promise<{ ok: boolean; error?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .delete()
    .eq("tenant_id", staff.tenantId)
    .eq("key", integrationKey);

  if (error) return { ok: false, error: error.message };

  const providerKey = providerForIntegration(integrationKey);
  await supabase
    .from("integration_connections")
    .update({
      status: "offline",
      credentials_status: "missing",
      credentials_ref: null,
      credentials_preview: {},
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", staff.tenantId)
    .eq("provider_key", providerKey)
    .eq("environment", "production")
    .then(() => undefined, () => undefined);

  revalidatePath("/config/integracoes");
  return { ok: true };
}

export async function startManualSync(
  integrationKey: IntegrationKey
): Promise<{ ok: boolean; error?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (staff.role !== "tenant_owner" && staff.role !== "tenant_admin") {
    return { ok: false, error: "Sem permissão." };
  }

  const providerKey = providerForIntegration(integrationKey);
  const supabase = await createClient();
  const now = new Date().toISOString();
  const idempotencyKey = `${providerKey}:manual-sync:${staff.tenantId}:${Date.now()}`;

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("tenant_id", staff.tenantId)
    .eq("provider_key", providerKey)
    .eq("environment", "production")
    .maybeSingle();

  const { error: runError } = await enqueueIntegrationSync(supabase, {
    tenantId: staff.tenantId,
    connectionId: connection?.id ?? null,
    providerKey,
    action: "sync_all",
    trigger: "manual",
    requestPayload: { integration_key: integrationKey },
    createdBy: staff.id,
  });

  if (runError) {
    return {
      ok: false,
      error:
        "A fila de integrações ainda não está aplicada no banco. Aplique a migration integration_event_bus_foundation e tente novamente.",
    };
  }

  await enqueueIntegrationEvent(supabase, {
    tenantId: staff.tenantId,
    eventType: "integration.sync.requested",
    source: "admin",
    sourceId: integrationKey,
    aggregateType: "integration",
    aggregateId: providerKey,
    payload: {
      provider_key: providerKey,
      integration_key: integrationKey,
      requested_by: staff.email,
    },
    idempotencyKey,
  }).then(() => undefined, () => undefined);

  await supabase
    .from("integration_connections")
    .update({
      last_sync_at: now,
      last_error: null,
      status: "online",
      updated_at: now,
    })
    .eq("tenant_id", staff.tenantId)
    .eq("provider_key", providerKey)
    .eq("environment", "production")
    .then(() => undefined, () => undefined);

  revalidatePath("/config/integracoes");
  return { ok: true };
}
