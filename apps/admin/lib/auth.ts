import { createClient } from "@/lib/supabase/server";

export type StaffRole = "platform_admin" | "tenant_owner" | "tenant_admin" | "tenant_editor";

export interface StaffProfile {
  id: string;
  tenantId: string;
  role: StaffRole;
  fullName: string | null;
  email: string | null;
}

const STAFF_ROLES: StaffRole[] = ["platform_admin", "tenant_owner", "tenant_admin", "tenant_editor"];

/**
 * Retorna o perfil do usuário autenticado, se for staff do tenant.
 *
 * Estratégia de dois níveis:
 *  1. Lê de `profiles` (fonte primária — dados atualizáveis pelo admin).
 *  2. Se não houver registro em `profiles`, faz fallback para `app_metadata`
 *     do JWT (comportamento idêntico ao `getStaffSession` do padrão antigo),
 *     evitando falha silenciosa para usuários criados sem registro na tabela.
 *
 * O middleware já redireciona sessões sem role para /sem-acesso; aqui só
 * precisamos garantir que staff legítimo nunca receba null por falta de perfil.
 */
export async function currentStaff(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  // ── 1. Tenta profiles ──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.tenant_id && STAFF_ROLES.includes(profile.role as StaffRole)) {
    return {
      id: profile.id,
      tenantId: profile.tenant_id,
      role: profile.role as StaffRole,
      fullName: profile.full_name,
      email: user.email ?? null,
    };
  }

  // ── 2. Fallback: app_metadata do JWT (p/ staff sem registro em profiles) ─
  const meta = (user.app_metadata ?? {}) as { tenant_id?: string; role?: string };
  if (meta.role && STAFF_ROLES.includes(meta.role as StaffRole)) {
    if (meta.tenant_id || meta.role === "platform_admin") {
      return {
        id: user.id,
        tenantId: meta.tenant_id ?? "",
        role: meta.role as StaffRole,
        fullName: user.user_metadata?.full_name ?? null,
        email: user.email ?? null,
      };
    }
  }

  return null;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  platform_admin: "Admin da plataforma",
  tenant_owner: "Proprietário",
  tenant_admin: "Administrador",
  tenant_editor: "Editor",
};
