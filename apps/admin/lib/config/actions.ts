"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

export interface LogoConfig {
  image: string;
  width: number;
  height: number;
  /** Cor hex (ex: "#ffffff") ou "" para usar a cor original da imagem. */
  color: string;
}

function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
}

async function requireConfigAdmin() {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  if (session.role === "tenant_editor") throw new Error("Editores não podem alterar configurações.");
  return session;
}

/** Salva o logo da marca (imagem + tamanho + cor) em site_settings.logo. */
export async function updateLogo(logo: LogoConfig) {
  await requireConfigAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        tenant_id: tenantId,
        key: "logo",
        value: {
          image: logo.image.trim(),
          width: logo.width,
          height: logo.height,
          color: logo.color,
        },
      },
      { onConflict: "tenant_id,key" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/config");
}

/** Salva o favicon da marca em site_settings.favicon. */
export async function updateFavicon(url: string) {
  await requireConfigAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { tenant_id: tenantId, key: "favicon", value: { url: url.trim() } },
      { onConflict: "tenant_id,key" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/config");
  revalidatePath("/");
}

export async function addTenantDomain(domain: string) {
  await requireConfigAdmin();
  const clean = normalizeDomain(domain);
  if (!clean || !clean.includes(".")) throw new Error("Informe um domínio válido.");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: existing } = await supabase
    .from("tenant_domains")
    .select("tenant_id")
    .eq("domain", clean)
    .maybeSingle();

  if (existing && existing.tenant_id !== tenantId) {
    throw new Error("Este domínio já está vinculado a outra marca.");
  }

  if (!existing) {
    const { count } = await supabase
      .from("tenant_domains")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    const { error } = await supabase.from("tenant_domains").insert({
      tenant_id: tenantId,
      domain: clean,
      is_primary: (count ?? 0) === 0,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/config");
}

export async function setPrimaryTenantDomain(domain: string) {
  await requireConfigAdmin();
  const clean = normalizeDomain(domain);
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error: resetError } = await supabase
    .from("tenant_domains")
    .update({ is_primary: false })
    .eq("tenant_id", tenantId);
  if (resetError) throw new Error(resetError.message);

  const { error } = await supabase
    .from("tenant_domains")
    .update({ is_primary: true })
    .eq("tenant_id", tenantId)
    .eq("domain", clean);
  if (error) throw new Error(error.message);

  revalidatePath("/config");
}

export async function verifyTenantDomain(domain: string) {
  await requireConfigAdmin();
  const clean = normalizeDomain(domain);
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("tenant_domains")
    .update({ verified_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("domain", clean);
  if (error) throw new Error(error.message);

  revalidatePath("/config");
}

export async function removeTenantDomain(domain: string) {
  await requireConfigAdmin();
  const clean = normalizeDomain(domain);
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("tenant_domains")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("domain", clean);
  if (error) throw new Error(error.message);

  revalidatePath("/config");
}

export type SocialItem = { label: string; image: string; href: string };

/** Salva os botões de redes sociais (imagem + link) em site_settings.social. */
export async function updateSocialLinks(items: SocialItem[]) {
  await requireConfigAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const clean = items
    .filter((i) => i.label.trim())
    .map((i) => ({
      label: i.label.trim(),
      image: i.image.trim(),
      href: i.href.trim() || "#",
    }));

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { tenant_id: tenantId, key: "social", value: { items: clean } },
      { onConflict: "tenant_id,key" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/config");
}

export async function updateThemeColors(colors: Record<string, string>) {
  await requireConfigAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: theme } = await supabase
    .from("tenant_themes")
    .select("id, tokens")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const tokens = (theme?.tokens ?? {}) as Record<string, unknown>;
  tokens.colors = colors;

  const { error } = theme
    ? await supabase.from("tenant_themes").update({ tokens }).eq("id", theme.id)
    : await supabase.from("tenant_themes").insert({ tenant_id: tenantId, tokens });
  if (error) throw new Error(error.message);

  revalidatePath("/config");
}
