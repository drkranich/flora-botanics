"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ConversationDetail, MessageRow } from "./inbox-actions";
import { getConversationDetail, getMessages, sendReply, setStatus } from "./inbox-actions";
import { formatDateTime } from "./constants";

const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", chat: "Chat", phone: "Telefone",
  instagram: "Instagram", facebook: "Facebook", sms: "SMS",
};
const CHANNEL_ICON: Record<string, string> = {
  email: "✉", whatsapp: "◎", chat: "◉", phone: "◈", instagram: "◌", facebook: "◫", sms: "◷",
};

const STATUS_OPTIONS = [
  { value: "open",             label: "Em atendimento",   color: "#62c99d" },
  { value: "waiting_customer", label: "Ag. cliente",      color: "#f0b429" },
  { value: "waiting_team",     label: "Ag. equipe",       color: "#a78bfa" },
  { value: "resolved",         label: "Resolvido",        color: "#4ade80" },
  { value: "archived",         label: "Arquivado",        color: "#6b7280" },
  { value: "spam",             label: "Spam",             color: "#ef4444" },
];

function statusColor(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color
    ?? (status === "new" ? "#7ea8d9" : status === "waiting" ? "#f0b429" : "#6b7280");
}
function statusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label
    ?? (status === "new" ? "Novo" : status === "waiting" ? "Aguardando" : status);
}

interface Props { conversationId: string | null }

