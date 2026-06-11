import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de um Server Component: middleware cuida do refresh
          }
        },
      },
    }
  );
}

export type StaffSession = {
  userId: string;
  email: string;
  tenantId: string;
  role: "platform_admin" | "tenant_owner" | "tenant_admin" | "tenant_editor";
};

const STAFF_ROLES = ["platform_admin", "tenant_owner", "tenant_admin", "tenant_editor"];

/** Retorna a sessão se o usuário for staff; null caso contrário. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = (user.app_metadata ?? {}) as { tenant_id?: string; role?: string };
  if (!meta.role || !STAFF_ROLES.includes(meta.role)) return null;
  if (!meta.tenant_id && meta.role !== "platform_admin") return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    tenantId: meta.tenant_id ?? "",
    role: meta.role as StaffSession["role"],
  };
}
