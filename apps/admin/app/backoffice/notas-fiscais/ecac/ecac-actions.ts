"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

const ECAC_EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ecac-consulta`;
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ─── Salva credenciais SERPRO em site_settings ───────────────────────────────

export async function salvarCredenciaisEcacAction(
  formData: FormData,
): Promise<{ ok: boolean; msg: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, msg: "Não autorizado." };

  const consumerKey    = (formData.get("consumer_key")     as string ?? "").trim();
  const consumerSecret = (formData.get("consumer_secret")  as string ?? "").trim();
  const cnpjContrat    = (formData.get("cnpj_contratante") as string ?? "").replace(/\D/g, "");

  if (!consumerKey || !consumerSecret) {
    return { ok: false, msg: "Consumer Key e Consumer Secret são obrigatórios." };
  }

  const supabase = await createClient();
  const value = {
    consumer_key:     consumerKey,
    consumer_secret:  consumerSecret,
    cnpj_contratante: cnpjContrat,
    ativo:            true,
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { tenant_id: staff.tenantId, key: "integration_ecac", value },
      { onConflict: "tenant_id,key" },
    );

  if (error) return { ok: false, msg: `Erro ao salvar: ${error.message}` };

  revalidatePath("/backoffice/notas-fiscais/ecac");
  return { ok: true, msg: "Credenciais salvas com sucesso." };
}

// ─── Testa conexão com SERPRO ────────────────────────────────────────────────

export async function testarConexaoEcacAction(params: {
  consumerKey:    string;
  consumerSecret: string;
}): Promise<{ ok: boolean; error?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Não autorizado." };

  // Busca o CNPJ do emitente
  const supabase = await createClient();
  const { data: sefazSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", staff.tenantId)
    .eq("key", "integration_sefaz")
    .maybeSingle();
  const cnpj = ((sefazSetting?.value as Record<string,string>)?.cnpj ?? "").replace(/\D/g, "") || "00000000000000";

  try {
    const res = await fetch(ECAC_EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
        "apikey": ANON_KEY,
      },
      body: JSON.stringify({
        action:        "auth",
        cnpj,
        tenantId:      staff.tenantId,
        consumerKey:   params.consumerKey,
        consumerSecret: params.consumerSecret,
      }),
    });
    const json = await res.json() as { ok: boolean; error?: string };
    return { ok: json.ok, error: json.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Consulta um serviço do e-CAC ────────────────────────────────────────────

export async function consultarEcacAction(params: {
  action:          string;
  cnpj:            string;
  cnpjContratante?: string;
  consumerKey?:    string;
  consumerSecret?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string; code?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Não autorizado." };

  // Se não vieram credenciais no params, tenta buscar as salvas
  let consumerKey    = params.consumerKey    ?? "";
  let consumerSecret = params.consumerSecret ?? "";

  if (!consumerKey || !consumerSecret) {
    const supabase = await createClient();
    const { data: setting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("tenant_id", staff.tenantId)
      .eq("key", "integration_ecac")
      .maybeSingle();
    const cfg = (setting?.value ?? {}) as Record<string, string>;
    consumerKey    = cfg.consumer_key    ?? "";
    consumerSecret = cfg.consumer_secret ?? "";
  }

  if (!consumerKey || !consumerSecret) {
    return {
      ok: false,
      error: "Credenciais SERPRO não configuradas.",
      code:  "NO_CREDENTIALS",
    };
  }

  try {
    const res = await fetch(ECAC_EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
        "apikey": ANON_KEY,
      },
      body: JSON.stringify({
        action:          params.action,
        cnpj:            params.cnpj.replace(/\D/g, ""),
        cnpjContratante: (params.cnpjContratante ?? params.cnpj).replace(/\D/g, ""),
        tenantId:        staff.tenantId,
        consumerKey,
        consumerSecret,
      }),
    });

    const json = await res.json() as { ok: boolean; data?: unknown; error?: string; code?: string };
    return json;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
