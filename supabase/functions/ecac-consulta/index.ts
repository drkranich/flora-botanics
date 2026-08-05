/**
 * Edge Function: ecac-consulta  v1
 *
 * Proxy para a API SERPRO Integra Contador (acesso programático ao e-CAC).
 * Autentica via mTLS com o certificado A1 do Storage + credenciais SERPRO.
 *
 * Credenciais necessárias (Supabase Secrets ou body):
 *   SERPRO_CONSUMER_KEY    — Consumer Key do contrato SERPRO
 *   SERPRO_CONSUMER_SECRET — Consumer Secret do contrato SERPRO
 *   SEFAZ_CERT_PASSWORD    — senha do certificado A1 (já existente)
 *   Certificado A1: bucket "sefaz-certs" / "Certificado-A1.pfx" (já existente)
 *
 * Input (POST JSON):
 *   {
 *     action: "auth" | "situacao-fiscal" | "cnd" | "caixa-postal" | "simples-nacional",
 *     cnpj: string,              // CNPJ do contribuinte (14 dígitos)
 *     cnpjContratante?: string,  // CNPJ do escritório contábil (se diferente)
 *     // Credenciais opcionais — usadas apenas se Secrets não configurados:
 *     consumerKey?: string,
 *     consumerSecret?: string,
 *   }
 *
 * Output:
 *   { ok: true,  data: Record<string,unknown>, cached?: boolean }
 *   { ok: false, error: string, code?: "NO_CREDENTIALS" | "AUTH_FAILED" | "SERPRO_ERROR" }
 */

// @ts-ignore
import forge from "npm:node-forge@1.3.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const SERPRO_AUTH_URL    = "https://autenticacao.sapi.serpro.gov.br/authenticate";
const SERPRO_GATEWAY_URL = "https://gateway.apiserpro.serpro.gov.br/integra-contador/v1";

// Mapeamento de ações para idSistema/idServico do Integra Contador
const SERVICOS: Record<string, { idSistema: string; idServico: string; versao: string; endpoint: "Apoiar" | "Consultar" | "Emitir" | "Monitorar" }> = {
  "situacao-fiscal": {
    idSistema: "SITFIS",
    idServico: "EMITIRRELATORIO",
    versao: "1.0",
    endpoint: "Emitir",
  },
  "cnd": {
    idSistema: "SITFIS",
    idServico: "EMITIRCND",
    versao: "1.0",
    endpoint: "Emitir",
  },
  "caixa-postal": {
    idSistema: "ECAC",
    idServico: "LISTARMENSAGENS",
    versao: "1.0",
    endpoint: "Consultar",
  },
  "simples-nacional": {
    idSistema: "PGDASD",
    idServico: "CONSEXTRATO16",
    versao: "1.0",
    endpoint: "Consultar",
  },
};

// ---------------------------------------------------------------------------
// Carrega certificado A1 do Storage
// ---------------------------------------------------------------------------

async function loadCertFromStorage(): Promise<{ pfxBase64: string; pfxSenha: string }> {
  const pfxSenha = Deno.env.get("SEFAZ_CERT_PASSWORD");
  if (!pfxSenha) throw new Error("Secret SEFAZ_CERT_PASSWORD não configurado.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.");

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.storage
    .from("sefaz-certs")
    .download("Certificado-A1.pfx");

  if (error || !data) throw new Error(`Falha ao baixar certificado: ${error?.message ?? "sem dados"}`);

  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);

  return { pfxBase64: btoa(binary), pfxSenha };
}

// ---------------------------------------------------------------------------
// Extrai PEM do PFX para mTLS
// ---------------------------------------------------------------------------

function extractPemFromPfx(pfxBase64: string, password: string): { certPem: string; keyPem: string } {
  const clean   = pfxBase64.replace(/^data:[^;]+;base64,/, "").replace(/[\s\r\n\t]/g, "");
  const pfxBytes = forge.util.decode64(clean);
  const pfxAsn1  = forge.asn1.fromDer(pfxBytes, { strict: false, parseAllBytes: false } as unknown as boolean);
  const pfx      = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  if (!certBags[0]?.cert) throw new Error("Certificado X.509 não encontrado no PFX.");
  const certPem = forge.pki.certificateToPem(certBags[0].cert);

  const shroudedBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  const rawKeyBags   = pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
  const keyEntry     = shroudedBags[0] ?? rawKeyBags[0];
  if (!keyEntry?.key) throw new Error("Chave privada não encontrada no PFX.");
  const keyPem = forge.pki.privateKeyToPem(keyEntry.key);

  return { certPem, keyPem };
}

// ---------------------------------------------------------------------------
// Helpers binários (reutilizados do sefaz-nfe)
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
// POST HTTPS via mTLS (forge.tls sobre TCP puro)
// ---------------------------------------------------------------------------

