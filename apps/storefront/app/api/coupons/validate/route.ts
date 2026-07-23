import { NextRequest, NextResponse } from "next/server";
import { currentTenant, db } from "@/lib/tenant";

interface CouponRow {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number | string;
  min_subtotal_cents: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().slice(0, 40);
}

function isCouponActive(coupon: CouponRow, now: Date) {
  if (coupon.status !== "active") return false;
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return false;
  if (coupon.ends_at && new Date(coupon.ends_at) < now) return false;
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) return false;
  return true;
}

function discountFor(coupon: CouponRow, subtotalCents: number) {
  if (coupon.type === "free_shipping") return { discount_cents: 0, free_shipping: true };

  const value = Number(coupon.value) || 0;
  const discount =
    coupon.type === "percent"
      ? Math.round(subtotalCents * Math.min(Math.max(value, 0), 100) / 100)
      : Math.round(value * 100);

  return {
    discount_cents: Math.min(Math.max(discount, 0), subtotalCents),
    free_shipping: false,
  };
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
    const { data, error } = await client
      .from("coupons")
      .select("code, type, value, min_subtotal_cents, max_uses, used_count, starts_at, ends_at, status")
      .eq("tenant_id", tenant.tenantId)
      .eq("code", code)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "Cupom não encontrado." }, { status: 404 });

    const coupon = data as CouponRow;
    if (!isCouponActive(coupon, new Date())) {
      return NextResponse.json({ ok: false, error: "Cupom indisponível." }, { status: 409 });
    }

    if (coupon.min_subtotal_cents !== null && subtotalCents < coupon.min_subtotal_cents) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cupom válido para compras acima de ${(coupon.min_subtotal_cents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      code: coupon.code,
      ...discountFor(coupon, subtotalCents),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
