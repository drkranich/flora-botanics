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

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
    enviNFe +
    `</nfeDadosMsg>` +
    `</soap:Body>` +
    `</soap:Envelope>`
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
    const url = getSefazEndpoint(input.emitente.enderEmit.UF, input.config.ambiente);

    // 5. POST SOAP
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
      },
      body: soapBody,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return {
        ok: false,
        chNFe,
        error: `SEFAZ retornou HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // 6. Parse do retorno
    const xmlRet = await response.text();

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
    return {
      ok: false,
      chNFe,
      cStat,
      xMotivo,
      error: `SEFAZ: [${cStat}] ${xMotivo}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido na emissão NF-e.",
    };
  }
}
