"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { markPrintJobsPrinted } from "./actions";

export type PrintQueueItem = {
  id: string;
  kind: "shipping" | "product";
  status: string;
  format: string;
  copies: number;
  title: string;
  subtitle: string;
  barcode: string;
  notes: string[];
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  queued: "Na fila",
  printing: "Imprimindo",
  printed: "Impressa",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const filters = [
  { value: "all", label: "Todas" },
  { value: "queued", label: "Na fila" },
  { value: "shipping", label: "Envio" },
  { value: "product", label: "Produto" },
  { value: "thermal", label: "Térmica" },
  { value: "a4", label: "A4" },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function copies(item: PrintQueueItem) {
  return Array.from({ length: Math.max(1, item.copies) }, (_, index) => `${item.id}-${index}`);
}

export function PrintQueue({ items }: { items: PrintQueueItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((item) => item.status === "queued").map((item) => item.id)));
  const [printIds, setPrintIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === "all") return true;
      if (filter === "queued") return item.status === "queued" || item.status === "printing";
      if (filter === "shipping" || filter === "product") return item.kind === filter;
      return item.format === filter;
    });
  }, [filter, items]);

  const selectedItems = items.filter((item) => selected.has(item.id));
  const printableItems = printIds.length ? items.filter((item) => printIds.includes(item.id)) : selectedItems;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selected.has(item.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const item of visibleItems) {
        if (allVisibleSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  function print(itemsToPrint = selectedItems) {
    if (!itemsToPrint.length) {
      setMessage("Selecione ao menos uma etiqueta.");
      return;
    }
    setMessage(null);
    setPrintIds(itemsToPrint.map((item) => item.id));
    window.setTimeout(() => window.print(), 80);
  }

  function markPrinted() {
    if (!selectedItems.length) {
      setMessage("Selecione ao menos uma etiqueta.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await markPrintJobsPrinted(selectedItems.map((item) => ({ id: item.id, kind: item.kind })));
      setMessage(result.ok ? "Etiquetas marcadas como impressas." : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <style>{`
        .flora-print-area { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .flora-print-area, .flora-print-area * { visibility: visible !important; }
          .flora-print-area {
            display: grid !important;
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            padding: 18px;
            background: white;
            color: #111;
            gap: 10px;
          }
          .flora-print-label {
            break-inside: avoid;
            border: 1px solid #111;
            border-radius: 8px;
            padding: 12px;
            min-height: 120px;
            font-family: Arial, sans-serif;
          }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={filter === option.value ? "btn btn-gold" : "btn btn-ghost"}
              style={{ padding: "8px 13px", fontSize: 10 }}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" style={{ padding: "8px 13px", fontSize: 10 }} onClick={toggleVisible}>
            Selecionar visíveis
          </button>
          <button type="button" className="btn btn-gold" style={{ padding: "8px 13px", fontSize: 10 }} onClick={() => print()}>
            Imprimir selecionadas
          </button>
          <button type="button" className="btn btn-ghost" disabled={pending} style={{ padding: "8px 13px", fontSize: 10 }} onClick={markPrinted}>
            Marcar impressas
          </button>
        </div>
      </div>

      {message ? (
        <p style={{ margin: 0, fontSize: 11, color: message.includes("Selecione") || message.includes("erro") ? "#e8a0a0" : "#8fd486" }}>
          {message}
        </p>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhuma etiqueta encontrada para este filtro.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>Etiqueta</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Formato</th>
                <th style={thStyle}>Cópias</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Criada em</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected.has(item.id)}
                      aria-label={`Selecionar ${item.title}`}
                      onClick={() => toggle(item.id)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        border: selected.has(item.id) ? "1px solid var(--gold-light)" : "1px solid var(--glass-border)",
                        background: selected.has(item.id) ? "rgba(185,146,77,0.22)" : "rgba(10,22,11,0.44)",
                        color: "var(--cream)",
                        cursor: "pointer",
                        boxShadow: selected.has(item.id) ? "0 0 0 3px rgba(185,146,77,0.12)" : "none",
                      }}
                    >
                      {selected.has(item.id) ? "✓" : ""}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <strong>{item.title}</strong>
                    <span className="muted" style={{ display: "block", fontSize: 10 }}>{item.subtitle}</span>
                    <code style={codeStyle}>{item.barcode}</code>
                  </td>
                  <td style={tdStyle}>{item.kind === "shipping" ? "Envio" : "Produto/estoque"}</td>
                  <td style={tdStyle}>{item.format.toUpperCase()}</td>
                  <td style={tdStyle}>{item.copies}</td>
                  <td style={tdStyle}><StatusBadge status={item.status} /></td>
                  <td style={tdStyle}>{formatDate(item.createdAt)}</td>
                  <td style={tdStyle}>
                    <button type="button" className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 10 }} onClick={() => print([item])}>
                      Reimprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flora-print-area" aria-hidden="true">
        {printableItems.flatMap((item) =>
          copies(item).map((copyKey) => (
            <section key={copyKey} className="flora-print-label">
              <p style={{ margin: 0, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" }}>Flora Botanics</p>
              <h2 style={{ margin: "6px 0", fontSize: 18 }}>{item.title}</h2>
              <p style={{ margin: "0 0 8px", fontSize: 12 }}>{item.subtitle}</p>
              <div style={{ border: "1px solid #111", padding: "8px 10px", fontSize: 16, letterSpacing: 2, fontWeight: 800 }}>
                ||| {item.barcode} |||
              </div>
              {item.notes.map((note) => (
                <p key={note} style={{ margin: "6px 0 0", fontSize: 11 }}>{note}</p>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const danger = status === "failed" || status === "cancelled";
  const ok = status === "printed";
  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: danger ? "#e8a0a0" : ok ? "#8fd486" : "var(--gold-light)",
        border: `1px solid ${danger ? "rgba(232,160,160,0.35)" : ok ? "rgba(143,212,134,0.35)" : "rgba(185,146,77,0.35)"}`,
        background: danger ? "rgba(232,160,160,0.1)" : ok ? "rgba(143,212,134,0.1)" : "rgba(185,146,77,0.12)",
      }}
    >
      {statusLabel[status] ?? status}
    </span>
  );
}

const thStyle: CSSProperties = {
  padding: "10px 12px",
  color: "var(--cream-dim)",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontSize: 10,
  borderBottom: "1px solid var(--glass-border)",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid rgba(242,236,223,0.08)",
  verticalAlign: "middle",
};

const codeStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 5,
  color: "var(--cream)",
  background: "rgba(10,22,11,0.38)",
  border: "1px solid var(--glass-border)",
  borderRadius: 6,
  padding: "3px 7px",
  fontSize: 11,
};
