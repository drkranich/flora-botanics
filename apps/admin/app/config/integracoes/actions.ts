"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

export type IntegrationKey =
  | "integration_whatsapp"
  | "integration_mercadolivre"
  | "integration_shopee"
  | "integration_instagram"
  | "integration_amazon"
  | "integration_tiktok"
  | "integration_google_merchant";

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

  revalidatePath("/config/integracoes");
  return { ok: true };
}
