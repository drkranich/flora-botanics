"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  cancelShipment,
  chooseShippingQuote,
  dispatchShipment,
  queueLabelPrint,
  queueProductLabelPrint,
  requestShipmentLabel,
  requestShippingQuotes,
} from "./actions";

export function RequestLabelButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <ActionWrap message={message}>
      <button
        type="button"
        className="btn btn-gold"
        disabled={pending}
        style={{ padding: "8px 14px", fontSize: 10 }}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await requestShipmentLabel(orderId);
            setMessage(result.ok ? "Etiqueta enfileirada." : result.error);
          });
        }}
      >
        {pending ? "Enfileirando..." : "Gerar etiqueta"}
      </button>
    </ActionWrap>
  );
}

export function RequestQuotesButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <ActionWrap message={message}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        style={{ padding: "8px 14px", fontSize: 10 }}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await requestShippingQuotes(orderId);
            setMessage(result.ok ? "Cotações atualizadas." : result.error);
          });
        }}
      >
        {pending ? "Cotando..." : "Cotar frete"}
      </button>
    </ActionWrap>
  );
}

export function ChooseQuoteButton({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <ActionWrap message={message}>
      <button
        type="button"
        className="btn btn-gold"
        disabled={pending}
        style={{ padding: "7px 12px", fontSize: 10 }}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await chooseShippingQuote(quoteId);
            setMessage(result.ok ? "Transportadora escolhida." : result.error);
          });
        }}
      >
        {pending ? "Escolhendo..." : "Escolher"}
      </button>
    </ActionWrap>
  );
}

export function ShipmentButtons({
  shipmentId,
  canPrint,
  canDispatch = true,
}: {
  shipmentId: string;
  canPrint: boolean;
  canDispatch?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: "print_a4" | "print_thermal" | "dispatch" | "cancel") {
    setMessage(null);
    startTransition(async () => {
      const result =
        action === "cancel"
          ? await cancelShipment(shipmentId)
          : action === "dispatch"
            ? await dispatchShipment(shipmentId)
            : await queueLabelPrint(shipmentId, action === "print_a4" ? "a4" : "thermal");
      setMessage(result.ok ? "Ação registrada." : result.error);
    });
  }

  return (
    <ActionWrap message={message}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-gold"
          disabled={pending || !canDispatch}
          style={{ padding: "7px 12px", fontSize: 10 }}
          onClick={() => {
            if (confirm("Marcar esta remessa como expedida e enviar o rastreio ao cliente?")) run("dispatch");
          }}
        >
          Expedir
        </button>
        <button
          type="button"
          className="btn btn-gold"
          disabled={pending || !canPrint}
          style={{ padding: "7px 12px", fontSize: 10 }}
          onClick={() => run("print_a4")}
        >
          A4
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending || !canPrint}
          style={{ padding: "7px 12px", fontSize: 10 }}
          onClick={() => run("print_thermal")}
        >
          Térmica
        </button>
        <button
          type="button"
          disabled={pending}
          style={{
            border: "1px solid rgba(232,160,160,0.38)",
            background: "rgba(232,160,160,0.08)",
            color: "#e8a0a0",
            borderRadius: 999,
            padding: "7px 12px",
            fontSize: 10,
            fontWeight: 800,
            cursor: pending ? "not-allowed" : "pointer",
          }}
          onClick={() => {
            if (confirm("Cancelar esta remessa/etiqueta?")) run("cancel");
          }}
        >
          Cancelar
        </button>
      </div>
    </ActionWrap>
  );
}

export function ProductLabelButtons({ variantId }: { variantId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);

  function run(format: "a4" | "thermal") {
    setMessage(null);
    startTransition(async () => {
      const result = await queueProductLabelPrint(variantId, format, copies);
      setMessage(result.ok ? "Etiqueta de produto enfileirada." : result.error);
    });
  }

  return (
    <ActionWrap message={message}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
        <input
          aria-label="Quantidade de cópias"
          type="number"
          min={1}
          max={250}
          value={copies}
          onChange={(event) => setCopies(Number(event.target.value) || 1)}
          className="input"
          style={{ width: 74, padding: "7px 10px", fontSize: 11 }}
        />
        <button
          type="button"
          className="btn btn-gold"
          disabled={pending}
          style={{ padding: "7px 12px", fontSize: 10 }}
          onClick={() => run("thermal")}
        >
          Térmica
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          style={{ padding: "7px 12px", fontSize: 10 }}
          onClick={() => run("a4")}
        >
          A4
        </button>
      </div>
    </ActionWrap>
  );
}

function ActionWrap({ children, message }: { children: ReactNode; message: string | null }) {
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      {children}
      {message ? (
        <span style={{ color: message.includes("erro") || message.includes("não") ? "#e8a0a0" : "#8fd486", fontSize: 10.5 }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
