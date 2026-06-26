"use client";

import { useState, useTransition } from "react";
import { sendCartRecovery, dismissCart } from "@/lib/carts/actions";

export function RecoveryButton({ cartId, hasEmail }: { cartId: string; hasEmail: boolean }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (msg) {
    return (
      <span style={{ fontSize: 11, color: msg.ok ? "var(--gold-light)" : "#f87171" }}>
        {msg.text}
      </span>
    );
  }

  return (
    <button
      disabled={!hasEmail || pending}
      onClick={() => {
        startTransition(async () => {
          const res = await sendCartRecovery(cartId);
          setMsg({ ok: res.ok, text: res.message });
        });
      }}
      className="btn btn-ghost"
      style={{ padding: "6px 12px", fontSize: 10, opacity: hasEmail ? 1 : 0.4 }}
      title={hasEmail ? "Enviar e-mail de recuperação" : "Sem e-mail capturado"}
    >
      {pending ? "…" : "✉ Enviar"}
    </button>
  );
}

export function DismissButton({ cartId }: { cartId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return <span className="muted" style={{ fontSize: 10 }}>Ignorado</span>;

  return (
    <button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await dismissCart(cartId);
          setDone(true);
        });
      }}
      className="btn btn-ghost"
      style={{ padding: "6px 10px", fontSize: 10, opacity: 0.5 }}
      title="Ignorar este carrinho"
    >
      {pending ? "…" : "✕"}
    </button>
  );
}
