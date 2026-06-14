"use client";

import { useState, useTransition } from "react";
import { transitionOrder } from "@/lib/sales/actions";

const NEXT: Record<string, string[]> = {
  pending: ["paid", "canceled"],
  paid: ["processing", "canceled", "refunded"],
  processing: ["shipped", "canceled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  canceled: [],
  refunded: [],
};

const DANGER = new Set(["canceled", "refunded"]);

export function TransitionBar({
  orderId,
  status,
  statusLabel,
}: {
  orderId: string;
  status: string;
  statusLabel: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const options = NEXT[status] ?? [];

  if (options.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>
        Pedido em estado final — nenhuma ação disponível.
      </p>
    );
  }

  function go(to: string) {
    if (DANGER.has(to) && !confirm(`Confirmar: marcar como "${statusLabel[to]}"?`)) return;
    setMsg(null);
    startTransition(async () => {
      try {
        await transitionOrder(orderId, to);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <footer
      className="glass"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 22,
        width: "min(640px, calc(100vw - 40px))",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        padding: "14px 22px",
        borderRadius: 999,
        background: "rgba(15, 32, 18, 0.78)",
        zIndex: 50,
      }}
    >
      <p style={{ fontSize: 11.5, margin: 0, color: "var(--cream-soft)" }}>
        {msg ?? "Mover pedido para:"}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((to) => (
          <button
            key={to}
            onClick={() => go(to)}
            disabled={pending}
            className={DANGER.has(to) ? "btn btn-ghost" : "btn btn-gold"}
            style={{
              padding: "10px 18px",
              fontSize: 10,
              ...(DANGER.has(to) ? { color: "#e8a0a0", borderColor: "rgba(232,160,160,0.4)" } : {}),
            }}
          >
            {pending ? "…" : statusLabel[to]}
          </button>
        ))}
      </div>
    </footer>
  );
}
