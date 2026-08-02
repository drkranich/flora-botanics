"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ── SLA Policies ──────────────────────────────────────────────────────────────

export async function createSlaPolicy(formData: FormData): Promise<ActionResult<string>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Nome obrigatório." };

  const supabase = await createClient();

  const firstResponse: Record<string, number> = {
    low:      parseInt(String(formData.get("fr_low")  ?? "480"), 10),
    normal:   parseInt(String(formData.get("fr_normal") ?? "240"), 10),
    high:     parseInt(String(formData.get("fr_high")  ?? "60"), 10),
    urgent:   parseInt(String(formData.get("fr_urgent") ?? "30"), 10),
    critical: parseInt(String(formData.get("fr_critical") ?? "15"), 10),
  };
  const resolution: Record<string, number> = {
    low:      parseInt(String(formData.get("res_low")  ?? "10080"), 10),
    normal:   parseInt(String(formData.get("res_normal") ?? "2880"), 10),
    high:     parseInt(String(formData.get("res_high")  ?? "480"), 10),
    urgent:   parseInt(String(formData.get("res_urgent") ?? "240"), 10),
    critical: parseInt(String(formData.get("res_critical") ?? "60"), 10),
  };

  const { data, error } = await supabase
    .from("helpdesk_sla_policies")
    .insert({
      tenant_id:               staff.tenantId,
      name,
      description:             String(formData.get("description") ?? "").trim() || null,
      first_response_minutes:  firstResponse,
      resolution_minutes:      resolution,
      business_hours_only:     formData.get("business_hours_only") === "on",
      business_hours_start:    String(formData.get("bh_start") ?? "08:00"),
      business_hours_end:      String(formData.get("bh_end")   ?? "18:00"),
      escalate_at_percent:     parseInt(String(formData.get("escalate_pct") ?? "80"), 10),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao criar política." };
  revalidatePath("/inbox/settings");
  return { ok: true, data: (data as { id: string }).id };
}

export async function toggleSlaPolicy(id: string, active: boolean): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_sla_policies")
    .update({ active })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}

export async function deleteSlaPolicy(id: string): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_sla_policies")
    .delete()
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}
