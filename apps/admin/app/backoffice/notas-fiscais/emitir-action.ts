"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import {
  emitirNFe,
  type NFeEmitente,
  type NFeDestinatario,
  type NFeItem,
  type NFePagamento,
  type NFeConfig,
} from "@/lib/fiscal/nfe-service";

// form actions devem retornar void — erros ficam em nfe_documents.ultimo_erro

function revalidateFiscal() {
  revalidatePath("/backoffice/notas-fiscais");
  revalidatePath("/backoffice/notas-fiscais/emissao");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, "0"); }
function dhEmiNow() {
  const now = new Date();
  return (
    `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}` +
    `T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}-03:00`
  );
}

async function loadSefaz(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string) {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "integration_sefaz")
    .maybeSingle();
  return (data?.value ?? {}) as Record<string, string>;
}

function buildEmitente(sefaz: Record<string, string>): NFeEmitente {
  return {
    CNPJ: sefaz.cnpj ?? "",
    xNome: sefaz.razao_social ?? "",
    xFant: sefaz.nome_fantasia || undefined,
    IE: sefaz.inscricao_estadual ?? "",
    CRT: (sefaz.crt ?? "1") as "1" | "2" | "3",
    enderEmit: {
      xLgr:    sefaz.logradouro ?? "Logradouro",
      nro:     sefaz.numero_endereco ?? "S/N",
      xCompl:  sefaz.complemento || undefined,
      xBairro: sefaz.bairro ?? "Centro",
      cMun:    sefaz.codigo_ibge_municipio ?? "",
      xMun:    sefaz.municipio ?? sefaz.uf ?? "",
      UF:      sefaz.uf ?? "",
      CEP:     sefaz.cep ?? "00000000",
    },
  };
}

// ─── Emitir NF-e de rascunho (pedido real) ────────────────────────────────────

/**
 * Emite uma NF-e a partir de um rascunho já criado (status "rascunho").
 * Erros de validação e rejeições SEFAZ ficam gravados em nfe_documents.ultimo_erro.
 */
