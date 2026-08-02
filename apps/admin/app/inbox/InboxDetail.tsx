"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ConversationDetail, TimelineEvent } from "./inbox-actions";
import {
  getConversationDetail,
  getTimeline,
  sendReply,
  setStatus,
  setStatusWithAudit,
} from "./inbox-actions";
import { formatDateTime, formatRelative } from "./constants";

// ── Constantes de UI ──────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", chat: "Chat",
  phone: "Telefone", instagram: "Instagram", facebook: "Facebook", sms: "SMS",
};
const CHANNEL_ICON: Record<string, string> = {
  email: "✉", whatsapp: "◎", chat: "◉", phone: "◈",
  instagram: "◌", facebook: "◫", sms: "◷",
};

const STATUS_OPTIONS = [
  { value: "open",             label: "Em atendimento",  color: "#62c99d" },
  { value: "waiting_customer", label: "Ag. cliente",     color: "#f0b429" },
  { value: "waiting_team",     label: "Ag. equipe",      color: "#a78bfa" },
  { value: "resolved",         label: "Resolvido",       color: "#4ade80" },
  { value: "archived",         label: "Arquivado",       color: "#6b7280" },
  { value: "spam",             label: "Spam",            color: "#ef4444" },
];

function sColor(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color
    ?? (status === "new" ? "#7ea8d9" : status === "waiting" ? "#f0b429" : "#6b7280");
}
function sLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label
    ?? (status === "new" ? "Novo" : status === "waiting" ? "Aguardando" : status);
}

// ── Ícone semântico para tipo de evento ───────────────────────────────────────

