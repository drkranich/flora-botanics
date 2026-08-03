/**
 * Edge Function: sefaz-nfe  v24
 *
 * Proxy SOAP para o webservice do SEFAZ (NFeAutorizacao4) com mTLS.
 *
 * SOLUÇÃO FINAL: usa forge.tls sobre Deno.connect (TCP puro) para realizar
 * o handshake TLS com certificado de cliente (mTLS).
 *
 * Razão: Deno.connectTls({ certChain/cert, privateKey/key }) no
 * supabase-edge-runtime-1.74.3 (Deno v2.1.4) NÃO envia o certificado de
 * cliente durante o handshake TLS — qualquer parâmetro passado é ignorado
 * silenciosamente. Isso foi confirmado por testes: o servidor SEFAZ aceita
 * o handshake mas reseta a conexão no primeiro write() (os error 104).
 *
 * A abordagem forge.tls funciona porque:
 * 1. Abre conexão TCP pura com Deno.connect
 * 2. Executa todo o protocolo TLS 1.2 em userspace via node-forge
 * 3. Apresenta o certificado A1 no CertificateVerify do handshake
 * 4. Envia a requisição HTTP/SOAP sobre a sessão TLS estabelecida
 *
 * Input (POST JSON):
 *   {
 *     url:        string,  // endpoint SEFAZ (https://hom.nfe.fazenda.gov.br/...)
 *     soapBody:   string,  // envelope SOAP já assinado com XMLDSig
 *     soapAction: string,  // valor do header SOAPAction
 *     pfxBase64:  string,  // certificado A1 em base64
 *     pfxSenha:   string,  // senha do .pfx
 *   }
 *
 * Output:
 *   { ok: true,  xmlResponse: string }
 *   { ok: false, error: string }
 *
 * Deploy:
 *   supabase functions deploy sefaz-nfe --project-ref mbpvzhcrimdwcqkqvoqr --no-verify-jwt
 */

// @ts-ignore — npm: imports em Deno
import forge from "npm:node-forge@1.3.1";

// ---------------------------------------------------------------------------
// Domínios SEFAZ permitidos (allowlist de segurança)
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
  ".sefa.pr.gov.br",
  ".fazenda.sp.gov.br",
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
// Extração de PEM do PKCS#12 (certificado A1)
// ---------------------------------------------------------------------------

function extractPemFromPfx(
  pfxBase64: string,
  password: string
): { leafCertPem: string; pkcs1KeyPem: string } {
  const cleanB64 = pfxBase64
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/[\s\r\n\t]/g, "");

  const pfxBytes = forge.util.decode64(cleanB64);

  // parseAllBytes:false necessário para PFXs legados ICP-Brasil (RC2/3DES)
  const pfxAsn1 = forge.asn1.fromDer(pfxBytes, {
    strict: false,
    parseAllBytes: false,
  } as unknown as boolean);

  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

  // Certificado folha (leaf) — usado no CertificateVerify do mTLS
  const certBags =
    pfx.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] ?? [];

  if (certBags.length === 0 || !certBags[0].cert) {
    throw new Error("Certificado A1: nenhum certificado encontrado no PKCS#12.");
  }

  const leafCertPem = forge.pki.certificateToPem(certBags[0].cert);

  // Chave privada — forge.tls usa formato PKCS#1 (RSA PRIVATE KEY)
  const shroudedBags =
    pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];
  const rawKeyBags =
    pfx.getBags({ bagType: forge.pki.oids.keyBag })[
      forge.pki.oids.keyBag
    ] ?? [];

  const keyEntry = shroudedBags[0] ?? rawKeyBags[0];
  if (!keyEntry?.key) {
    throw new Error("Certificado A1: chave privada não encontrada no PKCS#12.");
  }

  const pkcs1KeyPem = forge.pki.privateKeyToPem(keyEntry.key);

  return { leafCertPem, pkcs1KeyPem };
}

// ---------------------------------------------------------------------------
// Helpers de conversão binary string ↔ Uint8Array
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

