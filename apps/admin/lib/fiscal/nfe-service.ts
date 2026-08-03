/**
 * Serviço de emissão NF-e 4.00 via SEFAZ
 *
 * Orquestra:
 *   buildNFeXml → signNFe → SOAP NFeAutorizacao4 → parse retorno
 *
 * Retorna o protocolo de autorização (nProt) e a chave de acesso (chNFe)
 * em caso de sucesso, ou o motivo de rejeição.
 */

import { buildNFeXml, type NFeEmitente, type NFeDestinatario, type NFeItem, type NFePagamento, type NFeConfig } from "./nfe-xml";
import { signNFe } from "./nfe-signer";
import { getSefazEndpoint } from "./nfe-endpoints";

export type { NFeEmitente, NFeDestinatario, NFeItem, NFePagamento, NFeConfig };

export interface NFeInput {
  emitente: NFeEmitente;
  destinatario: NFeDestinatario;
  itens: NFeItem[];
  pagamentos: NFePagamento[];
  config: NFeConfig;
  /** Base64 do arquivo .pfx */
  pfxBase64: string;
  /** Senha do certificado A1 */
  pfxSenha: string;
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

// ─── SOAP helpers ─────────────────────────────────────────────────────────────

function buildSoapEnvelope(nfeXml: string, lote: string): string {
  const enviNFe =
    `<enviNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>${lote}</idLote>` +
    `<indSinc>1</indSinc>` +
    nfeXml +
    `</enviNFe>`;

  // SOAP 1.1 — compatível com endpoints JAX-WS (MG, GO, PE...) e .asmx (SP, RS, SVAN)
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soapenv:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
    enviNFe +
    `</nfeDadosMsg>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
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
    // 1. Constrói o XML NF-e (forma canônica pronta para assinar)
    const { canonicalInfNFe, chNFe } = buildNFeXml({
      emitente: input.emitente,
      destinatario: input.destinatario,
      itens: input.itens,
      pagamentos: input.pagamentos,
      config: input.config,
    });

    // 2. Assina com o certificado A1
    const nfeXml = await signNFe(
      canonicalInfNFe,
      chNFe,
      input.pfxBase64,
      input.pfxSenha
    );

    // 3. Monta envelope SOAP
    const lote = String(Date.now()).slice(-15).padStart(15, "0");
    const soapBody = buildSoapEnvelope(nfeXml, lote);

    // 4. URL do SEFAZ conforme UF + ambiente
    const sefazUrl = getSefazEndpoint(input.emitente.enderEmit.UF, input.config.ambiente);
    const soapAction = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote";

    // 5. POST SOAP via Supabase Edge Function (evita HTTP 525 do CF Workers com SEFAZ)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const edgeFnUrl = `${supabaseUrl}/functions/v1/sefaz-nfe`;

    const efResponse = await fetch(edgeFnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({ url: sefazUrl, soapBody, soapAction, pfxBase64: input.pfxBase64, pfxSenha: input.pfxSenha }),
      signal: AbortSignal.timeout(45000),
    });

    if (!efResponse.ok) {
      return { ok: false, chNFe, error: `Falha ao chamar Edge Function sefaz-nfe: HTTP ${efResponse.status}` };
    }

    const efData = await efResponse.json() as { ok: boolean; xmlResponse?: string; xmlSnippet?: string; error?: string; status?: number };

    if (!efData.ok || !efData.xmlResponse) {
      const statusMsg =
        efData.status === 525
          ? "Falha SSL no servidor SEFAZ (HTTP 525). Causa provável: endpoint da sua UF exige mTLS ou tem certificado SSL inválido no momento."
          : (efData.error ?? "Erro desconhecido ao chamar SEFAZ via Edge Function.");
      return { ok: false, chNFe, error: statusMsg };
    }

    // 6. Parse do retorno
    const xmlRet = efData.xmlResponse;
    // DEBUG — log primeiros 800 chars para diagnosticar estrutura do XML do SEFAZ
    console.log("[sefaz-nfe] xmlResponse snippet:", xmlRet?.slice(0, 800));

    // Tenta extrair retEnviNFe / protNFe
    const cStat   = extractTag(xmlRet, "cStat");
    const xMotivo = extractTag(xmlRet, "xMotivo");
    const nProt   = extractTag(xmlRet, "nProt");
    const chNFeRet = extractTag(xmlRet, "chNFe") || chNFe;

    // cStat 100 = NF-e Autorizada
    if (cStat === "100" && nProt) {
      // Monta XML autorizado (nfeProc)
      const xmlAutorizado =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
        nfeXml +
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
    return {
      ok: false,
      chNFe,
      cStat,
      xMotivo,
      error: errorMsg,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido na emissão NF-e.",
    };
  }
}
