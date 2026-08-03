import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createClient } from "@supabase/supabase-js";

type RuntimeEnv = Record<string, string | undefined>;

async function runtimeEnv(): Promise<RuntimeEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as RuntimeEnv;
  } catch {
    return process.env;
  }
}

/**
 * Cliente administrativo usado somente em Server Actions / Route Handlers.
 * Nunca importar este arquivo em componentes client-side.
 *
 * Padrão duplo igual ao storefront: tenta Cloudflare env primeiro,
 * faz fallback para process.env (dev local).
 */
export async function createAdminClient() {
  const env = await runtimeEnv();
  const url            = env.NEXT_PUBLIC_SUPABASE_URL       ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY      ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("[createAdminClient] Variáveis ausentes:", { url: !!url, key: !!serviceRoleKey });
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
