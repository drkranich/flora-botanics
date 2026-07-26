"use client";

import { useState } from "react";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect } from "@/components/GlassSelect";
import { createPriceTable } from "./actions";

const TABLE_TYPE_OPTIONS = [
  { value: "retail", label: "Varejo" },
  { value: "wholesale", label: "Atacado" },
  { value: "distributor", label: "Distribuidor" },
  { value: "representative", label: "Representante" },
  { value: "physical_store", label: "Loja física" },
  { value: "marketplace", label: "Marketplace" },
  { value: "b2b", label: "B2B" },
  { value: "special_customer", label: "Cliente especial" },
  { value: "campaign", label: "Campanha" },
  { value: "subscription", label: "Assinatura" },
  { value: "region", label: "Região" },
  { value: "export", label: "Exportação" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "Sem canal específico" },
  { value: "site", label: "Site próprio" },
  { value: "mercado_livre", label: "Mercado Livre" },
  { value: "shopee", label: "Shopee" },
  { value: "amazon", label: "Amazon" },
  { value: "b2b", label: "B2B" },
  { value: "physical_store", label: "Loja física" },
  { value: "representative", label: "Representante" },
];

export function PriceTableForm() {
  const [open, setOpen] = useState(false);
  const [tableType, setTableType] = useState("retail");
  const [channel, setChannel] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  return (
    <section className="glass rise rise-2" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: open ? 18 : 0 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 7 }}>Tabelas de preço</p>
          <h2 className="display" style={{ fontSize: 28 }}>Condições por canal</h2>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.7 }}>
            Use para varejo, atacado, B2B, marketplaces, representantes, regiões, campanhas e assinaturas.
          </p>
        </div>
        <button type="button" className="btn btn-gold" style={{ padding: "9px 16px", fontSize: 10 }} onClick={() => setOpen((v) => !v)}>
          {open ? "Fechar" : "+ Nova tabela"}
        </button>
      </div>

      {open ? (
        <form action={createPriceTable} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <label className="field">
              <span>Nome</span>
              <input className="input" name="name" required placeholder="Ex: Atacado lojas SP" />
            </label>
            <label className="field">
              <span>Tipo</span>
              <GlassSelect name="table_type" value={tableType} onChange={setTableType} options={TABLE_TYPE_OPTIONS} ariaLabel="Tipo da tabela" inlineMenu />
            </label>
            <label className="field">
              <span>Canal</span>
              <GlassSelect name="channel" value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} ariaLabel="Canal da tabela" inlineMenu />
            </label>
            <label className="field">
              <span>Cliente / grupo</span>
              <input className="input" name="customer_name" placeholder="Opcional" />
            </label>
            <label className="field">
              <span>Quantidade mínima</span>
              <input className="input" name="min_quantity" inputMode="decimal" defaultValue="1" />
            </label>
            <label className="field">
              <span>Desconto %</span>
              <input className="input" name="discount_percent" inputMode="decimal" defaultValue="0" />
            </label>
            <label className="field">
              <span>Comissão %</span>
              <input className="input" name="commission_percent" inputMode="decimal" defaultValue="0" />
            </label>
            <label className="field">
              <span>Margem mínima %</span>
              <input className="input" name="minimum_margin_percent" inputMode="decimal" defaultValue="30" />
            </label>
            <label className="field">
              <span>Vigente desde</span>
              <GlassDateInput name="valid_from" value={validFrom} onChange={setValidFrom} placeholder="Opcional" inlinePopover />
            </label>
            <label className="field">
              <span>Vigente até</span>
              <GlassDateInput name="valid_until" value={validUntil} onChange={setValidUntil} placeholder="Opcional" inlinePopover />
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: "var(--cream-soft)" }}>
              <input type="checkbox" name="approval_required" />
              Exigir aprovação para usar esta tabela
            </label>
            <label className="field">
              <span>Pagamento</span>
              <input className="input" name="payment_terms" placeholder="Ex: 30/60 dias" />
            </label>
            <label className="field">
              <span>Logística</span>
              <input className="input" name="logistics_terms" placeholder="Ex: FOB, CIF, retirada" />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Observações</span>
              <textarea className="input" name="notes" rows={3} placeholder="Regras, exceções e limites comerciais." />
            </label>
          </div>
          <button className="btn btn-gold" style={{ padding: "11px 22px", fontSize: 10, justifySelf: "start" }}>
            Criar tabela
          </button>
        </form>
      ) : null}
    </section>
  );
}