async function httpsPostMtls(
  url: string,
  body: string,
  headers: Record<string, string>,
  certPem: string,
  keyPem: string,
): Promise<{ status: number; body: string }> {
  const u        = new URL(url);
  const hostname = u.hostname;
  const port     = u.port ? parseInt(u.port) : 443;
  const path     = u.pathname + (u.search || "");

  const bodyBytes = new TextEncoder().encode(body);

  const httpRequest =
    `POST ${path} HTTP/1.1\r\n` +
    `Host: ${hostname}\r\n` +
    Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n" +
    `Content-Length: ${bodyBytes.length}\r\n` +
    `Connection: close\r\n` +
    `\r\n` +
    body;

  const tcp = await Deno.connect({ hostname, port, transport: "tcp" });
  const sendQueue: Uint8Array[] = [];
  let sendSignal: (() => void) | null = null;
  let appData = "";
  let handshakeDone = false;
  let tlsError: string | null = null;
  let tlsClosed = false;

  const flush = (conn: { tlsData: { getBytes(): string } }) => {
    const raw = conn.tlsData.getBytes();
    if (raw.length > 0) {
      sendQueue.push(binToBytes(raw));
      if (sendSignal) { const s = sendSignal; sendSignal = null; s(); }
    }
  };

  type TlsConn = {
    handshake(): void; process(d: string): void; prepare(d: string): boolean;
    tlsData: { getBytes(): string }; data: { getBytes(): string }; close(): void;
  };

  const tls = (forge.tls as unknown as { createConnection(o: Record<string, unknown>): TlsConn }).createConnection({
    server: false, virtualHost: hostname, caStore: [], verify: () => true,
    getCertificate: () => certPem, getPrivateKey: () => keyPem,
    connected:    (c: { tlsData: { getBytes(): string }; prepare(s: string): boolean }) => { handshakeDone = true; c.prepare(httpRequest); flush(c); },
    tlsDataReady: (c: { tlsData: { getBytes(): string } }) => flush(c),
    dataReady:    (c: { data: { getBytes(): string } }) => { appData += c.data.getBytes(); },
    closed: () => { tlsClosed = true; if (sendSignal) { const s = sendSignal; sendSignal = null; s(); } },
    error:  (_: unknown, e: { message: string }) => { tlsError = e.message; if (sendSignal) { const s = sendSignal; sendSignal = null; s(); } },
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
    for (const c of sendQueue) { try { await tcp.write(c); } catch { break; } }
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

  if (tlsError)       throw new Error(`TLS error: ${tlsError}`);
  if (!handshakeDone) throw new Error("TLS handshake não concluído (timeout).");
  if (!appData)       throw new Error("Sem resposta do servidor.");

  const sepIdx = appData.indexOf("\r\n\r\n");
  const sep    = sepIdx !== -1 ? sepIdx : appData.indexOf("\n\n");
  const sepLen = appData[sep + 1] === "\n" ? 2 : 4;

  const headersRaw  = appData.slice(0, sep);
  const bodyRaw     = appData.slice(sep + sepLen);
  const statusMatch = headersRaw.match(/^HTTP\/[\d.]+ (\d+)/);
  const statusCode  = statusMatch ? parseInt(statusMatch[1]) : 0;

  return { status: statusCode, body: bodyRaw };
}

// ---------------------------------------------------------------------------
// Autenticação SERPRO — retorna access_token + jwt_token
// ---------------------------------------------------------------------------

async function serproAuth(
  consumerKey: string,
  consumerSecret: string,
  certPem: string,
  keyPem: string,
): Promise<{ accessToken: string; jwtToken: string }> {
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  const body        = "grant_type=client_credentials";

  const { status, body: resBody } = await httpsPostMtls(
    SERPRO_AUTH_URL,
    body,
    {
      "Authorization": `Basic ${credentials}`,
      "Role-Type": "TERCEIROS",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    certPem,
    keyPem,
  );

  if (status !== 200) {
    throw new Error(`Autenticação SERPRO falhou (HTTP ${status}): ${resBody.slice(0, 300)}`);
  }

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(resBody); } catch {
    throw new Error(`Resposta de autenticação inválida: ${resBody.slice(0, 200)}`);
  }

  const accessToken = parsed.access_token as string;
  const jwtToken    = parsed.jwt_token    as string;

  if (!accessToken || !jwtToken) {
    throw new Error(`Tokens ausentes na resposta: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  return { accessToken, jwtToken };
}

// ---------------------------------------------------------------------------
// Chamada a um serviço do Integra Contador
// ---------------------------------------------------------------------------

async function serproServico(
  endpoint: "Apoiar" | "Consultar" | "Emitir" | "Monitorar",
  idSistema: string,
  idServico: string,
  versao: string,
  cnpjContratante: string,
  cnpjContribuinte: string,
  dadosExtras: string,
  accessToken: string,
  jwtToken: string,
  certPem: string,
  keyPem: string,
): Promise<Record<string, unknown>> {
  const requestBody = JSON.stringify({
    contratante: { numero: cnpjContratante.replace(/\D/g, ""), tipo: 2 },
    autorPedidoDados: { numero: cnpjContratante.replace(/\D/g, ""), tipo: 2 },
    contribuinte: { numero: cnpjContribuinte.replace(/\D/g, ""), tipo: 2 },
    pedidoDados: { idSistema, idServico, versaoSistema: versao, dados: dadosExtras },
  });

  const url = `${SERPRO_GATEWAY_URL}/${endpoint}`;

  const { status, body } = await httpsPostMtls(
    url,
    requestBody,
    {
      "Authorization": `Bearer ${accessToken}`,
      "jwt_token": jwtToken,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    certPem,
    keyPem,
  );

  if (status === 401) throw new Error("Token expirado ou inválido (401). Reautentique.");
  if (status >= 400)  throw new Error(`SERPRO retornou erro HTTP ${status}: ${body.slice(0, 300)}`);

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error(`Resposta não é JSON (status ${status}): ${body.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Salva resultado no cache (Supabase)
// ---------------------------------------------------------------------------

async function saveCache(
  tenantId: string,
  tipo: string,
  cnpj: string,
  dados: Record<string, unknown>,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  await supabase.from("ecac_cache").upsert({
    tenant_id:   tenantId,
    tipo,
    cnpj:        cnpj.replace(/\D/g, ""),
    dados:       dados,
    consultado_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,tipo,cnpj" });
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Método não permitido." }, { status: 405 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const action          = (body.action as string) ?? "";
  const cnpj            = (body.cnpj   as string) ?? "";
  const cnpjContratante = (body.cnpjContratante as string) || cnpj;
  const tenantId        = (body.tenantId as string) ?? "default";

  // Credenciais: Secrets têm prioridade; fallback para body (configuração pelo frontend)
  const consumerKey    = Deno.env.get("SERPRO_CONSUMER_KEY")    || (body.consumerKey    as string) || "";
  const consumerSecret = Deno.env.get("SERPRO_CONSUMER_SECRET") || (body.consumerSecret as string) || "";

  // ── Verificação de credenciais ───────────────────────────────────────────
  if (!consumerKey || !consumerSecret) {
    return Response.json({
      ok: false,
      error: "Credenciais SERPRO não configuradas. Informe Consumer Key e Consumer Secret no painel e-CAC.",
      code: "NO_CREDENTIALS",
    }, { status: 200, headers: corsHeaders });
  }

  if (!cnpj) {
    return Response.json({ ok: false, error: "Campo obrigatório: cnpj." }, { status: 400, headers: corsHeaders });
  }

  // ── Ação: apenas teste de credenciais ────────────────────────────────────
  if (action === "auth") {
    try {
      const { pfxBase64, pfxSenha } = await loadCertFromStorage();
      const { certPem, keyPem }     = extractPemFromPfx(pfxBase64, pfxSenha);
      const { accessToken }         = await serproAuth(consumerKey, consumerSecret, certPem, keyPem);
      return Response.json(
        { ok: true, data: { autenticado: true, accessToken: accessToken.slice(0, 8) + "…" } },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, error: msg, code: "AUTH_FAILED" }, { status: 200, headers: corsHeaders });
    }
  }

  // ── Serviços do Integra Contador ─────────────────────────────────────────
  const servico = SERVICOS[action];
  if (!servico) {
    return Response.json({
      ok: false,
      error: `Ação desconhecida: "${action}". Use: auth, situacao-fiscal, cnd, caixa-postal, simples-nacional.`,
    }, { status: 400, headers: corsHeaders });
  }

  try {
    // 1. Carrega cert
    const { pfxBase64, pfxSenha } = await loadCertFromStorage();
    const { certPem, keyPem }     = extractPemFromPfx(pfxBase64, pfxSenha);

    // 2. Autentica
    const { accessToken, jwtToken } = await serproAuth(consumerKey, consumerSecret, certPem, keyPem);

    // 3. Chama serviço
    const dados = await serproServico(
      servico.endpoint,
      servico.idSistema,
      servico.idServico,
      servico.versao,
      cnpjContratante,
      cnpj,
      "{}",   // dados extras (específicos por serviço — expansível)
      accessToken,
      jwtToken,
      certPem,
      keyPem,
    );

    // 4. Salva cache
    await saveCache(tenantId, action, cnpj, dados).catch(() => { /* não bloqueia */ });

    return Response.json(
      { ok: true, data: dados },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.includes("NO_CREDENTIALS") ? "NO_CREDENTIALS"
               : msg.includes("AUTH") || msg.includes("401") ? "AUTH_FAILED"
               : "SERPRO_ERROR";
    return Response.json({ ok: false, error: msg, code }, { status: 200, headers: corsHeaders });
  }
});
