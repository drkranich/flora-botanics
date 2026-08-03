/**
 * Edge Function: sefaz-nfe  v25
 *
 * Recebe dados brutos da NF-e, constrói o XML, assina (XMLDSig) e transmite
 * ao SEFAZ via mTLS — tudo dentro do Deno/Supabase.
 *
 * O Cloudflare Worker não executa mais node-forge (evita erro 1102).
 *
 * Input (POST JSON):
 *   {
 *     // Dados para construir + assinar + transmitir
 *     nfeInput: NFeInput,   // emitente, destinatario, itens, pagamentos, config
 *     pfxBase64: string,
 *     pfxSenha:  string,
 *     // OU: envelope já pronto (legado)
 *     url?:      string,
 *     soapBody?: string,
 *     soapAction?: string,
 *   }
 *
 * Output:
 *   { ok: true,  xmlResponse: string, xmlSnippet: string, chNFe: string }
 *   { ok: false, error: string }
 */

// @ts-ignore
import forge from "npm:node-forge@1.3.1";

// ---------------------------------------------------------------------------
// Domínios SEFAZ permitidos
// ---------------------------------------------------------------------------

const SEFAZ_DOMAINS = [
  ".sefaz.am.gov.br",
  ".sefaz.ba.gov.br",
  ".sefaz.ce.gov.br",
  ".sefaz.go.gov.br",
  ".sefaz.ms.gov.br",
  ".sefaz.mt.gov.br",
  ".sefaz.pe.gov.br",
  ".sefaz.rs.gov.br",
  ".sefaz.rj.gov.br",
  ".sefaz.sp.gov.br",
  ".fazenda.mg.gov.br",
  ".fazenda.ms.gov.br",
  ".fazenda.pr.gov.br",
  ".fazenda.sp.gov.br",
  ".sefa.pr.gov.br",
  ".svrs.rs.gov.br",
  ".nfe.svrs.rs.gov.br",
  ".nfe.fazenda.gov.br",
];

function isAllowedSefazUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return SEFAZ_DOMAINS.some(
      (d) => u.hostname.endsWith(d) || u.hostname === d.slice(1)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Endpoints por UF
// ---------------------------------------------------------------------------

const UF_CODE: Record<string, string> = {
  AC:"12",AL:"27",AM:"13",AP:"16",BA:"29",CE:"23",DF:"53",ES:"32",GO:"52",
  MA:"21",MG:"31",MS:"50",MT:"51",PA:"15",PB:"25",PE:"26",PI:"22",PR:"41",
  RJ:"33",RN:"24",RO:"11",RR:"14",RS:"43",SC:"42",SE:"28",SP:"35",TO:"17",
};

const ENDPOINTS: Record<string, { prod: string; hom: string }> = {
  AM: { prod:"https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4",    hom:"https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4" },
  BA: { prod:"https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx", hom:"https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx" },
  GO: { prod:"https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",          hom:"https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4" },
  MG: { prod:"https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4",       hom:"https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx" },
  MS: { prod:"https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4",                    hom:"https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4" },
  MT: { prod:"https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4",     hom:"https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4" },
  PE: { prod:"https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4",  hom:"https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4" },
  PR: { prod:"https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4",                    hom:"https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4" },
  RS: { prod:"https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx", hom:"https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx" },
  SP: { prod:"https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",             hom:"https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx" },
  _SVRS: { prod:"https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx", hom:"https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx" },
};

function getSefazEndpoint(uf: string, ambiente: "1" | "2"): string {
  const entry = ENDPOINTS[uf.toUpperCase()] ?? ENDPOINTS._SVRS;
  return ambiente === "2" ? entry.hom : entry.prod;
}

function getUfCode(uf: string): string {
  return UF_CODE[uf.toUpperCase()] ?? "35";
}

// ---------------------------------------------------------------------------
// Geração da chave de acesso
// ---------------------------------------------------------------------------

function mod11(digits: string): number {
  const weights = [2,3,4,5,6,7,8,9];
  let sum = 0;
  for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
    sum += parseInt(digits[i], 10) * weights[w % 8];
  }
  const rem = sum % 11;
  return rem === 0 || rem === 1 ? 1 : 11 - rem;
}

