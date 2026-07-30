/**
 * Construtor de XML NF-e 4.00 para e-commerce Simples Nacional.
 *
 * Perfil implementado:
 *   - Modelo 55 (NF-e), série/número configuráveis
 *   - CRT 1 — Simples Nacional (CSOSN 102 — sem crédito ICMS)
 *   - PIS / COFINS — CST 07 (operação isenta de contribuição)
 *   - IPI — não incidente
 *   - CFOP 5102 (dentro do estado) / 6102 (interestadual)
 *
 * O XML produzido já está na forma canônica (C14N 1.0) exigida pelo XMLDSig:
 *   - Atributos em ordem lexicográfica por elemento
 *   - Sem whitespace entre tags
 *   - Elementos vazios escritos como <tag></tag>
 */

import { generateAccessKey } from "./nfe-access-key";
import { getUfCode } from "./nfe-endpoints";

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface NFeEndereco {
  xLgr: string;
  nro: string;
  xCompl?: string;
  xBairro: string;
  cMun: string;  // código IBGE 7 dígitos
  xMun: string;
  UF: string;
  CEP: string;
  cPais?: string; // default "1058" (Brasil)
  xPais?: string; // default "Brasil"
  fone?: string;
}

export interface NFeEmitente {
  CNPJ: string;
  xNome: string;
  xFant?: string;
  IE: string;
  CRT: "1" | "2" | "3";
  enderEmit: NFeEndereco;
}

export interface NFeDestinatario {
  CPF?: string;
  CNPJ?: string;
  xNome: string;
  email?: string;
  indIEDest: "1" | "2" | "9"; // 9 = consumidor final (não contribuinte)
  IE?: string;
  enderDest: NFeEndereco;
}

export interface NFeItem {
  nItem: number;
  cProd: string;
  cEAN?: string;   // EAN-13 ou "SEM GTIN"
  xProd: string;
  NCM: string;     // 8 dígitos
  CEST?: string;
  CFOP: string;    // 5102 ou 6102
  uCom: string;    // UN, KG, etc.
  qCom: number;
  vUnCom: number;
  vProd: number;   // qCom × vUnCom (sem arredondamento aqui)
  indTot?: "0" | "1"; // default "1"
}

export interface NFePagamento {
  tPag: string; // "01" dinheiro, "03" cartão crédito, "04" débito, "15" boleto, "17" PIX, "99" outros
  vPag: number;
}

export interface NFeConfig {
  nNF: number;
  serie: number;
  dhEmi: string;      // ISO 8601 com fuso ex: "2024-07-30T10:00:00-03:00"
  ambiente: "1" | "2"; // 1=produção, 2=homologação
  natOp: string;       // "Venda de mercadoria"
  idDest: "1" | "2" | "3"; // 1=interna, 2=interestadual, 3=exterior
  cMunFG: string;      // cMun do município do fato gerador
  vFrete?: number;
  vSeg?: number;
  vDesc?: number;
  vOutro?: number;
  infCpl?: string;
}

