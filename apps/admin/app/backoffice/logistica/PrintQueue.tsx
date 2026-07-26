"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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

type PrintTemplate = {
  id: string;
  name: string;
  group: string;
  description: string;
  compatible: "all" | "shipping" | "product";
  widthMm: number;
  heightMm: number;
  barcodeSize: "small" | "medium" | "large";
  density: "compact" | "standard" | "complete";
  page: "single" | "a4" | "sheet";
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

const printTemplates: PrintTemplate[] = [
  {
    id: "auto",
    name: "Automático por uso",
    group: "Recomendado",
    description: "Usa etiqueta completa para envio e etiqueta SKU para produtos na mesma impressão.",
    compatible: "all",
    widthMm: 100,
    heightMm: 150,
    barcodeSize: "medium",
    density: "standard",
    page: "single",
  },
  {
    id: "mixed_a4_sheet",
    name: "Folha econômica mista A4",
    group: "Lote",
    description: "Distribui várias etiquetas por folha para economizar papel em separação, conferência e expedição.",
    compatible: "all",
    widthMm: 86,
    heightMm: 54,
    barcodeSize: "medium",
    density: "standard",
    page: "sheet",
  },
  {
    id: "shipping_100x150",
    name: "Envio térmica 100 x 150 mm",
    group: "Envio",
    description: "Etiqueta completa com cliente, endereço, telefone, observação, rastreio e código de barras.",
    compatible: "shipping",
    widthMm: 100,
    heightMm: 150,
    barcodeSize: "large",
    density: "complete",
    page: "single",
  },
  {
    id: "shipping_a4",
    name: "Envio A4",
    group: "Envio",
    description: "Modelo grande para folha A4, útil quando não houver impressora térmica.",
    compatible: "shipping",
    widthMm: 190,
    heightMm: 135,
    barcodeSize: "large",
    density: "complete",
    page: "a4",
  },
  {
    id: "sku_50x30",
    name: "SKU estoque 50 x 30 mm",
    group: "Produto",
    description: "Etiqueta compacta para colar em produtos, caixas internas e prateleiras.",
    compatible: "product",
    widthMm: 50,
    heightMm: 30,
    barcodeSize: "small",
    density: "compact",
    page: "single",
  },
  {
    id: "sku_a4_3x8",
    name: "SKU em folha A4 3 x 8",
    group: "Produto",
    description: "Até 24 etiquetas compactas por folha para SKU, validade, lote e controle interno.",
    compatible: "product",
    widthMm: 63,
    heightMm: 33,
    barcodeSize: "small",
    density: "compact",
    page: "sheet",
  },
  {
    id: "barcode_60x40",
    name: "Código de barras 60 x 40 mm",
    group: "Produto",
    description: "Código de barras legível com nome curto e SKU.",
    compatible: "product",
    widthMm: 60,
    heightMm: 40,
    barcodeSize: "medium",
    density: "standard",
    page: "single",
  },
  {
    id: "barcode_100x50",
    name: "Código de barras grande 100 x 50 mm",
    group: "Produto",
    description: "Modelo maior para caixas, kits, lotes e volumes de estoque.",
    compatible: "product",
    widthMm: 100,
    heightMm: 50,
    barcodeSize: "large",
    density: "standard",
    page: "single",
  },
  {
    id: "barcode_a4_2x7",
    name: "Código de barras A4 2 x 7",
    group: "Produto",
    description: "Até 14 etiquetas médias por folha, com leitura confortável para caixas e kits.",
    compatible: "product",
    widthMm: 95,
    heightMm: 38,
    barcodeSize: "medium",
    density: "standard",
    page: "sheet",
  },
  {
    id: "kit_80x50",
    name: "Kit, combo ou lote 80 x 50 mm",
    group: "Produto",
    description: "Etiqueta intermediária para identificação de kits, combos e separação interna.",
    compatible: "product",
    widthMm: 80,
    heightMm: 50,
    barcodeSize: "medium",
    density: "standard",
    page: "single",
  },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function copies(item: PrintQueueItem) {
  return Array.from({ length: Math.max(1, item.copies) }, (_, index) => `${item.id}-${index}`);
}

function getTemplate(templateId: string) {
  return printTemplates.find((template) => template.id === templateId) ?? printTemplates[0];
}

function templateForItem(template: PrintTemplate, item: PrintQueueItem) {
  if (template.id !== "auto") return template;
  return item.kind === "shipping" ? getTemplate("shipping_100x150") : getTemplate("sku_50x30");
}

function isCompatible(template: PrintTemplate, items: PrintQueueItem[]) {
  if (template.compatible === "all") return true;
  return items.length > 0 && items.every((item) => item.kind === template.compatible);
}

export function PrintQueue({ items }: { items: PrintQueueItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((item) => item.status === "queued").map((item) => item.id)));
  const [printIds, setPrintIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("auto");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [pendingPrintItems, setPendingPrintItems] = useState<PrintQueueItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const selectedTemplate = getTemplate(templateId);
  const compatibleTemplates = printTemplates.filter((template) => isCompatible(template, pendingPrintItems));

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

  function openTemplateModal(itemsToPrint = selectedItems) {
    if (!itemsToPrint.length) {
      setMessage("Selecione ao menos uma etiqueta.");
      return;
    }
    const currentTemplate = getTemplate(templateId);
    const nextTemplateId = isCompatible(currentTemplate, itemsToPrint) ? currentTemplate.id : "auto";
    setTemplateId(nextTemplateId);
    setPendingPrintItems(itemsToPrint);
    setMessage(null);
    setTemplateModalOpen(true);
  }

  function printWithTemplate() {
    if (!pendingPrintItems.length) {
      setMessage("Selecione ao menos uma etiqueta.");
      setTemplateModalOpen(false);
      return;
    }
    setPrintIds(pendingPrintItems.map((item) => item.id));
    setTemplateModalOpen(false);
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
            padding: var(--print-padding);
            background: white;
            color: #111;
            gap: var(--sheet-gap);
            align-content: start;
            grid-template-columns: var(--sheet-columns);
          }
          .flora-print-label {
            break-inside: avoid;
            box-sizing: border-box;
            border: 1px solid #111;
            border-radius: 2mm;
            padding: 4mm;
            width: var(--label-width);
            min-height: var(--label-height);
            max-width: 100%;
            font-family: Arial, sans-serif;
            overflow: hidden;
          }
          .flora-print-label[data-page="single"] {
            page-break-after: always;
          }
          .flora-print-label h2 {
            font-size: var(--label-title-size);
            line-height: 1.12;
          }
          .flora-print-barcode {
            font-size: var(--barcode-size);
            letter-spacing: var(--barcode-spacing);
          }
          .flora-print-note {
            display: var(--note-display);
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
          <button type="button" className="btn btn-gold" style={{ padding: "8px 13px", fontSize: 10 }} onClick={() => openTemplateModal()}>
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
                    <button type="button" className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 10 }} onClick={() => openTemplateModal([item])}>
                      Reimprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mounted && templateModalOpen
        ? createPortal(
            <div style={modalBackdropStyle} role="presentation" onMouseDown={() => setTemplateModalOpen(false)}>
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="print-template-title"
                style={modalStyle}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                  <div>
                    <p className="eyebrow">Formato de impressão</p>
                    <h2 id="print-template-title" style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 900 }}>
                      Escolha o modelo da etiqueta
                    </h2>
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                      {pendingPrintItems.length} etiqueta(s) selecionada(s). O modelo define tamanho, densidade e leitura do código.
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }} onClick={() => setTemplateModalOpen(false)}>
                    Fechar
                  </button>
                </div>

                <div style={modalBodyStyle}>
                  <div style={templateGridStyle}>
                    {compatibleTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setTemplateId(template.id)}
                        style={{
                          ...templateCardStyle,
                          borderColor: templateId === template.id ? "var(--gold-light)" : "var(--glass-border)",
                          background: templateId === template.id ? "rgba(185,146,77,0.18)" : "rgba(10,22,11,0.42)",
                          boxShadow: templateId === template.id ? "0 16px 38px rgba(185,146,77,0.16)" : "none",
                        }}
                      >
                        <span className="eyebrow" style={{ color: "var(--gold-light)" }}>{template.group}</span>
                        <strong style={{ display: "block", marginTop: 7, fontSize: 14 }}>{template.name}</strong>
                        <span className="muted" style={{ display: "block", marginTop: 6, fontSize: 11, lineHeight: 1.45 }}>
                          {template.description}
                        </span>
                        <span style={templateMetaStyle}>
                          {template.widthMm} x {template.heightMm} mm · {template.page === "single" ? "individual" : "folha A4"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div style={previewPanelStyle}>
                    <p className="eyebrow">Prévia</p>
                    <PreviewLabel template={selectedTemplate} item={pendingPrintItems[0]} />
                    <p className="muted" style={{ margin: "10px 0 0", fontSize: 10.5 }}>
                      Use modelos compactos para SKU e produtos pequenos. Use modelos completos para envio e rastreio.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: 10 }} onClick={() => setTemplateModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-gold" style={{ padding: "10px 22px", fontSize: 10 }} onClick={printWithTemplate}>
                    Imprimir neste modelo
                  </button>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      <div
        className="flora-print-area"
        aria-hidden="true"
        data-page-mode={selectedTemplate.page}
        style={{
          "--sheet-columns": selectedTemplate.page === "sheet"
            ? `repeat(auto-fill, minmax(${selectedTemplate.widthMm}mm, ${selectedTemplate.widthMm}mm))`
            : "1fr",
          "--sheet-gap": selectedTemplate.page === "sheet" ? "2mm" : "5mm",
          "--print-padding": selectedTemplate.page === "sheet" ? "7mm" : "10mm",
        } as CSSProperties}
      >
        {printableItems.flatMap((item) =>
          copies(item).map((copyKey) => {
            const itemTemplate = templateForItem(selectedTemplate, item);
            return (
              <PrintLabel key={copyKey} item={item} template={itemTemplate} />
            );
          })
        )}
      </div>
    </div>
  );
}