function generateAccessKey(params: {
  uf: string; aaaamm: string; cnpj: string; serie: number; nNF: number;
}): { chNFe: string; cNF: string; cDV: number } {
  const cUF    = getUfCode(params.uf);
  const cnpj   = params.cnpj.replace(/\D/g, "").padStart(14, "0");
  const serie  = String(params.serie).padStart(3, "0");
  const nNF    = String(params.nNF).padStart(9, "0");
  const cNF    = String(Math.floor(10000000 + Math.random() * 89999999));
  const base   = `${cUF}${params.aaaamm}${cnpj}55${serie}${nNF}1${cNF}`;
  const cDV    = mod11(base);
  return { chNFe: `${base}${cDV}`, cNF, cDV };
}

// ---------------------------------------------------------------------------
// Construtor de XML NF-e
// ---------------------------------------------------------------------------

const f2  = (n: number) => n.toFixed(2);
const f4  = (n: number) => n.toFixed(4);
const f10 = (n: number) => n.toFixed(10);
const pad = (s: string | number, len: number) => String(s).padStart(len, "0");
const nums = (s: string) => s.replace(/\D/g, "");

function ender(e: Record<string,string>, tag: string): string {
  const cep = nums(e.CEP ?? "").padStart(8, "0");
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

const ICMS_SN102 = `<ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`;
const PIS_07  = `<PIS><PISOutr><CST>07</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>`;
const COF_07  = `<COFINS><COFINSOutr><CST>07</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>`;

function buildNFeXml(input: Record<string, unknown>): { canonicalInfNFe: string; chNFe: string } {
  const e   = input.emitente as Record<string,unknown>;
  const ee  = e.enderEmit as Record<string,string>;
  const d   = input.destinatario as Record<string,unknown>;
  const de  = (d.enderDest ?? ee) as Record<string,string>;
  const itens = input.itens as Array<Record<string,unknown>>;
  const pags  = input.pagamentos as Array<Record<string,unknown>>;
  const cfg   = input.config as Record<string,unknown>;

  const uf   = ee.UF;
  const cnpj = nums(e.CNPJ as string);
  const dhEmi = cfg.dhEmi as string;
  const dt   = new Date(dhEmi);
  const aaaamm = `${dt.getFullYear()}${pad(dt.getMonth() + 1, 2)}`;
  const { chNFe, cNF, cDV } = generateAccessKey({ uf, aaaamm, cnpj, serie: cfg.serie as number, nNF: cfg.nNF as number });

  const ambiente = cfg.ambiente as string;
  const cUF = getUfCode(uf);
  const nNFp = pad(cfg.nNF as number, 9);
  const serp = pad(cfg.serie as number, 3);

  const ideXml =
    `<ide>` +
    `<cUF>${cUF}</cUF><cNF>${cNF}</cNF>` +
    `<natOp>${cfg.natOp}</natOp><mod>55</mod>` +
    `<serie>${serp}</serie><nNF>${nNFp}</nNF>` +
    `<dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF>` +
    `<idDest>${cfg.idDest}</idDest><cMunFG>${cfg.cMunFG}</cMunFG>` +
    `<tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${cDV}</cDV>` +
    `<tpAmb>${ambiente}</tpAmb><finNFe>1</finNFe>` +
    `<indFinal>1</indFinal><indPres>2</indPres>` +
    `<procEmi>0</procEmi><verProc>Flora Botanics 1.0</verProc>` +
    `</ide>`;

  const emitXml =
    `<emit>` +
    `<CNPJ>${cnpj.padStart(14,"0")}</CNPJ>` +
    `<xNome>${e.xNome}</xNome>` +
    (e.xFant ? `<xFant>${e.xFant}</xFant>` : "") +
    ender(ee, "enderEmit") +
    `<IE>${nums(e.IE as string)}</IE>` +
    `<CRT>${e.CRT}</CRT>` +
    `</emit>`;

  const doc = d.CPF
    ? `<CPF>${nums(d.CPF as string).padStart(11,"0")}</CPF>`
    : d.CNPJ
    ? `<CNPJ>${nums(d.CNPJ as string).padStart(14,"0")}</CNPJ>`
    : "";
  const destXml =
    `<dest>` + doc +
    `<xNome>${d.xNome}</xNome>` +
    ender(de, "enderDest") +
    `<indIEDest>${d.indIEDest}</indIEDest>` +
    (d.IE ? `<IE>${nums(d.IE as string)}</IE>` : "") +
    (d.email ? `<email>${d.email}</email>` : "") +
    `</dest>`;

  const detsXml = itens.map((item) => {
    const ean = (item.cEAN as string) ?? "SEM GTIN";
    return (
      `<det nItem="${item.nItem}">` +
      `<prod>` +
      `<cProd>${item.cProd}</cProd><cEAN>${ean}</cEAN>` +
      `<xProd>${item.xProd}</xProd><NCM>${item.NCM}</NCM>` +
      (item.CEST ? `<CEST>${item.CEST}</CEST>` : "") +
      `<CFOP>${item.CFOP}</CFOP><uCom>${item.uCom}</uCom>` +
      `<qCom>${f4(item.qCom as number)}</qCom>` +
      `<vUnCom>${f10(item.vUnCom as number)}</vUnCom>` +
      `<vProd>${f2(item.vProd as number)}</vProd>` +
      `<cEANTrib>${ean}</cEANTrib><uTrib>${item.uCom}</uTrib>` +
      `<qTrib>${f4(item.qCom as number)}</qTrib>` +
      `<vUnTrib>${f10(item.vUnCom as number)}</vUnTrib>` +
      `<indTot>${item.indTot ?? "1"}</indTot>` +
      `</prod>` +
      `<imposto>${ICMS_SN102}${PIS_07}${COF_07}</imposto>` +
      `</det>`
    );
  }).join("");

  const vProd  = itens.reduce((s, i) => s + (i.vProd as number), 0);
  const vFrete = (cfg.vFrete as number) ?? 0;
  const vSeg   = (cfg.vSeg   as number) ?? 0;
  const vDesc  = (cfg.vDesc  as number) ?? 0;
  const vOutro = (cfg.vOutro as number) ?? 0;
  const vNF    = vProd + vFrete + vSeg + vOutro - vDesc;

  const totalXml =
    `<total><ICMSTot>` +
    `<vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson>` +
    `<vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST>` +
    `<vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${f2(vProd)}</vProd><vFrete>${f2(vFrete)}</vFrete>` +
    `<vSeg>${f2(vSeg)}</vSeg><vDesc>${f2(vDesc)}</vDesc>` +
    `<vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol>` +
    `<vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS>` +
    `<vOutro>${f2(vOutro)}</vOutro><vNF>${f2(vNF)}</vNF>` +
    `<vTotTrib>0.00</vTotTrib>` +
    `</ICMSTot></total>`;

  const transpXml = `<transp><modFrete>9</modFrete></transp>`;

  const pagXml = `<pag>${pags.map(p =>
    `<detPag><tPag>${p.tPag}</tPag><vPag>${f2(p.vPag as number)}</vPag></detPag>`
  ).join("")}</pag>`;

  let cpl = (cfg.infCpl as string) ?? "";
  if (ambiente === "2") {
    cpl = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" + (cpl ? ". " + cpl : "");
  }
  const infAdicXml = cpl ? `<infAdic><infCpl>${cpl}</infCpl></infAdic>` : "";

  const canonicalInfNFe =
    `<infNFe Id="NFe${chNFe}" versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    ideXml + emitXml + destXml + detsXml + totalXml + transpXml + pagXml + infAdicXml +
    `</infNFe>`;

  return { canonicalInfNFe, chNFe };
}

// ---------------------------------------------------------------------------
// Assinatura XMLDSig
// ---------------------------------------------------------------------------

function signNFe(canonicalInfNFe: string, chNFe: string, pfxBase64: string, pfxPassword: string): string {
  const cleanB64 = pfxBase64.replace(/^data:[^;]+;base64,/, "").replace(/[\s\r\n\t]/g, "");
  const pfxBytes = forge.util.decode64(cleanB64);
  const pfxAsn1  = forge.asn1.fromDer(pfxBytes, { strict: false, parseAllBytes: false } as unknown as boolean);
  const pfx      = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, pfxPassword);

  const shroudedBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  const rawKeyBags   = pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
  const keyEntry     = shroudedBags[0] ?? rawKeyBags[0];
  if (!keyEntry?.key) throw new Error("Chave privada não encontrada no certificado A1.");
  const privateKey = keyEntry.key;

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  if (!certBags[0]?.cert) throw new Error("Certificado X.509 não encontrado no PFX.");
  const certDer    = forge.asn1.toDer(forge.pki.certificateToAsn1(certBags[0].cert)).getBytes();
  const x509Base64 = forge.util.encode64(certDer);

  const mdDigest = forge.md.sha256.create();
  mdDigest.update(canonicalInfNFe, "utf8");
  const digestValue = forge.util.encode64(mdDigest.digest().getBytes());

  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>` +
    `<Reference URI="#NFe${chNFe}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const mdSign = forge.md.sha256.create();
  mdSign.update(signedInfo, "utf8");
  const signatureValue = forge.util.encode64(privateKey.sign(mdSign));

  const signatureEl =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${x509Base64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  return (
    `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
    canonicalInfNFe + signatureEl +
    `</NFe>`
  );
}

