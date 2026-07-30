/**
 * Edge Function: sefaz-nfe
 *
 * Proxy SOAP para o webservice do SEFAZ (NFeAutorizacao4) com mTLS.
 *
 * Razão de existir: Cloudflare Workers não suporta mTLS nem tem a CA
 * ICP-Brasil no trust store. O Deno permite Deno.createHttpClient() com
 * certificado de cliente para o handshake mTLS exigido pelo SEFAZ.
 *
 * Input (POST JSON):
 *   {
 *     url:       string,   // endpoint SEFAZ
 *     soapBody:  string,   // envelope SOAP já assinado
 *     soapAction:string,   // SOAPAction header
 *     pfxBase64: string,   // certificado A1 em base64
 *     pfxSenha:  string,   // senha do .pfx
 *   }
 *
 * Output:
 *   { ok: true,  xmlResponse: string }
 *   { ok: false, error: string, status?: number }
 *
 * Deploy:
 *   supabase functions deploy sefaz-nfe --project-ref mbpvzhcrimdwcqkqvoqr --no-verify-jwt
 */

// @ts-ignore — npm: imports em Deno
import forge from "npm:node-forge@1.3.1";

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
  ".svrs.rs.gov.br",
  ".nfe.svrs.rs.gov.br",
  ".nfe.fazenda.gov.br",
];

function isAllowedSefazUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return SEFAZ_DOMAINS.some((d) => u.hostname.endsWith(d) || u.hostname === d.slice(1));
  } catch {
    return false;
  }
}

/**
 * Extrai certChain (PEM) e privateKey (PEM) de um PKCS#12 base64.
 * Necessário para mTLS com Deno.createHttpClient().
 */
function extractPemFromPfx(
  pfxBase64: string,
  password: string
): { certChain: string; privateKey: string } {
  const cleanB64 = pfxBase64
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/[\s\r\n\t]/g, "");

  const pfxBytes = forge.util.decode64(cleanB64);

  // parseAllBytes:false necessário em node-forge v1.3+ para evitar erro de "unparsed bytes"
  const pfxAsn1 = forge.asn1.fromDer(pfxBytes, {
    strict: false,
    parseAllBytes: false,
  } as unknown as boolean);

  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

  // Certificados
  const certBags =
    pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certChain = certBags
    .map((b: { cert?: forge.pki.Certificate }) => {
      if (!b.cert) return "";
      return forge.pki.certificateToPem(b.cert);
    })
    .filter(Boolean)
    .join("");

  // Chave privada (pkcs8ShroudedKeyBag → keyBag)
  const shroudedBags =
    pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];
  const rawKeyBags =
    pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];

  const keyEntry =
    shroudedBags[0] ?? rawKeyBags[0];

  if (!keyEntry?.key) {
    throw new Error("Certificado A1: chave privada não encontrada no PKCS#12.");
  }

  const privateKey = forge.pki.privateKeyToPem(keyEntry.key);

  return { certChain, privateKey };
}

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
    return Response.json({ ok: false, error: "Método não permitido." }, { status: 405 });
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
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
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
      { ok: false, error: `URL não permitida: ${url}. Deve ser endpoint SEFAZ gov.br.` },
      { status: 403 }
    );
  }

  try {
    // Cria cliente HTTP com mTLS se o certificado foi enviado
    // (SEFAZ exige apresentação do certificado no handshake TLS)
    let fetchOptions: RequestInit & { client?: Deno.HttpClient } = {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": soapAction,
      },
      body: soapBody,
    };

    let httpClient: Deno.HttpClient | undefined;

    if (pfxBase64 && pfxSenha) {
      try {
        const { certChain, privateKey } = extractPemFromPfx(pfxBase64, pfxSenha);
        httpClient = Deno.createHttpClient({
          certChain,
          privateKey,
          // Permite CAs gov.br / ICP-Brasil não presentes no bundle padrão
          caCerts: [],
        });
        fetchOptions = { ...fetchOptions, client: httpClient };
      } catch (certErr) {
        const certMsg = certErr instanceof Error ? certErr.message : String(certErr);
        return Response.json(
          { ok: false, error: `Falha ao processar certificado A1: ${certMsg}` },
          { status: 200 }
        );
      }
    }

    const response = await fetch(url, fetchOptions);

    // Libera o cliente HTTP após uso
    httpClient?.close();

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return Response.json(
        {
          ok: false,
          error: `SEFAZ retornou HTTP ${response.status}: ${response.statusText || "(sem mensagem)"}`,
          status: response.status,
          detail: text.slice(0, 500),
        },
        { status: 200 }
      );
    }

    const xmlResponse = await response.text();

    return Response.json(
      { ok: true, xmlResponse },
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
