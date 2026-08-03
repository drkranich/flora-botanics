"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// ── Teams ──────────────────────────────────────────────────────────────────────

export async function createTeam(name: string, description: string, color: string): Promise<ActionResult<string>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!name.trim()) return { ok: false, error: "Nome obrigatório." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("helpdesk_teams")
    .insert({ tenant_id: staff.tenantId, name: name.trim(), description: description.trim() || null, color })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao criar equipe." };
  revalidatePath("/inbox/settings");
  return { ok: true, data: (data as { id: string }).id };
}

export async function updateTeam(id: string, name: string, description: string, color: string): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_teams")
    .update({ name: name.trim(), description: description.trim() || null, color })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}

export async function deleteTeam(id: string): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_teams")
    .update({ active: false })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}

export async function addTeamMember(teamId: string, profileId: string, role: "agent" | "lead"): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_team_members")
    .upsert({ tenant_id: staff.tenantId, team_id: teamId, profile_id: profileId, role }, { onConflict: "team_id,profile_id" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}

export async function removeTeamMember(teamId: string, profileId: string): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("profile_id", profileId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}

// ── Business Hours ─────────────────────────────────────────────────────────────

export interface BusinessHourInput {
  day_of_week: number;  // 0=Dom … 6=Sáb
  open: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
}

export async function saveBusinessHours(hours: BusinessHourInput[]): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const rows = hours.map(h => ({ ...h, tenant_id: staff.tenantId }));

  const { error } = await supabase
    .from("helpdesk_business_hours")
    .upsert(rows, { onConflict: "tenant_id,day_of_week" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}

// ── Email Signatures ───────────────────────────────────────────────────────────

export async function saveEmailSignature(
  id: string | null,
  name: string,
  body: string,
  isDefault: boolean,
): Promise<ActionResult<string>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();

  // Se for padrão, remove default das demais
  if (isDefault) {
    await supabase
      .from("helpdesk_email_signatures")
      .update({ is_default: false })
      .eq("tenant_id", staff.tenantId);
  }

  if (id) {
    const { error } = await supabase
      .from("helpdesk_email_signatures")
      .update({ name, body, is_default: isDefault })
      .eq("id", id)
      .eq("tenant_id", staff.tenantId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inbox/settings");
    return { ok: true, data: id };
  }

  const { data, error } = await supabase
    .from("helpdesk_email_signatures")
    .insert({ tenant_id: staff.tenantId, name, body, is_default: isDefault })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao salvar." };
  revalidatePath("/inbox/settings");
  return { ok: true, data: (data as { id: string }).id };
}

export async function deleteEmailSignature(id: string): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_email_signatures")
    .delete()
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}

// ── Channel Connections (e-mail) ───────────────────────────────────────────────

export async function saveEmailChannel(
  id: string | null,
  name: string,
  identifier: string,
  autoReply: boolean,
  autoReplyMessage: string,
): Promise<ActionResult<string>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!identifier.trim()) return { ok: false, error: "E-mail obrigatório." };

  const admin = await createAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração do servidor." };

  const payload = {
    tenant_id:           staff.tenantId,
    channel:             "email" as const,
    name:                name.trim() || identifier.trim(),
    identifier:          identifier.trim().toLowerCase(),
    active:              true,
    status:              "connected",
    auto_reply_enabled:  autoReply,
    auto_reply_message:  autoReply ? autoReplyMessage.trim() : null,
  };

  if (id) {
    const { error } = await admin
      .from("helpdesk_channel_connections")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", staff.tenantId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inbox/settings");
    return { ok: true, data: id };
  }

  const { data, error } = await admin
    .from("helpdesk_channel_connections")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao salvar." };
  revalidatePath("/inbox/settings");
  return { ok: true, data: (data as { id: string }).id };
}

export async function deleteEmailChannel(id: string): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const admin = await createAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração do servidor." };

  const { error } = await admin
    .from("helpdesk_channel_connections")
    .update({ active: false })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/settings");
  return { ok: true, data: undefined };
}