export function InboxDetail({ conversationId }: Props) {
  const [conv, setConv]       = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reply, setReply]     = useState("");
  const [isNote, setIsNote]   = useState(false);
  const [isPending, start]    = useTransition();
  const [error, setError]     = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const endRef                = useRef<HTMLDivElement>(null);

  function load(id: string) {
    start(async () => {
      const [d, m] = await Promise.all([getConversationDetail(id), getMessages(id)]);
      setConv(d);
      setMessages(m);
    });
  }

  useEffect(() => {
    if (!conversationId) { setConv(null); setMessages([]); return; }
    load(conversationId);
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!conversationId || !reply.trim()) return;
    setError(null);
    const res = await sendReply(conversationId, reply, isNote);
    if (!res.ok) { setError(res.error); return; }
    setReply("");
    load(conversationId);
  }

  async function handleStatus(s: string) {
    if (!conversationId) return;
    await setStatus(conversationId, s);
    setShowStatus(false);
    load(conversationId);
  }

  /* ── Estado vazio ── */
  if (!conversationId) {
    return (
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,22,11,0.35)",
        gap: 16,
      }}>
        <div style={{
          fontFamily: "Fraunces, serif",
          fontSize: 48,
          color: "var(--gold-light)",
          opacity: 0.18,
          lineHeight: 1,
        }}>
          ✦
        </div>
        <p style={{
          fontFamily: "Fraunces, serif",
          fontSize: 17,
          fontStyle: "italic",
          color: "var(--cream-dim)",
          fontWeight: 400,
        }}>
          Selecione uma conversa
        </p>
        <p style={{
          fontSize: 12,
          color: "rgba(242,236,223,0.25)",
          maxWidth: 260,
          textAlign: "center",
          lineHeight: 1.6,
        }}>
          Escolha um atendimento na lista ao lado para visualizar o histórico completo.
        </p>
      </div>
    );
  }

  const sColor = conv ? statusColor(conv.status) : "#6b7280";

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      background: "rgba(10,22,11,0.35)",
    }}>

      {/* ── Cabeçalho ── */}
      <div style={{
        padding: "14px 22px",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "rgba(15,32,18,0.5)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        flexShrink: 0,
        minHeight: 64,
      }}>
        {isPending && !conv ? (
          <span style={{ color: "var(--cream-dim)", fontSize: 12.5, fontStyle: "italic" }}>
            Carregando…
          </span>
        ) : conv ? (
          <>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(185,146,77,0.25), rgba(185,146,77,0.08))",
              border: "1px solid rgba(185,146,77,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, color: "var(--gold-light)",
              flexShrink: 0,
              fontFamily: "Manrope, sans-serif",
              fontWeight: 700,
            }}>
              {CHANNEL_ICON[conv.channel] ?? "◉"}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "Manrope, sans-serif",
                color: "var(--cream)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {conv.contact_name || conv.contact_handle || "Desconhecido"}
              </div>
              <div style={{
                fontSize: 11,
                color: "var(--cream-dim)",
                marginTop: 2,
                fontFamily: "Manrope, sans-serif",
              }}>
                {CHANNEL_LABEL[conv.channel] ?? conv.channel}
                {conv.contact_handle && ` · ${conv.contact_handle}`}
                {" · "}
                <span style={{ color: "rgba(242,236,223,0.3)" }}>
                  aberto em {formatDateTime(conv.created_at)}
                </span>
              </div>
            </div>

            {/* Status dropdown */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setShowStatus(v => !v)}
                style={{
                  background: `${sColor}18`,
                  border: `1px solid ${sColor}40`,
                  borderRadius: 8,
                  color: sColor,
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.2s",
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: sColor,
                  boxShadow: `0 0 5px ${sColor}`,
                }} />
                {statusLabel(conv.status)}
                <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
              </button>

              {showStatus && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)",
                  background: "rgba(10,22,11,0.97)",
                  border: "1px solid rgba(242,236,223,0.12)",
                  borderRadius: 12,
                  zIndex: 200,
                  minWidth: 180,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(185,146,77,0.08)",
                  overflow: "hidden",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}>
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatus(opt.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        width: "100%",
                        padding: "10px 14px",
                        background: conv.status === opt.value ? "rgba(185,146,77,0.08)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid rgba(242,236,223,0.05)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "Manrope, sans-serif",
                        fontSize: 12.5,
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
                  background: "rgba(74,222,128,0.1)",
                  border: "1px solid rgba(74,222,128,0.25)",
                  borderRadius: 8,
                  color: "#4ade80",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 12px",
                  cursor: "pointer",
                  letterSpacing: 0.5,
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(74,222,128,0.18)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(74,222,128,0.1)"; }}
              >
                ✓ Resolver
              </button>
            )}
          </>
        ) : null}
      </div>

      {/* ── Thread de mensagens ── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        {messages.map(msg => {
          const isOut  = msg.type === "out";
          const isNoteMsg = msg.is_internal_note;

          return (
            <div key={msg.id} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isOut ? "flex-end" : "flex-start",
              gap: 4,
            }}>
              {/* Rótulo */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingLeft: isOut ? 0 : 4,
                paddingRight: isOut ? 4 : 0,
              }}>
                {isNoteMsg && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#f0b429",
                    background: "rgba(240,180,41,0.12)",
                    border: "1px solid rgba(240,180,41,0.25)",
                    borderRadius: 4,
                    padding: "1px 6px",
                  }}>
                    Nota interna
                  </span>
                )}
                <span style={{
                  fontSize: 10.5,
                  color: "rgba(242,236,223,0.35)",
                  fontFamily: "Manrope, sans-serif",
                }}>
                  {msg.sender_name} · {formatDateTime(msg.created_at)}
                </span>
              </div>

              {/* Bolha */}
              <div style={{
                maxWidth: "68%",
                background: isNoteMsg
                  ? "rgba(240,180,41,0.08)"
                  : isOut
                  ? "linear-gradient(135deg, rgba(185,146,77,0.18), rgba(185,146,77,0.08))"
                  : "rgba(242,236,223,0.06)",
                border: isNoteMsg
                  ? "1px solid rgba(240,180,41,0.2)"
                  : isOut
                  ? "1px solid rgba(185,146,77,0.25)"
                  : "1px solid rgba(242,236,223,0.09)",
                borderRadius: isOut
                  ? "14px 14px 4px 14px"
                  : "14px 14px 14px 4px",
                padding: "10px 14px",
                fontSize: 13.5,
                fontFamily: "Manrope, sans-serif",
                color: "var(--cream)",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                backdropFilter: "blur(8px)",
              }}>
                {msg.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Editor de resposta ── */}
      <div style={{
        padding: "14px 22px 18px",
        borderTop: "1px solid rgba(242,236,223,0.07)",
        background: "rgba(15,32,18,0.5)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
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
                  ? opt.v ? "rgba(240,180,41,0.12)" : "rgba(185,146,77,0.12)"
                  : "rgba(242,236,223,0.04)",
                border: `1px solid ${isNote === opt.v
                  ? opt.v ? "rgba(240,180,41,0.3)" : "rgba(185,146,77,0.3)"
                  : "rgba(242,236,223,0.08)"}`,
                borderRadius: 8,
                color: isNote === opt.v
                  ? opt.v ? "#f0b429" : "var(--gold-light)"
                  : "var(--cream-dim)",
                fontFamily: "Manrope, sans-serif",
                fontSize: 11,
                fontWeight: isNote === opt.v ? 700 : 500,
                letterSpacing: 0.3,
                padding: "6px 12px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div style={{
          background: "rgba(10,22,11,0.5)",
          border: `1px solid ${isNote ? "rgba(240,180,41,0.2)" : "rgba(242,236,223,0.1)"}`,
          borderRadius: 12,
          overflow: "hidden",
          transition: "border-color 0.2s",
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
              const parent = e.target.parentElement;
              if (parent) parent.style.borderColor = isNote ? "rgba(240,180,41,0.4)" : "rgba(185,146,77,0.45)";
            }}
            onBlur={e => {
              const parent = e.target.parentElement;
              if (parent) parent.style.borderColor = isNote ? "rgba(240,180,41,0.2)" : "rgba(242,236,223,0.1)";
            }}
            placeholder={isNote
              ? "Nota interna — visível apenas para a equipe…"
              : "Digite sua resposta… (Ctrl+Enter para enviar)"}
            rows={3}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              color: "var(--cream)",
              fontSize: 13.5,
              fontFamily: "Manrope, sans-serif",
              lineHeight: 1.55,
              padding: "12px 14px 8px",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Barra inferior do editor */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px 10px",
            borderTop: "1px solid rgba(242,236,223,0.06)",
          }}>
            <span style={{
              fontSize: 10,
              color: "rgba(242,236,223,0.25)",
              fontFamily: "Manrope, sans-serif",
            }}>
              Ctrl+Enter para enviar
            </span>

            <div style={{ display: "flex", gap: 7 }}>
              {/* Enviar e resolver */}
              {!isNote && (
                <button
                  onClick={async () => {
                    if (!reply.trim() || !conversationId) return;
                    setError(null);
                    const res = await sendReply(conversationId, reply, false);
                    if (res.ok) {
                      setReply("");
                      await setStatus(conversationId, "resolved");
                      load(conversationId);
                    } else setError(res.error);
                  }}
                  disabled={!reply.trim() || isPending}
                  style={{
                    background: "rgba(74,222,128,0.08)",
                    border: "1px solid rgba(74,222,128,0.2)",
                    borderRadius: 8,
                    color: "#4ade80",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "7px 13px",
                    cursor: !reply.trim() || isPending ? "default" : "pointer",
                    opacity: !reply.trim() || isPending ? 0.45 : 1,
                    letterSpacing: 0.3,
                    transition: "all 0.2s",
                  }}
                >
                  Enviar e resolver
                </button>
              )}

              {/* Enviar principal */}
              <button
                onClick={handleSend}
                disabled={!reply.trim() || isPending}
                style={{
                  background: !reply.trim() || isPending
                    ? "rgba(185,146,77,0.3)"
                    : "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
                  border: "none",
                  borderRadius: 8,
                  color: "var(--forest-950)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  padding: "7px 18px",
                  cursor: !reply.trim() || isPending ? "default" : "pointer",
                  opacity: !reply.trim() || isPending ? 0.5 : 1,
                  boxShadow: !reply.trim() || isPending ? "none" : "0 4px 14px rgba(185,146,77,0.35)",
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
            fontSize: 11.5,
            color: "#ef4444",
            marginTop: 8,
            fontFamily: "Manrope, sans-serif",
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