export interface NFeXmlResult {
  /** infNFe em forma canônica (com xmlns) — usado para calcular o DigestValue */
  canonicalInfNFe: string;
  /** chave de acesso 44 dígitos */
  chNFe: string;
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

const f2  = (n: number) => n.toFixed(2);
const f4  = (n: number) => n.toFixed(4);
const f10 = (n: number) => n.toFixed(10);
const pad = (s: string | number, len: number) => String(s).padStart(len, "0");
const nums = (s: string) => s.replace(/\D/g, "");

// ─── Construtores de elementos ─────────────────────────────────────────────────

function ender(e: NFeEndereco, tag: "enderEmit" | "enderDest"): string {
  const cep = nums(e.CEP).padStart(8, "0");
  return (
    `<${tag}>` +
    `<xLgr>${e.xLgr}</xLgr>` +
    `<nro>${e.nro}</nro>` +
    (e.xCompl ? `<xCompl>${e.xCompl}</xCompl>` : "") +
    `<xBairro>${e.xBairro}</xBairro>` +
    `<cMun>${e.cMun}</cMun>` +
    `<xMun>${e.xMun}</xMun>` +
    `<UF>${e.UF}</UF>` +
    `<CEP>${cep}</CEP>` +
    `<cPais>${e.cPais ?? "1058"}</cPais>` +
    `<xPais>${e.xPais ?? "Brasil"}</xPais>` +
    (e.fone ? `<fone>${nums(e.fone)}</fone>` : "") +
    `</${tag}>`
  );
}

function ide(cfg: NFeConfig, chNFe: string, cNF: string, cDV: number, uf: string): string {
  const cUF  = getUfCode(uf);
  const nNFp = pad(cfg.nNF, 9);
  const serp = pad(cfg.serie, 3);

  return (
    `<ide>` +
    `<cUF>${cUF}</cUF>` +
    `<cNF>${cNF}</cNF>` +
    `<natOp>${cfg.natOp}</natOp>` +
    `<mod>55</mod>` +
    `<serie>${serp}</serie>` +
    `<nNF>${nNFp}</nNF>` +
    `<dhEmi>${cfg.dhEmi}</dhEmi>` +
    `<tpNF>1</tpNF>` +
    `<idDest>${cfg.idDest}</idDest>` +
    `<cMunFG>${cfg.cMunFG}</cMunFG>` +
    `<tpImp>1</tpImp>` +
    `<tpEmis>1</tpEmis>` +
    `<cDV>${cDV}</cDV>` +
    `<tpAmb>${cfg.ambiente}</tpAmb>` +
    `<finNFe>1</finNFe>` +
    `<indFinal>1</indFinal>` +
    `<indPres>2</indPres>` +
    `<procEmi>0</procEmi>` +
    `<verProc>Flora Botanics 1.0</verProc>` +
    `</ide>`
  );
}

function emit(e: NFeEmitente): string {
  const cnpj = nums(e.CNPJ).padStart(14, "0");
  return (
    `<emit>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<xNome>${e.xNome}</xNome>` +
    (e.xFant ? `<xFant>${e.xFant}</xFant>` : "") +
    ender(e.enderEmit, "enderEmit") +
    `<IE>${nums(e.IE)}</IE>` +
    `<CRT>${e.CRT}</CRT>` +
    `</emit>`
  );
}

function dest(d: NFeDestinatario): string {
  const doc = d.CPF
    ? `<CPF>${nums(d.CPF).padStart(11, "0")}</CPF>`
    : d.CNPJ
    ? `<CNPJ>${nums(d.CNPJ).padStart(14, "0")}</CNPJ>`
    : "";

  return (
    `<dest>` +
    doc +
    `<xNome>${d.xNome}</xNome>` +
    ender(d.enderDest, "enderDest") +
    `<indIEDest>${d.indIEDest}</indIEDest>` +
    (d.IE ? `<IE>${nums(d.IE)}</IE>` : "") +
    (d.email ? `<email>${d.email}</email>` : "") +
    `</dest>`
  );
}

// ICMS para Simples Nacional sem crédito (CSOSN 102)
const ICMS_SN102 = `<ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`;
// PIS / COFINS isentos (CST 07)
const PIS_07  = `<PIS><PISOutr><CST>07</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>`;
const COF_07  = `<COFINS><COFINSOutr><CST>07</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>`;

function det(item: NFeItem): string {
  const ean    = item.cEAN ?? "SEM GTIN";
  const indTot = item.indTot ?? "1";

  return (
    `<det nItem="${item.nItem}">` +
    `<prod>` +
    `<cProd>${item.cProd}</cProd>` +
    `<cEAN>${ean}</cEAN>` +
    `<xProd>${item.xProd}</xProd>` +
    `<NCM>${item.NCM}</NCM>` +
    (item.CEST ? `<CEST>${item.CEST}</CEST>` : "") +
    `<CFOP>${item.CFOP}</CFOP>` +
    `<uCom>${item.uCom}</uCom>` +
    `<qCom>${f4(item.qCom)}</qCom>` +
    `<vUnCom>${f10(item.vUnCom)}</vUnCom>` +
    `<vProd>${f2(item.vProd)}</vProd>` +
    `<cEANTrib>${ean}</cEANTrib>` +
    `<uTrib>${item.uCom}</uTrib>` +
    `<qTrib>${f4(item.qCom)}</qTrib>` +
    `<vUnTrib>${f10(item.vUnCom)}</vUnTrib>` +
    `<indTot>${indTot}</indTot>` +
    `</prod>` +
    `<imposto>${ICMS_SN102}${PIS_07}${COF_07}</imposto>` +
    `</det>`
  );
}

function total(itens: NFeItem[], cfg: NFeConfig): string {
  const vProd  = itens.reduce((s, i) => s + i.vProd, 0);
  const vFrete = cfg.vFrete ?? 0;
  const vSeg   = cfg.vSeg ?? 0;
  const vDesc  = cfg.vDesc ?? 0;
  const vOutro = cfg.vOutro ?? 0;
  const vNF    = vProd + vFrete + vSeg + vOutro - vDesc;

  return (
    `<total><ICMSTot>` +
    `<vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson>` +
    `<vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST>` +
    `<vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${f2(vProd)}</vProd>` +
    `<vFrete>${f2(vFrete)}</vFrete>` +
    `<vSeg>${f2(vSeg)}</vSeg>` +
    `<vDesc>${f2(vDesc)}</vDesc>` +
    `<vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol>` +
    `<vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS>` +
    `<vOutro>${f2(vOutro)}</vOutro>` +
    `<vNF>${f2(vNF)}</vNF>` +
    `<vTotTrib>0.00</vTotTrib>` +
    `</ICMSTot></total>`
  );
}

function transp(): string {
  // modFrete 9 = sem frete (padrão para e-commerce onde valor já está no produto)
  return `<transp><modFrete>9</modFrete></transp>`;
}

function pag(pagamentos: NFePagamento[]): string {
  const det = pagamentos
    .map(p => `<detPag><tPag>${p.tPag}</tPag><vPag>${f2(p.vPag)}</vPag></detPag>`)
    .join("");
  return `<pag>${det}</pag>`;
}

function infAdic(cfg: NFeConfig): string {
  let cpl = cfg.infCpl ?? "";
  if (cfg.ambiente === "2") {
    cpl = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" + (cpl ? ". " + cpl : "");
  }
  if (!cpl) return "";
  return `<infAdic><infCpl>${cpl}</infCpl></infAdic>`;
}

// ─── Função principal ──────────────────────────────────────────────────────────

export function buildNFeXml(input: {
  emitente: NFeEmitente;
  destinatario: NFeDestinatario;
  itens: NFeItem[];
  pagamentos: NFePagamento[];
  config: NFeConfig;
}): NFeXmlResult {
  const { emitente: e, destinatario: d, itens, pagamentos, config: cfg } = input;

  const uf   = e.enderEmit.UF;
  const cnpj = nums(e.CNPJ);
  const dt   = new Date(cfg.dhEmi);
  const aaaamm = `${dt.getFullYear()}${pad(dt.getMonth() + 1, 2)}`;

  const { chNFe, cNF, cDV } = generateAccessKey({ uf, aaaamm, cnpj, serie: cfg.serie, nNF: cfg.nNF });

  const content =
    ide(cfg, chNFe, cNF, cDV, uf) +
    emit(e) +
    dest(d) +
    itens.map(det).join("") +
    total(itens, cfg) +
    transp() +
    pag(pagamentos) +
    infAdic(cfg);

  // Forma canônica: atributos em ordem lexicográfica (Id < versao < xmlns)
  const canonicalInfNFe =
    `<infNFe Id="NFe${chNFe}" versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${content}</infNFe>`;

  return { canonicalInfNFe, chNFe };
}