// ---------------------------------------------------------------------------
// Extração PEM do PFX (para mTLS)
// ---------------------------------------------------------------------------

function extractPemFromPfx(pfxBase64: string, password: string): { leafCertPem: string; pkcs1KeyPem: string } {
  const cleanB64 = pfxBase64.replace(/^data:[^;]+;base64,/, "").replace(/[\s\r\n\t]/g, "");
  const pfxBytes = forge.util.decode64(cleanB64);
  const pfxAsn1  = forge.asn1.fromDer(pfxBytes, { strict: false, parseAllBytes: false } as unknown as boolean);
  const pfx      = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  if (!certBags[0]?.cert) throw new Error("Certificado A1: nenhum certificado encontrado no PKCS#12.");
  const leafCertPem = forge.pki.certificateToPem(certBags[0].cert);

  const shroudedBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  const rawKeyBags   = pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
  const keyEntry     = shroudedBags[0] ?? rawKeyBags[0];
  if (!keyEntry?.key) throw new Error("Certificado A1: chave privada não encontrada no PKCS#12.");
  const pkcs1KeyPem = forge.pki.privateKeyToPem(keyEntry.key);

  return { leafCertPem, pkcs1KeyPem };
}

// ---------------------------------------------------------------------------
// Helpers binários
// ---------------------------------------------------------------------------

function binToBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

function bytesToBin(b: Uint8Array, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(b[i]);
  return s;
}

function decodeChunkedBin(data: string): string {
  let out = "";
  let i = 0;
  let iterations = 0;
  while (i < data.length && iterations++ < 10000) {
    let lineEnd = data.indexOf("\r\n", i);
    const lineEndLen = 2;
    if (lineEnd === -1) { lineEnd = data.indexOf("\n", i); if (lineEnd === -1) break; }
    const sizeLine = data.slice(i, lineEnd).split(";")[0].trim();
    if (!sizeLine) { i = lineEnd + lineEndLen; continue; }
    const chunkSize = parseInt(sizeLine, 16);
    if (isNaN(chunkSize) || chunkSize === 0) break;
    i = lineEnd + lineEndLen;
    if (i + chunkSize > data.length) { out += data.slice(i); break; }
    out += data.slice(i, i + chunkSize);
    i += chunkSize + lineEndLen;
  }
  return out || data;
}

// ---------------------------------------------------------------------------
// mTLS via forge.tls sobre TCP puro
// ---------------------------------------------------------------------------

async function httpsPostMtlsForge(
  url: string, soapBody: string, soapAction: string,
  leafCertPem: string, pkcs1KeyPem: string
): Promise<string> {
  const u        = new URL(url);
  const hostname = u.hostname;
  const port     = u.port ? parseInt(u.port) : 443;
  const path     = u.pathname + (u.search || "");
  const bodyLen  = new TextEncoder().encode(soapBody).length;

  const httpRequest =
    `POST ${path} HTTP/1.1\r\n` +
    `Host: ${hostname}\r\n` +
    `Content-Type: text/xml; charset=utf-8\r\n` +
    `SOAPAction: "${soapAction}"\r\n` +
    `Content-Length: ${bodyLen}\r\n` +
    `Connection: close\r\n` +
    `\r\n` +
    soapBody;

  const tcp = await Deno.connect({ hostname, port, transport: "tcp" });
  const sendQueue: Uint8Array[] = [];
  let sendSignal: (() => void) | null = null;
  let appData = "";
  let handshakeDone = false;
  let tlsError: string | null = null;
  let tlsClosed = false;

  const flushTlsData = (conn: { tlsData: { getBytes(): string } }) => {
    const raw = conn.tlsData.getBytes();
    if (raw.length > 0) {
      sendQueue.push(binToBytes(raw));
      if (sendSignal) { const s = sendSignal; sendSignal = null; s(); }
    }
  };

  type ForgeTlsConn = {
    handshake(): void; process(data: string): void; prepare(data: string): boolean;
    tlsData: { getBytes(): string }; data: { getBytes(): string }; close(): void;
  };

  const tls = (forge.tls as unknown as { createConnection(opts: Record<string, unknown>): ForgeTlsConn }).createConnection({
    server: false, virtualHost: hostname, caStore: [], verify: () => true,
    getCertificate: () => leafCertPem, getPrivateKey: () => pkcs1KeyPem,
    connected: (conn: { tlsData: { getBytes(): string }; prepare(s: string): boolean }) => {
      handshakeDone = true; conn.prepare(httpRequest); flushTlsData(conn);
    },
    tlsDataReady: (conn: { tlsData: { getBytes(): string } }) => { flushTlsData(conn); },
    dataReady:    (conn: { data: { getBytes(): string } }) => { appData += conn.data.getBytes(); },
    closed: () => { tlsClosed = true; if (sendSignal) { const s = sendSignal; sendSignal = null; s(); } },
    error:  (_c: unknown, err: { message: string }) => {
      tlsError = err.message;
      if (sendSignal) { const s = sendSignal; sendSignal = null; s(); }
    },
  });

  const writer = async () => {
    while (!tlsClosed && !tlsError) {
      if (sendQueue.length > 0) {
        const chunk = sendQueue.shift()!;
        try { await tcp.write(chunk); } catch { break; }
      } else {
        await new Promise<void>((r) => { sendSignal = r; });
      }
    }
    for (const chunk of sendQueue) { try { await tcp.write(chunk); } catch { break; } }
  };

  const reader = async () => {
    const buf = new Uint8Array(16384);
    try {
      while (!tlsClosed && !tlsError) {
        const n = await tcp.read(buf);
        if (n === null) { tls.close(); break; }
        tls.process(bytesToBin(buf, n));
        if (sendSignal) { const s = sendSignal; sendSignal = null; s(); }
      }
    } catch { /* normal ao fechar */ }
  };

  tls.handshake();
  if (sendSignal) { const s = sendSignal; sendSignal = null; s(); }

  await Promise.race([
    Promise.all([writer(), reader()]),
    new Promise<void>((r) => setTimeout(r, 30_000)),
  ]);

  try { tcp.close(); } catch { /* ignore */ }

  if (tlsError)      throw new Error(`TLS error: ${tlsError}`);
  if (!handshakeDone) throw new Error("TLS handshake não concluído (timeout ou erro de rede).");
  if (!appData)       throw new Error("Nenhuma resposta recebida do SEFAZ.");

  let headerEnd = appData.indexOf("\r\n\r\n");
  let headerSepLen = 4;
  if (headerEnd === -1) { headerEnd = appData.indexOf("\n\n"); headerSepLen = 2; }
  if (headerEnd === -1) throw new Error(`Resposta HTTP malformada. Primeiros 200b: ${appData.slice(0, 200)}`);

  const headersRaw = appData.slice(0, headerEnd);
  const bodyRaw    = appData.slice(headerEnd + headerSepLen);
  const statusMatch = headersRaw.match(/^HTTP\/[\d.]+ (\d+)/);
  const statusCode  = statusMatch ? parseInt(statusMatch[1]) : 0;
  const isChunked   = headersRaw.toLowerCase().includes("transfer-encoding: chunked");

  console.log("[sefaz-nfe v25] HTTP status:", statusCode, "| chunked:", isChunked);

  const bodyDecoded  = isChunked ? decodeChunkedBin(bodyRaw) : bodyRaw;
  const xmlResponse  = new TextDecoder("utf-8").decode(binToBytes(bodyDecoded));

  console.log("[sefaz-nfe v25] xmlResponse[0..600]:", xmlResponse.slice(0, 600));

  if (xmlResponse.trimStart().startsWith("<!") || xmlResponse.trimStart().startsWith("<html")) {
    throw new Error(`SEFAZ retornou HTML (status ${statusCode}). Snippet: ${xmlResponse.slice(0, 600)}`);
  }
  if (statusCode >= 500 && !xmlResponse.includes("Envelope")) {
    throw new Error(`SEFAZ HTTP ${statusCode}. Body: ${xmlResponse.slice(0, 300)}`);
  }

  return xmlResponse;
}

