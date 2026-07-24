"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { updateCrmStage } from "./actions";
import { type CrmStage } from "./crm-constants";

/* ─── PDF export ─────────────────────────────────────────────── */
const STAGE_QUAL: Record<
  string,
  { label: string; emoji: string; desc: string; criteria: string[] }
> = {
  lead: {
    label: "Lead",
    emoji: "🌱",
    desc: "Primeiro contato — demonstrou interesse na marca ou nos produtos.",
    criteria: [
      "Inscreveu-se na newsletter ou baixou um material",
      "Visitou o site mais de uma vez",
      "Interagiu nas redes sociais",
      "Solicitou informações sobre produtos",
    ],
  },
  contato: {
    label: "Contato",
    emoji: "💬",
    desc: "Engajamento ativo — respondeu a uma comunicação ou iniciou conversa.",
    criteria: [
      "Respondeu a um e-mail de boas-vindas",
      "Iniciou conversa pelo WhatsApp ou Instagram",
      "Adicionou produto ao carrinho (sem comprar)",
      "Solicitou cupom de desconto",
    ],
  },
  proposta: {
    label: "Proposta",
    emoji: "📋",
    desc: "Em consideração — recebeu oferta personalizada e está avaliando a compra.",
    criteria: [
      "Recebeu e abriu proposta ou cupom exclusivo",
      "Perguntou sobre condições de frete ou prazo",
      "Solicitou amostras ou mais informações de produto",
      "Voltou ao carrinho após abandono",
    ],
  },
  cliente: {
    label: "Cliente",
    emoji: "✅",
    desc: "Convertido — realizou pelo menos uma compra na Flora Botanics.",
    criteria: [
      "Pedido pago e confirmado",
      "Recebeu e-mail de pós-compra",
      "Avaliou o produto ou deixou review",
      "Indicou a marca para outra pessoa",
    ],
  },
  fidelizado: {
    label: "Fidelizado",
    emoji: "⭐",
    desc: "Cliente recorrente — compra com regularidade e tem alto valor de relacionamento.",
    criteria: [
      "Realizou 2 ou mais compras",
      "Ticket médio acima da média da base",
      "Participa de programa de fidelidade ou assinatura",
      "Engajamento alto em e-mails e campanhas",
    ],
  },
};

