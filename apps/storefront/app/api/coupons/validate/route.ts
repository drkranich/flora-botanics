import { NextRequest, NextResponse } from "next/server";
import { currentTenant, db } from "@/lib/tenant";

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().slice(0, 40);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body.code);
    const subtotalCents = Math.max(0, Math.round(Number(body.subtotal_cents) || 0));

    if (!code) {
      return NextResponse.json({ ok: false, error: "Informe um cupom." }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();
    const { data, error } = await client.rpc("validate_storefront_coupon", {
      p_tenant_id: tenant.tenantId,
      p_code: code,
      p_subtotal_cents: subtotalCents,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const result = data as
      | {
          ok?: boolean;
          error?: string;
          code?: string;
          discount_cents?: number;
          free_shipping?: boolean;
        }
      | null;

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error ?? "Cupom inválido." },
        { status: 409 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
