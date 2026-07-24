"use client";

import { useState, useId } from "react";
import type { CSSProperties } from "react";

/* ─── tipos ─────────────────────────────────────────────────── */
interface Inputs {
  // Custo de produção
  materiaprima: number;      // R$
  embalagem_primaria: number; // R$ (pote, frasco, tampa)
  caixa_envio: number;        // R$ (caixa/fita/papel seda)
  outros_insumos: number;     // R$ (outros custos fixos do produto)

  // Logística / operacional
  frete_envio: number;        // R$ custo médio de envio ao cliente
  taxa_gateway: number;       // % (ex: 2.5 Stripe, 3.99 Mercado Pago)
  taxa_marketplace: number;   // % (0 loja própria, 12 ML, 14 Shopee)

  // Fiscal
  regime: "mei" | "simples" | "lucro_presumido" | "isento";
  aliquota_simples: number;   // % usado só se regime == simples

  // Preço atual do produto (para comparação)
  preco_atual: number;        // R$

  // Margem desejada
  margem_desejada: number;    // %
}

/* ─── helpers ───────────────────────────────────────────────── */
function r(v: number) {
  return isNaN(v) || !isFinite(v) ? 0 : Math.round(v * 100) / 100;
}

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

const REGIME_ALIQUOTA: Record<string, number> = {
  mei: 5,
  simples: 0,   // definido pelo usuário
  lucro_presumido: 11.33,
  isento: 0,
};

const REGIME_LABEL: Record<string, string> = {
  mei: "MEI (DAS 5%)",
  simples: "Simples Nacional (alíquota variável)",
  lucro_presumido: "Lucro Presumido (~11.33%)",
  isento: "Isento / Pessoa Física",
};

function calc(inp: Inputs) {
  // Custo fixo total (não depende do preço)
  const custo_fixo =
    r(inp.materiaprima) +
    r(inp.embalagem_primaria) +
    r(inp.caixa_envio) +
    r(inp.outros_insumos) +
    r(inp.frete_envio);

  // Impostos sobre o preço
  const aliq_fiscal =
    inp.regime === "simples"
      ? inp.aliquota_simples
      : REGIME_ALIQUOTA[inp.regime] ?? 0;

  // % totais sobre o preço de venda
  const pct_sobre_preco =
    (inp.taxa_gateway + inp.taxa_marketplace + aliq_fiscal) / 100;

  // Preço de equilíbrio (sem margem):  custo_fixo = price * (1 - pct_sobre_preco)
  //   => price_break = custo_fixo / (1 - pct_sobre_preco)
  const price_break =
    pct_sobre_preco < 1
      ? r(custo_fixo / (1 - pct_sobre_preco))
      : 0;

  // Preço sugerido com margem:  custo_fixo = price * (1 - pct_sobre_preco - margem/100)
  const pct_margem = inp.margem_desejada / 100;
  const price_sugerido =
    pct_sobre_preco + pct_margem < 1
      ? r(custo_fixo / (1 - pct_sobre_preco - pct_margem))
      : 0;

  // Margem real com preço atual
  const preco = r(inp.preco_atual);
  const custo_total_com_preco_atual =
    preco > 0
      ? r(custo_fixo + preco * pct_sobre_preco)
      : custo_fixo;

  const lucro_atual = preco > 0 ? r(preco - custo_total_com_preco_atual) : 0;
  const margem_real = preco > 0 ? r((lucro_atual / preco) * 100) : null;

  // Custo total com preço sugerido
  const custo_total_sugerido =
    price_sugerido > 0
      ? r(custo_fixo + price_sugerido * pct_sobre_preco)
      : custo_fixo;

  return {
    custo_fixo,
    pct_sobre_preco: r(pct_sobre_preco * 100),
    aliq_fiscal,
    price_break,
    price_sugerido,
    preco,
    custo_total_com_preco_atual,
    lucro_atual,
    margem_real,
    custo_total_sugerido,
  };
}

