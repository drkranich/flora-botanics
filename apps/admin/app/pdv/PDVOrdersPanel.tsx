"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { cancelOrderWithReason } from "@/app/vendas/[orderId]/order-actions";
import { getPDVOrdersToday, type PDVOrderRow } from "./pdv-report-actions";

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = {
  processing: "Processando",
  pending:    "Pendente",
  paid:       "Pago",
  canceled:   "Cancelado",
  completed:  "Concluído",
};

const STATUS_COLOR: Record<string, string> = {
  processing: "#4ade80",
  pending:    "var(--gold-light)",
  paid:       "#4ade80",
  canceled:   "#e8a0a0",
  completed:  "#4ade80",
};

export function PDVOrdersPanel() {
  const [orders, setOrders] = useState<PDVOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<PDVOrderRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelErr, setCancelErr] = useState("");
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    getPDVOrdersToday().then((rows) => {
      setOrders(rows);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  }

  function openCancel(order: PDVOrderRow) {
    setCancelTarget(order);
    setCancelReason("");
    setCancelErr("");
  }

  function handleCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { setCancelErr("Informe o motivo."); return; }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reason", cancelReason.trim());
      const res = await cancelOrderWithReason(cancelTarget.id, fd);
      if (res.ok) {
        setOrders((prev) => prev.map((o) => o.id === cancelTarget.id ? { ...o, status: "canceled" } : o));
        setCancelTarget(null);
        flash(`Pedido #${cancelTarget.number} cancelado.`);
      } else {
        setCancelErr(res.error);
      }
    });
  }

  const totalHoje = orders.filter((o) => o.status !== "canceled")
    .reduce((s, o) => s + o.total_cents, 0);
  const vendasHoje = orders.filter((o) => o.status !== "canceled").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>

      {/* Resumo do dia */}
      <div style={{
        display: "flex", gap: 16, padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}>
        <div>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "var(--cream-dim)", opacity: 0.6 }}>Vendas hoje</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--cream)", lineHeight: 1.3 }}>{vendasHoje}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "var(--cream-dim)", opacity: 0.6 }}>Total</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", lineHeight: 1.3 }}>{fmt(totalHoje)}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <button
            onClick={reload}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "var(--cream-dim)", cursor: "pointer", fontSize: 12,
              padding: "5px 12px",
            }}
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* Feedback */}
      {successMsg && (
        <div style={{ padding: "8px 14px", background: "rgba(74,222,128,0.08)", borderBottom: "1px solid rgba(74,222,128,0.2)", fontSize: 12, color: "#4ade80" }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Modal cancelamento */}
      {cancelTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setCancelTarget(null); }}
        >
          <div className="glass" style={{ maxWidth: 400, width: "100%", padding: "28px 24px", borderRadius: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#e8a0a0", margin: 0 }}>
              🚫 Cancelar pedido #{cancelTarget.number}
            </h3>
            <p style={{ fontSize: 12, color: "var(--cream-dim)", margin: 0, lineHeight: 1.6 }}>
              Total: <strong style={{ color: "var(--gold-light)" }}>{fmt(cancelTarget.total_cents)}</strong> · {fmtTime(cancelTarget.placed_at)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)", letterSpacing: 0.3 }}>
                Motivo <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <input
                className="input"
                placeholder="Ex: cliente desistiu, erro no lançamento…"
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setCancelErr(""); }}
                autoFocus
                style={{ fontSize: 13 }}
              />
              {cancelErr && <p style={{ fontSize: 11, color: "#e8a0a0", margin: 0 }}>⚠ {cancelErr}</p>}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, padding: "10px", fontSize: 12, color: "#e8a0a0", borderColor: "rgba(232,160,160,0.4)" }}
                disabled={isPending}
                onClick={handleCancel}
              >
                {isPending ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: "10px 16px", fontSize: 12 }}
                onClick={() => setCancelTarget(null)}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de pedidos */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
        {loading ? (
          <p className="muted" style={{ fontSize: 12, textAlign: "center", padding: "32px 0" }}>Carregando…</p>
        ) : orders.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, textAlign: "center", padding: "32px 0" }}>
            Nenhuma venda PDV hoje.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {orders.map((order) => {
              const isCanceled = order.status === "canceled";
              return (
                <div
                  key={order.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    background: isCanceled ? "rgba(232,160,160,0.05)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isCanceled ? "rgba(232,160,160,0.15)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 10,
                    opacity: isCanceled ? 0.65 : 1,
                  }}
                >
                  {/* Hora + número */}
                  <div style={{ minWidth: 44, textAlign: "center" as const }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--cream-dim)", opacity: 0.6 }}>
                      {fmtTime(order.placed_at)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--cream)" }}>
                      #{order.number}
                    </div>
                  </div>

                  {/* Valores + status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: isCanceled ? "#e8a0a0" : "#4ade80" }}>
                        {fmt(order.total_cents)}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: `${STATUS_COLOR[order.status] ?? "rgba(255,255,255,0.1)"}22`,
                        color: STATUS_COLOR[order.status] ?? "var(--cream-dim)",
                        textTransform: "uppercase" as const, letterSpacing: 0.5,
                      }}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    {order.notes && (
                      <div style={{ fontSize: 10, color: "var(--cream-dim)", opacity: 0.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <Link
                      href={`/vendas/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 11, padding: "5px 10px", borderRadius: 7,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "var(--cream-dim)", textDecoration: "none", lineHeight: 1,
                      }}
                      title="Ver pedido"
                    >
                      ↗
                    </Link>
                    {!isCanceled && (
                      <button
                        onClick={() => openCancel(order)}
                        style={{
                          fontSize: 11, padding: "5px 10px", borderRadius: 7,
                          background: "rgba(232,160,160,0.08)", border: "1px solid rgba(232,160,160,0.25)",
                          color: "#e8a0a0", cursor: "pointer", lineHeight: 1,
                        }}
                        title="Cancelar pedido"
                      >
                        🚫
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
