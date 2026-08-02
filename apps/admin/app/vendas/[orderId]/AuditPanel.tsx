"use client";

import { useState, useTransition } from "react";
import { updateAuditReason, deleteAuditEvent, archiveOrder, softDeleteOrder } from "./order-actions";
import { buildFloraKraftPDF, openAndPrint } from "@/lib/pdf/template";

export interface AuditRow {
  id: string;
  action: string;
  reason: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

interface Props {
  orderId: string;
  orderNumber: string | number;
  initialAudits: AuditRow[];
  isAdmin: boolean;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    order_operation_updated: "Operação do pedido atualizada",
    payment_registered: "Pagamento registrado",
    order_archived: "Pedido arquivado",
    order_soft_deleted: "Pedido excluído (lógico)",
    order_canceled: "Pedido cancelado",
    order_duplicated: "Pedido duplicado",
    pdv_sale: "Venda PDV",
    audit_event_deleted: "Evento de auditoria removido",
    shipping_event: "Evento de rastreamento",
    label_generated: "Etiqueta gerada",
    label_printed: "Etiqueta impressa",
    quote_selected: "Cotação selecionada",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

// ── Mapeamento de chaves técnicas → rótulos legíveis ──────────────────────

const FIELD_LABELS: Record<string, string> = {
  // Operação geral
  origin_label: "Origem visível",
  manual_channel: "Canal interno",
  notes: "Observações internas",
  internal_tags: "Tags internas",
  // Pagamento
  payment_status: "Status financeiro",
  "payment_summary.method": "Método de pagamento",
  "payment_summary.terms": "Condição de pagamento",
  "payment_summary.external_identifier": "Identificador externo",
  "payment_summary.due_dates": "Vencimentos",
  "payment_summary.notes": "Observação de pagamento",
  amount_cents: "Valor (centavos)",
  // Entrega
  "delivery_summary.mode": "Modo de entrega",
  "delivery_summary.carrier": "Transportadora",
  "delivery_summary.service": "Serviço",
  "delivery_summary.deadline": "Prazo",
  "delivery_summary.tracking_code": "Código de rastreio",
  "delivery_summary.package": "Embalagem",
  "delivery_summary.customer_observation": "Obs. do cliente",
  // Fiscal
  "fiscal_summary.invoice_kind": "Nota fiscal",
  "fiscal_summary.operation_nature": "Natureza da operação",
  "fiscal_summary.cfop": "CFOP",
  "fiscal_summary.fiscal_notes": "Notas fiscais",
  // Status / evento
  status: "Status do pedido",
  payment_status_new: "Status financeiro (novo)",
  // Arquivamento / exclusão
  archived_at: "Arquivado em",
  deleted_at: "Excluído em",
  // Pagamento baixa
  provider: "Método",
  provider_payment_id: "ID do pagamento",
  last_payment_cents: "Último pagamento",
  last_payment_at: "Data do pagamento",
  last_payment_method: "Método do pagamento",
  last_receipt_reference: "Comprovante",
  // Rastreamento
  description: "Descrição",
  location: "Local",
  carrier: "Transportadora",
  tracking_code: "Código",
  // Outros
  commission_summary: "Comissões",
  deleted_audit_id: "ID do evento removido",
  source_order_id: "Pedido de origem",
  duplicated_order_id: "Pedido duplicado",
};

const CHANNEL_LABELS: Record<string, string> = {
  atendimento_direto: "Atendimento direto",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  loja_fisica: "Loja física",
  representante: "Representante",
  marketplace: "Marketplace",
  b2b: "B2B",
  b2c: "B2C",
  outro: "Outro canal",
  pdv: "PDV",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
  scheduled: "Agendado",
  failed: "Falhou",
  refunded: "Reembolsado",
  canceled: "Cancelado",
  delivered: "Entregue",
  in_transit: "Em trânsito",
  out_for_delivery: "Saiu para entrega",
  dispatched: "Despachado",
  exception: "Ocorrência",
};

function humanizeValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const str = String(value).trim();
  if (!str) return "—";
  // centavos → reais
  if (key.includes("cents") || key.includes("amount")) {
    const num = Number(str);
    if (!Number.isNaN(num)) return `R$ ${(num / 100).toFixed(2).replace(".", ",")}`;
  }
  // status / canal
  return STATUS_LABELS[str] ?? CHANNEL_LABELS[str] ?? str;
}

/** Achata um objeto aninhado em chaves planas (máx. 2 níveis) */
function flattenObj(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenObj(v as Record<string, unknown>, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

/** Retorna apenas os campos que mudaram entre before e after */
function diffValues(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Array<{ label: string; key: string; before: unknown; after: unknown }> {
  const flatBefore = before ? flattenObj(before) : {};
  const flatAfter = after ? flattenObj(after) : {};

  const allKeys = new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]);
  const diffs: Array<{ label: string; key: string; before: unknown; after: unknown }> = [];

  for (const key of allKeys) {
    const vBefore = flatBefore[key];
    const vAfter = flatAfter[key];
    // Arrays: comparar serializado
    const strBefore = Array.isArray(vBefore) ? vBefore.join(", ") : String(vBefore ?? "");
    const strAfter = Array.isArray(vAfter) ? vAfter.join(", ") : String(vAfter ?? "");
    if (strBefore === strAfter) continue;
    // Ignora IDs internos e campos de sistema que não têm rótulo mapeado
    const label = FIELD_LABELS[key];
    if (!label) continue;
    diffs.push({ label, key, before: vBefore, after: vAfter });
  }

  return diffs;
}

/** Renderiza os campos alterados de forma legível, sem JSON bruto */
function AuditDiff({
  action,
  previousValue,
  newValue,
}: {
  action: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}) {
  const diffs = diffValues(previousValue, newValue);

  // Se não há diff mapeado, mostra resumo compacto do new_value
  if (diffs.length === 0 && newValue) {
    const flat = flattenObj(newValue);
    const mapped = Object.entries(flat)
      .filter(([k]) => FIELD_LABELS[k])
      .slice(0, 8);
    if (mapped.length === 0) return null;
    return (
      <div style={diffBox}>
        {mapped.map(([k, v]) => (
          <div key={k} style={diffRow}>
            <span style={diffLabel}>{FIELD_LABELS[k]}</span>
            <span style={diffAfter}>{humanizeValue(k, v)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (diffs.length === 0) return null;

  return (
    <div style={diffBox}>
      {diffs.map(({ label, key, before, after }) => (
        <div key={key} style={diffRow}>
          <span style={diffLabel}>{label}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {before !== undefined && before !== null && String(before) !== "undefined" && (
              <span style={diffBefore}>{humanizeValue(key, before)}</span>
            )}
            {before !== undefined && before !== null && String(before) !== "undefined" && (
              <span style={{ fontSize: 10, opacity: 0.5 }}>→</span>
            )}
            <span style={diffAfter}>{humanizeValue(key, after)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const diffBox: React.CSSProperties = {
  marginTop: 8,
  display: "grid",
  gap: 5,
  padding: "10px 12px",
  background: "rgba(242,236,223,0.04)",
  borderRadius: 8,
  border: "1px solid var(--glass-border)",
};

const diffRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  fontSize: 11.5,
  flexWrap: "wrap",
};

const diffLabel: React.CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 11,
  flexShrink: 0,
  minWidth: 140,
};

const diffBefore: React.CSSProperties = {
  textDecoration: "line-through",
  opacity: 0.5,
  fontSize: 11,
};

const diffAfter: React.CSSProperties = {
  color: "#8fd486",
  fontWeight: 600,
  fontSize: 11.5,
};

function actionIcon(action: string) {
  if (action.includes("cancel")) return "🚫";
  if (action.includes("delet")) return "🗑️";
  if (action.includes("archiv")) return "📦";
  if (action.includes("payment")) return "💰";
  if (action.includes("pdv")) return "🛒";
  if (action.includes("label")) return "🏷️";
  if (action.includes("quote")) return "📊";
  if (action.includes("ship")) return "🚚";
  return "📋";
}

// ── Gerador de PDF de auditoria — usa template centralizado Flora ──────────

function generateAuditPDF(
  orderId: string,
  orderNumber: string | number,
  audits: AuditRow[]
) {
  const rows = audits
    .map((a) => {
      const valueStr = a.new_value
        ? JSON.stringify(a.new_value, null, 2).slice(0, 500)
        : "";
      return `
        <tr>
          <td style="white-space:nowrap">${formatDate(a.created_at)}</td>
          <td><strong>${actionLabel(a.action)}</strong><br/><small style="opacity:0.6;font-size:9px">${a.action}</small></td>
          <td>${a.reason ?? "—"}</td>
          <td><pre>${valueStr || "—"}</pre></td>
        </tr>`;
    })
    .join("");

  const body = `
    <table>
      <thead>
        <tr>
          <th style="width:115px">Data/Hora</th>
          <th style="width:200px">Ação</th>
          <th style="width:160px">Motivo / Anotação</th>
          <th>Dados</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:10px;color:#8b7a6a;margin-top:8px">Total: ${audits.length} evento(s) · ID do pedido: ${orderId}</p>
  `;

  const html = buildFloraKraftPDF({
    title: `Auditoria — Pedido #${orderNumber}`,
    subtitle: `Histórico completo de alterações e eventos do pedido #${orderNumber}`,
    body,
  });

  openAndPrint(html);
}

// ── Componente principal ───────────────────────────────────────────────────

export function AuditPanel({ orderId, orderNumber, initialAudits, isAdmin }: Props) {
  const [audits, setAudits] = useState<AuditRow[]>(initialAudits);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Arquivar pedido
  const [showArchive, setShowArchive] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  function flash(ok: boolean, message: string) {
    if (ok) { setMsg(message); setErr(null); }
    else { setErr(message); setMsg(null); }
    setTimeout(() => { setMsg(null); setErr(null); }, 4000);
  }

  function startEdit(audit: AuditRow) {
    setEditingId(audit.id);
    setEditReason(audit.reason ?? "");
  }

  function saveEdit(auditId: string) {
    startTransition(async () => {
      const result = await updateAuditReason(auditId, orderId, editReason);
      if (result.ok) {
        setAudits((prev) => prev.map((a) => a.id === auditId ? { ...a, reason: editReason || null } : a));
        setEditingId(null);
        flash(true, "Anotação salva.");
      } else {
        flash(false, result.error);
      }
    });
  }

  function handleDelete(auditId: string) {
    if (!confirm("Excluir este evento de auditoria? Esta ação é registrada.")) return;
    startTransition(async () => {
      const result = await deleteAuditEvent(auditId, orderId);
      if (result.ok) {
        setAudits((prev) => prev.filter((a) => a.id !== auditId));
        flash(true, "Evento removido.");
      } else {
        flash(false, result.error);
      }
    });
  }

  function handleArchive(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reason", archiveReason);
      const result = await archiveOrder(orderId, fd);
      if (result.ok) { flash(true, "Pedido arquivado."); setShowArchive(false); }
      else flash(false, result.error);
    });
  }

  function handleSoftDelete(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reason", deleteReason);
      const result = await softDeleteOrder(orderId, fd);
      if (result.ok) { flash(true, "Pedido marcado como excluído."); setShowDelete(false); }
      else flash(false, result.error);
    });
  }

  return (
    <section className="glass rise" style={{ padding: 22, marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <p className="eyebrow">📋 Auditoria do pedido</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "7px 14px", fontSize: 10 }}
            onClick={() => generateAuditPDF(orderId, orderNumber, audits)}
            disabled={audits.length === 0}
          >
            📄 Relatório PDF
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "7px 14px", fontSize: 10, color: "var(--gold-light)" }}
                onClick={() => { setShowArchive((v) => !v); setShowDelete(false); }}
              >
                📦 Arquivar pedido
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "7px 14px", fontSize: 10, color: "#e8a0a0" }}
                onClick={() => { setShowDelete((v) => !v); setShowArchive(false); }}
              >
                🗑️ Excluir pedido
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback */}
      {msg && <p style={{ color: "#4ade80", fontSize: 12, marginBottom: 10 }}>✓ {msg}</p>}
      {err && <p style={{ color: "#e8a0a0", fontSize: 12, marginBottom: 10 }}>⚠️ {err}</p>}

      {/* Formulário: arquivar */}
      {showArchive && (
        <form onSubmit={handleArchive} style={formStyle}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gold-light)", marginBottom: 8 }}>📦 Arquivar pedido</p>
          <input
            className="input"
            placeholder="Motivo do arquivamento (opcional)"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" className="btn btn-gold" style={{ padding: "8px 16px", fontSize: 11 }} disabled={pending}>
              {pending ? "Arquivando…" : "Confirmar arquivamento"}
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => setShowArchive(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Formulário: excluir */}
      {showDelete && (
        <form onSubmit={handleSoftDelete} style={{ ...formStyle, borderColor: "rgba(232,160,160,0.3)", background: "rgba(232,160,160,0.05)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#e8a0a0", marginBottom: 8 }}>🗑️ Excluir pedido (lógico)</p>
          <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>O pedido não será apagado do banco — ficará marcado como excluído e ocultado das listagens.</p>
          <input
            className="input"
            placeholder="Motivo obrigatório"
            required
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 11, color: "#e8a0a0", borderColor: "#e8a0a0" }} disabled={pending}>
              {pending ? "Excluindo…" : "Confirmar exclusão"}
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => setShowDelete(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Timeline de eventos */}
      {audits.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhum evento auditável registrado ainda.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {audits.map((audit) => {
            const isExpanded = expanded === audit.id;
            const hasData = audit.previous_value || audit.new_value;
            return (
              <div key={audit.id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14 }}>{actionIcon(audit.action)}</span>
                    <strong style={{ fontSize: 13 }}>{actionLabel(audit.action)}</strong>
                    <span className="muted" style={{ fontSize: 10.5 }}>{formatDate(audit.created_at)}</span>
                  </div>

                  {/* Resumo legível dos campos alterados — sempre visível */}
                  {hasData && editingId !== audit.id && !isExpanded && (
                    <AuditDiff
                      action={audit.action}
                      previousValue={audit.previous_value}
                      newValue={audit.new_value}
                    />
                  )}

                  {/* Razão / anotação */}
                  {editingId === audit.id ? (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        className="input"
                        style={{ flex: 1, fontSize: 12, minWidth: 200 }}
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="Anotação / motivo"
                        autoFocus
                      />
                      <button type="button" className="btn btn-gold" style={{ padding: "6px 12px", fontSize: 11 }} disabled={pending} onClick={() => saveEdit(audit.id)}>
                        {pending ? "…" : "Salvar"}
                      </button>
                      <button type="button" className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    audit.reason && (
                      <p style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 4 }}>
                        {audit.reason}
                      </p>
                    )
                  )}

                  {/* Dados expandidos — legível, sem JSON bruto */}
                  {hasData && isExpanded && (
                    <AuditDiff
                      action={audit.action}
                      previousValue={audit.previous_value}
                      newValue={audit.new_value}
                    />
                  )}
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexShrink: 0 }}>
                  {hasData && (
                    <button
                      type="button"
                      title={isExpanded ? "Ocultar dados" : "Ver dados"}
                      style={iconBtn}
                      onClick={() => setExpanded(isExpanded ? null : audit.id)}
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                  <button
                    type="button"
                    title="Editar anotação"
                    style={iconBtn}
                    onClick={() => startEdit(audit)}
                    disabled={editingId !== null}
                  >
                    ✏️
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Excluir evento"
                      style={{ ...iconBtn, color: "#e8a0a0" }}
                      onClick={() => handleDelete(audit.id)}
                      disabled={pending}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "12px 14px",
  background: "rgba(242,236,223,0.04)",
  borderRadius: 10,
  border: "1px solid var(--glass-border)",
};

const formStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "14px 16px",
  background: "rgba(185,146,77,0.06)",
  border: "1px solid rgba(185,146,77,0.2)",
  borderRadius: 10,
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--glass-border)",
  borderRadius: 6,
  color: "var(--cream-dim)",
  cursor: "pointer",
  fontSize: 12,
  padding: "4px 8px",
  lineHeight: 1,
};