function PrintLabel({ item, template }: { item: PrintQueueItem; template: PrintTemplate }) {
  const compact = template.density === "compact";
  return (
    <section
      className="flora-print-label"
      data-page={template.page}
      style={{
        "--label-width": `${template.widthMm}mm`,
        "--label-height": `${template.heightMm}mm`,
        "--label-title-size": compact ? "10px" : template.density === "complete" ? "18px" : "14px",
        "--barcode-size": template.barcodeSize === "large" ? "17px" : template.barcodeSize === "medium" ? "13px" : "10px",
        "--barcode-spacing": template.barcodeSize === "large" ? "2px" : "1.2px",
        "--note-display": compact ? "none" : "block",
      } as CSSProperties}
    >
      <p style={{ margin: 0, fontSize: compact ? 7 : 11, letterSpacing: 1.4, textTransform: "uppercase" }}>Flora Botanics</p>
      <h2 style={{ margin: compact ? "3px 0" : "6px 0", fontWeight: 800 }}>{item.title}</h2>
      <p style={{ margin: "0 0 6px", fontSize: compact ? 7 : 12 }}>{item.subtitle}</p>
      <div className="flora-print-barcode" style={{ border: "1px solid #111", padding: compact ? "4px 5px" : "8px 10px", fontWeight: 800 }}>
        ||| {item.barcode} |||
      </div>
      {item.notes.map((note) => (
        <p key={note} className="flora-print-note" style={{ margin: "6px 0 0", fontSize: 11 }}>{note}</p>
      ))}
    </section>
  );
}

