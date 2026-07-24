import { NextRequest, NextResponse } from "next/server";
import { currentTenant, db } from "@/lib/tenant";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { orderNumber, email } = await req.json() as { orderNumber: string; email: string };
    if (!orderNumber || !email) {
      return NextResponse.json({ error: "Informe o número do pedido e o e-mail." }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();

    // Busca o pedido pelo número + e-mail do cliente (verificação pública)
    const { data: order } = await client
      .from("orders")
      .select("id, number, status, created_at, shipping_address, customers(email, full_name)")
      .eq("tenant_id", tenant.tenantId)
      .eq("number", String(orderNumber).trim())
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const customer = (Array.isArray(order.customers) ? order.customers[0] : order.customers) as
      | { email: string; full_name: string | null }
      | null;

    if (!customer || customer.email.toLowerCase() !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: "E-mail não confere com o pedido." }, { status: 403 });
    }

    // Busca eventos de rastreamento
    const { data: events } = await client
      .from("shipping_events")
      .select("id, status, city, state, description, carrier, tracking_code, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const addr = order.shipping_address as Record<string, string> | null;

    return NextResponse.json({
      order: {
        number: order.number,
        status: order.status,
        created_at: order.created_at,
        recipient: addr?.recipient ?? customer.full_name ?? "",
        city: addr?.city ?? "",
        state: addr?.state ?? "",
      },
      events: events ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
