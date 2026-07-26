"use client";

import { useMemo, useState } from "react";
import { GlassSelect } from "@/components/GlassSelect";
import { money } from "@/lib/format";
import { calculateFinanceScenario, type FinanceComponentGroup } from "@/lib/finance/engine";
import { saveFinanceCalculation } from "./actions";

const MODE_OPTIONS = [
  { value: "unit", label: "Custo unitário" },
  { value: "batch", label: "Lote" },
  { value: "kit", label: "Kit" },
  { value: "combo", label: "Combo" },
  { value: "order", label: "Pedido" },
  { value: "customer", label: "Cliente" },
  { value: "channel", label: "Canal" },
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "campaign", label: "Campanha" },
  { value: "subscription", label: "Assinatura" },
];

const SALE_MODEL_OPTIONS = [
  { value: "retail", label: "Varejo" },
  { value: "wholesale", label: "Atacado" },
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "consignment", label: "Consignação" },
  { value: "marketplace", label: "Marketplace" },
  { value: "physical_store", label: "Loja física" },
  { value: "representative", label: "Representante" },
  { value: "subscription", label: "Assinatura" },
  { value: "corporate", label: "Corporativo" },
];

const CHANNEL_OPTIONS = [
  { value: "site", label: "E-commerce Flora" },
  { value: "marketplace", label: "Marketplace" },
  { value: "physical_store", label: "Loja física" },
  { value: "representative", label: "Representante" },
  { value: "b2b", label: "B2B" },
  { value: "subscription", label: "Assinatura" },
  { value: "internal", label: "Venda interna" },
];

const GROUP_OPTIONS: { value: FinanceComponentGroup; label: string }[] = [
  { value: "production", label: "Produção" },
  { value: "packaging", label: "Embalagem" },
  { value: "logistics", label: "Logística" },
  { value: "tax", label: "Imposto" },
  { value: "commission", label: "Comissão" },
  { value: "channel_fee", label: "Taxa de canal" },
  { value: "fixed_expense", label: "Despesa fixa" },
  { value: "variable_expense", label: "Despesa variável" },
  { value: "labor", label: "Mão de obra" },
  { value: "investment", label: "Investimento" },
  { value: "custom", label: "Personalizado" },
];

const ITEM_KIND_OPTIONS = [
  { value: "product", label: "Produto" },
  { value: "kit", label: "Kit" },
  { value: "combo", label: "Combo" },
  { value: "service", label: "Serviço" },
  { value: "custom", label: "Personalizado" },
];

const PRESETS = [
  { group: "production" as const, label: "Matéria-prima / ativos", amount: "0" },
  { group: "packaging" as const, label: "Frasco, tampa, rótulo e caixa", amount: "0" },
  { group: "logistics" as const, label: "Picking, packing, etiqueta e frete", amount: "0" },
  { group: "tax" as const, label: "Reserva fiscal", amount: "0" },
  { group: "commission" as const, label: "Comissões", amount: "0" },
  { group: "channel_fee" as const, label: "Gateway / marketplace", amount: "0" },
  { group: "fixed_expense" as const, label: "Rateio de despesas fixas", amount: "0" },
  { group: "labor" as const, label: "Mão de obra direta e indireta", amount: "0" },
];

type Row = { id: string; group: FinanceComponentGroup; label: string; amount: string };
type ItemRow = { id: string; kind: string; name: string; sku: string; quantity: string; unitPrice: string; discount: string };

function centsFromInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
}

function numberFromInput(value: string, fallback: number) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

