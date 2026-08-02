"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ConversationDetail, MessageRow } from "./inbox-actions";
import { getConversationDetail, getMessages, sendReply, setStatus } from "./inbox-actions";
import { CHANNEL_LABEL, formatDateTime } from "./constants";

const CHANNEL_ICONS: Record<string, string> = {
  email: "✉️", whatsapp: "💬", chat: "🌐",
  phone: "📞", instagram: "📷", facebook: "👥", sms: "📱",
};

const STATUS_OPTIONS = [
  { value: "open",             label: "Em atendimento" },
  { value: "waiting_customer", label: "Aguardando cliente" },
  { value: "waiting_team",     label: "Aguardando equipe" },
  { value: "resolved",         label: "Resolvido" },
  { value: "archived",         label: "Arquivado" },
  { value: "spam",             label: "Spam" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "#60a5fa", open: "#34d399", waiting_customer: "#f59e0b",
  waiting: "#f59e0b", resolved: "#6b7280", closed: "#6b7280",
  archived: "#374151", spam: "#ef4444",
};

interface Props {
  conversationId: string | null;
}

export function InboxDetail({ conversationId }: Props) {
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reply, setReply] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function load(id: string) {
    startTransition(async () => {
      const [detail, msgs] = await Promise.all([
        getConversationDetail(id),
        getMessages(id),
      ]);
      setConv(detail);
      setMessages(msgs);
    });
  }

  useEffect(() => {
    if (!conversationId) { setConv(null); setMessages([]); return; }
    load(conversationId);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  if (!conversationId) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
        Selecione uma conversa
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>

      {/* Header da conversa */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        background: "rgba(255,255,255,0.02)",
      }}>
        {isPending && !conv ? (
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Carregando…</span>
        ) : conv ? (
          <>
            {/* Avatar */}
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "rgba(212,175,55,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>
              {CHANNEL_ICONS[conv.channel] ?? "💬"}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {conv.contact_name || conv.contact_handle || "Desconhecido"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                {CHANNEL_LABEL[conv.channel] ?? conv.channel}
                {conv.contact_handle && ` · ${conv.contact_handle}`}
              </div>
            </div>

            {/* Status badge + dropdown */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setShowStatus((v) => !v)}
                style={{
                  background: `${STATUS_COLORS[conv.status] ?? "#6b7280"}22`,
                  color: STATUS_COLORS[conv.status] ?? "#6b7280",
                  border: `1px solid ${STATUS_COLORS[conv.status] ?? "#6b7280"}44`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {STATUS_OPTIONS.find((s) => s.value === conv.status)?.label ?? conv.status} ▾
              </button>
              {showStatus && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 4px)",
                  background: "var(--c-glass,rgba(24,24,27,0.97))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, zIndex: 100, minWidth: 180,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  overflow: "hidden",
                }}>
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatus(opt.value)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 14px", background: "transparent",
                        border: "none", color: "var(--c-text)", fontSize: 13,
                        cursor: "pointer",
                        fontWeight: conv.status === opt.value ? 700 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Data abertura */}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
              {formatDateTime(conv.created_at)}
            </span>
          </>
        ) : null}
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg) => {
          const isOut  = msg.type === "out";
          const isNoteMsg = msg.is_internal_note;
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start", gap: 3 }}>
              {/* Sender label */}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", paddingLeft: 4, paddingRight: 4 }}>
                {msg.sender_name} · {formatDateTime(msg.created_at)}
                {isNoteMsg && " · 📝 nota interna"}
              </span>
              {/* Bubble */}
              <div style={{
                maxWidth: "70%",
                background: isNoteMsg
                  ? "rgba(245,158,11,0.1)"
                  : isOut
                  ? "rgba(212,175,55,0.15)"
                  : "rgba(255,255,255,0.07)",
                border: isNoteMsg
                  ? "1px solid rgba(245,158,11,0.25)"
                  : isOut
                  ? "1px solid rgba(212,175,55,0.25)"
                  : "1px solid rgba(255,255,255,0.1)",
                borderRadius: isOut ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                padding: "8px 13px",
                fontSize: 13.5,
                color: "var(--c-text)",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {msg.body}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Área de resposta */}
      <div style={{
        padding: "12px 20px 16px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        flexShrink: 0,
      }}>
        {/* Tabs resposta / nota */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {[{ v: false, label: "↩ Responder" }, { v: true, label: "📝 Nota interna" }].map((opt) => (
            <button
              key={String(opt.v)}
              onClick={() => setIsNote(opt.v)}
              style={{
                background: isNote === opt.v ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.05)",
                border: isNote === opt.v ? "1px solid rgba(212,175,55,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: isNote === opt.v ? "var(--c-gold)" : "rgba(255,255,255,0.5)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: isNote === opt.v ? 600 : 400,
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
          }}
          placeholder={isNote ? "Nota interna (não enviada ao cliente)…" : "Digite sua resposta… (Ctrl+Enter para enviar)"}
          rows={3}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            color: "var(--c-text)",
            fontSize: 13.5,
            padding: "9px 12px",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        />
        {error && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={handleSend}
            disabled={!reply.trim() || isPending}
            className="btn btn-gold"
            style={{ opacity: !reply.trim() || isPending ? 0.5 : 1, cursor: !reply.trim() || isPending ? "default" : "pointer" }}
          >
            {isNote ? "Salvar nota" : "Enviar resposta"}
          </button>
        </div>
      </div>
    </div>
  );
}
