/**
 * POST /api/shipping/quote
 *
 * Body: { zip_to: string, items: [{weight_g, width_cm, height_cm, depth_cm, quantity}] }
 * Retorna cotações do Melhor Envio (Correios, Azul, J&T, Loggi, etc.)
 *
 * Secrets necessários (Cloudflare → Workers → flora-botanics → Settings → Variables):
 *   MELHOR_ENVIO_TOKEN         — access_token inicial (usado antes do primeiro refresh)
 *   MELHOR_ENVIO_REFRESH_TOKEN — refresh_token obtido no fluxo OAuth do Melhor Envio
 *   MELHOR_ENVIO_CLIENT_ID     — ID do app cadastrado no Melhor Envio
 *   MELHOR_ENVIO_CLIENT_SECRET — Secret do app cadastrado no Melhor Envio
 *   MELHOR_ENVIO_FROM_CEP      — CEP de origem (ex: "75900000")
 *   MELHOR_ENVIO_FROM_NAME     — Nome do remetente
 *   MELHOR_ENVIO_SANDBOX       — "true" para sandbox (omitir em produção)
 *
 * KV binding (wrangler.jsonc):
 *   ME_TOKEN_STORE — guarda access_token renovado e refresh_token rotacionado
 *   Após o primeiro refresh o token nunca mais precisa ser atualizado manualmente.
 */
import { NextRequest, NextResponse } from "next/server";

// ── tipos mínimos para o KV do Cloudflare (sem depender do pacote @cloudflare/workers-types) ──
interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// ── helpers de ambiente ────────────────────────────────────────────────────────────────────────

type CFEnv = Record<string, unknown>;

async function getCFEnv(): Promise<CFEnv | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return ctx.env as CFEnv;
  } catch {
    return null;
  }
}

function envVal(key: string, cfEnv: CFEnv | null): string | undefined {
  const v = cfEnv?.[key];
  if (typeof v === "string" && v) return v;
  return process.env[key];
}

function getKV(cfEnv: CFEnv | null): KVStore | null {
  const kv = cfEnv?.["ME_TOKEN_STORE"];
  if (kv && typeof (kv as KVStore).get === "function") return kv as KVStore;
  return null;
}

// ── token helpers ──────────────────────────────────────────────────────────────────────────────

/** Retorna o melhor access_token disponível: KV → env var */
async function getAccessToken(kv: KVStore | null, cfEnv: CFEnv | null): Promise<string | undefined> {
  if (kv) {
    const cached = await kv.get("access_token").catch(() => null);
    if (cached) return cached;
  }
  return envVal("MELHOR_ENVIO_TOKEN", cfEnv);
}

/**
 * Troca o refresh_token por um novo access_token via OAuth do Melhor Envio.
 * Salva ambos no KV para rotação automática futura.
 * Retorna o novo access_token ou null em caso de falha.
 */
