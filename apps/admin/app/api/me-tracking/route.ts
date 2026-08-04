/**
 * POST /api/me-tracking
 *
 * Proxy para a API de rastreamento do Melhor Envio.
 * Body: { tracking_code: string }
 * Retorna os eventos de rastreamento reais da transportadora.
 *
 * Token: usa MELHOR_ENVIO_TOKEN do env (mesmo JWT pessoal configurado no Cloudflare).
 * Precisa do scope "ecommerce-shipping" ou "shipping-tracking" no token.
 */
import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";

const ME_TRACKING_URL = "https://www.melhorenvio.com.br/api/v2/me/shipment/tracking";

export async function POST(req: NextRequest) {
  // Só staff autenticado pode consultar
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { tracking_code?: string } | null;
  const code = body?.tracking_code?.trim();

  if (!code) {
    return NextResponse.json({ ok: false, error: "Código de rastreio obrigatório." }, { status: 400 });
  }

  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token Melhor Envio não configurado no ambiente do admin." },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${ME_TRACKING_URL}/${encodeURIComponent(code)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "Florabotanics/1.0 (contato@florabotanics.com.br)",
      },
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      let errMsg = `Erro ${res.status} da API Melhor Envio.`;
      try {
        const errJson = JSON.parse(text);
        errMsg = errJson?.message ?? errJson?.error ?? errMsg;
      } catch { /* usa mensagem genérica */ }
      return NextResponse.json({ ok: false, error: errMsg }, { status: 502 });
    }

    // Verifica se retornou HTML em vez de JSON
    if (text.trimStart().startsWith("<")) {
      return NextResponse.json(
        { ok: false, error: "Token Melhor Envio inválido ou expirado. Gere um novo token em melhorenvio.com.br → Tokens." },
        { status: 401 }
      );
    }

    const data = JSON.parse(text);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Falha ao consultar Melhor Envio: ${msg}` },
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }
}