function PreviewLabel({ template, item }: { template: PrintTemplate; item?: PrintQueueItem }) {
  const sample = item ?? {
    id: "preview",
    kind: "product" as const,
    status: "queued",
    format: "thermal",
    copies: 1,
    title: "Sérum Flora",
    subtitle: "SKU FLORA-SERUM",
    barcode: "FLORA-SERUM-001",
    notes: ["Etiqueta interna de produto/estoque"],
    createdAt: new Date().toISOString(),
  };
  const previewScale = Math.min(1, 165 / template.widthMm, 118 / template.heightMm);
  return (
    <div style={{ minHeight: 146, display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: template.widthMm * previewScale,
          minHeight: template.heightMm * previewScale,
          border: "1px solid var(--glass-border)",
          borderRadius: 10,
          padding: 10,
          background: "rgba(242,236,223,0.92)",
          color: "#111",
          overflow: "hidden",
          boxShadow: "0 18px 45px rgba(0,0,0,0.24)",
        }}
      >
        <p style={{ margin: 0, fontSize: 8, letterSpacing: 1.2, textTransform: "uppercase" }}>Flora Botanics</p>
        <strong style={{ display: "block", marginTop: 7, fontSize: template.density === "compact" ? 10 : 14, lineHeight: 1.08 }}>
          {sample.title}
        </strong>
        <span style={{ display: "block", marginTop: 5, fontSize: 9 }}>{sample.subtitle}</span>
        <div style={{ marginTop: 8, border: "1px solid #111", padding: 6, fontSize: template.barcodeSize === "large" ? 13 : 10, fontWeight: 800 }}>
          ||| {sample.barcode} |||
        </div>
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

const modalBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  display: "grid",
  placeItems: "center",
  padding: "24px max(18px, env(safe-area-inset-right)) 24px max(18px, env(safe-area-inset-left))",
  background: "rgba(3, 10, 5, 0.72)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const modalStyle: CSSProperties = {
  width: "min(920px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  display: "grid",
  gap: 20,
  borderRadius: 22,
  border: "1px solid var(--glass-border)",
  background: "linear-gradient(145deg, rgba(20,49,26,0.92), rgba(7,21,10,0.96))",
  boxShadow: "0 30px 80px rgba(0,0,0,0.48)",
  padding: 24,
  color: "var(--cream)",
};

const modalBodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(220px, 0.75fr)",
  gap: 18,
  alignItems: "start",
};

const templateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const templateCardStyle: CSSProperties = {
  textAlign: "left",
  color: "var(--cream)",
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};

const templateMetaStyle: CSSProperties = {
  display: "inline-flex",
  marginTop: 10,
  borderRadius: 999,
  border: "1px solid rgba(242,236,223,0.16)",
  padding: "4px 9px",
  color: "var(--cream-dim)",
  fontSize: 10,
};

const previewPanelStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,248,234,0.07)",
};