export async function emitirNFeAction(nfeDocumentId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) return;

  const supabase = await createClient();

  async function rejectWith(erro: string) {
    await supabase
      .from("nfe_documents")
      .update({ status: "rejeitada", ultimo_erro: erro })
      .eq("id", nfeDocumentId)
      .eq("tenant_id", staff!.tenantId);
    revalidateFiscal();
  }

  // 1. Rascunho
  const { data: nfeDoc } = await supabase
    .from("nfe_documents")
    .select("id, numero, serie, status, order_id")
    .eq("id", nfeDocumentId)
    .eq("tenant_id", staff.tenantId)
    .eq("status", "rascunho")
    .maybeSingle();

  if (!nfeDoc || !nfeDoc.order_id) {
    await rejectWith("Rascunho não encontrado ou sem pedido vinculado.");
    return;
  }

  // 2. Pedido + itens
  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, number, total_cents,
      customer_name, customer_document, customer_email,
      shipping_street, shipping_number, shipping_complement, shipping_neighborhood,
      shipping_city, shipping_city_ibge, shipping_state, shipping_zip,
      payment_method,
      order_items(
        id, quantity, unit_price_cents, total_price_cents,
        product_name, product_sku,
        products(sku, name, ncm, cfop_out, cfop_interstate, barcode, unit)
      )
    `)
    .eq("id", nfeDoc.order_id)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) { await rejectWith("Pedido não encontrado."); return; }

  // 3. Credenciais SEFAZ
  const sefaz = await loadSefaz(supabase, staff.tenantId);
  const { certificate_pfx_base64: pfxBase64, certificate_password: pfxSenha } = sefaz;
  const ambiente = (sefaz.environment === "producao" ? "1" : "2") as "1" | "2";

  if (!pfxBase64 || !pfxSenha) {
    await rejectWith("Certificado A1 não configurado em Integrações → SEFAZ.");
    return;
  }
  if (!sefaz.cnpj || !sefaz.uf || !sefaz.razao_social || !sefaz.inscricao_estadual) {
    await rejectWith("Dados do emitente incompletos em Integrações → SEFAZ.");
    return;
  }
  if (!sefaz.codigo_ibge_municipio) {
    await rejectWith("Código IBGE do município não configurado em Integrações → SEFAZ.");
    return;
  }

  const emitente = buildEmitente(sefaz);
  const uf = sefaz.uf;
  const cMunFG = sefaz.codigo_ibge_municipio;

  // 4. Destinatário
  const custDoc = ((order.customer_document as string) ?? "").replace(/\D/g, "");
  const destUF  = (order.shipping_state as string) ?? uf;
  const destinatario: NFeDestinatario = {
    ...(custDoc.length === 14 ? { CNPJ: custDoc } : { CPF: custDoc }),
    xNome:     (order.customer_name as string) ?? "Consumidor Final",
    email:     (order.customer_email as string) || undefined,
    indIEDest: "9",
    enderDest: {
      xLgr:    (order.shipping_street as string)       ?? "Endereço",
      nro:     (order.shipping_number as string)       ?? "S/N",
      xCompl:  (order.shipping_complement as string)   || undefined,
      xBairro: (order.shipping_neighborhood as string) ?? "Centro",
      cMun:    (order.shipping_city_ibge as string)    ?? "0000000",
      xMun:    (order.shipping_city as string)         ?? destUF,
      UF:      destUF,
      CEP:     (order.shipping_zip as string)          ?? "00000000",
    },
  };

  // 5. Itens
  const orderItems = (order.order_items ?? []) as Array<{
    quantity: number;
    unit_price_cents: number;
    total_price_cents: number;
    product_name: string;
    product_sku: string;
    products?: { sku?: string; name?: string; ncm?: string; cfop_out?: string; cfop_interstate?: string; barcode?: string; unit?: string };
  }>;

  if (!orderItems.length) { await rejectWith("Pedido sem itens."); return; }

  const sameState = destUF.toUpperCase() === uf.toUpperCase();
  const itens: NFeItem[] = orderItems.map((it, idx) => {
    const p    = it.products;
    const qty  = it.quantity ?? 1;
    const vU   = (it.unit_price_cents ?? 0) / 100;
    const vP   = (it.total_price_cents ?? 0) / 100 || vU * qty;
    return {
      nItem:  idx + 1,
      cProd:  p?.sku ?? it.product_sku ?? String(idx + 1),
      cEAN:   p?.barcode || undefined,
      xProd:  p?.name ?? it.product_name ?? "Produto",
      NCM:    (p?.ncm ?? "84719013").replace(/\D/g, "").padStart(8, "0"),
      CFOP:   sameState ? (p?.cfop_out ?? "5102") : (p?.cfop_interstate ?? "6102"),
      uCom:   p?.unit ?? "UN",
      qCom:   qty,
      vUnCom: vU,
      vProd:  parseFloat(vP.toFixed(2)),
    };
  });

  // 6. Pagamento
  const pmMap: Record<string, string> = { credit_card: "03", debit_card: "04", pix: "17", boleto: "15", cash: "01" };
  const pagamentos: NFePagamento[] = [{ tPag: pmMap[(order.payment_method as string) ?? ""] ?? "99", vPag: (order.total_cents as number) / 100 }];

  // 7. Config
  const config: NFeConfig = {
    nNF:    nfeDoc.numero as number,
    serie:  (nfeDoc.serie as number) ?? 1,
    dhEmi:  dhEmiNow(),
    ambiente,
    natOp:  "Venda de mercadoria",
    idDest: sameState ? "1" : "2",
    cMunFG,
    infCpl: ambiente === "2" ? undefined : `Pedido #${order.number}`,
  };

  // 8. Emite
  const result = await emitirNFe({ emitente, destinatario, itens, pagamentos, config, pfxBase64, pfxSenha });

  if (result.ok && result.nProt) {
    await supabase.from("nfe_documents").update({
      status: "autorizada", chave_acesso: result.chNFe, protocolo: result.nProt,
      xml_autorizado: result.xmlAutorizado, emitido_em: new Date().toISOString(),
    }).eq("id", nfeDocumentId).eq("tenant_id", staff.tenantId);

    await supabase.from("fiscal_documents").upsert({
      tenant_id: staff.tenantId, order_id: nfeDoc.order_id,
      document_type: "nfe_sale", direction: "out",
      number: String(nfeDoc.numero), series: String((nfeDoc.serie as number) ?? 1),
      status: "authorized", environment: ambiente === "1" ? "production" : "sandbox",
      access_key: result.chNFe, protocol: result.nProt,
      total_cents: order.total_cents as number, payment_status: "open",
      verification_status: "verified", origin: "order",
      metadata: { source: "nfe_emission", order_number: order.number },
      created_by: staff.id,
    }, { onConflict: "tenant_id,access_key" });
  } else {
    await supabase.from("nfe_documents")
      .update({ status: "rejeitada", ultimo_erro: result.error })
      .eq("id", nfeDocumentId).eq("tenant_id", staff.tenantId);
  }

  revalidateFiscal();
}

