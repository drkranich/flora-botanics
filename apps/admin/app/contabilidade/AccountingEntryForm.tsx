"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect } from "@/components/GlassSelect";
import { createAccountingEntry } from "./actions";

const TYPE_OPTIONS = [
  { value: "expense", label: "Despesa geral" },
  { value: "product_cost", label: "Custo de produto" },
  { value: "tax", label: "Imposto" },
  { value: "fee", label: "Taxa financeira" },
  { value: "shipping_cost", label: "Frete / logistica" },
  { value: "packaging_cost", label: "Embalagem" },
  { value: "operational_cost", label: "Custo operacional" },
  { value: "income", label: "Receita manual" },
  { value: "adjustment", label: "Ajuste contabil" },
];

const RECURRENCE_OPTIONS = [
  { value: "", label: "Sem recorrencia" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AccountingEntryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [percent, setPercent] = useState("");
  const [extra, setExtra] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [recurrence, setRecurrence] = useState("");

  const calculated = useMemo(() => {
    const base = parseMoney(unit) * Math.max(1, Number(quantity) || 1);
    const withPercent = base + base * ((Number(percent.replace(",", ".")) || 0) / 100);
    return withPercent + parseMoney(extra);
  }, [unit, quantity, percent, extra]);

  function useCalculatedValue() {
    setAmount(formatMoneyInput(calculated));
  }

  function submit(formData: FormData) {
    setError(null);
    setOk(null);
    startTransition(async () => {
      try {
        await createAccountingEntry(formData);
        formRef.current?.reset();
        setAmount("");
        setUnit("");
        setQuantity("1");
        setPercent("");
        setExtra("");
        setPeriodStart("");
        setPeriodEnd("");
        setRecurrence("");
        setOk("Lancamento registrado.");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao registrar lancamento.");
      }
    });
  }

  return (
    <section className="glass rise" style={{ padding: 22, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Lancamentos manuais</p>
          <h2 className="display" style={{ fontSize: 28 }}>Calculadora de custos</h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Registre impostos, fretes reais, embalagens, taxas, custos de produto, ajustes e despesas avulsas.
          </p>
        </div>
        <button type="button" className={open ? "btn btn-ghost" : "btn btn-gold"} onClick={() => setOpen((v) => !v)}>
          {open ? "Fechar" : "+ Novo lancamento"}
        </button>
      </div>

      {ok ? <p style={{ margin: 0, color: "var(--gold-light)", fontSize: 12 }}>{ok}</p> : null}
      {error ? <p style={{ margin: 0, color: "#e8a0a0", fontSize: 12 }}>{error}</p> : null}

      {open ? (
        <form ref={formRef} action={submit} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label className="field">
              <span>Tipo</span>
              <GlassSelect name="type" defaultValue="expense" options={TYPE_OPTIONS} ariaLabel="Tipo de lancamento" />
            </label>
            <label className="field">
              <span>Categoria</span>
              <input className="input" name="category" placeholder="Impostos, embalagem, materia-prima..." required />
            </label>
            <label className="field">
              <span>Descricao</span>
              <input className="input" name="description" placeholder="Ex: ICMS estimado do mes" required />
            </label>
            <label className="field">
              <span>Data do lancamento</span>
              <GlassDateInput name="occurred_at" value={occurredAt} onChange={setOccurredAt} placeholder="Selecionar data" />
            </label>
          </div>

          <div className="glass" style={{ padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 5 }}>Composicao do valor</p>
                <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
                  Use a calculadora ou informe o valor final manualmente.
                </p>
              </div>
              <strong style={{ color: "var(--gold-light)" }}>{brl(calculated)}</strong>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <label className="field">
                <span>Valor unitario</span>
                <input className="input" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="0,00" />
              </label>
              <label className="field">
                <span>Quantidade</span>
                <input className="input" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </label>
              <label className="field">
                <span>% adicional</span>
                <input className="input" value={percent} onChange={(event) => setPercent(event.target.value)} placeholder="0" />
              </label>
              <label className="field">
                <span>Custo extra</span>
                <input className="input" value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="0,00" />
              </label>
              <label className="field">
                <span>Valor final</span>
                <input className="input" name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required />
              </label>
              <div className="field" style={{ justifyContent: "end" }}>
                <button type="button" className="btn btn-ghost" onClick={useCalculatedValue} style={{ minHeight: 44 }}>
                  Usar calculo
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            <label className="field">
              <span>Fornecedor</span>
              <input className="input" name="vendor_name" placeholder="Fornecedor ou prestador" />
            </label>
            <label className="field">
              <span>Documento</span>
              <input className="input" name="document_number" placeholder="NF, recibo, boleto..." />
            </label>
            <label className="field">
              <span>Forma de pagamento</span>
              <input className="input" name="payment_method" placeholder="PIX, cartao, boleto..." />
            </label>
            <label className="field">
              <span>Centro de custo</span>
              <input className="input" name="cost_center" placeholder="Marketing, fiscal, operacao..." />
            </label>
            <label className="field">
              <span>Canal de origem</span>
              <input className="input" name="source_channel" placeholder="site, mercado_livre, shopee..." />
            </label>
            <label className="field">
              <span>Periodo inicial</span>
              <GlassDateInput name="period_start" value={periodStart} onChange={setPeriodStart} placeholder="Opcional" />
            </label>
            <label className="field">
              <span>Periodo final</span>
              <GlassDateInput name="period_end" value={periodEnd} onChange={setPeriodEnd} placeholder="Opcional" />
            </label>
            <label className="field">
              <span>Recorrencia</span>
              <GlassSelect name="recurrence_interval" value={recurrence} onChange={setRecurrence} options={RECURRENCE_OPTIONS} ariaLabel="Recorrencia" />
            </label>
            <label className="field">
              <span>Tags</span>
              <input className="input" name="tags" placeholder="fiscal, imposto, materia-prima" />
            </label>
          </div>

          <label className="field">
            <span>Observacoes</span>
            <textarea className="input" name="notes" rows={4} placeholder="Detalhes para auditoria interna." />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--cream-soft)", fontSize: 12 }}>
            <input type="checkbox" name="is_recurring" style={{ width: 16, height: 16 }} />
            Repetir este lancamento conforme a recorrencia selecionada
          </label>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" disabled={pending} className="btn btn-gold">
              {pending ? "Salvando..." : "Salvar lancamento"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
