import { createClient } from "@/lib/supabase/server";

export type StaffRole = "platform_admin" | "tenant_owner" | "tenant_admin" | "tenant_editor";

export interface StaffProfile {
  id: string;
  tenantId: string;
  role: StaffRole;
  fullName: string | null;
  email: string | null;
}

/**
 * Retorna o perfil do usuário autenticado, se for staff do tenant.
 * Retorna null se não houver sessão ou se o perfil não tiver tenant/role
 * de backoffice (o middleware já redireciona esses casos para /sem-acesso).
 */
export async function currentStaff(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) return null;

  const staffRoles: StaffRole[] = ["platform_admin", "tenant_owner", "tenant_admin", "tenant_editor"];
  if (!staffRoles.includes(profile.role as StaffRole)) return null;

  return {
    id: profile.id,
    tenantId: profile.tenant_id,
    role: profile.role as StaffRole,
    fullName: profile.full_name,
    email: user.email ?? null,
  };
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  platform_admin: "Admin da plataforma",
  tenant_owner: "Proprietário",
  tenant_admin: "Administrador",
  tenant_editor: "Editor",
};
