/**
 * GET /api/shipping/test
 * Rota temporária de diagnóstico — retorna o status exato da autenticação Melhor Envio.
 * REMOVER após confirmar que o frete funciona.
 */
import { NextResponse } from "next/server";

async function getEnv(key: string): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const val = (env as Record<string, string | undefined>)[key];
    if (val !== undefined) return val;
  } catch { /* local */ }
  return process.env[key];
}

export async function GET() {
  const token    = await getEnv("MELHOR_ENVIO_TOKEN");
  const fromCep  = await getEnv("MELHOR_ENVIO_FROM_CEP");
  const sandbox  = (await getEnv("MELHOR_ENVIO_SANDBOX")) === "true";
  const clientId = await getEnv("MELHOR_ENVIO_CLIENT_ID");
  const hasRefresh = !!(await getEnv("MELHOR_ENVIO_REFRESH_TOKEN"));

  const info = {
    token_set:       !!token,
    token_prefix:    token ? token.slice(0, 6) + "…" : null,
    token_length:    token?.length ?? 0,
    from_cep_set:    !!fromCep,
    from_cep_value:  fromCep ? fromCep.replace(/\D/g, "").slice(0, 5) + "…" : null,
    sandbox:         sandbox,
    client_id:       clientId ?? null,
    has_refresh_token: hasRefresh,
  };

  if (!token) {
    return NextResponse.json({ ok: false, info, error: "MELHOR_ENVIO_TOKEN não definido" });
  }

  const url = sandbox
    ? "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/companies"
    : "https://www.melhorenvio.com.br/api/v2/me/shipment/companies";

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "Flora Botanics (contato@florabotanics.com.br)",
      },
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text().catch(() => "");
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      info,
      me_response: body.slice(0, 300),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, info, error: String(e) });
  }
}
