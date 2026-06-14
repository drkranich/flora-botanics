"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { transitionOrder } from "@/lib/sales/actions";
import { STATUS_LABEL } from "@/app/vendas/Tabs";

/** Máquina de estados do pedido (blueprint seção 6.4) — espelha lib/sales/actions.ts */
const TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "canceled"],
  paid: ["processing", "canceled", "refunded"],
  processing: ["shipped", "canceled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  canceled: [],
  refunded: [],
};

const DANGER = new Set(["canceled", "refunded"]);

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = TRANSITIONS[status] ?? [];

  function go(to: string) {
    if (DANGER.has(to) && !confirm(`Confirmar: marcar pedido como "${STATUS_LABEL[to]}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await transitionOrder(orderId, to);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Link href={`/vendas/${orderId}`} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 10 }}>
          Detalhes
        </Link>
        {options.map((to) => (
          <button
            key={to}
            onClick={() => go(to)}
            disabled={pending}
            className={DANGER.has(to) ? "btn btn-ghost" : "btn btn-gold"}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              ...(DANGER.has(to) ? { color: "#e8a0a0", borderColor: "rgba(232,160,160,0.4)" } : {}),
            }}
          >
            {pending ? "…" : STATUS_LABEL[to]}
          </button>
        ))}
      </div>
      {error ? <span style={{ fontSize: 11, color: "#e8a0a0" }}>{error}</span> : null}
    </div>
  );
}