function buildPdfHtml(customers: KanbanCustomer[]): string {
  const now = new Date().toLocaleDateString("pt-BR", {
    dateStyle: "full",
  });

  const stageOrder: CrmStage[] = ["lead", "contato", "proposta", "cliente", "fidelizado"];

  const sections = stageOrder
    .map((stageId) => {
      const info = STAGE_QUAL[stageId];
      const group = customers.filter((c) => c.crm_stage === stageId);

      const rows = group
        .map(
          (c) => `
        <tr>
          <td>${c.full_name ?? "—"}</td>
          <td>${c.email}</td>
          <td>${c.whatsapp ?? "—"}</td>
          <td>${c.tags?.length ? c.tags.join(", ") : "—"}</td>
        </tr>`
        )
        .join("");

      const table =
        group.length > 0
          ? `<table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Tags</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
          : `<p class="empty">Nenhum contato nesta etapa.</p>`;

      return `
      <section class="stage">
        <div class="stage-header">
          <span class="stage-emoji">${info.emoji}</span>
          <div>
            <h2>${info.label} <span class="count">${group.length}</span></h2>
            <p class="desc">${info.desc}</p>
          </div>
        </div>
        <div class="criteria">
          <strong>Qualificação da etapa:</strong>
          <ul>${info.criteria.map((c) => `<li>${c}</li>`).join("")}</ul>
        </div>
        ${table}
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Pipeline CRM — Flora Botanics</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #1a2e1c; background: #fff; padding: 40px; }
    header { border-bottom: 2px solid #2a4a2c; padding-bottom: 16px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
    header h1 { font-size: 22px; letter-spacing: 2px; text-transform: uppercase; }
    header .meta { font-size: 11px; color: #6b7c6b; text-align: right; }
    .summary { display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap; }
    .summary-chip { border: 1px solid #c8d4c8; border-radius: 6px; padding: 8px 14px; font-size: 11px; }
    .summary-chip strong { display: block; font-size: 18px; margin-bottom: 2px; }
    .stage { margin-bottom: 32px; page-break-inside: avoid; }
    .stage-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
    .stage-emoji { font-size: 22px; }
    .stage-header h2 { font-size: 15px; }
    .stage-header .count { font-size: 12px; background: #e8f0e8; border-radius: 999px; padding: 1px 8px; margin-left: 6px; }
    .stage-header .desc { font-size: 11px; color: #6b7c6b; margin-top: 3px; }
    .criteria { background: #f7f9f7; border-left: 3px solid #2a4a2c; padding: 8px 12px; margin-bottom: 10px; font-size: 11px; }
    .criteria ul { margin: 4px 0 0 16px; }
    .criteria li { margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #2a4a2c; color: #f2ecdf; padding: 6px 10px; text-align: left; font-weight: 700; letter-spacing: 0.5px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e8e8e8; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f9faf9; }
    .empty { font-size: 11px; color: #9aaa9a; padding: 8px 0; }
    footer { margin-top: 40px; border-top: 1px solid #c8d4c8; padding-top: 12px; font-size: 10px; color: #9aaa9a; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Flora Botanics</h1>
      <div style="font-size:11px;color:#6b7c6b;margin-top:4px;">Pipeline CRM — Relatório de qualificação por etapa do funil</div>
    </div>
    <div class="meta">
      Gerado em ${now}<br/>
      Total: ${customers.length} contatos
    </div>
  </header>

  <div class="summary">
    ${stageOrder
      .map((s) => {
        const count = customers.filter((c) => c.crm_stage === s).length;
        const info = STAGE_QUAL[s];
        return `<div class="summary-chip"><strong>${count}</strong>${info.label}</div>`;
      })
      .join("")}
  </div>

  ${sections}

  <footer>Flora Botanics · Pipeline CRM · florabotanics.com.br</footer>
</body>
</html>`;
}

export interface KanbanCustomer {
  id: string;
  full_name: string | null;
  email: string;
  whatsapp: string | null;
  tags: string[];
  crm_stage: CrmStage;
  order_count?: number;
}

const STAGES: { id: CrmStage; label: string; emoji: string; color: string; accent: string }[] = [
  { id: "lead", label: "Lead", emoji: "🌱", color: "rgba(143,212,134,0.08)", accent: "rgba(143,212,134,0.35)" },
  { id: "contato", label: "Contato", emoji: "💬", color: "rgba(127,184,196,0.08)", accent: "rgba(127,184,196,0.35)" },
  { id: "proposta", label: "Proposta", emoji: "📋", color: "rgba(185,146,77,0.08)", accent: "rgba(185,146,77,0.35)" },
  { id: "cliente", label: "Cliente", emoji: "✅", color: "rgba(159,141,224,0.08)", accent: "rgba(159,141,224,0.35)" },
  { id: "fidelizado", label: "Fidelizado", emoji: "⭐", color: "rgba(224,160,176,0.08)", accent: "rgba(224,160,176,0.35)" },
];

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
  return email[0].toUpperCase();
}

function CustomerCard({
  customer,
  accent,
  onDragStart,
}: {
  customer: KanbanCustomer;
  accent: string;
  onDragStart: (id: string) => void;
}) {
  const abbrev = initials(customer.full_name, customer.email);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(customer.id)}
      style={{
        background: "rgba(10,22,11,0.48)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
        padding: "12px 14px",
        cursor: "grab",
        userSelect: "none",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.28)",
        transition: "box-shadow 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.45)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.28)";
        (e.currentTarget as HTMLDivElement).style.transform = "";
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* avatar */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: accent,
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 13,
            flexShrink: 0,
            color: "var(--cream)",
          }}
        >
          {abbrev}
        </div>
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/backoffice/clientes/${customer.id}`}
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "var(--cream)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {customer.full_name ?? customer.email}
          </Link>
          {customer.full_name && (
            <span
              style={{
                fontSize: 11,
                color: "var(--cream-dim)",
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {customer.email}
            </span>
          )}
        </div>
      </div>

      {customer.tags?.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 9 }}>
          {customer.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: "rgba(185,146,77,0.15)",
                border: "1px solid rgba(185,146,77,0.3)",
                color: "var(--gold-light)",
                letterSpacing: 0.3,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {customer.whatsapp && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "#8fd486", flexShrink: 0 }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 8 8l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
          </svg>
          <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>{customer.whatsapp}</span>
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ customers: initial }: { customers: KanbanCustomer[] }) {
  const [customers, setCustomers] = useState<KanbanCustomer[]>(initial);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const dragId = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  function exportPdf() {
    const html = buildPdfHtml(customers);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }

  function onDragStart(id: string) {
    dragId.current = id;
  }

  function onDragOver(e: React.DragEvent, stageId: CrmStage) {
    e.preventDefault();
    setOverStage(stageId);
  }

  function onDrop(stageId: CrmStage) {
    const id = dragId.current;
    dragId.current = null;
    setOverStage(null);
    if (!id) return;

    const customer = customers.find((c) => c.id === id);
    if (!customer || customer.crm_stage === stageId) return;

    // optimistic update
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, crm_stage: stageId } : c))
    );

    startTransition(() => {
      updateCrmStage(id, stageId);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* toolbar PDF */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={exportPdf}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", fontSize: 11 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Exportar PDF
        </button>
      </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${STAGES.length}, minmax(220px, 1fr))`,
        gap: 14,
        overflowX: "auto",
        paddingBottom: 24,
      }}
    >
      {STAGES.map((stage) => {
        const cards = customers.filter((c) => c.crm_stage === stage.id);
        const isOver = overStage === stage.id;

        return (
          <div
            key={stage.id}
            onDragOver={(e) => onDragOver(e, stage.id)}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={() => onDrop(stage.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: isOver ? stage.color : "rgba(10,22,11,0.18)",
              border: `1px solid ${isOver ? stage.accent : "var(--glass-border)"}`,
              borderRadius: 16,
              padding: "14px 12px",
              minHeight: 200,
              transition: "background 0.15s, border-color 0.15s",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {/* column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
                paddingBottom: 10,
                borderBottom: `1px solid ${stage.accent}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 16 }}>{stage.emoji}</span>
                <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" }}>
                  {stage.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: stage.accent,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--cream)",
                }}
              >
                {cards.length}
              </span>
            </div>

            {/* cards */}
            {cards.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                accent={stage.accent}
                onDragStart={onDragStart}
              />
            ))}

            {cards.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--cream-dim)",
                  fontSize: 11,
                  border: "1px dashed var(--glass-border)",
                  borderRadius: 10,
                  padding: 20,
                  minHeight: 80,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {isOver ? "⬇ Soltar aqui" : "Arraste cards aqui"}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