export function FinanceCalculatorForm() {
  const [title, setTitle] = useState("Cenário comercial Flora");
  const [mode, setMode] = useState("unit");
  const [saleModel, setSaleModel] = useState("retail");
  const [channel, setChannel] = useState("site");
  const [desiredMargin, setDesiredMargin] = useState("55");
  const [minimumMargin, setMinimumMargin] = useState("35");
  const [itemRows, setItemRows] = useState<ItemRow[]>([
    { id: "item-1", kind: "product", name: "Produto Flora", sku: "", quantity: "1", unitPrice: "0", discount: "0" },
  ]);
  const [rows, setRows] = useState<Row[]>(() =>
    PRESETS.map((preset, index) => ({ id: String(index + 1), ...preset }))
  );

  const items = useMemo(
    () =>
      itemRows.map((row) => ({
        name: row.name,
        sku: row.sku || undefined,
        kind: row.kind as "product" | "kit" | "combo" | "service" | "custom",
        quantity: numberFromInput(row.quantity, 0),
        unitPriceCents: centsFromInput(row.unitPrice),
        discountPercent: numberFromInput(row.discount, 0),
      })),
    [itemRows]
  );

  const fallbackQuantity = items.reduce((sum, item) => sum + item.quantity, 0) || 1;
  const fallbackUnitPriceCents = items.length ? items[0]?.unitPriceCents ?? 0 : 0;

  const components = useMemo(
    () =>
      rows.map((row) => ({
        group: row.group,
        label: row.label,
        amountCents: centsFromInput(row.amount),
      })),
    [rows]
  );

  const result = useMemo(
    () =>
      calculateFinanceScenario({
        title,
        mode: mode as never,
        saleModel: saleModel as never,
        channel,
        quantity: fallbackQuantity,
        unitPriceCents: fallbackUnitPriceCents,
        discountPercent: 0,
        desiredMarginPercent: numberFromInput(desiredMargin, 55),
        minimumMarginPercent: numberFromInput(minimumMargin, 35),
        items,
        components,
      }),
    [title, mode, saleModel, channel, fallbackQuantity, fallbackUnitPriceCents, desiredMargin, minimumMargin, items, components]
  );

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItemRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addItem() {
    setItemRows((current) => [
      ...current,
      { id: crypto.randomUUID(), kind: "product", name: "Novo item", sku: "", quantity: "1", unitPrice: "0", discount: "0" },
    ]);
  }

  function removeItem(id: string) {
    setItemRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow(group: FinanceComponentGroup = "custom") {
    setRows((current) => [
      ...current,
      { id: crypto.randomUUID(), group, label: "Novo custo", amount: "0" },
    ]);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <form action={saveFinanceCalculation} className="glass rise" style={{ padding: 22, display: "grid", gap: 18 }}>
      <input type="hidden" name="items_json" value={JSON.stringify(items)} />
      <input type="hidden" name="components_json" value={JSON.stringify(components)} />
      <input type="hidden" name="quantity" value={String(fallbackQuantity)} />
      <input type="hidden" name="unit_price" value={String(fallbackUnitPriceCents / 100).replace(".", ",")} />
      <input type="hidden" name="discount_percent" value="0" />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 7 }}>Calculadora de custos e preços</p>
          <h2 className="display" style={{ fontSize: 30 }}>Motor comercial</h2>
        </div>
        <button className="btn btn-gold" style={{ padding: "11px 22px", fontSize: 10 }}>
          Salvar cenário
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <label className="field">
          <span>Nome do cenário</span>
          <input className="input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Tipo de cálculo</span>
          <GlassSelect name="calculation_mode" value={mode} onChange={setMode} options={MODE_OPTIONS} ariaLabel="Tipo de cálculo" inlineMenu />
        </label>
        <label className="field">
          <span>Modelo de venda</span>
          <GlassSelect name="sale_model" value={saleModel} onChange={setSaleModel} options={SALE_MODEL_OPTIONS} ariaLabel="Modelo de venda" inlineMenu />
        </label>
        <label className="field">
          <span>Canal</span>
          <GlassSelect name="channel" value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} ariaLabel="Canal" inlineMenu />
        </label>
        <label className="field">
          <span>Margem desejada %</span>
          <input className="input" name="desired_margin_percent" inputMode="decimal" value={desiredMargin} onChange={(e) => setDesiredMargin(e.target.value)} />
        </label>
        <label className="field">
          <span>Margem mínima %</span>
          <input className="input" name="minimum_margin_percent" inputMode="decimal" value={minimumMargin} onChange={(e) => setMinimumMargin(e.target.value)} />
        </label>
      </div>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 5 }}>Itens do pedido</p>
            <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
              Cada linha respeita sua própria quantidade, preço e desconto.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }} onClick={addItem}>
            + adicionar item
          </button>
        </div>
        {itemRows.map((item) => (
          <div
            key={item.id}
            className="glass"
            style={{
              padding: 12,
              display: "grid",
              gridTemplateColumns: "140px minmax(170px, 1fr) 110px 100px 130px 110px auto",
              gap: 10,
              alignItems: "end",
              background: "rgba(255,248,234,0.04)",
            }}
          >
            <label className="field">
              <span>Tipo</span>
              <GlassSelect
                value={item.kind}
                onChange={(value) => updateItem(item.id, { kind: value })}
                options={ITEM_KIND_OPTIONS}
                ariaLabel="Tipo do item"
                inlineMenu
              />
            </label>
            <label className="field">
              <span>Item</span>
              <input className="input" value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} />
            </label>
            <label className="field">
              <span>SKU</span>
              <input className="input" value={item.sku} onChange={(e) => updateItem(item.id, { sku: e.target.value })} />
            </label>
            <label className="field">
              <span>Qtd.</span>
              <input className="input" inputMode="decimal" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: e.target.value })} />
            </label>
            <label className="field">
              <span>Preço unit.</span>
              <input className="input" inputMode="decimal" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })} />
            </label>
            <label className="field">
              <span>Desc. %</span>
              <input className="input" inputMode="decimal" value={item.discount} onChange={(e) => updateItem(item.id, { discount: e.target.value })} />
            </label>
            <button type="button" className="btn btn-ghost" style={{ padding: "10px 12px", fontSize: 10 }} onClick={() => removeItem(item.id)}>
              Remover
            </button>
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, 0.8fr)", gap: 16 }}>
        <section style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <p className="eyebrow">Componentes ilimitados</p>
            <button type="button" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }} onClick={() => addRow()}>
              + adicionar custo
            </button>
          </div>
          {rows.map((row) => (
            <div key={row.id} className="glass" style={{ padding: 12, display: "grid", gridTemplateColumns: "180px minmax(180px, 1fr) 140px auto", gap: 10, alignItems: "end", background: "rgba(255,248,234,0.04)" }}>
              <label className="field">
                <span>Grupo</span>
                <GlassSelect
                  value={row.group}
                  onChange={(value) => updateRow(row.id, { group: value as FinanceComponentGroup })}
                  options={GROUP_OPTIONS}
                  ariaLabel="Grupo de custo"
                  inlineMenu
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <input className="input" value={row.label} onChange={(e) => updateRow(row.id, { label: e.target.value })} />
              </label>
              <label className="field">
                <span>Valor</span>
                <input className="input" inputMode="decimal" value={row.amount} onChange={(e) => updateRow(row.id, { amount: e.target.value })} />
              </label>
              <button type="button" className="btn btn-ghost" style={{ padding: "10px 12px", fontSize: 10 }} onClick={() => removeRow(row.id)}>
                Remover
              </button>
            </div>
          ))}
        </section>

        <aside className="glass" style={{ padding: 18, position: "sticky", top: 20, alignSelf: "start", background: "rgba(255,248,234,0.06)" }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Resultado em tempo real</p>
          <ResultLine label="Linhas do pedido" value={`${result.itemCount}`} />
          <ResultLine label="Unidades totais" value={`${result.totalUnits}`} />
          <ResultLine label="Receita bruta" value={money(result.grossRevenueCents)} />
          <ResultLine label="Descontos" value={`- ${money(result.discountCents)}`} muted />
          <ResultLine label="Receita líquida" value={money(result.netRevenueCents)} strong />
          <ResultLine label="Custo total" value={money(result.totalCostCents)} />
          <ResultLine label="Lucro líquido" value={money(result.netProfitCents)} strong tone={result.netProfitCents < 0 ? "danger" : "gold"} />
          <ResultLine label="Margem líquida" value={`${result.netMarginPercent.toFixed(1)}%`} />
          <ResultLine label="Markup" value={`${result.markupPercent.toFixed(1)}%`} />
          <ResultLine label="Preço mínimo" value={money(result.minimumPriceCents)} />
          <ResultLine label="Preço recomendado" value={money(result.recommendedPriceCents)} strong tone="gold" />
          <ResultLine label="Capital necessário" value={money(result.capitalNeededCents)} />

          {result.alerts.length ? (
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {result.alerts.map((alert) => (
                <span key={alert.message} className={alert.tone === "danger" ? "chip" : "chip chip-draft"} style={{ color: alert.tone === "danger" ? "#e8a0a0" : undefined }}>
                  {alert.message}
                </span>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label className="field">
          <span>Cliente</span>
          <input className="input" name="customer_name" placeholder="Opcional" />
        </label>
        <label className="field">
          <span>Vendedor / representante</span>
          <input className="input" name="seller_name" placeholder="Opcional" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Observações</span>
          <textarea className="input" name="notes" rows={3} placeholder="Premissas, regras de aprovação, observações fiscais e comerciais." />
        </label>
      </div>
    </form>
  );
}

function ResultLine({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: "gold" | "danger";
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "9px 0", borderBottom: "1px solid rgba(242,236,223,0.08)" }}>
      <span className="muted" style={{ fontSize: 11 }}>{label}</span>
      <strong style={{ color: tone === "danger" ? "#e8a0a0" : tone === "gold" || strong ? "var(--gold-light)" : muted ? "var(--cream-dim)" : "var(--cream)", fontSize: strong ? 15 : 13 }}>
        {value}
      </strong>
    </div>
  );
}

