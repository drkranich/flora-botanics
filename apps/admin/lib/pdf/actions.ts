"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import type { PdfConfig } from "./template";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Carrega configuração PDF salva em site_settings */
export async function getPdfConfig(): Promise<PdfConfig> {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "pdf_config")
    .maybeSingle();

  return (data?.value as PdfConfig) ?? {};
}

/** Salva configuração PDF em site_settings (upsert) */
export async function savePdfConfig(
  formData: FormData
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") {
    return { ok: false, error: "Sem permissão." };
  }

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const config: PdfConfig = {
    companyName: str(formData, "companyName"),
    address: str(formData, "address"),
    cnpj: str(formData, "cnpj"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    website: str(formData, "website"),
    defaultNotes: str(formData, "defaultNotes"),
    // Estilos visuais
    bgColor: str(formData, "bgColor"),
    accentColor: str(formData, "accentColor"),
    headerBorderColor: str(formData, "headerBorderColor"),
    fontFamily: str(formData, "fontFamily"),
    watermarkOpacity: num(formData, "watermarkOpacity"),
    watermarkSize: num(formData, "watermarkSize"),
  };

  const { error } = await supabase.from("site_settings").upsert(
    {
      tenant_id: tenantId,
      key: "pdf_config",
      value: config,
    },
    { onConflict: "tenant_id,key" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/config");
  return { ok: true, data: undefined };
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function num(fd: FormData, key: string): number | undefined {
  const v = Number(fd.get(key));
  return isNaN(v) ? undefined : v;
}