function eventIcon(type?: string) {
  switch (type) {
    case "status_changed":   return { icon: "◉", color: "#62c99d" };
    case "assigned":         return { icon: "◎", color: "#7ea8d9" };
    case "unassigned":       return { icon: "◌", color: "#6b7280" };
    case "priority_changed": return { icon: "◈", color: "#f0b429" };
    case "tag_added":        return { icon: "⬡", color: "#a78bfa" };
    case "tag_removed":      return { icon: "⬡", color: "#6b7280" };
    case "reopened":         return { icon: "↺", color: "#fb923c" };
    case "sla_breach":       return { icon: "⚠", color: "#ef4444" };
    case "order_linked":     return { icon: "◫", color: "#d9b87a" };
    case "email_bounced":    return { icon: "✕", color: "#ef4444" };
    default:                 return { icon: "·", color: "#6b7280" };
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props { conversationId: string | null }

export function InboxDetail({ conversationId }: Props) {
  const [conv, setConv]           = useState<ConversationDetail | null>(null);
  const [timeline, setTimeline]   = useState<TimelineEvent[]>([]);
  const [reply, setReply]         = useState("");
  const [isNote, setIsNote]       = useState(false);
  const [isPending, start]        = useTransition();
  const [error, setError]         = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [convNum, setConvNum]     = useState<number | null>(null);
  const endRef                    = useRef<HTMLDivElement>(null);

  function load(id: string) {
    start(async () => {
      const [d, tl] = await Promise.all([
        getConversationDetail(id),
        getTimeline(id),
      ]);
      setConv(d);
      setTimeline(tl);
      // Número sequencial: derivado da data de criação para mock
      if (d) setConvNum(parseInt(d.id.replace(/-/g, "").slice(-6), 16) % 100000);
    });
  }

  useEffect(() => {
    if (!conversationId) { setConv(null); setTimeline([]); return; }
    load(conversationId);
  }, [conversationId]); // eslint-disable-line

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  async function handleSend(resolveAfter = false) {
    if (!conversationId || !reply.trim()) return;
    setError(null);
    const res = await sendReply(conversationId, reply, isNote);
    if (!res.ok) { setError(res.error); return; }
    setReply("");
    if (resolveAfter) await setStatusWithAudit(conversationId, "resolved");
    load(conversationId);
  }

  async function handleStatus(s: string) {
    if (!conversationId) return;
    await setStatusWithAudit(conversationId, s);
    setShowStatus(false);
    load(conversationId);
  }

  // ── Estado vazio ────────────────────────────────────────────────────────────
  if (!conversationId) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "rgba(10,22,11,0.35)", gap: 16,
      }}>
        <div style={{
          fontFamily: "Fraunces, serif", fontSize: 52,
          color: "var(--gold-light)", opacity: 0.15, lineHeight: 1,
        }}>✦</div>
        <p style={{
          fontFamily: "Fraunces, serif", fontSize: 17, fontStyle: "italic",
          color: "var(--cream-dim)", fontWeight: 400,
        }}>
          Selecione uma conversa
        </p>
        <p style={{
          fontSize: 12, color: "rgba(242,236,223,0.22)",
          maxWidth: 260, textAlign: "center", lineHeight: 1.6,
        }}>
          Escolha um atendimento na lista para visualizar o histórico completo.
        </p>
      </div>
    );
  }

  const sc = conv ? sColor(conv.status) : "#6b7280";

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      minWidth: 0, background: "rgba(10,22,11,0.3)",
    }}>

      {/* ── Cabeçalho rico ────────────────────────────────────────────────── */}
      <div style={{
        padding: "0 22px",
        background: "rgba(12,26,14,0.65)",
        backdropFilter: "blur(24px) saturate(1.3)",
        WebkitBackdropFilter: "blur(24px) saturate(1.3)",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        flexShrink: 0,
      }}>
        {/* Linha 1 — info principal */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          minHeight: 60, paddingTop: 10, paddingBottom: conv ? 0 : 10,
        }}>
          {isPending && !conv ? (
            <span style={{ color: "var(--cream-dim)", fontSize: 12.5, fontStyle: "italic" }}>
              Carregando…
            </span>
          ) : conv ? (
            <>
              {/* Avatar canal */}
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, rgba(185,146,77,0.22), rgba(185,146,77,0.07))",
                border: "1px solid rgba(185,146,77,0.28)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, color: "var(--gold-light)",
                fontFamily: "Manrope, sans-serif", fontWeight: 700,
              }}>
                {CHANNEL_ICON[conv.channel] ?? "◉"}
              </div>

              {/* Nome + sub */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  fontFamily: "Manrope, sans-serif", color: "var(--cream)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {conv.contact_name || conv.contact_handle || "Desconhecido"}
                </div>
                <div style={{
                  fontSize: 11, color: "var(--cream-dim)", marginTop: 2,
                  fontFamily: "Manrope, sans-serif", display: "flex", gap: 6, flexWrap: "wrap",
                }}>
                  <span>{CHANNEL_LABEL[conv.channel] ?? conv.channel}</span>
                  {conv.contact_handle && <span style={{ opacity: 0.6 }}>·</span>}
                  {conv.contact_handle && <span>{conv.contact_handle}</span>}
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ opacity: 0.45 }}>
                    aberto {formatRelative(conv.created_at)}
                  </span>
                </div>
              </div>

              {/* Status dropdown */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  onClick={() => setShowStatus(v => !v)}
                  style={{
                    background: `${sc}15`,
                    border: `1px solid ${sc}38`,
                    borderRadius: 8, color: sc,
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                    padding: "6px 11px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: sc, boxShadow: `0 0 5px ${sc}`,
                  }} />
                  {sLabel(conv.status)}
                  <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
                </button>

                {showStatus && (
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 6px)",
                    background: "rgba(10,22,11,0.97)",
                    border: "1px solid rgba(242,236,223,0.12)",
                    borderRadius: 12, zIndex: 300, minWidth: 190,
                    boxShadow: "0 20px 56px rgba(0,0,0,0.75), 0 0 0 1px rgba(185,146,77,0.07)",
                    overflow: "hidden",
                    backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                  }}>
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleStatus(opt.value)}
                        style={{
                          display: "flex", alignItems: "center", gap: 9,
                          width: "100%", padding: "10px 14px",
                          background: conv.status === opt.value ? "rgba(185,146,77,0.08)" : "transparent",
                          border: "none",
                          borderBottom: "1px solid rgba(242,236,223,0.05)",
                          cursor: "pointer", textAlign: "left",
                          fontFamily: "Manrope, sans-serif", fontSize: 12.5,
                          fontWeight: conv.status === opt.value ? 700 : 500,
                          color: conv.status === opt.value ? "var(--cream)" : "var(--cream-soft)",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => { if (conv.status !== opt.value) e.currentTarget.style.background = "rgba(242,236,223,0.04)"; }}
                        onMouseLeave={e => { if (conv.status !== opt.value) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: opt.color, flexShrink: 0,
                          boxShadow: conv.status === opt.value ? `0 0 5px ${opt.color}` : "none",
                        }} />
                        {opt.label}
                        {conv.status === opt.value && (
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gold-light)" }}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Resolver rápido */}
              {conv.status !== "resolved" && (
                <button
                  onClick={() => handleStatus("resolved")}
                  style={{
                    background: "rgba(74,222,128,0.09)",
                    border: "1px solid rgba(74,222,128,0.22)",
                    borderRadius: 8, color: "#4ade80",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11, fontWeight: 700,
                    padding: "6px 12px", cursor: "pointer",
                    letterSpacing: 0.4, flexShrink: 0,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(74,222,128,0.16)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(74,222,128,0.09)"; }}
                >
                  ✓ Resolver
                </button>
              )}
            </>
          ) : null}
        </div>

        {/* Linha 2 — número do atendimento + meta chips */}
        {conv && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            paddingTop: 8, paddingBottom: 10,
            borderTop: "1px solid rgba(242,236,223,0.05)",
          }}>
            {convNum !== null && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: 1.2, textTransform: "uppercase",
                color: "var(--gold-light)", opacity: 0.7,
                background: "rgba(185,146,77,0.1)",
                border: "1px solid rgba(185,146,77,0.2)",
                borderRadius: 5, padding: "2px 7px",
                fontFamily: "Manrope, sans-serif",
              }}>
                #{String(convNum).padStart(5, "0")}
              </span>
            )}
            <span style={{
              fontSize: 10, color: "var(--cream-dim)",
              background: "rgba(242,236,223,0.05)",
              border: "1px solid rgba(242,236,223,0.08)",
              borderRadius: 5, padding: "2px 7px",
              fontFamily: "Manrope, sans-serif",
            }}>
              {CHANNEL_ICON[conv.channel]} {CHANNEL_LABEL[conv.channel] ?? conv.channel}
            </span>
            <span style={{
              fontSize: 10, color: "var(--cream-dim)",
              fontFamily: "Manrope, sans-serif", opacity: 0.5,
            }}>
              {formatDateTime(conv.created_at)}
            </span>
            {timeline.filter(t => t.kind === "message" || t.kind === "note").length > 0 && (
              <span style={{
                fontSize: 10, color: "var(--cream-dim)",
                background: "rgba(242,236,223,0.05)",
                border: "1px solid rgba(242,236,223,0.08)",
                borderRadius: 5, padding: "2px 7px",
                fontFamily: "Manrope, sans-serif",
              }}>
                {timeline.filter(t => t.kind === "message" || t.kind === "note").length} mensagens
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Linha do tempo ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "20px 28px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {timeline.length === 0 && !isPending && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "40px 0", gap: 12,
          }}>
            <div style={{
              fontSize: 32, color: "var(--gold-light)",
              opacity: 0.18, fontFamily: "Fraunces, serif",
            }}>✦</div>
            <p style={{
              fontSize: 12.5, color: "var(--cream-dim)",
              fontFamily: "Fraunces, serif", fontStyle: "italic",
            }}>
              Nenhuma mensagem ainda
            </p>
          </div>
        )}

        {timeline.map((item, idx) => {
          /* ── Evento de sistema ────────────────────────────────────── */
          if (item.kind === "event") {
            const { icon, color } = eventIcon(item.event_type);
            // Agrupa eventos consecutivos
            const prevIsEvent = idx > 0 && timeline[idx - 1].kind === "event";
            return (
              <div
                key={item.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  justifyContent: "center",
                  marginTop: prevIsEvent ? -6 : 4,
                  marginBottom: 4,
                }}
              >
                <div style={{
                  height: 1, flex: 1,
                  background: "rgba(242,236,223,0.05)",
                }} />
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(10,22,11,0.6)",
                  border: `1px solid ${color}22`,
                  borderRadius: 20, padding: "4px 10px",
                }}>
                  <span style={{ fontSize: 10, color }}>{icon}</span>
                  <span style={{
                    fontSize: 10.5, color: "var(--cream-dim)",
                    fontFamily: "Manrope, sans-serif",
                  }}>
                    {item.event_label}
                  </span>
                  {item.event_meta && (
                    <span style={{
                      fontSize: 10, color: "rgba(242,236,223,0.3)",
                      fontFamily: "Manrope, sans-serif",
                    }}>
                      — {item.event_meta}
                    </span>
                  )}
                  <span style={{
                    fontSize: 9.5, color: "rgba(242,236,223,0.25)",
                    fontFamily: "Manrope, sans-serif",
                    marginLeft: 2,
                  }}>
                    {formatRelative(item.created_at)}
                  </span>
                </div>
                <div style={{
                  height: 1, flex: 1,
                  background: "rgba(242,236,223,0.05)",
                }} />
              </div>
            );
          }

          /* ── Mensagem / Nota ──────────────────────────────────────── */
          const isOut  = !item.sender_is_contact;
          const isNoteMsg = item.is_internal_note;

          return (
            <div key={item.id} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isOut ? "flex-end" : "flex-start",
              gap: 4,
            }}>
              {/* Rótulo */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                paddingLeft: isOut ? 0 : 4,
                paddingRight: isOut ? 4 : 0,
              }}>
                {isNoteMsg && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                    textTransform: "uppercase", color: "#f0b429",
                    background: "rgba(240,180,41,0.12)",
                    border: "1px solid rgba(240,180,41,0.25)",
                    borderRadius: 4, padding: "1px 6px",
                  }}>
                    Nota interna
                  </span>
                )}
                <span style={{
                  fontSize: 10.5, color: "rgba(242,236,223,0.32)",
                  fontFamily: "Manrope, sans-serif",
                }}>
                  {item.sender_name} · {formatDateTime(item.created_at)}
                </span>
              </div>

              {/* Bolha */}
              <div style={{
                maxWidth: "68%",
                background: isNoteMsg
                  ? "rgba(240,180,41,0.07)"
                  : isOut
                  ? "linear-gradient(135deg, rgba(185,146,77,0.17), rgba(185,146,77,0.07))"
                  : "rgba(242,236,223,0.055)",
                border: isNoteMsg
                  ? "1px solid rgba(240,180,41,0.18)"
                  : isOut
                  ? "1px solid rgba(185,146,77,0.22)"
                  : "1px solid rgba(242,236,223,0.08)",
                borderRadius: isOut
                  ? "14px 14px 4px 14px"
                  : "14px 14px 14px 4px",
                padding: "10px 14px",
                fontSize: 13.5, fontFamily: "Manrope, sans-serif",
                color: "var(--cream)", lineHeight: 1.55,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                backdropFilter: "blur(8px)",
              }}>
                {item.body}
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* ── Editor de resposta ────────────────────────────────────────────── */}
      <div style={{
        padding: "14px 22px 18px",
        borderTop: "1px solid rgba(242,236,223,0.07)",
        background: "rgba(12,26,14,0.6)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        flexShrink: 0,
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { v: false, label: "↩ Responder" },
            { v: true,  label: "✦ Nota interna" },
          ].map(opt => (
            <button
              key={String(opt.v)}
              onClick={() => setIsNote(opt.v)}
              style={{
                background: isNote === opt.v
                  ? opt.v ? "rgba(240,180,41,0.11)" : "rgba(185,146,77,0.11)"
                  : "rgba(242,236,223,0.04)",
                border: `1px solid ${isNote === opt.v
                  ? opt.v ? "rgba(240,180,41,0.28)" : "rgba(185,146,77,0.28)"
                  : "rgba(242,236,223,0.08)"}`,
                borderRadius: 8,
                color: isNote === opt.v
                  ? opt.v ? "#f0b429" : "var(--gold-light)"
                  : "var(--cream-dim)",
                fontFamily: "Manrope, sans-serif",
                fontSize: 11, fontWeight: isNote === opt.v ? 700 : 500,
                letterSpacing: 0.3, padding: "6px 12px",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Textarea wrapper */}
        <div style={{
          background: "rgba(10,22,11,0.5)",
          border: `1px solid ${isNote ? "rgba(240,180,41,0.18)" : "rgba(242,236,223,0.09)"}`,
          borderRadius: 12, overflow: "hidden", transition: "border-color 0.2s",
        }}>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault(); handleSend();
              }
            }}
            onFocus={e => {
              const p = e.target.parentElement;
              if (p) p.style.borderColor = isNote ? "rgba(240,180,41,0.38)" : "rgba(185,146,77,0.42)";
            }}
            onBlur={e => {
              const p = e.target.parentElement;
              if (p) p.style.borderColor = isNote ? "rgba(240,180,41,0.18)" : "rgba(242,236,223,0.09)";
            }}
            placeholder={isNote
              ? "Nota interna — visível apenas para a equipe…"
              : "Digite sua resposta… (Ctrl+Enter para enviar)"}
            rows={3}
            style={{
              width: "100%", background: "transparent", border: "none",
              color: "var(--cream)", fontSize: 13.5,
              fontFamily: "Manrope, sans-serif", lineHeight: 1.55,
              padding: "12px 14px 8px", resize: "vertical",
              outline: "none", boxSizing: "border-box",
            }}
          />

          {/* Barra inferior do editor */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px 10px",
            borderTop: "1px solid rgba(242,236,223,0.06)",
          }}>
            <span style={{
              fontSize: 10, color: "rgba(242,236,223,0.22)",
              fontFamily: "Manrope, sans-serif",
            }}>
              Ctrl+Enter para enviar
            </span>

            <div style={{ display: "flex", gap: 7 }}>
              {!isNote && (
                <button
                  onClick={() => handleSend(true)}
                  disabled={!reply.trim() || isPending}
                  style={{
                    background: "rgba(74,222,128,0.07)",
                    border: "1px solid rgba(74,222,128,0.18)",
                    borderRadius: 8, color: "#4ade80",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11, fontWeight: 700,
                    padding: "7px 13px", letterSpacing: 0.3,
                    cursor: !reply.trim() || isPending ? "default" : "pointer",
                    opacity: !reply.trim() || isPending ? 0.4 : 1,
                    transition: "all 0.2s",
                  }}
                >
                  Enviar e resolver
                </button>
              )}

              <button
                onClick={() => handleSend()}
                disabled={!reply.trim() || isPending}
                style={{
                  background: !reply.trim() || isPending
                    ? "rgba(185,146,77,0.25)"
                    : "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
                  border: "none", borderRadius: 8,
                  color: "var(--forest-950)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11, fontWeight: 800,
                  letterSpacing: 1.2, textTransform: "uppercase",
                  padding: "7px 18px",
                  cursor: !reply.trim() || isPending ? "default" : "pointer",
                  opacity: !reply.trim() || isPending ? 0.5 : 1,
                  boxShadow: !reply.trim() || isPending
                    ? "none"
                    : "0 4px 14px rgba(185,146,77,0.3)",
                  transition: "all 0.2s",
                }}
              >
                {isNote ? "Salvar nota" : "Enviar"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p style={{
            fontSize: 11.5, color: "#ef4444",
            marginTop: 8, fontFamily: "Manrope, sans-serif",
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