async function refreshAccessToken(kv: KVStore | null, cfEnv: CFEnv | null): Promise<string | null> {
  const clientId     = envVal("MELHOR_ENVIO_CLIENT_ID",     cfEnv);
  const clientSecret = envVal("MELHOR_ENVIO_CLIENT_SECRET",  cfEnv);

  // Refresh token: KV tem prioridade (rotação), depois env var
  const refreshTk = kv
    ? ((await kv.get("refresh_token").catch(() => null)) ?? envVal("MELHOR_ENVIO_REFRESH_TOKEN", cfEnv))
    : envVal("MELHOR_ENVIO_REFRESH_TOKEN", cfEnv);

  if (!clientId || !clientSecret || !refreshTk) {
    console.error("[ME refresh] Faltam MELHOR_ENVIO_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN");
    return null;
  }

  const sandbox = envVal("MELHOR_ENVIO_SANDBOX", cfEnv) === "true";
  const oauthUrl = sandbox
    ? "https://sandbox.melhorenvio.com.br/oauth/token"
    : "https://www.melhorenvio.com.br/oauth/token";

  let res: Response;
  try {
    res = await fetch(oauthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshTk,
        scope:         "shipping-calculate",
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[ME refresh] Timeout/rede:", e);
    return null;
  }

  if (!res.ok) {
    console.error("[ME refresh] HTTP", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;

  if (!data?.access_token) {
    console.error("[ME refresh] Resposta sem access_token");
    return null;
  }

  // Persiste no KV: access_token com TTL (expires_in − 5 min), refresh_token sem TTL
  if (kv) {
    const ttl = Math.max((data.expires_in ?? 31_536_000) - 300, 60);
    await kv.put("access_token", data.access_token, { expirationTtl: ttl }).catch(console.error);
    if (data.refresh_token) {
      await kv.put("refresh_token", data.refresh_token).catch(console.error);
    }
  }

  return data.access_token;
}

// ── route ─────────────────────────────────────────────────────────────────────────────────────

const ME_API     = "https://www.melhorenvio.com.br/api/v2/me/shipment/calculate";
const ME_SANDBOX = "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate";

interface ShipItem {
  weight_g?: number;
  width_cm?: number;
  height_cm?: number;
  depth_cm?: number;
  quantity?: number;
}

interface QuoteRequest {
  zip_to: string;
  items: ShipItem[];
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const cfEnv   = await getCFEnv();
  const kv      = getKV(cfEnv);
  const fromCep = (envVal("MELHOR_ENVIO_FROM_CEP", cfEnv) ?? "").replace(/\D/g, "");
  const fromName = envVal("MELHOR_ENVIO_FROM_NAME", cfEnv) ?? "Flora Botanics";
  const sandbox  = envVal("MELHOR_ENVIO_SANDBOX", cfEnv) === "true";

  if (!fromCep) {
    return NextResponse.json(
      { ok: false, error: "Frete não configurado. Contate o suporte." },
      { status: 503, headers: corsHeaders() }
    );
  }

  const body = (await req.json().catch(() => null)) as QuoteRequest | null;
  const zipTo = (body?.zip_to ?? "").replace(/\D/g, "");
  if (zipTo.length !== 8) {
    return NextResponse.json(
      { ok: false, error: "CEP de destino inválido." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const items = (body?.items ?? []).filter((i) => (i.quantity ?? 1) > 0);
  if (items.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nenhum item para cotar." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const products = items.map((item) => ({
    id:              crypto.randomUUID(),
    width:           Math.max(item.width_cm  ?? 12, 1),
    height:          Math.max(item.height_cm ?? 6,  1),
    length:          Math.max(item.depth_cm  ?? 12, 1),
    weight:          Math.max((item.weight_g ?? 300) / 1000, 0.1),
    insurance_value: 0,
    quantity:        item.quantity ?? 1,
  }));

  const payload = {
    from:     { postal_code: fromCep },
    to:       { postal_code: zipTo },
    products,
    options:  { receipt: false, own_hand: false, reverse: false, non_commercial: true },
  };

  /** Faz a chamada à ME API com o token fornecido */
  async function callME(token: string) {
    return fetch(sandbox ? ME_SANDBOX : ME_API, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept:         "application/json",
        "User-Agent":   `${fromName} (contato@florabotanics.com.br)`,
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  }

  try {
    let token = await getAccessToken(kv, cfEnv);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Frete não configurado. Contate o suporte." },
        { status: 503, headers: corsHeaders() }
      );
    }

    let meRes = await callME(token);

    // Auto-refresh: token expirado → renova e repete uma vez
    if (meRes.status === 401 || meRes.status === 403) {
      const newToken = await refreshAccessToken(kv, cfEnv);
      if (newToken) {
        token = newToken;
        meRes = await callME(token);
      }
    }

    if (!meRes.ok) {
      const errText = await meRes.text().catch(() => "");

      if (meRes.status === 401 || meRes.status === 403) {
        return NextResponse.json(
          { ok: false, error: "Serviço de frete temporariamente indisponível. Tente novamente em instantes." },
          { status: 502, headers: corsHeaders() }
        );
      }

      let errorMsg = "Erro ao calcular frete. Tente novamente.";
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.errors) errorMsg = "Endereço de destino inválido. Verifique o CEP informado.";
      } catch { /* manter mensagem genérica */ }
      return NextResponse.json(
        { ok: false, error: errorMsg },
        { status: 502, headers: corsHeaders() }
      );
    }

    const rawQuotes = (await meRes.json()) as Array<{
      id: number;
      name: string;
      company: { name: string; picture: string };
      price: string;
      discount: string;
      delivery_time: number;
      delivery_range: { min: number; max: number };
      custom_delivery_range: { min: number; max: number };
      error?: string;
    }>;

    const quotes = rawQuotes
      .filter((q) => !q.error && q.price && parseFloat(q.price) > 0)
      .map((q) => ({
        service_id:    q.id,
        service_name:  q.name,
        carrier:       q.company?.name ?? "",
        carrier_logo:  q.company?.picture ?? "",
        price_cents:   Math.round(parseFloat(q.price) * 100),
        discount_cents: Math.round(parseFloat(q.discount ?? "0") * 100),
        days:          q.custom_delivery_range?.max ?? q.delivery_range?.max ?? q.delivery_time ?? 0,
        days_min:      q.custom_delivery_range?.min ?? q.delivery_range?.min ?? q.delivery_time ?? 0,
      }))
      .sort((a, b) => a.price_cents - b.price_cents);

    return NextResponse.json({ ok: true, quotes, zip_from: fromCep, zip_to: zipTo }, { headers: corsHeaders() });
  } catch (e) {
    console.error("[ME] Exceção:", e);
    return NextResponse.json(
      { ok: false, error: "Serviço de frete temporariamente indisponível." },
      { status: 503, headers: corsHeaders() }
    );
  }
}
