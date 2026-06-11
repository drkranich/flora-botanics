"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

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
