import { NextRequest, NextResponse } from "next/server";
import { currentTenant, db } from "@/lib/tenant";

interface IncomingCartItem {
  product_id: string;
  variant_id?: string;
  image?: string;
  quantity: number;
}

interface ProductJoin {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
}

interface VariantRow {
  id: string;
  product_id: string;
  price_cents: number;
  products: ProductJoin | ProductJoin[] | null;
}

interface NormalizedCartItem {
  product_id: string;
  variant_id: string;
  name: string;
  slug: string;
  image?: string;
  price_cents: number;
  quantity: number;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function subtotal(items: NormalizedCartItem[]) {
  return items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
}

async function normalizeItems(
  client: ReturnType<typeof db>,
  tenantId: string,
  incoming: IncomingCartItem[]
): Promise<NormalizedCartItem[]> {
  const byVariant = new Map<string, { quantity: number; image?: string }>();

  for (const item of incoming) {
    if (!item.variant_id) continue;
    const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    const current = byVariant.get(item.variant_id);
    byVariant.set(item.variant_id, {
      quantity: Math.min(99, (current?.quantity ?? 0) + quantity),
      image: current?.image ?? item.image,
    });
  }

  const variantIds = Array.from(byVariant.keys());
  if (variantIds.length === 0) return [];

  const { data, error } = await client
    .from("product_variants")
    .select("id, product_id, price_cents, products!inner(id, name, slug, status, deleted_at)")
    .eq("tenant_id", tenantId)
    .in("id", variantIds);

  if (error) throw new Error(error.message);

  const variants = (data ?? []) as unknown as VariantRow[];

  const normalized: NormalizedCartItem[] = [];

  for (const id of variantIds) {
      const variant = variants.find((item) => item.id === id);
    if (!variant) continue;

      const product = first(variant.products);
    if (!product || product.status !== "published" || product.deleted_at) continue;

      const local = byVariant.get(id);
    if (!local) continue;

    normalized.push({
        product_id: product.id,
        variant_id: variant.id,
        name: product.name,
        slug: product.slug,
        image: local.image,
        price_cents: variant.price_cents,
        quantity: local.quantity,
    });
  }

  return normalized;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id é obrigatório" }, { status: 400 });
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      session_id,
      customer_email,
      customer_name,
      items = [],
    } = body as {
      session_id: string;
      customer_email?: string;
      customer_name?: string;
      items: IncomingCartItem[];
    };

    if (!session_id) {
      return NextResponse.json({ error: "session_id é obrigatório" }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();
    const now = new Date().toISOString();
    const normalizedItems = await normalizeItems(client, tenant.tenantId, items);
    const serverSubtotal = subtotal(normalizedItems);

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
      customer_email: customer_email || existing?.customer_email || null,
      customer_name: customer_name || existing?.customer_name || null,
      items: normalizedItems,
      subtotal_cents: serverSubtotal,
      status: "active",
      last_activity_at: now,
    };

    let cartId: string;

    if (existing) {
      const { error } = await client.from("carts").update(payload).eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      cartId = existing.id;
    } else {
      const { data, error } = await client.from("carts").insert(payload).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      cartId = data.id;
    }

    return NextResponse.json({
      ok: true,
      cart_id: cartId,
      items: normalizedItems,
      subtotal_cents: serverSubtotal,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
