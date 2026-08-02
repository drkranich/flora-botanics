"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import type { PdfConfig, PdfCategory } from "./template";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Carrega configuração PDF salva em site_settings.
 * Pode ser chamada tanto em Server Components quanto em Client Components
 * (via Server Actions) para garantir que todos os PDFs usem os dados da empresa.
 */
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

  // ── Estilos por categoria ──────────────────────────────────────────────────
  // O FormData contém campos como "cat_orcamento_bgColor", etc.
  // Reconstruímos o mapa categoryStyles a partir desses campos.
  const CATEGORIES: PdfCategory[] = [
    "orcamento", "cotacao", "proposta_comercial", "pedido",
    "nota_fiscal", "recibo", "boleto", "contrato",
    "relatorio_financeiro", "relatorio_estoque", "relatorio_vendas",
    "relatorio_crm", "relatorio_auditoria", "relatorio_remessa",
    "relatorio_pdv", "contabil", "fiscal", "exportacao",
    "etiqueta", "assinatura", "interno",
  ];

  const CAT_STYLE_KEYS = [
    "bgColor", "accentColor", "headerBorderColor",
    "textColor", "fontFamily", "watermarkOpacity", "watermarkSize",
  ] as const;

  type CatStyleKey = typeof CAT_STYLE_KEYS[number];

  const categoryStyles: PdfConfig["categoryStyles"] = {};
  for (const cat of CATEGORIES) {
    const entry: Record<string, string | number> = {};
    for (const key of CAT_STYLE_KEYS) {
      const raw = formData.get(`cat_${cat}_${key}`);
      if (raw !== null && raw !== "") {
        if (key === "watermarkOpacity" || key === "watermarkSize") {
          const n = Number(raw);
          if (!isNaN(n)) entry[key] = n;
        } else {
          entry[key] = String(raw).trim();
        }
      }
    }
    if (Object.keys(entry).length > 0) {
      categoryStyles[cat] = entry as PdfConfig["categoryStyles"][typeof cat];
    }
  }

  const config: PdfConfig = {
    // ── Dados da empresa ──
    companyName:  str(formData, "companyName"),
    address:      str(formData, "address"),
    cnpj:         str(formData, "cnpj"),
    phone:        str(formData, "phone"),
    email:        str(formData, "email"),
    website:      str(formData, "website"),
    defaultNotes: str(formData, "defaultNotes"),
    // ── Assinante / responsável global ──
    signerName:   str(formData, "signerName"),
    signerRole:   str(formData, "signerRole"),
    department:   str(formData, "department"),
    // ── Estilos globais ──
    bgColor:            str(formData, "bgColor"),
    accentColor:        str(formData, "accentColor"),
    headerBorderColor:  str(formData, "headerBorderColor"),
    textColor:          str(formData, "textColor"),
    fontFamily:         str(formData, "fontFamily"),
    watermarkOpacity:   num(formData, "watermarkOpacity"),
    watermarkSize:      num(formData, "watermarkSize"),
    // ── Estilos por categoria ──
    categoryStyles: Object.keys(categoryStyles).length > 0 ? categoryStyles : undefined,
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
