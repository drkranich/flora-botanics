import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Cliente Supabase para Server Components / Server Actions do admin.
 * Usa cookies para manter a sessão de autenticação (staff do tenant).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em apps/admin/.env.local"
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // chamado de um Server Component sem permissão de escrita —
          // o middleware já cuida do refresh da sessão.
        }
      },
    },
  });
}

/**
 * Alias histórico de createClient(), mantido para as páginas do admin
 * antigo (catálogo, CMS, vendas, plataforma, config, etc.) que importam
 * `supabaseServer`. Mesma implementação, nome diferente.
 */
export const supabaseServer = createClient;

export type StaffSession = {
  userId: string;
  email: string;
  tenantId: string;
  role: "platform_admin" | "tenant_owner" | "tenant_admin" | "tenant_editor";
};

/**
 * Retorna a sessão se o usuário for staff.
 * Internamente delega para `currentStaff()` (lib/auth.ts), que usa `profiles`
 * com fallback para `app_metadata` — unificando os dois padrões de auth sem
 * precisar alterar os 48+ arquivos que importam essa função.
 *
 * Mapeamento de campos: currentStaff.id → StaffSession.userId
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const { currentStaff } = await import("@/lib/auth");
  const staff = await currentStaff();
  if (!staff) return null;
  return {
    userId: staff.id,
    email: staff.email ?? "",
    tenantId: staff.tenantId,
    role: staff.role,
  };
}
