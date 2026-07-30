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

type Result =
  | { ok: true; chNFe: string; nProt: string; xMotivo?: string }
  | { ok: false; error: string };

/**
 * Emite uma NF-e a partir de um rascunho já criado (status "rascunho").
 *
 * Pré-requisitos:
 *   1. Credenciais SEFAZ salvas em site_settings (integration_sefaz)
 *      com os campos: cnpj, uf, crt, razao_social, inscricao_estadual,
 *      cep, logradouro, numero_endereco, bairro, municipio,
 *      codigo_ibge_municipio, certificate_pfx_base64, certificate_password
 *   2. fiscal_configs com serie_nfe, proximo_numero_nfe, ambiente
 *   3. Cada produto com campo ncm preenchido
 */
export async function emitirNFeAction(nfeDocumentId: string): Promise<Result> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role)) {
    return { ok: false, error: "Sem permissão para emitir NF-e." };
  }

  const supabase = await createClient();

  // ── 1. Carrega o rascunho de NF-e ──────────────────────────────────────────
  const { data: nfeDoc } = await supabase
    .from("nfe_documents")
    .select("id, numero, serie, ambiente, status, order_id")
    .eq("id", nfeDocumentId)
    .eq("tenant_id", staff.tenantId)
    .eq("status", "rascunho")
    .maybeSingle();

  if (!nfeDoc) return { ok: false, error: "Rascunho NF-e não encontrado ou já emitido." };
  if (!nfeDoc.order_id) return { ok: false, error: "Rascunho sem pedido vinculado." };

  // ── 2. Carrega pedido + itens + cliente ────────────────────────────────────
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
        products(id, sku, name, ncm, cfop_out, cfop_interstate, barcode, unit)
      )
    `)
    .eq("id", nfeDoc.order_id)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  // ── 3. Carrega credenciais SEFAZ de site_settings ─────────────────────────
  const { data: sefazSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", staff.tenantId)
    .eq("key", "integration_sefaz")
    .maybeSingle();

  const sefaz = (sefazSetting?.value ?? {}) as Record<string, string>;

  const pfxBase64 = sefaz.certificate_pfx_base64 ?? "";
  const pfxSenha  = sefaz.certificate_password ?? "";
  const cnpj      = sefaz.cnpj ?? "";
  const uf        = sefaz.uf ?? "";
  const crt       = (sefaz.crt ?? "1") as "1" | "2" | "3";
  const razaoSocial = sefaz.razao_social ?? "";
  const IE        = sefaz.inscricao_estadual ?? "";
  const cMunFG    = sefaz.codigo_ibge_municipio ?? sefaz.cMunFG ?? "";
  const ambiente  = (sefaz.environment === "producao" ? "1" : "2") as "1" | "2";

  if (!pfxBase64 || !pfxSenha)
    return { ok: false, error: "Certificado A1 não configurado em Integrações → SEFAZ." };
  if (!cnpj || !uf || !razaoSocial || !IE)
    return { ok: false, error: "Dados do emitente incompletos em Integrações → SEFAZ (CNPJ, UF, Razão Social, IE)." };
  if (!cMunFG)
    return { ok: false, error: "Código IBGE do município não configurado em Integrações → SEFAZ." };

  // ── 4. Monta emitente ──────────────────────────────────────────────────────
  const emitente: NFeEmitente = {
    CNPJ: cnpj,
    xNome: razaoSocial,
    xFant: sefaz.nome_fantasia ?? undefined,
    IE,
    CRT: crt,
    enderEmit: {
      xLgr:    sefaz.logradouro ?? "Logradouro não informado",
      nro:     sefaz.numero_endereco ?? "S/N",
      xCompl:  sefaz.complemento ?? undefined,
      xBairro: sefaz.bairro ?? "Centro",
      cMun:    cMunFG,
      xMun:    sefaz.municipio ?? uf,
      UF:      uf,
      CEP:     sefaz.cep ?? "00000000",
    },
  };

  // ── 5. Monta destinatário ──────────────────────────────────────────────────
  const custDoc  = ((order.customer_document as string) ?? "").replace(/\D/g, "");
  const isCnpj   = custDoc.length === 14;
  const destUF   = (order.shipping_state as string) ?? uf;

  const destinatario: NFeDestinatario = {
    ...(isCnpj ? { CNPJ: custDoc } : { CPF: custDoc }),
    xNome:      (order.customer_name as string) ?? "Consumidor Final",
    email:      (order.customer_email as string) ?? undefined,
    indIEDest:  "9", // consumidor final, não contribuinte
    enderDest: {
      xLgr:    (order.shipping_street as string)        ?? "Endereço não informado",
      nro:     (order.shipping_number as string)        ?? "S/N",
      xCompl:  (order.shipping_complement as string)    ?? undefined,
      xBairro: (order.shipping_neighborhood as string)  ?? "Centro",
      cMun:    (order.shipping_city_ibge as string)     ?? "0000000",
      xMun:    (order.shipping_city as string)          ?? destUF,
      UF:      destUF,
      CEP:     (order.shipping_zip as string)           ?? "00000000",
    },
  };

  // ── 6. Monta itens ────────────────────────────────────────────────────────
  const orderItems = (order.order_items as Array<{
    quantity: number;
    unit_price_cents: number;
    total_price_cents: number;
    product_name: string;
    product_sku: string;
    products?: {
      sku?: string;
      name?: string;
      ncm?: string;
      cfop_out?: string;
      cfop_interstate?: string;
      barcode?: string;
      unit?: string;
    };
  }>) ?? [];

  if (orderItems.length === 0) return { ok: false, error: "Pedido sem itens." };

  // CFOP: 5102 (dentro do estado) ou 6102 (interestadual)
  const sameState = destUF.toUpperCase() === uf.toUpperCase();

  const itens: NFeItem[] = orderItems.map((it, idx) => {
    const prod   = it.products;
    const ncm    = prod?.ncm ?? "84719013"; // fallback: computador (editar por produto)
    const cfopOut = sameState
      ? (prod?.cfop_out ?? "5102")
      : (prod?.cfop_interstate ?? "6102");
    const ean    = prod?.barcode ?? undefined;
    const unit   = prod?.unit ?? "UN";
    const qty    = it.quantity ?? 1;
    const vUnit  = (it.unit_price_cents ?? 0) / 100;
    const vProd  = (it.total_price_cents ?? 0) / 100 || vUnit * qty;

    return {
      nItem: idx + 1,
      cProd: prod?.sku ?? it.product_sku ?? String(idx + 1),
      cEAN:  ean,
      xProd: prod?.name ?? it.product_name ?? "Produto",
      NCM:   ncm.replace(/\D/g, "").padStart(8, "0"),
      CFOP:  cfopOut,
      uCom:  unit,
      qCom:  qty,
      vUnCom: vUnit,
      vProd:  parseFloat(vProd.toFixed(2)),
    };
  });

  // ── 7. Monta pagamentos ────────────────────────────────────────────────────
  // tPag: 01=Dinheiro, 03=Cartão Crédito, 04=Débito, 15=Boleto, 17=PIX, 99=Outros
  const pmMap: Record<string, string> = {
    credit_card: "03",
    debit_card:  "04",
    pix:         "17",
    boleto:      "15",
    cash:        "01",
  };
  const pmMethod = (order.payment_method as string) ?? "";
  const tPag = pmMap[pmMethod] ?? "99";
  const vTotal = (order.total_cents as number) / 100;

  const pagamentos: NFePagamento[] = [{ tPag, vPag: vTotal }];

  // ── 8. Monta config ────────────────────────────────────────────────────────
  const now    = new Date();
  // Offset BR -03:00
  const offset = "-03:00";
  const pad    = (n: number) => String(n).padStart(2, "0");
  const dhEmi  =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${offset}`;

  const config: NFeConfig = {
    nNF:     nfeDoc.numero as number,
    serie:   nfeDoc.serie as number ?? 1,
    dhEmi,
    ambiente,
    natOp:   "Venda de mercadoria",
    idDest:  sameState ? "1" : "2",
    cMunFG,
    infCpl:  ambiente === "2" ? undefined : `Pedido #${order.number}`,
  };

  // ── 9. Emite ───────────────────────────────────────────────────────────────
  const result = await emitirNFe({
    emitente,
    destinatario,
    itens,
    pagamentos,
    config,
    pfxBase64,
    pfxSenha,
  });

  // ── 10. Atualiza nfe_documents ─────────────────────────────────────────────
  if (result.ok && result.nProt) {
    await supabase
      .from("nfe_documents")
      .update({
        status:         "autorizada",
        chave_acesso:   result.chNFe,
        protocolo:      result.nProt,
        xml_autorizado: result.xmlAutorizado,
        emitido_em:     now.toISOString(),
      })
      .eq("id", nfeDocumentId)
      .eq("tenant_id", staff.tenantId);

    await supabase.from("fiscal_documents").upsert(
      {
        tenant_id:           staff.tenantId,
        order_id:            nfeDoc.order_id,
        document_type:       "nfe_sale",
        direction:           "out",
        number:              String(nfeDoc.numero),
        series:              String(nfeDoc.serie ?? 1),
        status:              "authorized",
        environment:         ambiente === "1" ? "production" : "sandbox",
        access_key:          result.chNFe,
        protocol:            result.nProt,
        total_cents:         order.total_cents as number,
        payment_status:      "open",
        verification_status: "verified",
        origin:              "order",
        metadata: { source: "nfe_emission", order_number: order.number },
        created_by:          staff.id,
      },
      { onConflict: "tenant_id,access_key" }
    );

    revalidatePath("/backoffice/notas-fiscais");
    revalidatePath("/backoffice/notas-fiscais/emissao");
    return { ok: true, chNFe: result.chNFe!, nProt: result.nProt!, xMotivo: result.xMotivo };
  }

  // Rejeição: atualiza status
  await supabase
    .from("nfe_documents")
    .update({ status: "rejeitada", ultimo_erro: result.error })
    .eq("id", nfeDocumentId)
    .eq("tenant_id", staff.tenantId);

  return { ok: false, error: result.error ?? "Emissão rejeitada pelo SEFAZ." };
}
