"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

/** Salva o logo da marca (imagem) em site_settings.logo. */
export async function updateLogo(image: string) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { tenant_id: tenantId, key: "logo", value: { image: image.trim() } },
      { onConflict: "tenant_id,key" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/config");
}

export type SocialItem = { label: string; image: string; href: string };

/** Salva os botões de redes sociais (imagem + link) em site_settings.social. */
export async function updateSocialLinks(items: SocialItem[]) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
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
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
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
