"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Pedidos da cliente logada.
 * Ao montar: claim_my_customer() vincula o login aos registros de compra
 * (criados pelo checkout via e-mail) e o RLS libera os próprios pedidos.
 */

type OrderRow = {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  created_at: string;
  order_items: Array<{ quantity: number; product_snapshot: { name?: string } | null }>;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  processing: "Em separação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MyOrders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      await supabase.rpc("claim_my_customer"); // vincula compras feitas com este e-mail
      const { data } = await supabase
        .from("orders")
        .select("id, number, status, total_cents, created_at, order_items(quantity, product_snapshot)")
        .order("created_at", { ascending: false })
        .limit(20);
      setOrders((data ?? []) as OrderRow[]);
    })();
  }, []);

  if (orders === null) {
    return <p style={{ fontSize: 13, color: "var(--muted)" }}>Carregando seus pedidos…</p>;
  }

  if (orders.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
        Você ainda não tem pedidos. Quando comprar, eles aparecem aqui — com
        status de pagamento, separação e envio.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {orders.map((o) => (
        <div
          key={o.id}
          style={{
            background: "rgba(255, 248, 234, 0.6)",
            border: "1px solid rgba(150, 118, 63, 0.15)",
            borderRadius: 16,
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Pedido #{o.number}</strong>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#6d4d2d" }}>
              {STATUS_LABEL[o.status] ?? o.status}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            {(o.order_items ?? [])
              .map((it) => `${it.quantity}× ${it.product_snapshot?.name ?? "item"}`)
              .join(" · ")}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
            <span style={{ color: "var(--muted)" }}>
              {new Date(o.created_at).toLocaleDateString("pt-BR")}
            </span>
            <strong style={{ color: "#6d4d2d" }}>{money(o.total_cents)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
