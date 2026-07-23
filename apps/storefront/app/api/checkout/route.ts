import { NextRequest, NextResponse } from "next/server";
import { currentTenant, db } from "@/lib/tenant";

interface CheckoutPayload {
  session_id?: string;
  coupon_code?: string;
  notes?: string;
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
    accepts_marketing?: boolean;
  };
  shipping_address?: {
    recipient?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as CheckoutPayload;
    const sessionId = String(body.session_id ?? "").trim();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Sessao do carrinho invalida." }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();

    const { data, error } = await client.rpc("create_storefront_order", {
      p_tenant_id: tenant.tenantId,
      p_session_id: sessionId,
      p_customer_email: String(body.customer?.email ?? ""),
      p_customer_name: body.customer?.name ?? null,
      p_customer_phone: body.customer?.phone ?? null,
      p_accepts_marketing: Boolean(body.customer?.accepts_marketing),
      p_shipping_address: body.shipping_address ?? {},
      p_coupon_code: body.coupon_code ?? null,
      p_notes: body.notes ?? null,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const result = data as
      | {
          ok?: boolean;
          error?: string;
          order_id?: string;
          order_number?: number;
          subtotal_cents?: number;
          discount_cents?: number;
          shipping_cents?: number;
          total_cents?: number;
          currency?: string;
        }
      | null;

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error ?? "Nao foi possivel criar o pedido." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
