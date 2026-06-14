"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

/** Gestão de equipe — todas as regras vivem nas RPCs (security definer + checks). */

export type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

export async function inviteTeamMember(email: string, role: "tenant_admin" | "tenant_editor") {
  const supabase = await supabaseServer();
  const tenantId = await effectiveTenantId();
  const { data, error } = await supabase.rpc("team_invite", {
    t: tenantId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/config");
  // applied=true → a conta já existia e o acesso valeu na hora
  return (data as { applied: boolean }).applied;
}

export async function setTeamRole(memberId: string, role: "tenant_admin" | "tenant_editor") {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("team_set_role", { member: memberId, new_role: role });
  if (error) throw new Error(error.message);
  revalidatePath("/config");
}

export async function removeTeamMember(memberId: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("team_remove", { member: memberId });
  if (error) throw new Error(error.message);
  revalidatePath("/config");
}

export async function revokeInvite(inviteId: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("team_revoke_invite", { inv: inviteId });
  if (error) throw new Error(error.message);
  revalidatePath("/config");
}
