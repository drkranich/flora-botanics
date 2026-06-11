import { headers } from "next/headers";
import {
  createAnonClient,
  resolveTenantByDomain,
  resolveTenantBySlug,
  type TenantContext,
} from "@flora/db";

const FALLBACK_TENANT_SLUG = "flora-botanics";

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em apps/storefront/.env.local"
    );
  }
  return createAnonClient(url, key);
}

/** Resolve o tenant pelo Host; em localhost cai no tenant padrão. */
export async function currentTenant(): Promise<TenantContext> {
  const client = db();
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0];

  if (host && !host.startsWith("localhost") && host !== "127.0.0.1") {
    const byDomain = await resolveTenantByDomain(client, host);
    if (byDomain) return byDomain;
  }
  const fallback = await resolveTenantBySlug(client, FALLBACK_TENANT_SLUG);
  if (!fallback) throw new Error("Tenant padrão não encontrado no banco.");
  return fallback;
}
