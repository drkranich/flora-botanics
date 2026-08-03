"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { ConversationDetail, TimelineAttachment, TimelineEvent } from "./inbox-actions";
import {
  editMessage,
  getConversationDetail,
  getTimeline,
  sendReply,
  setStatusWithAudit,
} from "./inbox-actions";
import { MacroPicker } from "./MacroPicker";
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
    case "message_edited":   return { icon: "✏", color: "#a78bfa" };
    default:                 return { icon: "·", color: "#6b7280" };
  }
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isRasterImage(type: string) {
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

// ── Attachment chip ───────────────────────────────────────────────────────────

function AttachmentChip({ att }: { att: TimelineAttachment }) {
  const img   = isRasterImage(att.type);
  const isPdf = att.type === "application/pdf";
  const isSvg = att.type === "image/svg+xml";
  const icon  = isPdf ? "📄" : isSvg ? "🖼️" : "📎";
  return (
    <a
      href={att.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(242,236,223,0.05)",
        border: "1px solid rgba(242,236,223,0.1)",
        borderRadius: 7, padding: "4px 8px",
        textDecoration: "none", maxWidth: 220, overflow: "hidden",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(242,236,223,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(242,236,223,0.05)")}
    >
      {img ? (
        <img src={att.url} alt={att.name} style={{
          width: 30, height: 30, borderRadius: 4, objectFit: "cover", flexShrink: 0,
          border: "1px solid rgba(242,236,223,0.1)",
        }} />
      ) : (
        <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11, color: "var(--cream)", fontFamily: "Manrope, sans-serif",
          fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{att.name}</div>
        <div style={{ fontSize: 9.5, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif" }}>
          {fmtSize(att.size)}
        </div>
      </div>
    </a>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props { conversationId: string | null }

export function InboxDetail({ conversationId }: Props) {
  const [conv, setConv]           = useState<ConversationDetail | null>(null);
  const [timeline, setTimeline]   = useState<TimelineEvent[]>([]);
  const [reply, setReply]         = useState("");
  const [isNote, setIsNote]       = useState(false);
  const [isPending, start]          = useTransition();
  const [error, setError]           = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [convNum, setConvNum]       = useState<number | null>(null);
  const [statusPos, setStatusPos]   = useState<{ top: number; left: number } | null>(null);
  const statusBtnRef      = useRef<HTMLButtonElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Edição de mensagem
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Upload de arquivo pelo admin
  const [pendingAtts,  setPendingAtts]  = useState<TimelineAttachment[]>([]);
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const endRef    = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!showStatus) return;
    function close(e: MouseEvent) {
      const t = e.target as Node;
      if (
        statusBtnRef.current && !statusBtnRef.current.contains(t) &&
        statusDropdownRef.current && !statusDropdownRef.current.contains(t)
      ) {
        setShowStatus(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showStatus]);

  function load(id: string) {
    start(async () => {
      const [d, tl] = await Promise.all([
        getConversationDetail(id),
        getTimeline(id),
      ]);
      setConv(d);
      setTimeline(tl);
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

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    setError(null);
    const uploaded: TimelineAttachment[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { setError(`"${file.name}" excede 10 MB.`); continue; }
      const fd = new FormData();
      fd.append("file", file);
      if (conversationId) fd.append("conv_id", conversationId);
      try {
        const res  = await fetch("/api/inbox/upload", { method: "POST", body: fd });
        const json = await res.json() as { url?: string; name?: string; type?: string; size?: number; error?: string };
        if (!res.ok || !json.url) { setError(json.error ?? "Falha no upload."); continue; }
        uploaded.push({ url: json.url, name: json.name ?? file.name, type: json.type ?? file.type, size: json.size ?? file.size });
      } catch { setError("Erro de conexão no upload."); }
    }
    setUploading(false);
    if (uploaded.length) setPendingAtts(prev => [...prev, ...uploaded]);
  }

  // ── Enviar resposta ────────────────────────────────────────────────────────
  async function handleSend(resolveAfter = false) {
    if (!conversationId || (!reply.trim() && !pendingAtts.length)) return;
    setError(null);
    const atts = pendingAtts.length ? pendingAtts : undefined;
    const res = await sendReply(conversationId, reply, isNote, atts);
    if (!res.ok) { setError(res.error); return; }
    setReply("");
    setPendingAtts([]);
    if (resolveAfter) await setStatusWithAudit(conversationId, "resolved");
    load(conversationId);
  }

  // ── Editar mensagem ────────────────────────────────────────────────────────
  function startEdit(item: TimelineEvent) {
    setEditingId(item.id);
    setEditingText(item.body ?? "");
  }

  async function submitEdit() {
    if (!conversationId || !editingId || !editingText.trim()) { setEditingId(null); return; }
    setEditLoading(true);
    const res = await editMessage(conversationId, editingId, editingText);
    setEditLoading(false);
    setEditingId(null);
    if (!res.ok) { setError(res.error); return; }
    load(conversationId);
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  async function handleStatus(s: string) {
    if (!conversationId) return;
    await setStatusWithAudit(conversationId, s);
    setShowStatus(false);
    load(conversationId);
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  function handlePdf() {
    if (!conversationId) return;
    // O admin serve em /admin/* no mesmo domínio; URL relativa /api/... resolve
    // para o storefront. Usamos prefixo /admin explícito.
    window.open(`/admin/api/inbox/${conversationId}/pdf`, "_blank");
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

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "0 22px",
        background: "rgba(12,26,14,0.65)",
        backdropFilter: "blur(24px) saturate(1.3)",
        WebkitBackdropFilter: "blur(24px) saturate(1.3)",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          minHeight: 60, paddingTop: 10, paddingBottom: conv ? 0 : 10,
        }}>
          {isPending && !conv ? (
            <span style={{ color: "var(--cream-dim)", fontSize: 12.5, fontStyle: "italic" }}>Carregando…</span>
          ) : conv ? (
            <>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, rgba(185,146,77,0.22), rgba(185,146,77,0.07))",
                border: "1px solid rgba(185,146,77,0.28)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, color: "var(--gold-light)",
              }}>
                {CHANNEL_ICON[conv.channel] ?? "◉"}
              </div>

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
                  {conv.contact_handle && <><span style={{ opacity: 0.6 }}>·</span><span>{conv.contact_handle}</span></>}
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ opacity: 0.45 }}>aberto {formatRelative(conv.created_at)}</span>
                </div>
              </div>

              {/* PDF */}
              <button
                onClick={handlePdf}
                title="Gerar PDF da conversa"
                style={{
                  background: "rgba(185,146,77,0.08)",
                  border: "1px solid rgba(185,146,77,0.2)",
                  borderRadius: 8, color: "var(--gold-light)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11, fontWeight: 600,
                  padding: "6px 11px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                  flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(185,146,77,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(185,146,77,0.08)")}
              >
                📄 PDF
              </button>

              {/* Status dropdown */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  ref={statusBtnRef}
                  onClick={() => {
                    if (!showStatus && statusBtnRef.current) {
                      const r = statusBtnRef.current.getBoundingClientRect();
                      setStatusPos({ top: r.bottom + 6, left: r.left });
                    }
                    setShowStatus(v => !v);
                  }}
                  style={{
                    background: `${sc}15`,
                    border: `1px solid ${sc}38`,
                    borderRadius: 8, color: sc,
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                    padding: "6px 11px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc, boxShadow: `0 0 5px ${sc}`, flexShrink: 0 }} />
                  {sLabel(conv.status)}
                  <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▾</span>
                </button>
                {showStatus && statusPos && typeof document !== "undefined" && createPortal(
                  <div ref={statusDropdownRef} style={{
                    position: "fixed",
                    top: statusPos.top,
                    left: statusPos.left,
                    background: "rgba(10,22,11,0.97)",
                    border: "1px solid rgba(242,236,223,0.12)",
                    borderRadius: 12, zIndex: 99999, minWidth: 190,
                    boxShadow: "0 20px 56px rgba(0,0,0,0.75)",
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
                  </div>,
                  document.body
                )}
              </div>

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
                    whiteSpace: "nowrap",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.16)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(74,222,128,0.09)")}
                >
                  ✓ Resolver
                </button>
              )}
            </>
          ) : null}
        </div>

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
            <div style={{ fontSize: 32, color: "var(--gold-light)", opacity: 0.18, fontFamily: "Fraunces, serif" }}>✦</div>
            <p style={{ fontSize: 12.5, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>
              Nenhuma mensagem ainda
            </p>
          </div>
        )}

        {timeline.map((item, idx) => {
          /* ── Evento de sistema ── */
          if (item.kind === "event") {
            const { icon, color } = eventIcon(item.event_type);
            const prevIsEvent = idx > 0 && timeline[idx - 1].kind === "event";
            return (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                justifyContent: "center",
                marginTop: prevIsEvent ? -6 : 4, marginBottom: 4,
              }}>
                <div style={{ height: 1, flex: 1, background: "rgba(242,236,223,0.05)" }} />
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(10,22,11,0.6)",
                  border: `1px solid ${color}22`,
                  borderRadius: 20, padding: "4px 10px",
                }}>
                  <span style={{ fontSize: 10, color }}>{icon}</span>
                  <span style={{ fontSize: 10.5, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif" }}>
                    {item.event_label}
                  </span>
                  {item.event_meta && (
                    <span style={{ fontSize: 10, color: "rgba(242,236,223,0.3)", fontFamily: "Manrope, sans-serif" }}>
                      — {item.event_meta}
                    </span>
                  )}
                  <span style={{ fontSize: 9.5, color: "rgba(242,236,223,0.25)", fontFamily: "Manrope, sans-serif", marginLeft: 2 }}>
                    {formatRelative(item.created_at)}
                  </span>
                </div>
                <div style={{ height: 1, flex: 1, background: "rgba(242,236,223,0.05)" }} />
              </div>
            );
          }

          /* ── Mensagem / Nota ── */
          const isOut     = !item.sender_is_contact;
          const isNoteMsg = item.is_internal_note;
          const atts      = item.attachments ?? [];
          const isEditing = editingId === item.id;

          return (
            <div key={item.id} style={{
              display: "flex", flexDirection: "column",
              alignItems: isOut ? "flex-end" : "flex-start",
              gap: 4,
            }}>
              {/* Rótulo */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                paddingLeft: isOut ? 0 : 4, paddingRight: isOut ? 4 : 0,
              }}>
                {isNoteMsg && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                    textTransform: "uppercase", color: "#f0b429",
                    background: "rgba(240,180,41,0.12)",
                    border: "1px solid rgba(240,180,41,0.25)",
                    borderRadius: 4, padding: "1px 6px",
                  }}>Nota interna</span>
                )}
                <span style={{
                  fontSize: 10.5, color: "rgba(242,236,223,0.32)",
                  fontFamily: "Manrope, sans-serif",
                }}>
                  {item.sender_name} · {formatDateTime(item.created_at)}
                </span>
                {/* Botão editar — apenas nas mensagens do admin (direction=out/note) */}
                {!isEditing && !item.sender_is_contact && (
                  <button
                    onClick={() => startEdit(item)}
                    title="Editar sua mensagem"
                    style={{
                      background: "none", border: "none",
                      fontSize: 11, color: "rgba(242,236,223,0.25)",
                      cursor: "pointer", padding: "0 2px",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#d9b87a")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,236,223,0.25)")}
                  >✏</button>
                )}
              </div>

              {/* Bolha ou editor */}
              {isEditing ? (
                <div style={{ maxWidth: "68%", width: "100%" }}>
                  <textarea
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus rows={3}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(185,146,77,0.06)",
                      border: "1px solid rgba(185,146,77,0.38)",
                      borderRadius: 10, padding: "9px 12px",
                      color: "var(--cream)", fontSize: 13.5,
                      fontFamily: "Manrope, sans-serif", lineHeight: 1.5,
                      outline: "none", resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 5, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        background: "none", border: "none", fontSize: 11,
                        color: "var(--cream-dim)", cursor: "pointer",
                      }}
                    >Cancelar</button>
                    <button
                      onClick={submitEdit}
                      disabled={editLoading || !editingText.trim()}
                      style={{
                        background: "rgba(185,146,77,0.18)",
                        border: "1px solid rgba(185,146,77,0.38)",
                        borderRadius: 7, fontSize: 11, fontWeight: 700,
                        color: "var(--gold-light)", padding: "4px 12px",
                        cursor: editLoading ? "wait" : "pointer",
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >{editLoading ? "Salvando…" : "Salvar (⌘↵)"}</button>
                  </div>
                </div>
              ) : (
                <>
                  {item.body && (
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
                      borderRadius: isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      padding: "10px 14px",
                      fontSize: 13.5, fontFamily: "Manrope, sans-serif",
                      color: "var(--cream)", lineHeight: 1.55,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      backdropFilter: "blur(8px)",
                    }}>
                      {item.body}
                    </div>
                  )}
                  {/* Attachments */}
                  {atts.length > 0 && (
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 6,
                      maxWidth: "68%",
                      justifyContent: isOut ? "flex-end" : "flex-start",
                    }}>
                      {atts.map((att, i) => <AttachmentChip key={i} att={att} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Editor de resposta ────────────────────────────────────────────── */}
      <div
        ref={editorRef}
        style={{
          padding: "14px 22px 18px",
          borderTop: "1px solid rgba(242,236,223,0.07)",
          background: "rgba(12,26,14,0.6)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          flexShrink: 0, position: "relative",
        }}
      >
        {/* MacroPicker */}
        {showMacros && (
          <MacroPicker
            contactName={conv?.contact_name}
            contactEmail={conv?.contact_email}
            onApply={(body, isNoteTemplate) => {
              setReply(prev => prev ? prev + "\n\n" + body : body);
              setIsNote(isNoteTemplate);
              setShowMacros(false);
            }}
            onClose={() => setShowMacros(false)}
          />
        )}

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

        {/* Preview de arquivos pendentes */}
        {pendingAtts.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
            marginBottom: 10,
          }}>
            {pendingAtts.map((att, i) => (
              <div key={i} style={{ position: "relative" }}>
                <AttachmentChip att={att} />
                <button
                  onClick={() => setPendingAtts(prev => prev.filter((_, j) => j !== i))}
                  style={{
                    position: "absolute", top: -5, right: -5,
                    width: 15, height: 15, borderRadius: "50%",
                    background: "#ef4444", border: "none", color: "#fff",
                    fontSize: 8, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Upload */}
              <input
                ref={fileInputRef} type="file" multiple
                accept=".jpg,.jpeg,.png,.webp,.svg,.pdf"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Anexar arquivo (JPG, PNG, SVG, PDF)"
                style={{
                  background: uploading ? "rgba(185,146,77,0.06)" : "rgba(242,236,223,0.05)",
                  border: "1px solid rgba(242,236,223,0.09)",
                  borderRadius: 7, padding: "5px 9px",
                  color: uploading ? "var(--cream-dim)" : "var(--cream-soft)",
                  fontFamily: "Manrope, sans-serif", fontSize: 13,
                  cursor: uploading ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  transition: "all 0.2s",
                }}
              >{uploading ? "⏳" : "📎"}</button>

              {/* Templates */}
              <button
                onClick={() => setShowMacros(v => !v)}
                style={{
                  background: showMacros ? "rgba(185,146,77,0.14)" : "rgba(242,236,223,0.05)",
                  border: `1px solid ${showMacros ? "rgba(185,146,77,0.3)" : "rgba(242,236,223,0.09)"}`,
                  borderRadius: 7,
                  color: showMacros ? "var(--gold-light)" : "var(--cream-dim)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 10.5, fontWeight: showMacros ? 700 : 500,
                  padding: "5px 9px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 11 }}>◈</span>
                Templates
              </button>
              <span style={{
                fontSize: 10, color: "rgba(242,236,223,0.22)",
                fontFamily: "Manrope, sans-serif",
              }}>
                Ctrl+Enter para enviar
              </span>
            </div>

            <div style={{ display: "flex", gap: 7 }}>
              {!isNote && (
                <button
                  onClick={() => handleSend(true)}
                  disabled={(!reply.trim() && !pendingAtts.length) || isPending}
                  style={{
                    background: "rgba(74,222,128,0.07)",
                    border: "1px solid rgba(74,222,128,0.18)",
                    borderRadius: 8, color: "#4ade80",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 11, fontWeight: 700,
                    padding: "7px 13px", letterSpacing: 0.3,
                    cursor: (!reply.trim() && !pendingAtts.length) || isPending ? "default" : "pointer",
                    opacity: (!reply.trim() && !pendingAtts.length) || isPending ? 0.4 : 1,
                    transition: "all 0.2s",
                  }}
                >
                  Enviar e resolver
                </button>
              )}

              <button
                onClick={() => handleSend()}
                disabled={(!reply.trim() && !pendingAtts.length) || isPending}
                style={{
                  background: ((!reply.trim() && !pendingAtts.length) || isPending)
                    ? "rgba(185,146,77,0.25)"
                    : "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
                  border: "none", borderRadius: 8,
                  color: "var(--forest-950)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11, fontWeight: 800,
                  letterSpacing: 1.2, textTransform: "uppercase",
                  padding: "7px 18px",
                  cursor: ((!reply.trim() && !pendingAtts.length) || isPending) ? "default" : "pointer",
                  opacity: ((!reply.trim() && !pendingAtts.length) || isPending) ? 0.5 : 1,
                  boxShadow: ((!reply.trim() && !pendingAtts.length) || isPending)
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
