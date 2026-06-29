"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const STAFF_ROLES = ["platform_admin", "tenant_owner", "tenant_admin", "tenant_editor"];

const RESET_NOTICE =
  "Se este e-mail estiver cadastrado como equipe do painel, voce recebera um link para redefinir a senha.";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function resetRedirectUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "https://florabotanics.com.br";

  return `${origin}/admin/login/redefinir`;
}

/**
 * Recuperacao de senha do painel administrativo.
 *
 * Regra de seguranca:
 * - nunca chama o reset do Supabase direto do navegador;
 * - primeiro valida, no servidor, que o e-mail pertence a um perfil staff;
 * - clientes comuns (`role = customer`) nao recebem link de reset do admin;
 * - a resposta da UI e sempre generica para nao enumerar e-mails validos.
 */
export async function requestAdminPasswordReset(email: string): Promise<{ notice: string }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { notice: RESET_NOTICE };
  }

  const supabase = await createAdminClient();
  if (!supabase) {
    console.error("SUPABASE_SERVICE_ROLE_KEY ausente: recuperacao de senha do admin indisponivel.");
    return { notice: RESET_NOTICE };
  }

  const { data: staffProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", normalizedEmail)
    .in("role", STAFF_ROLES)
    .maybeSingle();

  if (profileError) {
    console.error("Falha ao validar staff para reset do admin:", profileError.message);
    return { notice: RESET_NOTICE };
  }

  if (!staffProfile) {
    return { notice: RESET_NOTICE };
  }

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: await resetRedirectUrl(),
  });

  if (resetError) {
    console.error("Falha ao enviar reset do admin:", resetError.message);
  }

  return { notice: RESET_NOTICE };
}
