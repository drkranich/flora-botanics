"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { ContactContext, InboxPriority } from "./inbox-actions";
import { getContactContext, setPriority, addTag, removeTag } from "./inbox-actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function dateShort(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

function dateRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendente",     color: "#f0b429" },
  paid:       { label: "Pago",         color: "#62c99d" },
  processing: { label: "Processando",  color: "#7ea8d9" },
  shipped:    { label: "Enviado",      color: "#a78bfa" },
  delivered:  { label: "Entregue",     color: "#4ade80" },
  canceled:   { label: "Cancelado",    color: "#ef4444" },
  refunded:   { label: "Reembolsado",  color: "#fb923c" },
};

const PRIORITIES: { id: InboxPriority; label: string; color: string }[] = [
  { id: "low",      label: "Baixa",    color: "#4ade80" },
  { id: "normal",   label: "Normal",   color: "rgba(242,236,223,0.4)" },
  { id: "high",     label: "Alta",     color: "#f0b429" },
  { id: "urgent",   label: "Urgente",  color: "#fb923c" },
  { id: "critical", label: "Crítica",  color: "#ef4444" },
];

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "var(--cream-dim)",
        opacity: 0.6,
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: "1px solid rgba(242,236,223,0.06)",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "rgba(10,22,11,0.55)",
      border: "1px solid rgba(242,236,223,0.07)",
      borderRadius: 10,
      padding: "10px 12px",
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 16,
        fontWeight: 700,
        color: "var(--gold-light)",
        fontFamily: "Manrope, sans-serif",
        lineHeight: 1.2,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 9.5,
        color: "var(--cream-dim)",
        fontFamily: "Manrope, sans-serif",
        marginTop: 3,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: "var(--cream-dim)", opacity: 0.6, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  conversationId: string | null;
  onPriorityChange?: (p: InboxPriority) => void;
}

