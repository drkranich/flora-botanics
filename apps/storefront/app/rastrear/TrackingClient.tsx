"use client";

import { useState } from "react";

type TrackingEvent = {
  id: string;
  status: string;
  city: string | null;
  state: string | null;
  description: string | null;
  carrier: string | null;
  tracking_code: string | null;
  created_at: string;
};

type TrackingResult = {
  order: {
    number: string | number;
    status: string;
    created_at: string;
    recipient: string;
    city: string;
    state: string;
  };
  events: TrackingEvent[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Preparando pedido",
  dispatched: "Enviado",
  in_transit: "Em trânsito",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  exception: "Ocorrência",
  cancelled: "Cancelado",
};

const STATUS_ICON: Record<string, string> = {
  pending: "⏳",
  paid: "✅",
  preparing: "📦",
  dispatched: "🚚",
  in_transit: "📍",
  out_for_delivery: "🛵",
  delivered: "🌸",
  exception: "⚠️",
  cancelled: "✕",
};

export function TrackingClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const json = await res.json() as TrackingResult & { error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Pedido não encontrado.");
        return;
      }
      setResult(json);
    } catch {
      setError("Não foi possível consultar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setOrderNumber("");
    setEmail("");
  }

  return (
    <div className="tracking-page">
      {!result ? (
        <form onSubmit={handleSubmit} className="tracking-form glass rise">
          <h2 className="tracking-form-title">Rastrear pedido</h2>
          <p className="tracking-form-sub">
            Insira o número do pedido (enviado por e-mail na confirmação) e o e-mail usado na compra.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="order-num">Número do pedido</label>
            <input
              id="order-num"
              className="input"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="ex: 1001"
              required
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="track-email">E-mail da compra</label>
            <input
              id="track-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>

          {error ? (
            <p className="tracking-error">{error}</p>
          ) : null}

          <button type="submit" disabled={loading} className="btn btn-gold tracking-submit">
            {loading ? "Consultando…" : "Consultar pedido"}
          </button>
        </form>
      ) : (
        <div className="tracking-result rise">
          {/* Cabeçalho do pedido */}
          <div className="tracking-result-header glass">
            <div className="tracking-result-badge">
              <span className="tracking-result-icon">{STATUS_ICON[result.order.status] ?? "📦"}</span>
              <div>
                <p className="tracking-result-number">Pedido #{result.order.number}</p>
                <p className="tracking-result-status">{STATUS_LABEL[result.order.status] ?? result.order.status}</p>
              </div>
            </div>
            <div className="tracking-result-meta">
              <span>Feito em {new Date(result.order.created_at).toLocaleDateString("pt-BR")}</span>
              {result.order.city ? (
                <span>Entrega: {result.order.city}/{result.order.state}</span>
              ) : null}
            </div>
          </div>

          {/* Timeline */}
          {result.events.length === 0 ? (
            <div className="tracking-empty glass">
              <p>📦 Seu pedido ainda não possui eventos de rastreamento.</p>
              <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                Assim que for enviado, a movimentação aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="tracking-timeline glass">
              <div className="tracking-timeline-inner">
                {result.events.map((ev, i) => {
                  const isLast = i === result.events.length - 1;
                  const date = new Date(ev.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <div key={ev.id} className={`tracking-event${isLast ? " is-latest" : ""}`}>
                      <div className="tracking-event-dot" aria-hidden="true">
                        <span>{STATUS_ICON[ev.status] ?? "•"}</span>
                      </div>
                      <div className="tracking-event-content">
                        <strong className="tracking-event-label">
                          {STATUS_LABEL[ev.status] ?? ev.status}
                          {ev.city ? ` — ${ev.city}${ev.state ? `/${ev.state}` : ""}` : ""}
                        </strong>
                        {ev.description ? (
                          <p className="tracking-event-desc">{ev.description}</p>
                        ) : null}
                        <div className="tracking-event-meta">
                          <span>{date}</span>
                          {ev.carrier ? <span>· {ev.carrier}</span> : null}
                          {ev.tracking_code ? (
                            <span className="tracking-code">· {ev.tracking_code}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button type="button" onClick={reset} className="btn btn-ghost tracking-back">
            ← Consultar outro pedido
          </button>
        </div>
      )}
    </div>
  );
}
