import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Papéis que podem acessar o backoffice (Seção 3 do blueprint). */
const STAFF_ROLES = ["platform_admin", "tenant_owner", "tenant_admin", "tenant_editor"];

/** Rotas acessíveis sem sessão autenticada. */
const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANTE: getUser() revalida o token a cada request.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user) {
    if (!isPublic) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // Usuário logado tentando ver /login -> manda pro painel.
  if (isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (path === "/sem-acesso") {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "";
  if (!profile?.tenant_id || !STAFF_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/sem-acesso", request.url));
  }

  return response;
}
