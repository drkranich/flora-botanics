/**
 * API de carrinho do storefront.
 *
 * GET  /api/cart?session_id=xxx&tenant_id=yyy  → retorna o carrinho ativo
 * POST /api/cart                                → cria ou atualiza o carrinho
 *
 * O session_id é gerado no cliente (UUID v4) e persistido em localStorage.
 * Quando o cliente fornece o e-mail (ex: campo de newsletter ou checkout),
 * o storefront faz um POST com customer_email para habilitar o remarketing.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, currentTenant } from "@/lib/tenant";

export const runtime = "edge";

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id obrigatório" }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();

    const { data, error } = await client
      .from("carts")
      .select("id, items, subtotal_cents, status, last_activity_at")
      .eq("tenant_id", tenant.tenantId)
      .eq("session_id", sessionId)
      .eq("status", "active")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cart: data ?? null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      session_id,
      customer_email,
      customer_name,
      items = [],
      subtotal_cents = 0,
    } = body as {
      session_id: string;
      customer_email?: string;
      customer_name?: string;
      items: Array<{
        product_id: string;
        variant_id?: string;
        name: string;
        slug?: string;
        image?: string;
        price_cents: number;
        quantity: number;
      }>;
      subtotal_cents: number;
    };

    if (!session_id) {
      return NextResponse.json({ error: "session_id obrigatório" }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();
    const now = new Date().toISOString();

    // Busca carrinho ativo existente para esta sessão
    const { data: existing } = await client
      .from("carts")
      .select("id, customer_email, customer_name")
      .eq("tenant_id", tenant.tenantId)
      .eq("session_id", session_id)
      .eq("status", "active")
      .maybeSingle();

    const payload = {
      tenant_id: tenant.tenantId,
      session_id,
      // Preserva e-mail/nome já capturado; atualiza se novo valor fornecido
      customer_email: customer_email || existing?.customer_email || null,
      customer_name: customer_name || existing?.customer_name || null,
      items,
      subtotal_cents,
      status: "active",
      last_activity_at: now,
    };

    let cartId: string;

    if (existing) {
      // Atualiza carrinho existente
      const { error } = await client
        .from("carts")
        .update(payload)
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      cartId = existing.id;
    } else {
      // Cria novo carrinho
      const { data, error } = await client
        .from("carts")
        .insert(payload)
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      cartId = data.id;
    }

    return NextResponse.json({ ok: true, cart_id: cartId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
