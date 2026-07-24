"use client";

import { useState, useTransition } from "react";
import { GlassSelect } from "@/components/GlassSelect";
import {
  addShippingEvent,
  deleteShippingEvent,
  STATUS_EVENT_LABEL,
  STATUS_EVENT_ICON,
  type ShippingEvent,
} from "./tracking-actions";

const STATUS_OPTIONS = Object.entries(STATUS_EVENT_LABEL).map(([value, label]) => ({ value, label }));

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
].map((v) => ({ value: v, label: v }));

export function TrackingPanel({
  orderId,
  customerPhone,
  initialEvents,
}: {
  orderId: string;
  customerPhone: string | null;
  initialEvents: ShippingEvent[];
}) {
  const [events, setEvents] = useState<ShippingEvent[]>(initialEvents);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Form state
  const [status, setStatus] = useState("in_transit");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [description, setDescription] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [phone, setPhone] = useState(customerPhone ?? "");

  function reset() {
    setCity(""); setDescription(""); setErr(null); setMsg(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    startTransition(async () => {
      const result = await addShippingEvent(orderId, {
        status, city, state, description, carrier, tracking_code: trackingCode,
        sendWhatsapp: sendWhatsapp && !!phone,
        phone: phone || undefined,
      });
      if (!result.ok) {
        setErr(result.error ?? "Erro ao salvar.");
        return;
      }
      setMsg(sendWhatsapp && !!phone ? "Evento salvo e WhatsApp enviado!" : "Evento salvo.");
      // Refresh local list (server revalidates too)
      const newEvent: ShippingEvent = {
        id: crypto.randomUUID(),
        status,
        city: city || null,
        state: state || null,
        description: description || null,
        carrier: carrier || null,
        tracking_code: trackingCode || null,
        whatsapp_sent: sendWhatsapp && !!phone,
        whatsapp_sent_at: sendWhatsapp && !!phone ? new Date().toISOString() : null,
        whatsapp_phone: sendWhatsapp && !!phone ? phone : null,
        created_at: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, newEvent]);
      reset();
    });
  }

  function remove(eventId: string) {
    if (!confirm("Remover este evento de rastreamento?")) return;
    startTransition(async () => {
      await deleteShippingEvent(eventId, orderId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    });
  }

  return (
    <section className="glass rise" style={{ padding: 22, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p className="eyebrow">📍 Rastreamento de entrega</p>
        <button
          type="button"
          className="btn btn-gold"
          style={{ padding: "9px 18px", fontSize: 10 }}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Fechar" : "+ Registrar evento"}
        </button>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>Nenhum evento registrado ainda.</p>
      ) : (
        <div style={{ position: "relative", paddingLeft: 28 }}>
          {/* linha vertical */}
          <div style={{
            position: "absolute", left: 8, top: 4, bottom: 4,
            width: 2, background: "rgba(185,146,77,0.25)", borderRadius: 2,
          }} />

          {events.map((ev, i) => {
            const isLast = i === events.length - 1;
            const date = new Date(ev.created_at).toLocaleString("pt-BR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            });
            return (
              <div key={ev.id} style={{ position: "relative", marginBottom: isLast ? 0 : 18 }}>
                {/* ponto */}
                <div style={{
                  position: "absolute", left: -24, top: 2,
                  width: 14, height: 14, borderRadius: "50%",
                  background: isLast ? "var(--gold)" : "rgba(185,146,77,0.35)",
                  border: `2px solid ${isLast ? "var(--gold-light)" : "rgba(185,146,77,0.5)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 7,
                }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13 }}>{STATUS_EVENT_ICON[ev.status]}</span>
                      <strong style={{ fontSize: 13 }}>
                        {STATUS_EVENT_LABEL[ev.status] ?? ev.status}
                        {ev.city ? ` — ${ev.city}${ev.state ? `/${ev.state}` : ""}` : ""}
                      </strong>
                    </div>
                    {ev.description ? (
                      <p style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 2 }}>{ev.description}</p>
                    ) : null}
                    <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                      <span className="muted" style={{ fontSize: 10.5 }}>{date}</span>
                      {ev.carrier ? <span className="muted" style={{ fontSize: 10.5 }}>· {ev.carrier}</span> : null}
                      {ev.tracking_code ? (
                        <span className="muted" style={{ fontSize: 10.5 }}>· {ev.tracking_code}</span>
                      ) : null}
                      {ev.whatsapp_sent ? (
                        <span style={{ fontSize: 10, color: "#4ade80" }}>· ✓ WhatsApp enviado</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ color: "#e8a0a0", fontSize: 11, padding: "4px 8px", flexShrink: 0 }}
                    disabled={pending}
                    onClick={() => remove(ev.id)}
                    title="Remover evento"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulário */}
      {open ? (
        <form
          onSubmit={submit}
          style={{
            marginTop: 20, padding: 18, borderTop: "1px solid var(--glass-border)",
            display: "grid", gap: 12,
          }}
        >
          <p className="eyebrow" style={{ fontSize: 9 }}>Novo evento</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <span className="field-label">Status</span>
              <GlassSelect
                value={status}
                onChange={setStatus}
                options={STATUS_OPTIONS}
                ariaLabel="Status do evento"
              />
            </div>
            <div className="field">
              <span className="field-label">Cidade</span>
              <input
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="ex: São Paulo"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 12 }}>
            <div className="field">
              <span className="field-label">UF</span>
              <GlassSelect
                value={state}
                onChange={setState}
                options={UF_OPTIONS}
                ariaLabel="Estado"
              />
            </div>
            <div className="field">
              <span className="field-label">Transportadora</span>
              <input
                className="input"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="Correios, Jadlog…"
              />
            </div>
            <div className="field">
              <span className="field-label">Código de rastreio</span>
              <input
                className="input"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="AA123456789BR"
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">Mensagem personalizada (opcional)</span>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: Seu pedido chegou ao CD de São Paulo"
            />
          </div>

          {/* WhatsApp */}
          <div
            style={{
              padding: "14px 16px",
              background: "rgba(37,211,102,0.07)",
              border: "1px solid rgba(37,211,102,0.2)",
              borderRadius: 10,
              display: "grid", gap: 10,
            }}
          >
            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={sendWhatsapp}
                onChange={(e) => setSendWhatsapp(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#25d366" }}
              />
              <span style={{ color: "#4ade80", fontWeight: 600 }}>📱 Notificar cliente via WhatsApp</span>
            </label>
            {sendWhatsapp ? (
              <div className="field">
                <span className="field-label" style={{ fontSize: 10 }}>Telefone do cliente (com DDD + 55)</span>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 51 99999-9999"
                />
                <p className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>
                  Requer WHATSAPP_API_URL e WHATSAPP_API_TOKEN configurados nos secrets do Worker.
                </p>
              </div>
            ) : null}
          </div>

          {err ? <p style={{ color: "#e8a0a0", fontSize: 12 }}>{err}</p> : null}
          {msg ? <p style={{ color: "#4ade80", fontSize: 12 }}>{msg}</p> : null}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px" }}>
              {pending ? "Salvando…" : "Registrar evento"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); reset(); }} style={{ padding: "11px 18px" }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