/* ─── estilos ────────────────────────────────────────────────── */
const inputS: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 9,
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10,22,11,0.42)",
  width: "100%",
  boxSizing: "border-box",
};

const labelS: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--cream-dim)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  display: "block",
  marginBottom: 5,
};

const sectionHeadS: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "var(--gold-light)",
  marginBottom: 12,
};

function Field({
  label,
  prefix,
  suffix,
  value,
  onChange,
  step = "0.01",
  min = "0",
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  min?: string;
}) {
  const id = useId();
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <label htmlFor={id} style={labelS}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {prefix && (
          <span
            style={{
              padding: "8px 10px",
              fontSize: 12,
              color: "var(--cream-dim)",
              background: "rgba(255,248,234,0.07)",
              border: "1px solid var(--glass-border)",
              borderRight: "none",
              borderRadius: "9px 0 0 9px",
              whiteSpace: "nowrap",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          style={{
            ...inputS,
            borderRadius: prefix ? "0 9px 9px 0" : suffix ? "9px 0 0 9px" : 9,
          }}
        />
        {suffix && (
          <span
            style={{
              padding: "8px 10px",
              fontSize: 12,
              color: "var(--cream-dim)",
              background: "rgba(255,248,234,0.07)",
              border: "1px solid var(--glass-border)",
              borderLeft: "none",
              borderRadius: "0 9px 9px 0",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ResultChip({
  label,
  value,
  tone = "neutral",
  large,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger" | "neutral" | "gold";
  large?: boolean;
}) {
  const colors: Record<string, string> = {
    ok: "rgba(143,212,134,0.12)",
    warn: "rgba(185,146,77,0.12)",
    danger: "rgba(232,160,160,0.12)",
    neutral: "rgba(242,236,223,0.07)",
    gold: "rgba(185,146,77,0.18)",
  };
  const textColors: Record<string, string> = {
    ok: "#8fd486",
    warn: "#d4aa5a",
    danger: "#e8a0a0",
    neutral: "var(--cream)",
    gold: "var(--gold-light)",
  };
  return (
    <div
      style={{
        background: colors[tone],
        border: `1px solid ${textColors[tone]}33`,
        borderRadius: 12,
        padding: large ? "16px 20px" : "12px 16px",
        display: "grid",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--cream-dim)" }}>
        {label}
      </span>
      <span style={{ fontSize: large ? 26 : 18, fontWeight: 800, color: textColors[tone] }}>
        {value}
      </span>
    </div>
  );
}

/* ─── componente principal ───────────────────────────────────── */
const DEFAULT: Inputs = {
  materiaprima: 0,
  embalagem_primaria: 0,
  caixa_envio: 0,
  outros_insumos: 0,
  frete_envio: 0,
  taxa_gateway: 2.5,
  taxa_marketplace: 0,
  regime: "mei",
  aliquota_simples: 6,
  preco_atual: 0,
  margem_desejada: 40,
};

export function PricingCalculator() {
  const [inp, setInp] = useState<Inputs>(DEFAULT);

  function set<K extends keyof Inputs>(key: K, val: Inputs[K]) {
    setInp((prev) => ({ ...prev, [key]: val }));
  }

  const res = calc(inp);

  const margemTone =
    res.margem_real == null
      ? "neutral"
      : res.margem_real >= 40
      ? "ok"
      : res.margem_real >= 20
      ? "warn"
      : "danger";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* ── coluna esquerda: inputs ── */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* custo de produção */}
          <section className="glass" style={{ padding: 20, borderRadius: 14 }}>
            <p style={sectionHeadS}>📦 Custo de produção</p>
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="Matéria-prima / produção" prefix="R$" value={inp.materiaprima} onChange={(v) => set("materiaprima", v)} />
              <Field label="Embalagem primária (pote, frasco, tampa)" prefix="R$" value={inp.embalagem_primaria} onChange={(v) => set("embalagem_primaria", v)} />
              <Field label="Caixa / fita / papel seda / laço" prefix="R$" value={inp.caixa_envio} onChange={(v) => set("caixa_envio", v)} />
              <Field label="Outros insumos" prefix="R$" value={inp.outros_insumos} onChange={(v) => set("outros_insumos", v)} />
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--cream-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Subtotal produção</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: "var(--gold-light)" }}>
                {money(inp.materiaprima + inp.embalagem_primaria + inp.caixa_envio + inp.outros_insumos)}
              </span>
            </div>
          </section>

          {/* logística */}
          <section className="glass" style={{ padding: 20, borderRadius: 14 }}>
            <p style={sectionHeadS}>🚚 Logística & Plataforma</p>
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="Frete médio de envio ao cliente" prefix="R$" value={inp.frete_envio} onChange={(v) => set("frete_envio", v)} />
              <Field label="Taxa de gateway de pagamento" suffix="%" value={inp.taxa_gateway} onChange={(v) => set("taxa_gateway", v)} step="0.1" />
              <Field label="Taxa marketplace (Shopee, ML, etc.)" suffix="%" value={inp.taxa_marketplace} onChange={(v) => set("taxa_marketplace", v)} step="0.1" />
            </div>
          </section>

          {/* fiscal */}
          <section className="glass" style={{ padding: 20, borderRadius: 14 }}>
            <p style={sectionHeadS}>🏛 Regime fiscal</p>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelS}>Regime tributário</label>
                <select
                  value={inp.regime}
                  onChange={(e) => set("regime", e.target.value as Inputs["regime"])}
                  style={{ ...inputS }}
                >
                  {Object.entries(REGIME_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {inp.regime === "simples" && (
                <Field
                  label="Alíquota Simples Nacional"
                  suffix="%"
                  value={inp.aliquota_simples}
                  onChange={(v) => set("aliquota_simples", v)}
                  step="0.1"
                />
              )}
              {inp.regime !== "isento" && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(242,236,223,0.05)",
                    border: "1px solid var(--glass-border)",
                    fontSize: 12,
                    color: "var(--cream-dim)",
                  }}
                >
                  Alíquota aplicada:{" "}
                  <strong style={{ color: "var(--cream)" }}>
                    {pct(res.aliq_fiscal)}
                  </strong>{" "}
                  sobre o preço de venda
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── coluna direita: parâmetros + resultado ── */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>

          {/* comparação com preço atual */}
          <section className="glass" style={{ padding: 20, borderRadius: 14 }}>
            <p style={sectionHeadS}>💰 Preço atual do produto</p>
            <Field label="Preço de venda atual (opcional)" prefix="R$" value={inp.preco_atual} onChange={(v) => set("preco_atual", v)} />
            {inp.preco_atual > 0 && (
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <ResultChip label="Custo total atual" value={money(res.custo_total_com_preco_atual)} />
                <ResultChip
                  label="Margem real"
                  value={res.margem_real != null ? pct(res.margem_real) : "—"}
                  tone={margemTone}
                />
              </div>
            )}
          </section>

          {/* margem desejada */}
          <section className="glass" style={{ padding: 20, borderRadius: 14 }}>
            <p style={sectionHeadS}>🎯 Margem desejada</p>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={labelS}>Margem líquida desejada</label>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--gold-light)" }}>
                    {inp.margem_desejada}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={1}
                  value={inp.margem_desejada}
                  onChange={(e) => set("margem_desejada", Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--gold)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--cream-dim)", marginTop: 4 }}>
                  <span>5%</span><span>Agressivo: 20%</span><span>Saudável: 40%</span><span>80%</span>
                </div>
              </div>
            </div>
          </section>

          {/* resultado */}
          <section
            className="glass"
            style={{
              padding: 20,
              borderRadius: 14,
              border: "1px solid rgba(185,146,77,0.3)",
              background: "rgba(185,146,77,0.05)",
            }}
          >
            <p style={{ ...sectionHeadS, color: "var(--gold)" }}>📊 Resultado da precificação</p>

            <div style={{ display: "grid", gap: 10 }}>
              {/* % sobre preço total */}
              <div
                style={{
                  background: "rgba(242,236,223,0.05)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--cream-dim)" }}>Custo fixo total</span>
                  <strong>{money(res.custo_fixo)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--cream-dim)" }}>% sobre preço (gateway + marketplace + imposto)</span>
                  <strong>{pct(res.pct_sobre_preco)}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <ResultChip
                  label="Preço de equilíbrio (break-even)"
                  value={res.price_break > 0 ? money(res.price_break) : "—"}
                  tone="neutral"
                />
                <ResultChip
                  label={`Preço sugerido (${inp.margem_desejada}% margem)`}
                  value={res.price_sugerido > 0 ? money(res.price_sugerido) : "—"}
                  tone="gold"
                  large
                />
              </div>

              {res.price_sugerido > 0 && (
                <div
                  style={{
                    background: "rgba(143,212,134,0.07)",
                    border: "1px solid rgba(143,212,134,0.2)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: 12,
                    display: "grid",
                    gap: 3,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700, color: "#8fd486", marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Composição ao preço sugerido
                  </p>
                  {(
                    [
                      ["Custo de produção", money(res.custo_fixo - inp.frete_envio)],
                      ["Frete", money(inp.frete_envio)],
                      ["Gateway (" + pct(inp.taxa_gateway) + ")", money(r(res.price_sugerido * inp.taxa_gateway / 100))],
                      inp.taxa_marketplace > 0 ? ["Marketplace (" + pct(inp.taxa_marketplace) + ")", money(r(res.price_sugerido * inp.taxa_marketplace / 100))] : null,
                      res.aliq_fiscal > 0 ? ["Imposto (" + pct(res.aliq_fiscal) + ")", money(r(res.price_sugerido * res.aliq_fiscal / 100))] : null,
                      ["Lucro líquido (" + pct(inp.margem_desejada) + ")", money(r(res.price_sugerido * inp.margem_desejada / 100))],
                    ] as (string[] | null)[]
                  )
                    .filter((item): item is string[] => item !== null)
                    .map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--cream-dim)" }}>{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  <div style={{ borderTop: "1px solid rgba(143,212,134,0.2)", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>Total</span>
                    <span>{money(res.price_sugerido)}</span>
                  </div>
                </div>
              )}

              {inp.preco_atual > 0 && res.margem_real != null && (
                <div
                  style={{
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    background:
                      res.margem_real >= 40
                        ? "rgba(143,212,134,0.08)"
                        : res.margem_real >= 20
                        ? "rgba(185,146,77,0.08)"
                        : "rgba(232,160,160,0.08)",
                    border: `1px solid ${
                      res.margem_real >= 40
                        ? "rgba(143,212,134,0.25)"
                        : res.margem_real >= 20
                        ? "rgba(185,146,77,0.25)"
                        : "rgba(232,160,160,0.25)"
                    }`,
                  }}
                >
                  Com preço atual de <strong>{money(inp.preco_atual)}</strong>, a margem real é{" "}
                  <strong
                    style={{
                      color:
                        res.margem_real >= 40 ? "#8fd486" : res.margem_real >= 20 ? "#d4aa5a" : "#e8a0a0",
                    }}
                  >
                    {pct(res.margem_real)}
                  </strong>
                  {res.margem_real < 20 && " — abaixo do recomendado. "}
                  {res.margem_real >= 20 && res.margem_real < 40 && " — margem aceitável mas pode melhorar. "}
                  {res.margem_real >= 40 && " — margem saudável. "}
                  {res.price_sugerido > inp.preco_atual && (
                    <span style={{ color: "var(--cream-dim)" }}>
                      Para atingir {inp.margem_desejada}% sugere-se{" "}
                      <strong style={{ color: "var(--gold-light)" }}>{money(res.price_sugerido)}</strong>.
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* botão reset */}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setInp(DEFAULT)}
            style={{ padding: "9px 18px", fontSize: 11, justifySelf: "end" }}
          >
            Limpar calculadora
          </button>
        </div>
      </div>
    </div>
  );
}
