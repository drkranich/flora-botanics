import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para o storefront/admin (chave anon — RLS aplica).
 * Tipos do banco: gerar com `supabase gen types typescript` e colar em types.ts (Fase 1).
 */
export function createAnonClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}

export interface TenantContext {
  tenantId: string;
  slug: string;
  name: string;
}

/** Resolve tenant a partir do hostname (tenant_domains). */
export async function resolveTenantByDomain(
  db: SupabaseClient,
  hostname: string
): Promise<TenantContext | null> {
  const { data, error } = await db
    .from("tenant_domains")
    .select("tenant_id, tenants!inner(id, slug, name, status)")
    .eq("domain", hostname)
    .maybeSingle();
  if (error || !data) return null;
  const t = data.tenants as unknown as { id: string; slug: string; name: string; status: string };
  if (t.status !== "active") return null;
  return { tenantId: t.id, slug: t.slug, name: t.name };
}

/** Fallback de desenvolvimento: resolve pelo slug do tenant. */
export async function resolveTenantBySlug(
  db: SupabaseClient,
  slug: string
): Promise<TenantContext | null> {
  const { data, error } = await db
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return { tenantId: data.id, slug: data.slug, name: data.name };
}

/** Carrega a versão publicada de uma página do CMS. */
export async function getPublishedPage(
  db: SupabaseClient,
  tenantId: string,
  slug: string
) {
  const { data: page } = await db
    .from("pages")
    .select("id, title, seo, published_version_id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!page?.published_version_id) return null;

  const { data: version } = await db
    .from("page_versions")
    .select("sections, version")
    .eq("id", page.published_version_id)
    .maybeSingle();
  if (!version) return null;

  return { title: page.title as string, seo: page.seo, sections: version.sections };
}

/** Carrega o tema (tokens) do tenant. */
export async function getTenantTheme(db: SupabaseClient, tenantId: string) {
  const { data } = await db
    .from("tenant_themes")
    .select("tokens")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data?.tokens ?? {}) as Record<string, unknown>;
}

/** Carrega menu por localização. */
export async function getMenu(db: SupabaseClient, tenantId: string, location: string) {
  const { data } = await db
    .from("menus")
    .select("items")
    .eq("tenant_id", tenantId)
    .eq("location", location)
    .maybeSingle();
  return (data?.items ?? []) as Array<{ label: string; href: string }>;
}
