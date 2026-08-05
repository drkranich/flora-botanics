/**
 * Serviço de emissão NF-e 4.00 via SEFAZ
 *
 * Orquestra:
 *   buildNFeXml → signNFe → SOAP NFeAutorizacao4 → parse retorno
 *
 * Retorna o protocolo de autorização (nProt) e a chave de acesso (chNFe)
 * em caso de sucesso, ou o motivo de rejeição.
 */

import type { NFeEmitente, NFeDestinatario, NFeItem, NFePagamento, NFeConfig } from "./nfe-xml";
// buildNFeXml, signNFe e transmissão SEFAZ rodam na Edge Function (Deno/Supabase)
// para não importar node-forge no Cloudflare Worker (erro 1102 - CPU limit)

export type { NFeEmitente, NFeDestinatario, NFeItem, NFePagamento, NFeConfig };

export interface NFeInput {
  emitente: NFeEmitente;
  destinatario: NFeDestinatario;
  itens: NFeItem[];
  pagamentos: NFePagamento[];
  config: NFeConfig;
  /**
   * @deprecated v26 — Edge Function carrega o cert do Storage automaticamente.
   * Mantido apenas para compatibilidade com código legado; ignorado pelo handler.
   */
  pfxBase64?: string;
  /** @deprecated v26 — ignorado pelo handler. */
  pfxSenha?: string;
}

export interface NFeResult {
  ok: boolean;
  chNFe?: string;
  nProt?: string;
  cStat?: string;
  xMotivo?: string;
  xmlAutorizado?: string;
  error?: string;
}

// Parser simples de tags XML para o retorno do SEFAZ
function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m?.[1] ?? "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`));
  return m?.[1] ?? "";
}

// ─── Emissão principal ────────────────────────────────────────────────────────

export async function emitirNFe(input: NFeInput): Promise<NFeResult> {
  try {
    // Envia dados brutos para a Edge Function — buildNFeXml + signNFe + transmissão
    // rodam no Deno (Supabase), não no Cloudflare Worker (evita erro 1102)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const edgeFnUrl = `${supabaseUrl}/functions/v1/sefaz-nfe`;

    // v26: cert carregado do Storage pela Edge Function — não envia pfxBase64/pfxSenha
    const efResponse = await fetch(edgeFnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        nfeInput: {
          emitente:     input.emitente,
          destinatario: input.destinatario,
          itens:        input.itens,
          pagamentos:   input.pagamentos,
          config:       input.config,
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!efResponse.ok) {
      return { ok: false, error: `Falha ao chamar Edge Function sefaz-nfe: HTTP ${efResponse.status}` };
    }

    const efData = await efResponse.json() as { ok: boolean; xmlResponse?: string; xmlSnippet?: string; chNFe?: string; error?: string; status?: number };

    if (!efData.ok || !efData.xmlResponse) {
      return { ok: false, error: efData.error ?? "Erro desconhecido ao chamar SEFAZ via Edge Function." };
    }

    // Parse do retorno
    const xmlRet   = efData.xmlResponse;
    const chNFe    = efData.chNFe ?? extractTag(xmlRet, "chNFe");
    console.log("[sefaz-nfe] xmlResponse snippet:", xmlRet?.slice(0, 800));

    const cStat    = extractTag(xmlRet, "cStat");
    const xMotivo  = extractTag(xmlRet, "xMotivo");
    const nProt    = extractTag(xmlRet, "nProt");
    const chNFeRet = extractTag(xmlRet, "chNFe") || chNFe;

    // cStat 100 = NF-e Autorizada
    if (cStat === "100" && nProt) {
      // nfeXml assinado vem da edge function via efData.nfeXml (quando disponível)
      const nfeXmlSigned = (efData as Record<string, unknown>).nfeXml as string | undefined ?? "";
      const xmlAutorizado =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
        nfeXmlSigned +
        `<protNFe versao="4.00"><infProt>` +
        `<tpAmb>${input.config.ambiente}</tpAmb>` +
        `<verAplic>${extractTag(xmlRet, "verAplic")}</verAplic>` +
        `<chNFe>${chNFeRet}</chNFe>` +
        `<dhRecbto>${extractTag(xmlRet, "dhRecbto")}</dhRecbto>` +
        `<nProt>${nProt}</nProt>` +
        `<digVal>${extractTag(xmlRet, "digVal")}</digVal>` +
        `<cStat>100</cStat>` +
        `<xMotivo>${xMotivo}</xMotivo>` +
        `</infProt></protNFe>` +
        `</nfeProc>`;

      return { ok: true, chNFe: chNFeRet, nProt, cStat, xMotivo, xmlAutorizado };
    }

    // Qualquer outro cStat = rejeição ou processamento assíncrono
    // Se cStat vazio: exibir snippet do XML para diagnóstico
    const errorMsg = cStat
      ? `SEFAZ: [${cStat}] ${xMotivo}`
      : `SEFAZ sem cStat — snippet: ${(efData.xmlSnippet ?? xmlRet).slice(0, 400)}`;
    return { ok: false, chNFe, cStat, xMotivo, error: errorMsg };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido na emissão NF-e.",
    };
  }
}