// ---------------------------------------------------------------------------
// Decodificação de Transfer-Encoding: chunked (opera em binary string)
// ---------------------------------------------------------------------------

function decodeChunkedBin(data: string): string {
  let out = "";
  let i = 0;
  let iterations = 0;
  while (i < data.length && iterations++ < 10000) {
    // Chunk size line termina em \r\n ou \n
    let lineEnd = data.indexOf("\r\n", i);
    const lineEndLen = 2;
    if (lineEnd === -1) {
      lineEnd = data.indexOf("\n", i);
      if (lineEnd === -1) break;
      // só \n
    }
    const sizeLine = data.slice(i, lineEnd).split(";")[0].trim();
    if (!sizeLine) { i = lineEnd + lineEndLen; continue; }
    const chunkSize = parseInt(sizeLine, 16);
    if (isNaN(chunkSize) || chunkSize === 0) break;
    i = lineEnd + lineEndLen;
    if (i + chunkSize > data.length) {
      out += data.slice(i);
      break;
    }
    out += data.slice(i, i + chunkSize);
    i += chunkSize + lineEndLen; // skip trailing \r\n após o chunk
  }
  return out || data; // fallback: se nada decodificado, retorna raw
}

// ---------------------------------------------------------------------------
// mTLS via forge.tls sobre TCP puro
//
// forge.tls.createConnection API (node-forge@1.3.1):
//   server: false
//   caStore: []          — não valida certificado do servidor
//   verify: () => true   — aceita qualquer servidor (SEFAZ usa ICP-Brasil
//                          que forge não conhece; a autenticação do SERVIDOR
//                          é feita pela CA chain do sistema operacional em
//                          produção mas aqui aceitamos por simplicidade)
//   getCertificate: () => certPem  — certificado de cliente (leaf PEM)
//   getPrivateKey:  () => keyPem   — chave privada PKCS#1
//   connected(conn)     — handshake concluído; chama conn.prepare() para enviar
//   tlsDataReady(conn)  — bytes TLS cifrados prontos; copiar conn.tlsData
//   dataReady(conn)     — bytes decifrados recebidos; copiar conn.data
//   closed()            — conexão fechada
//   error(_c, err)      — erro TLS
// ---------------------------------------------------------------------------

