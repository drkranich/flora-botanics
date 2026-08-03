"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

export interface AgentProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  role: string;
  department: string | null;
  job_title: string | null;
  avatar_url: string | null;
  created_at: string;
  inbox_permissions: {
    can_reply: boolean;
    can_assign: boolean;
    can_resolve: boolean;
    can_delete: boolean;
    can_export: boolean;
    view_all_conversations: boolean;
    view_team_conversations: boolean;
  };
  teams: { id: string; name: string; color: string }[];
}

export interface InboxTeam {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  members: AgentProfile[];
}

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ── Listar todos os agentes do tenant ─────────────────────────────────────────

export async function getAgents(): Promise<AgentProfile[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();

  const [{ data: profiles }, { data: teamMembers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, whatsapp, role, department, job_title, avatar_url, created_at, inbox_permissions")
      .eq("tenant_id", staff.tenantId)
      .in("role", ["platform_admin", "tenant_owner", "tenant_admin", "tenant_editor"])
      .order("full_name", { ascending: true }),

    supabase
      .from("helpdesk_team_members")
      .select("profile_id, helpdesk_teams(id, name, color)")
      .eq("tenant_id", staff.tenantId),
  ]);

  const teamsByProfile: Record<string, { id: string; name: string; color: string }[]> = {};
  for (const m of (teamMembers ?? []) as unknown as Array<{
    profile_id: string;
    helpdesk_teams: { id: string; name: string; color: string } | { id: string; name: string; color: string }[] | null;
  }>) {
    if (!teamsByProfile[m.profile_id]) teamsByProfile[m.profile_id] = [];
    const t = Array.isArray(m.helpdesk_teams) ? m.helpdesk_teams[0] : m.helpdesk_teams;
    if (t) teamsByProfile[m.profile_id].push(t);
  }

  return (profiles ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    full_name: p.full_name as string | null,
    email: p.email as string | null,
    phone: p.phone as string | null,
    whatsapp: p.whatsapp as string | null,
    role: p.role as string,
    department: p.department as string | null,
    job_title: p.job_title as string | null,
    avatar_url: p.avatar_url as string | null,
    created_at: p.created_at as string,
    inbox_permissions: (p.inbox_permissions as AgentProfile["inbox_permissions"]) ?? {
      can_reply: true, can_assign: false, can_resolve: true,
      can_delete: false, can_export: false,
      view_all_conversations: false, view_team_conversations: true,
    },
    teams: teamsByProfile[p.id as string] ?? [],
  }));
}

// ── Listar equipes com membros ────────────────────────────────────────────────

export async function getTeamsWithMembers(): Promise<InboxTeam[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const agents = await getAgents();
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase
      .from("helpdesk_teams")
      .select("id, name, description, color, active")
      .eq("tenant_id", staff.tenantId)
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("helpdesk_team_members")
      .select("team_id, profile_id")
      .eq("tenant_id", staff.tenantId),
  ]);

  const membersByTeam: Record<string, string[]> = {};
  for (const m of (members ?? []) as { team_id: string; profile_id: string }[]) {
    if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = [];
    membersByTeam[m.team_id].push(m.profile_id);
  }

  return (teams ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    name: t.name as string,
    description: t.description as string | null,
    color: t.color as string,
    active: t.active as boolean,
    members: (membersByTeam[t.id as string] ?? [])
      .map(pid => agentMap[pid])
      .filter(Boolean),
  }));
}

// ── Atualizar perfil do agente (dados + permissões) ──────────────────────────

export async function updateAgentProfile(
  agentId: string,
  data: {
    full_name?: string;
    phone?: string;
    whatsapp?: string;
    department?: string;
    job_title?: string;
    inbox_permissions?: Partial<AgentProfile["inbox_permissions"]>;
  }
): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();

  // Busca permissões atuais para merge
  const { data: current } = await supabase
    .from("profiles")
    .select("inbox_permissions")
    .eq("id", agentId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  const currentPerms = (current?.inbox_permissions as AgentProfile["inbox_permissions"]) ?? {};
  const mergedPerms = data.inbox_permissions
    ? { ...currentPerms, ...data.inbox_permissions }
    : currentPerms;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.full_name !== undefined) update.full_name = data.full_name.trim();
  if (data.phone !== undefined) update.phone = data.phone.trim();
  if (data.whatsapp !== undefined) update.whatsapp = data.whatsapp.trim();
  if (data.department !== undefined) update.department = data.department.trim();
  if (data.job_title !== undefined) update.job_title = data.job_title.trim();
  if (data.inbox_permissions !== undefined) update.inbox_permissions = mergedPerms;

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", agentId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/equipe");
  return { ok: true };
}

// ── Convidar novo agente ──────────────────────────────────────────────────────

export async function inviteAgent(
  email: string,
  role: "tenant_admin" | "tenant_editor",
  department?: string,
  jobTitle?: string
): Promise<ActionResult<{ applied: boolean }>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) {
    return { ok: false, error: "Sem permissão." };
  }
  if (!email.trim()) return { ok: false, error: "E-mail obrigatório." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("team_invite", {
    t: staff.tenantId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });

  if (error) return { ok: false, error: error.message };

  // Se o perfil já existe, atualiza department/job_title
  if ((data as { applied: boolean }).applied && (department || jobTitle)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .eq("tenant_id", staff.tenantId)
      .maybeSingle();

    if (profile?.id) {
      await supabase.from("profiles").update({
        ...(department ? { department } : {}),
        ...(jobTitle ? { job_title: jobTitle } : {}),
      }).eq("id", profile.id);
    }
  }

  revalidatePath("/inbox/equipe");
  return { ok: true, data: { applied: (data as { applied: boolean }).applied } };
}

// ── Remover agente do tenant ──────────────────────────────────────────────────

export async function removeAgent(agentId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!["platform_admin", "tenant_owner"].includes(staff.role)) {
    return { ok: false, error: "Somente proprietários podem remover agentes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("team_remove", { member: agentId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox/equipe");
  return { ok: true };
}
