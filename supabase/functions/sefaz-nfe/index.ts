/**
 * Edge Function: sefaz-nfe
 *
 * Proxy SOAP para o webservice do SEFAZ (NFeAutorizacao4).
 *
 * Razão de existir: Cloudflare Workers não consegue abrir TLS com servidores
 * SEFAZ estaduais (CA ICP-Brasil / SERPRO não está no trust store do CF).
 * O Deno runtime no Supabase Edge Functions tem suporte TLS mais amplo e
 * alcança esses endpoints corretamente.
 *
 * Input (POST JSON):
 *   { url: string, soapBody: string, soapAction: string }
 *
 * Output:
 *   { ok: true,  xmlResponse: string }
 *   { ok: false, error: string, status?: number }
 *
 * Deploy:
 *   supabase functions deploy sefaz-nfe --project-ref mbpvzhcrimdwcqkqvoqr --no-verify-jwt
 */

const SEFAZ_DOMAINS = [
  ".sefaz.am.gov.br",
  ".sefaz.ba.gov.br",
  ".sefaz.ce.gov.br",
  ".sefaz.go.gov.br",
  ".sefaz.ms.gov.br",
  ".sefaz.mt.gov.br",
  ".sefaz.pe.gov.br",
  ".sefaz.rs.gov.br",
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

  let body: { url?: string; soapBody?: string; soapAction?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const { url, soapBody, soapAction } = body;

  if (!url || !soapBody || !soapAction) {
    return Response.json(
      { ok: false, error: "Campos obrigatórios: url, soapBody, soapAction." },
      { status: 400 }
    );
  }

  if (!isAllowedSefazUrl(url)) {
    return Response.json(
      { ok: false, error: `URL não permitida: ${url}. Deve ser um endpoint SEFAZ gov.br.` },
      { status: 403 }
    );
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": soapAction,
      },
      body: soapBody,
      // Deno: sem opção de timeout nativa no fetch, mas a plataforma tem timeout de 60s
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return Response.json(
        {
          ok: false,
          error: `SEFAZ retornou HTTP ${response.status}: ${response.statusText || "(sem mensagem)"}`,
          status: response.status,
          detail: text.slice(0, 500),
        },
        { status: 200 } // retorna 200 para o caller processar o erro SEFAZ
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