// ─── NF-e de teste (homologação) ──────────────────────────────────────────────

/**
 * Emite uma NF-e de R$ 1,00 no ambiente de homologação do SEFAZ.
 * Não requer pedido. Usa o emitente configurado em Integrações → SEFAZ.
 * Resultado aparece em "Notas vinculadas a pedidos" com status Autorizada ou Rejeitada.
 */
export async function emitirNFeTesteAction(): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) return;

  const supabase = await createClient();

  const sefaz = await loadSefaz(supabase, staff.tenantId);
  const pfxBase64 = sefaz.certificate_pfx_base64 ?? "";
  const pfxSenha  = sefaz.certificate_password ?? "";
  const cMunFG    = sefaz.codigo_ibge_municipio ?? "";

  if (!pfxBase64 || !pfxSenha || !sefaz.cnpj || !sefaz.uf || !sefaz.razao_social || !sefaz.inscricao_estadual || !cMunFG) {
    // Grava um rascunho rejeitado para o erro aparecer na tela
    await supabase.from("nfe_documents").insert({
      tenant_id: staff.tenantId, order_id: null, numero: 0, serie: 1,
      ambiente: "homologacao", status: "rejeitada", valor_total_cents: 100,
      ultimo_erro: "Credenciais SEFAZ incompletas — verifique Integrações → SEFAZ (CNPJ, UF, Razão Social, IE, Código IBGE, Certificado A1).",
    });
    revalidateFiscal();
    return;
  }

  const { data: fiscal } = await supabase
    .from("fiscal_configs")
    .select("serie_nfe, proximo_numero_nfe")
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  const nNF  = (fiscal?.proximo_numero_nfe as number) ?? 1;
  const serie = (fiscal?.serie_nfe as number) ?? 1;
  const emitente = buildEmitente(sefaz);

  const destinatario: NFeDestinatario = {
    CNPJ: sefaz.cnpj,
    xNome: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
    indIEDest: "9",
    enderDest: { ...emitente.enderEmit },
  };

  const itens: NFeItem[] = [{
    nItem: 1, cProd: "TESTE001",
    xProd: "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
    NCM: "84719013", CFOP: "5102", uCom: "UN",
    qCom: 1, vUnCom: 1.00, vProd: 1.00,
  }];

  const pagamentos: NFePagamento[] = [{ tPag: "99", vPag: 1.00 }];

  const config: NFeConfig = {
    nNF, serie, dhEmi: dhEmiNow(),
    ambiente: "2",   // SEMPRE homologação
    natOp: "Venda de mercadoria", idDest: "1", cMunFG,
  };

  const result = await emitirNFe({ emitente, destinatario, itens, pagamentos, config, pfxBase64, pfxSenha });
  const now = new Date();

  if (result.ok && result.nProt) {
    if (fiscal) {
      await supabase.from("fiscal_configs")
        .update({ proximo_numero_nfe: nNF + 1 })
        .eq("tenant_id", staff.tenantId);
    }
    await supabase.from("nfe_documents").insert({
      tenant_id: staff.tenantId, order_id: null, numero: nNF, serie,
      ambiente: "homologacao", status: "autorizada",
      chave_acesso: result.chNFe, protocolo: result.nProt,
      xml_autorizado: result.xmlAutorizado, valor_total_cents: 100,
      emitido_em: now.toISOString(),
    });
  } else {
    await supabase.from("nfe_documents").insert({
      tenant_id: staff.tenantId, order_id: null, numero: nNF, serie,
      ambiente: "homologacao", status: "rejeitada", valor_total_cents: 100,
      ultimo_erro: result.error ?? "Rejeitada pelo SEFAZ.",
    });
  }

  revalidateFiscal();
}