async function httpsPostMtlsForge(
  url: string,
  soapBody: string,
  soapAction: string,
  leafCertPem: string,
  pkcs1KeyPem: string
): Promise<string> {
  const u = new URL(url);
  const hostname = u.hostname;
  const port = u.port ? parseInt(u.port) : 443;
  const path = u.pathname + (u.search || "");

  // Construir requisição HTTP/1.1
  const bodyLen = new TextEncoder().encode(soapBody).length;
  // SOAP 1.1 → Content-Type: text/xml + SOAPAction header separado
  // Compatível com endpoints JAX-WS (MG, GO, PE, PR...) e .asmx (SP, RS, SVAN)
  const httpRequest =
    `POST ${path} HTTP/1.1\r\n` +
    `Host: ${hostname}\r\n` +
    `Content-Type: text/xml; charset=utf-8\r\n` +
    `SOAPAction: "${soapAction}"\r\n` +
    `Content-Length: ${bodyLen}\r\n` +
    `Connection: close\r\n` +
    `\r\n` +
    soapBody;

  // Conexão TCP pura
  const tcp = await Deno.connect({ hostname, port, transport: "tcp" });

  // Fila de bytes TLS cifrados a enviar
  const sendQueue: Uint8Array[] = [];
  let sendSignal: (() => void) | null = null;

  let appData = ""; // dados decifrados acumulados
  let handshakeDone = false;
  let tlsError: string | null = null;
  let tlsClosed = false;

  const flushTlsData = (conn: { tlsData: { getBytes(): string } }) => {
    const raw = conn.tlsData.getBytes();
    if (raw.length > 0) {
      sendQueue.push(binToBytes(raw));
      if (sendSignal) {
        const s = sendSignal;
        sendSignal = null;
        s();
      }
    }
  };

  type ForgeTlsConn = {
    handshake(): void;
    process(data: string): void;
    prepare(data: string): boolean;
    tlsData: { getBytes(): string; length(): number };
    data: { getBytes(): string; length(): number };
    close(): void;
  };

  const tls = (
    forge.tls as unknown as {
      createConnection(opts: Record<string, unknown>): ForgeTlsConn;
    }
  ).createConnection({
    server: false,
    virtualHost: hostname,
    caStore: [],
    verify: () => true, // aceitar qualquer cert de servidor

    // Apresentar certificado de cliente durante handshake mTLS
    getCertificate: () => leafCertPem,
    getPrivateKey: () => pkcs1KeyPem,

    connected: (conn: {
      tlsData: { getBytes(): string };
      prepare(s: string): boolean;
    }) => {
      handshakeDone = true;
      conn.prepare(httpRequest);
      flushTlsData(conn);
    },
    tlsDataReady: (conn: { tlsData: { getBytes(): string } }) => {
      flushTlsData(conn);
    },
    dataReady: (conn: { data: { getBytes(): string } }) => {
      appData += conn.data.getBytes();
    },
    closed: () => {
      tlsClosed = true;
      if (sendSignal) {
        const s = sendSignal;
        sendSignal = null;
        s();
      }
    },
    error: (_c: unknown, err: { message: string }) => {
      tlsError = err.message;
      if (sendSignal) {
        const s = sendSignal;
        sendSignal = null;
        s();
      }
    },
  });

  // Coroutine escritora: envia bytes TLS cifrados pelo TCP
  const writer = async () => {
    while (!tlsClosed && !tlsError) {
      if (sendQueue.length > 0) {
        const chunk = sendQueue.shift()!;
        try {
          await tcp.write(chunk);
        } catch {
          break;
        }
      } else {
        await new Promise<void>((r) => {
          sendSignal = r;
        });
      }
    }
    // Drena fila restante
    for (const chunk of sendQueue) {
      try {
        await tcp.write(chunk);
      } catch {
        break;
      }
    }
  };

  // Coroutine leitora: alimenta bytes TCP no motor TLS
  const reader = async () => {
    const buf = new Uint8Array(16384);
    try {
      while (!tlsClosed && !tlsError) {
        const n = await tcp.read(buf);
        if (n === null) {
          tls.close();
          break;
        }
        tls.process(bytesToBin(buf, n));
        // process() pode ter preenchido sendQueue (ex: handshake messages)
        if (sendSignal) {
          const s = sendSignal;
          sendSignal = null;
          s();
        }
      }
    } catch {
      /* conexão fechada pelo servidor — normal para Connection: close */
    }
  };

  // Iniciar handshake TLS — produz ClientHello e chama tlsDataReady
  tls.handshake();
  if (sendSignal) {
    const s = sendSignal;
    sendSignal = null;
    s();
  }

  // Rodar writer e reader concorrentemente com timeout de 30s
  await Promise.race([
    Promise.all([writer(), reader()]),
    new Promise<void>((r) => setTimeout(r, 30_000)),
  ]);

  try {
    tcp.close();
  } catch {
    /* ignore */
  }

  if (tlsError) {
    throw new Error(`TLS error: ${tlsError}`);
  }
  if (!handshakeDone) {
    throw new Error("TLS handshake não concluído (timeout ou erro de rede).");
  }
  if (!appData) {
    throw new Error("Nenhuma resposta recebida do SEFAZ.");
  }

  // Parse HTTP/1.1 response (appData é binary string em latin1)
  // Suporte a \r\n\r\n e \n\n como separador de headers
  let headerEnd = appData.indexOf("\r\n\r\n");
  let headerSepLen = 4;
  if (headerEnd === -1) {
    headerEnd = appData.indexOf("\n\n");
    headerSepLen = 2;
  }
  if (headerEnd === -1) {
    throw new Error(
      `Resposta HTTP malformada (sem separador de headers). Primeiros 200 bytes: ${appData.slice(0, 200)}`
    );
  }

  const headersRaw = appData.slice(0, headerEnd);
  const bodyRaw = appData.slice(headerEnd + headerSepLen);

  const statusMatch = headersRaw.match(/^HTTP\/[\d.]+ (\d+)/);
  const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;

  const isChunked = headersRaw.toLowerCase().includes("transfer-encoding: chunked");

  // Diagnóstico: log headers e body bruto
  console.log("[sefaz-nfe v19] HTTP status:", statusCode);
  console.log("[sefaz-nfe v19] headers:", headersRaw.slice(0, 300));
  console.log("[sefaz-nfe v19] isChunked:", isChunked, "| bodyRaw[0..200]:", bodyRaw.slice(0, 200));

  const bodyDecoded = isChunked ? decodeChunkedBin(bodyRaw) : bodyRaw;

  // Converter binary string latin1 → UTF-8 via TextDecoder
  const bodyBytes = binToBytes(bodyDecoded);
  const xmlResponse = new TextDecoder("utf-8").decode(bodyBytes);

  console.log("[sefaz-nfe v19] xmlResponse[0..800]:", xmlResponse.slice(0, 800));

  // Se veio HTML em vez de XML, retornar como erro com snippet
  if (xmlResponse.trimStart().startsWith("<!") || xmlResponse.trimStart().startsWith("<html")) {
    throw new Error(
      `SEFAZ retornou HTML (status ${statusCode}). Snippet: ${xmlResponse.slice(0, 600)}`
    );
  }

  // SOAP fault vem como HTTP 500 — mas o XML ainda é válido
  if (statusCode >= 500 && !xmlResponse.includes("Envelope")) {
    throw new Error(
      `SEFAZ HTTP ${statusCode}. Body: ${xmlResponse.slice(0, 300)}`
    );
  }

  return xmlResponse;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS pré-flight
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
    return Response.json(
      { ok: false, error: "Método não permitido." },
      { status: 405 }
    );
  }

  let body: {
    url?: string;
    soapBody?: string;
    soapAction?: string;
    pfxBase64?: string;
    pfxSenha?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 }
    );
  }

  const { url, soapBody, soapAction, pfxBase64, pfxSenha } = body;

  if (!url || !soapBody || !soapAction) {
    return Response.json(
      { ok: false, error: "Campos obrigatórios: url, soapBody, soapAction." },
      { status: 400 }
    );
  }

  if (!isAllowedSefazUrl(url)) {
    return Response.json(
      {
        ok: false,
        error: `URL não permitida: ${url}. Deve ser endpoint SEFAZ gov.br.`,
      },
      { status: 403 }
    );
  }

  if (!pfxBase64 || !pfxSenha) {
    return Response.json(
      {
        ok: false,
        error: "Certificado A1 (pfxBase64 + pfxSenha) obrigatório.",
      },
      { status: 400 }
    );
  }

  try {
    let leafCertPem: string;
    let pkcs1KeyPem: string;

    try {
      ({ leafCertPem, pkcs1KeyPem } = extractPemFromPfx(pfxBase64, pfxSenha));
    } catch (certErr) {
      const msg = certErr instanceof Error ? certErr.message : String(certErr);
      return Response.json(
        { ok: false, error: `Falha ao processar certificado A1: ${msg}` },
        { status: 200 }
      );
    }

    const xmlResponse = await httpsPostMtlsForge(
      url,
      soapBody,
      soapAction,
      leafCertPem,
      pkcs1KeyPem
    );

    // Log para diagnóstico nos logs da Edge Function (Supabase Dashboard)
    console.log("[sefaz-nfe v19] xmlResponse primeiros 600 chars:", xmlResponse.slice(0, 600));

    return Response.json(
      { ok: true, xmlResponse, xmlSnippet: xmlResponse.slice(0, 500) },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { ok: false, error: `Falha na conexão com SEFAZ: ${message}` },
      { status: 200 }
    );
  }
});
