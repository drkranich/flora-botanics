"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

/**
 * Cria um rascunho de NF-e a partir de um pedido pago, usando a numeração/série
 * configurada em fiscal_configs. A emissão real (assinatura + envio à SEFAZ)
 * depende do certificado digital e webservice — ainda não implementados
 * (ver Seção 14 do blueprint). Esta ação apenas reserva o número e cria o
 * registro em status "rascunho".
 */
export async function createDraftNfe(orderId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();

  const [{ data: order }, { data: fiscal }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, total_cents")
      .eq("id", orderId)
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
    supabase
      .from("fiscal_configs")
      .select("serie_nfe, proximo_numero_nfe, ambiente")
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
  ]);

  // Pedido inexistente ou dados fiscais ainda não configurados: não há onde
  // exibir um erro a partir de uma form action sem valor de retorno, então
  // a tela de Notas Fiscais já orienta o usuário a configurar tudo antes
  // (ver banner "Configure os dados fiscais" em /notas-fiscais).
  if (!order || !fiscal) {
    return;
  }

  const { error: insertError } = await supabase.from("nfe_documents").insert({
    tenant_id: staff.tenantId,
    order_id: order.id,
    numero: fiscal.proximo_numero_nfe,
    serie: fiscal.serie_nfe,
    ambiente: fiscal.ambiente,
    status: "rascunho",
    valor_total_cents: order.total_cents,
  });

  // system_logs não tem policy de insert para staff (somente leitura/atualização),
  // então erros aqui não são registrados em log — apenas abortamos sem criar
  // a NF-e e sem consumir o número reservado.
  if (insertError) {
    return;
  }

  await supabase
    .from("fiscal_configs")
    .update({ proximo_numero_nfe: fiscal.proximo_numero_nfe + 1 })
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/notas-fiscais");
}

export async function cancelNfeDraft(nfeId: string) {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("nfe_documents")
    .update({ status: "cancelada" })
    .eq("id", nfeId)
    .eq("tenant_id", staff.tenantId)
    .eq("status", "rascunho");

  revalidatePath("/notas-fiscais");
}