// ---------------------------------------------------------------------------
// Envelope SOAP 1.1
// ---------------------------------------------------------------------------

function buildSoapEnvelope(nfeXml: string, lote: string): string {
  const enviNFe =
    `<enviNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>${lote}</idLote><indSinc>1</indSinc>` +
    nfeXml +
    `</enviNFe>`;
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

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Método não permitido." }, { status: 405 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const { pfxBase64, pfxSenha, nfeInput } = body as {
    pfxBase64?: string; pfxSenha?: string; nfeInput?: Record<string, unknown>;
  };

  if (!pfxBase64 || !pfxSenha || !nfeInput) {
    return Response.json({ ok: false, error: "Campos obrigatórios: pfxBase64, pfxSenha, nfeInput." }, { status: 400 });
  }

  try {
    // 1. Extrai PEM para mTLS
    let leafCertPem: string, pkcs1KeyPem: string;
    try {
      ({ leafCertPem, pkcs1KeyPem } = extractPemFromPfx(pfxBase64, pfxSenha));
    } catch (certErr) {
      const msg = certErr instanceof Error ? certErr.message : String(certErr);
      return Response.json({ ok: false, error: `Falha ao processar certificado A1: ${msg}` }, { status: 200 });
    }

    // 2. Constrói XML + assina
    const { canonicalInfNFe, chNFe } = buildNFeXml(nfeInput);
    const nfeXml  = signNFe(canonicalInfNFe, chNFe, pfxBase64, pfxSenha);

    // 3. Monta SOAP
    const lote      = String(Date.now()).slice(-15).padStart(15, "0");
    const soapBody  = buildSoapEnvelope(nfeXml, lote);
    const cfg       = nfeInput.config as Record<string, unknown>;
    const emit_     = nfeInput.emitente as Record<string, unknown>;
    const ee_       = emit_.enderEmit as Record<string, string>;
    const ambiente  = (cfg.ambiente as string) === "1" ? "1" : "2" as "1" | "2";
    const sefazUrl  = getSefazEndpoint(ee_.UF, ambiente);
    const soapAction = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote";

    if (!isAllowedSefazUrl(sefazUrl)) {
      return Response.json({ ok: false, error: `URL não permitida: ${sefazUrl}` }, { status: 403 });
    }

    // 4. Transmite via mTLS
    const xmlResponse = await httpsPostMtlsForge(sefazUrl, soapBody, soapAction, leafCertPem, pkcs1KeyPem);

    return Response.json(
      { ok: true, xmlResponse, xmlSnippet: xmlResponse.slice(0, 500), chNFe, nfeXml },
      { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: `Falha na conexão com SEFAZ: ${message}` }, { status: 200 });
  }
});