export function InboxContext({ conversationId, onPriorityChange }: Props) {
  const [ctx, setCtx] = useState<ContactContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Tags locais (editáveis) — iniciadas do ctx após fetch
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  // Prioridade local — iniciada do ctx após fetch
  const [localPriority, setLocalPriority] = useState<InboxPriority>("normal");
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  // Expansão de seções
  const [showAllOrders, setShowAllOrders] = useState(false);

  useEffect(() => {
    if (!conversationId) { setCtx(null); setTags([]); setLocalPriority("normal"); return; }
    setLoading(true);
    startTransition(async () => {
      const res = await getContactContext(conversationId);
      setCtx(res);
      setLocalPriority(res.priority);
      setTags(res.convTags);
      setLoading(false);
    });
  }, [conversationId]);

  function handlePriority(p: InboxPriority) {
    if (!conversationId) return;
    setLocalPriority(p);
    setShowPriorityMenu(false);
    startTransition(async () => {
      await setPriority(conversationId, p);
      onPriorityChange?.(p);
    });
  }

  function handleAddTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t) || !conversationId) return;
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    setShowTagInput(false);
    startTransition(async () => { await addTag(conversationId, t); });
  }

  function handleRemoveTag(t: string) {
    if (!conversationId) return;
    setTags(prev => prev.filter(x => x !== t));
    startTransition(async () => { await removeTag(conversationId, t); });
  }

  const pDef = PRIORITIES.find(p => p.id === localPriority) ?? PRIORITIES[1];
  const visibleOrders = showAllOrders ? (ctx?.orders ?? []) : (ctx?.orders ?? []).slice(0, 3);

  // ── Sem conversa selecionada ──────────────────────────────────────────────

  if (!conversationId) {
    return (
      <aside style={asideStyle}>
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{ fontSize: 40, color: "var(--gold-light)", opacity: 0.12, marginBottom: 16, fontFamily: "Fraunces, serif" }}>
            ✦
          </div>
          <p style={{ fontSize: 12, color: "var(--cream-dim)", textAlign: "center", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>
            Selecione um atendimento
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside style={asideStyle}>
      {/* Header */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "Fraunces, serif",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--cream-soft)",
          letterSpacing: -0.2,
        }}>
          Contexto
        </div>
      </div>

      {/* Corpo rolável */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 24px" }}>

        {/* ── Prioridade ──────────────────────────────────────────────── */}
        <Section title="Prioridade">
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowPriorityMenu(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%",
                background: "rgba(10,22,11,0.5)",
                border: `1px solid ${pDef.color}35`,
                borderRadius: 9,
                padding: "8px 12px",
                cursor: "pointer",
                color: pDef.color,
                fontFamily: "Manrope, sans-serif",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: pDef.color,
                boxShadow: localPriority !== "normal" ? `0 0 6px ${pDef.color}` : "none",
                flexShrink: 0,
              }} />
              {pDef.label}
              <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: 10 }}>▾</span>
            </button>

            {showPriorityMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: "rgba(12,26,14,0.97)",
                border: "1px solid rgba(242,236,223,0.12)",
                borderRadius: 10,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                zIndex: 50,
                overflow: "hidden",
              }}>
                {PRIORITIES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePriority(p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      width: "100%", padding: "9px 14px",
                      background: p.id === localPriority ? "rgba(185,146,77,0.1)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: p.color,
                      fontFamily: "Manrope, sans-serif",
                      fontSize: 12.5,
                      fontWeight: p.id === localPriority ? 700 : 500,
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: p.color, flexShrink: 0,
                    }} />
                    {p.label}
                    {p.id === localPriority && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gold-light)" }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── Tags ────────────────────────────────────────────────────── */}
        <Section title="Tags">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {tags.map(t => (
              <span
                key={t}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(185,146,77,0.12)",
                  border: "1px solid rgba(185,146,77,0.25)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 10.5,
                  color: "var(--gold-light)",
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: 600,
                }}
              >
                {t}
                <button
                  onClick={() => handleRemoveTag(t)}
                  disabled={isPending}
                  style={{
                    background: "none", border: "none",
                    cursor: "pointer", padding: 0, lineHeight: 1,
                    color: "rgba(185,146,77,0.5)", fontSize: 10,
                  }}
                >
                  ×
                </button>
              </span>
            ))}

            {showTagInput ? (
              <input
                autoFocus
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") { setShowTagInput(false); setTagInput(""); }
                }}
                onBlur={() => { if (!tagInput.trim()) setShowTagInput(false); }}
                placeholder="tag…"
                style={{
                  background: "rgba(10,22,11,0.6)",
                  border: "1px solid rgba(185,146,77,0.35)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 10.5,
                  color: "var(--cream)",
                  fontFamily: "Manrope, sans-serif",
                  outline: "none",
                  width: 80,
                }}
              />
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                style={{
                  background: "rgba(242,236,223,0.05)",
                  border: "1px dashed rgba(242,236,223,0.15)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 10.5,
                  color: "var(--cream-dim)",
                  fontFamily: "Manrope, sans-serif",
                  cursor: "pointer",
                }}
              >
                + tag
              </button>
            )}
          </div>
        </Section>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--cream-dim)", fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 8, opacity: 0.3 }}>◌</div>
            Buscando dados do cliente…
          </div>
        )}

        {/* ── Dados do cliente ─────────────────────────────────────────── */}
        {ctx && (
          <>
            {ctx.customer ? (
              <Section title="Cliente">
                {/* Avatar + nome */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(185,146,77,0.25), rgba(185,146,77,0.08))",
                    border: "1px solid rgba(185,146,77,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                    color: "var(--gold-light)",
                    fontFamily: "Manrope, sans-serif",
                    flexShrink: 0,
                  }}>
                    {(ctx.customer.full_name ?? ctx.customer.email ?? "?")
                      .split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase() || "?"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: "var(--cream)",
                      fontFamily: "Manrope, sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {ctx.customer.full_name ?? "Sem nome"}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", marginTop: 1 }}>
                      Cliente desde {dateShort(ctx.customer.created_at)}
                    </div>
                  </div>
                </div>

                {/* Contatos */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                  {ctx.customer.email && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--cream-dim)", width: 14, textAlign: "center" }}>✉</span>
                      <span style={{ fontSize: 11.5, color: "var(--cream-soft)", fontFamily: "Manrope, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ctx.customer.email}
                      </span>
                    </div>
                  )}
                  {ctx.customer.phone && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--cream-dim)", width: 14, textAlign: "center" }}>◈</span>
                      <span style={{ fontSize: 11.5, color: "var(--cream-soft)", fontFamily: "Manrope, sans-serif" }}>
                        {ctx.customer.phone}
                      </span>
                    </div>
                  )}
                  {ctx.customer.whatsapp && ctx.customer.whatsapp !== ctx.customer.phone && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#25D366", width: 14, textAlign: "center" }}>◎</span>
                      <span style={{ fontSize: 11.5, color: "var(--cream-soft)", fontFamily: "Manrope, sans-serif" }}>
                        {ctx.customer.whatsapp}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags do cliente */}
                {ctx.customer.tags?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {ctx.customer.tags.map(t => (
                      <span key={t} style={{
                        fontSize: 9.5, background: "rgba(242,236,223,0.06)",
                        border: "1px solid rgba(242,236,223,0.1)",
                        borderRadius: 5, padding: "2px 7px",
                        color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", fontWeight: 600,
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Nota */}
                {ctx.customer.notes && (
                  <div style={{
                    background: "rgba(10,22,11,0.5)",
                    border: "1px solid rgba(242,236,223,0.07)",
                    borderRadius: 8, padding: "8px 10px",
                    fontSize: 11, color: "var(--cream-soft)", fontFamily: "Manrope, sans-serif",
                    lineHeight: 1.5, marginBottom: 10,
                    fontStyle: "italic",
                  }}>
                    {ctx.customer.notes}
                  </div>
                )}

                {/* Botão ver perfil */}
                <Link
                  href={`/inbox/clientes/${ctx.customer.id}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 10.5, color: "var(--gold-light)",
                    textDecoration: "none", fontFamily: "Manrope, sans-serif",
                    fontWeight: 600,
                  }}
                >
                  Ver perfil completo ↗
                </Link>
              </Section>
            ) : (
              <Section title="Cliente">
                <div style={{
                  background: "rgba(10,22,11,0.45)",
                  border: "1px dashed rgba(242,236,223,0.1)",
                  borderRadius: 10, padding: "14px 12px",
                  textAlign: "center",
                }}>
                  <p style={{ fontSize: 11.5, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic", margin: 0 }}>
                    Nenhum cliente vinculado
                  </p>
                  <p style={{ fontSize: 10, color: "var(--cream-dim)", opacity: 0.6, marginTop: 4, fontFamily: "Manrope, sans-serif" }}>
                    O handle desta conversa não corresponde a um cliente cadastrado.
                  </p>
                </div>
              </Section>
            )}

            {/* ── Estatísticas ───────────────────────────────────────────── */}
            {ctx.customer && (
              <Section title="Histórico de compras">
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <StatCard
                    label="Total gasto"
                    value={money(ctx.stats.total_spent_cents)}
                  />
                  <StatCard
                    label="Pedidos"
                    value={String(ctx.stats.total_orders)}
                    sub={ctx.stats.last_order_at ? `última: ${dateRelative(ctx.stats.last_order_at)}` : undefined}
                  />
                </div>
                {ctx.stats.avg_ticket_cents > 0 && (
                  <div style={{
                    fontSize: 10.5, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif",
                    textAlign: "center", marginBottom: 4,
                  }}>
                    Ticket médio: <span style={{ color: "var(--gold-light)", fontWeight: 700 }}>{money(ctx.stats.avg_ticket_cents)}</span>
                  </div>
                )}
              </Section>
            )}

            {/* ── Pedidos ────────────────────────────────────────────────── */}
            {ctx.orders.length > 0 && (
              <Section title="Pedidos recentes">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {visibleOrders.map(order => {
                    const st = ORDER_STATUS[order.status] ?? { label: order.status, color: "#6b7280" };
                    return (
                      <Link
                        key={order.id}
                        href={`/backoffice/pedidos?order=${order.id}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          background: "rgba(10,22,11,0.5)",
                          border: "1px solid rgba(242,236,223,0.07)",
                          borderRadius: 9, padding: "9px 11px",
                          textDecoration: "none",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = "rgba(185,146,77,0.2)";
                          (e.currentTarget as HTMLElement).style.background = "rgba(185,146,77,0.06)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = "rgba(242,236,223,0.07)";
                          (e.currentTarget as HTMLElement).style.background = "rgba(10,22,11,0.5)";
                        }}
                      >
                        {/* Número */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 11.5, fontWeight: 700,
                            color: "var(--cream)", fontFamily: "Manrope, sans-serif",
                          }}>
                            #{order.number}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", marginTop: 1 }}>
                            {dateShort(order.created_at)}
                          </div>
                        </div>
                        {/* Status */}
                        <span style={{
                          fontSize: 9.5, fontWeight: 700,
                          background: `${st.color}18`,
                          border: `1px solid ${st.color}35`,
                          borderRadius: 5, padding: "2px 7px",
                          color: st.color, fontFamily: "Manrope, sans-serif",
                          flexShrink: 0,
                        }}>
                          {st.label}
                        </span>
                        {/* Valor */}
                        <div style={{
                          fontSize: 11.5, fontWeight: 700,
                          color: "var(--gold-light)", fontFamily: "Manrope, sans-serif",
                          flexShrink: 0,
                        }}>
                          {money(order.total_cents, order.currency)}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {ctx.orders.length > 3 && (
                  <button
                    onClick={() => setShowAllOrders(v => !v)}
                    style={{
                      marginTop: 8, width: "100%",
                      background: "transparent",
                      border: "1px dashed rgba(242,236,223,0.1)",
                      borderRadius: 8, padding: "7px",
                      fontSize: 11, color: "var(--cream-dim)",
                      cursor: "pointer", fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    {showAllOrders
                      ? "▲ Mostrar menos"
                      : `▼ Ver todos (${ctx.orders.length})`}
                  </button>
                )}
              </Section>
            )}

            {/* ── Sem pedidos ────────────────────────────────────────────── */}
            {ctx.customer && ctx.orders.length === 0 && (
              <Section title="Pedidos">
                <div style={{
                  padding: "12px", textAlign: "center",
                  fontSize: 11, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic",
                }}>
                  Nenhum pedido encontrado
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

// ── Estilos base ──────────────────────────────────────────────────────────────

const asideStyle: React.CSSProperties = {
  width: 240,
  minWidth: 220,
  display: "flex",
  flexDirection: "column",
  background: "rgba(10,22,11,0.62)",
  backdropFilter: "blur(20px) saturate(1.3)",
  WebkitBackdropFilter: "blur(20px) saturate(1.3)",
  borderLeft: "1px solid rgba(242,236,223,0.07)",
  flexShrink: 0,
  overflow: "hidden",
};
