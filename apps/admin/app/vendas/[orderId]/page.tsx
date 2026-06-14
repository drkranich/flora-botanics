import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { StatusChip, STATUS_LABEL } from "../Tabs";
import { money } from "@/lib/format";
import { TransitionBar } from "./TransitionBar";

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const { orderId } = await params;
  const supabase = await supabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, number, status, subtotal_cents, discount_cents, shipping_cents, total_cents, currency, shipping_address, notes, created_at, customers(email, full_name, phone)"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_snapshot, quantity, unit_price_cents, total_cents")
    .eq("order_id", orderId);

  const customer = order.customers as unknown as {
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  const addr = order.shipping_address as Record<string, string> | null;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 28px 140px" }}>
      <header className="rise" style={{ marginBottom: 28 }}>
        <Link href="/vendas" className="eyebrow" style={{ opacity: 0.8 }}>← Pedidos</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
          <h1 className="display" style={{ fontSize: 42 }}>Pedido #{order.number}</h1>
          <StatusChip status={order.status} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {new Date(order.created_at).toLocaleString("pt-BR")}
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="glass rise rise-1" style={{ padding: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Cliente</p>
          <p style={{ fontSize: 14 }}>{customer?.full_name ?? "—"}</p>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{customer?.email}</p>
          {customer?.phone ? (
            <p className="muted" style={{ fontSize: 12 }}>{customer.phone}</p>
          ) : null}
        </div>
        <div className="glass rise rise-2" style={{ padding: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Entrega</p>
          {addr ? (
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
              {addr.recipient}<br />
              {addr.street}, {addr.number} {addr.complement}<br />
              {addr.district} — {addr.city}/{addr.state}<br />
              CEP {addr.zip}
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>Sem endereço registrado.</p>
          )}
        </div>
      </div>

      <div className="glass rise rise-3" style={{ padding: 22, marginBottom: 16 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Itens</p>
        {(items ?? []).map((it) => {
          const snap = it.product_snapshot as { name?: string; sku?: string };
          return (
            <div
              key={it.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid var(--glass-border)",
                fontSize: 13,
              }}
            >
              <span>
                {it.quantity}× {snap?.name ?? "Item"}{" "}
                <span className="muted" style={{ fontSize: 11 }}>{snap?.sku}</span>
              </span>
              <span>{money(it.total_cents, order.currency)}</span>
            </div>
          );
        })}
        <div style={{ fontSize: 13, paddingTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <Row label="Subtotal" value={money(order.subtotal_cents, order.currency)} />
          {order.discount_cents > 0 ? (
            <Row label="Desconto" value={`− ${money(order.discount_cents, order.currency)}`} />
          ) : null}
          <Row label="Frete" value={money(order.shipping_cents, order.currency)} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, paddingTop: 6 }}>
            <span>Total</span>
            <span style={{ color: "var(--gold-light)" }}>{money(order.total_cents, order.currency)}</span>
          </div>
        </div>
      </div>

      {order.notes ? (
        <div className="glass rise rise-4" style={{ padding: 22, marginBottom: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Observações</p>
          <p className="muted" style={{ fontSize: 12.5 }}>{order.notes}</p>
        </div>
      ) : null}

      <TransitionBar orderId={order.id} status={order.status} statusLabel={STATUS_LABEL} />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
