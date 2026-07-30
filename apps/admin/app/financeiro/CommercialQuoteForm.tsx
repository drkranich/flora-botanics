"use client";

import { useState } from "react";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import { createCommercialQuote } from "./actions";

const KIND_OPTIONS = [
  { value: "budget", label: "Orçamento" },
  { value: "quote", label: "Cotação" },
  { value: "proposal", label: "Proposta comercial" },
];

const CHANNEL_OPTIONS = [
  { value: "site", label: "E-commerce Flora" },
  { value: "b2b", label: "B2B" },
  { value: "wholesale", label: "Atacado" },
  { value: "marketplace", label: "Marketplace" },
  { value: "physical_store", label: "Loja física" },
  { value: "corporate", label: "Corporativo" },
];

export function CommercialQuoteForm({ calculations }: { calculations: GlassSelectOption[] }) {
  const [kind, setKind] = useState("budget");
  const [channel, setChannel] = useState("site");
  const [calculationId, setCalculationId] = useState(calculations[0]?.value ?? "");

  return (
    <form action={createCommercialQuote} className="glass rise rise-1" style={{ padding: 22, display: "grid", gap: 14 }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 7 }}>Orçamentos, cotações e propostas</p>
        <h2 className="display" style={{ fontSize: 28 }}>Documento comercial</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label className="field">
          <span>Tipo</span>
          <GlassSelect name="kind" value={kind} onChange={setKind} options={KIND_OPTIONS} ariaLabel="Tipo de documento" inlineMenu />
        </label>
        <label className="field">
          <span>Cenário base</span>
          <GlassSelect
            name="calculation_id"
            value={calculationId}
            onChange={setCalculationId}
            options={calculations.length ? calculations : [{ value: "", label: "Sem cenário salvo" }]}
            ariaLabel="Cenário base"
            inlineMenu
            disabled={!calculations.length}
          />
        </label>
        <label className="field">
          <span>Canal</span>
          <GlassSelect name="channel" value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} ariaLabel="Canal" inlineMenu />
        </label>
        <label className="field">
          <span>Cliente</span>
          <input className="input" name="customer_name" required placeholder="Nome do cliente" />
        </label>
        <label className="field">
          <span>Empresa</span>
          <input className="input" name="company_name" placeholder="Opcional" />
        </label>
        <label className="field">
          <span>CPF / CNPJ</span>
          <input className="input" name="document_number" placeholder="Opcional" />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input className="input" name="email" placeholder="cliente@email.com" />
        </label>
        <label className="field">
          <span>Telefone</span>
          <input className="input" name="phone" placeholder="Opcional" />
        </label>
        <label className="field">
          <span>Vendedor</span>
          <input className="input" name="seller_name" placeholder="Opcional" />
        </label>
        <label className="field">
          <span>Condição de pagamento</span>
          <input className="input" name="payment_terms" placeholder="Ex: 30/60 dias, PIX, boleto" />
        </label>
        <label className="field">
          <span>Logística / entrega</span>
          <input className="input" name="delivery_terms" placeholder="Prazo, frete, transportadora" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Endereço</span>
          <input className="input" name="address" placeholder="Endereço comercial ou entrega" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Termos comerciais</span>
          <textarea className="input" name="terms" rows={3} placeholder="Validade, aceite, assinatura, condições especiais." />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Observações internas</span>
          <textarea className="input" name="notes" rows={3} placeholder="Premissas, negociação, riscos e próximos passos." />
        </label>
      </div>

      <button className="btn btn-gold" style={{ padding: "12px 24px", fontSize: 10, justifySelf: "start" }}>
        Criar documento
      </button>
    </form>
  );
}

