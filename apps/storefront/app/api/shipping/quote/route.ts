/**
 * POST /api/shipping/quote
 *
 * Body: { zip_to: string, items: [{weight_g, width_cm, height_cm, depth_cm, quantity}] }
 * Retorna cotações do Melhor Envio (Correios, Azul, J&T, Loggi, etc.)
 *
 * Vars necessárias (Cloudflare Secrets / .dev.vars):
 *   MELHOR_ENVIO_TOKEN    — Bearer token da conta Melhor Envio
 *   MELHOR_ENVIO_FROM_CEP — CEP de origem do remetente (ex: "75900000")
 *   MELHOR_ENVIO_FROM_NAME — Nome do remetente
 *   MELHOR_ENVIO_SANDBOX  — "true" para usar o sandbox do Melhor Envio
 */
import { NextRequest, NextResponse } from "next/server";

/** Lê variável de ambiente via Cloudflare Workers context (com fallback para process.env) */
async function getEnv(key: string): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const val = (env as Record<string, string | undefined>)[key];
    if (val !== undefined) return val;
  } catch {
    // fora do ambiente CF Workers (dev local)
  }
  return process.env[key];
}

const ME_API = "https://www.melhorenvio.com.br/api/v2/me/shipment/calculate";
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
  const token   = await getEnv("MELHOR_ENVIO_TOKEN");
  const fromCep = ((await getEnv("MELHOR_ENVIO_FROM_CEP")) ?? "").replace(/\D/g, "");
  const fromName = (await getEnv("MELHOR_ENVIO_FROM_NAME")) ?? "Flora Botanics";
  const sandbox  = (await getEnv("MELHOR_ENVIO_SANDBOX")) === "true";

  if (!token || !fromCep) {
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

  // Melhor Envio: usar APENAS products (não misturar com package)
  const products = items.map((item) => ({
    id: crypto.randomUUID(),
    width:  Math.max(item.width_cm  ?? 12, 1),
    height: Math.max(item.height_cm ?? 6,  1),
    length: Math.max(item.depth_cm  ?? 12, 1),
    weight: Math.max((item.weight_g ?? 300) / 1000, 0.1), // kg
    insurance_value: 0,
    quantity: item.quantity ?? 1,
  }));

  // services omitido = todos os serviços; invoice omitido = sem nota
  const payload = {
    from: { postal_code: fromCep },
    to:   { postal_code: zipTo },
    products,
    options: {
      receipt:        false,
      own_hand:       false,
      reverse:        false,
      non_commercial: true,
    },
  };

  try {
    const meRes = await fetch(sandbox ? ME_SANDBOX : ME_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": `${fromName} (contato@florabotanics.com.br)`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!meRes.ok) {
      const errText = await meRes.text().catch(() => "");
      console.error("Melhor Envio error:", meRes.status, errText);
      // Devolve o detalhe para facilitar debug em produção
      let errorMsg = "Erro ao calcular frete. Tente novamente.";
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.message) errorMsg = errJson.message;
        else if (typeof errJson === "string") errorMsg = errJson;
      } catch { /* manter mensagem genérica */ }
      return NextResponse.json(
        { ok: false, error: errorMsg, detail: errText.slice(0, 300), status: meRes.status },
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
        service_id: q.id,
        service_name: q.name,
        carrier: q.company?.name ?? "",
        carrier_logo: q.company?.picture ?? "",
        price_cents: Math.round(parseFloat(q.price) * 100),
        discount_cents: Math.round(parseFloat(q.discount ?? "0") * 100),
        days: q.custom_delivery_range?.max ?? q.delivery_range?.max ?? q.delivery_time ?? 0,
        days_min: q.custom_delivery_range?.min ?? q.delivery_range?.min ?? q.delivery_time ?? 0,
      }))
      .sort((a, b) => a.price_cents - b.price_cents);

    return NextResponse.json({ ok: true, quotes, zip_from: fromCep, zip_to: zipTo }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Shipping quote error:", e);
    return NextResponse.json(
      { ok: false, error: "Serviço de frete temporariamente indisponível." },
      { status: 503, headers: corsHeaders() }
    );
  }
}
