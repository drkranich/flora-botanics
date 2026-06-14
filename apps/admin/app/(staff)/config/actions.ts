"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

type ActionResult = { error?: string; success?: boolean };

export async function upsertFiscalConfig(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { error: "Não autorizado." };

  const cnpj = String(formData.get("cnpj") ?? "").trim();
  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  const inscricaoEstadual = String(formData.get("inscricao_estadual") ?? "").trim();
  const inscricaoMunicipal = String(formData.get("inscricao_municipal") ?? "").trim();
  const regimeTributario = String(formData.get("regime_tributario") ?? "simples");
  const ambiente = String(formData.get("ambiente") ?? "homologacao");
  const serieNfe = Number(formData.get("serie_nfe") ?? 1);
  const proximoNumeroNfe = Number(formData.get("proximo_numero_nfe") ?? 1);

  const endereco = {
    cep: String(formData.get("endereco_cep") ?? "").trim(),
    logradouro: String(formData.get("endereco_logradouro") ?? "").trim(),
    numero: String(formData.get("endereco_numero") ?? "").trim(),
    complemento: String(formData.get("endereco_complemento") ?? "").trim(),
    bairro: String(formData.get("endereco_bairro") ?? "").trim(),
    cidade: String(formData.get("endereco_cidade") ?? "").trim(),
    uf: String(formData.get("endereco_uf") ?? "").trim(),
  };

  if (!cnpj || !razaoSocial) {
    return { error: "CNPJ e razão social são obrigatórios." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_configs").upsert(
    {
      tenant_id: staff.tenantId,
      cnpj,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia || null,
      inscricao_estadual: inscricaoEstadual || null,
      inscricao_municipal: inscricaoMunicipal || null,
      regime_tributario: regimeTributario,
      endereco,
      ambiente,
      serie_nfe: Number.isFinite(serieNfe) && serieNfe > 0 ? serieNfe : 1,
      proximo_numero_nfe: Number.isFinite(proximoNumeroNfe) && proximoNumeroNfe > 0 ? proximoNumeroNfe : 1,
    },
    { onConflict: "tenant_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/config");
  return { success: true };
}

export async function updateChannelDisplayName(channelAccountId: string, formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return;

  const displayName = String(formData.get("display_name") ?? "").trim();

  const supabase = await createClient();
  await supabase
    .from("channel_accounts")
    .update({ display_name: displayName || null })
    .eq("id", channelAccountId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/config");
}
