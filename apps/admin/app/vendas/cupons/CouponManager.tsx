"use client";

import { useState, useTransition } from "react";
import { createCoupon, toggleCoupon, deleteCoupon } from "@/lib/sales/actions";

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_subtotal_cents: number | null;
  used_count: number;
  max_uses: number | null;
  ends_at: string | null;
  status: string;
};

const TYPE_LABEL: Record<string, string> = {
  percent: "% de desconto",
  fixed: "Valor fixo (R$)",
  free_shipping: "Frete grátis",
};

function describe(c: Coupon) {
  if (c.type === "percent") return `${c.value}% de desconto`;
  if (c.type === "fixed") return `R$ ${Number(c.value).toFixed(2)} de desconto`;
  return "Frete grátis";
}

export function CouponManager({ initial }: { initial: Coupon[] }) {
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed" | "free_shipping">("percent");
  const [value, setValue] = useState("10");
  const [endsAt, setEndsAt] = useState("");

  function run(fn: () => Promise<void>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setMsg(ok);
        setCreating(false);
        setCode("");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {initial.map((c) => (
        <div key={c.id} className="glass" style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong style={{ fontSize: 15, letterSpacing: 1 }}>{c.code}</strong>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
              {describe(c)} · usado {c.used_count}×
              {c.ends_at ? ` · expira ${new Date(c.ends_at).toLocaleDateString("pt-BR")}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`chip ${c.status === "active" ? "chip-live" : "chip-draft"}`}>
              {c.status === "active" ? "Ativo" : "Desativado"}
            </span>
            <button
              className="btn btn-ghost"
              disabled={pending}
              style={{ padding: "8px 14px", fontSize: 9.5 }}
              onClick={() =>
                run(() => toggleCoupon(c.id, c.status !== "active"), "Cupom atualizado.")
              }
            >
              {c.status === "active" ? "Desativar" : "Ativar"}
            </button>
            <button
              className="btn-icon"
              title="Excluir"
              style={{ color: "#e8a0a0" }}
              disabled={pending}
              onClick={() => {
                if (confirm(`Excluir o cupom ${c.code}?`)) {
                  run(() => deleteCoupon(c.id), "Cupom excluído.");
                }
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {creating ? (
        <form
          className="glass rise"
          style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                createCoupon({
                  code,
                  type,
                  value: type === "free_shipping" ? 0 : Number(value),
                  ends_at: endsAt || null,
                }),
              "Cupom criado."
            );
          }}
        >
          <p className="eyebrow">Novo cupom</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div className="field">
              <span className="field-label">Código</span>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BEMVINDA10" required />
            </div>
            <div className="field">
              <span className="field-label">Tipo</span>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="field-label">Valor</span>
              <input className="input" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} disabled={type === "free_shipping"} />
            </div>
            <div className="field">
              <span className="field-label">Expira em (opcional)</span>
              <input className="input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px" }}>
              {pending ? "…" : "Criar cupom"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="btn btn-ghost" style={{ padding: "11px 20px" }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-ghost" onClick={() => setCreating(true)} style={{ padding: 16, borderStyle: "dashed" }}>
          + Novo cupom
        </button>
      )}

      {msg ? (
        <p className="rise" style={{ fontSize: 12, color: "var(--gold-light)", textAlign: "center" }}>{msg}</p>
      ) : null}
    </div>
  );
}
