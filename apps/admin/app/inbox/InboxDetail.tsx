"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { ConversationDetail, TimelineAttachment, TimelineEvent, PipelineOption } from "./inbox-actions";
import {
  editMessage,
  getConversationDetail,
  getTimeline,
  sendReply,
  setStatusWithAudit,
  triageLeadToPipeline,
  getPipelineOptions,
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
  { value: "urgent",           label: "Urgente",         color: "#e07b6a" },
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

// ── Media bubble (WA/IG) ──────────────────────────────────────────────────────

function MediaBubble({ mediaType, mediaUrl, body, isOut }: {
  mediaType?: TimelineEvent["media_type"];
  mediaUrl?: string;
  body?: string;
  isOut: boolean;
}) {
  if (!mediaType) return null;
  const borderR = isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px";
  const bg = isOut
    ? "linear-gradient(135deg, rgba(185,146,77,0.17), rgba(185,146,77,0.07))"
    : "rgba(242,236,223,0.055)";
  const border = isOut ? "1px solid rgba(185,146,77,0.22)" : "1px solid rgba(242,236,223,0.08)";

  if (mediaType === "image" && mediaUrl) {
    return (
      <div style={{ maxWidth: "68%", borderRadius: borderR, overflow: "hidden", border }}>
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
          <img src={mediaUrl} alt="imagem" style={{ display: "block", maxWidth: 300, maxHeight: 300, objectFit: "cover" }} />
        </a>
        {body && (
          <div style={{ padding: "6px 12px 8px", background: bg, fontSize: 13, fontFamily: "Manrope, sans-serif", color: "var(--cream)" }}>
            {body}
          </div>
        )}
      </div>
    );
  }

  if (mediaType === "audio" && mediaUrl) {
    return (
      <div style={{ maxWidth: "68%", background: bg, border, borderRadius: borderR, padding: "10px 12px" }}>
        <audio controls style={{ maxWidth: 260 }}>
          <source src={mediaUrl} />
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-light)", fontSize: 12 }}>🎵 Áudio</a>
        </audio>
      </div>
    );
  }

  if (mediaType === "video" && mediaUrl) {
    return (
      <div style={{ maxWidth: "68%", borderRadius: borderR, overflow: "hidden", border }}>
        <video controls style={{ maxWidth: 300, display: "block" }}>
          <source src={mediaUrl} />
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-light)", fontSize: 12 }}>🎬 Vídeo</a>
        </video>
        {body && (
          <div style={{ padding: "6px 12px 8px", background: bg, fontSize: 13, fontFamily: "Manrope, sans-serif", color: "var(--cream)" }}>
            {body}
          </div>
        )}
      </div>
    );
  }

  if (mediaType === "document" || mediaType === "sticker") {
    return (
      <div style={{ maxWidth: "68%", background: bg, border, borderRadius: borderR, padding: "10px 14px" }}>
        <a href={mediaUrl ?? "#"} target="_blank" rel="noopener noreferrer" style={{
          display: "flex", alignItems: "center", gap: 8,
          color: "var(--gold-light)", textDecoration: "none",
          fontFamily: "Manrope, sans-serif", fontSize: 13,
        }}>
          <span>{mediaType === "sticker" ? "🎭" : "📎"}</span>
          <span>{body || (mediaType === "document" ? "Documento" : "Sticker")}</span>
        </a>
      </div>
    );
  }

  // Fallback genérico
  return (
    <div style={{ maxWidth: "68%", background: bg, border, borderRadius: borderR, padding: "10px 14px",
      fontFamily: "Manrope, sans-serif", fontSize: 13, color: "var(--cream)" }}>
      {body || `[${mediaType}]`}
    </div>
  );
}

// ── Triage Modal ──────────────────────────────────────────────────────────────

function TriageModal({
  conversationId,
  onClose,
  onSuccess,
}: {
  conversationId: string;
  onClose: () => void;
  onSuccess: (dealId: string) => void;
}) {
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPipelineOptions().then(opts => { setPipelines(opts); setLoading(false); });
  }, []);

  const pipeline = pipelines.find(p => p.id === selectedPipeline);

  async function handleSubmit() {
    if (!selectedPipeline || !selectedStage) { setError("Selecione pipeline e estágio."); return; }
    setSending(true);
    setError(null);
    const res = await triageLeadToPipeline(conversationId, selectedPipeline, selectedStage, notes || undefined);
    setSending(false);
    if (!res.ok) { setError(res.error); return; }
    onSuccess(res.data);
  }

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "rgba(10,22,11,0.98)",
        border: "1px solid rgba(242,236,223,0.12)",
        borderRadius: 16, padding: 28,
        width: 380, maxWidth: "90vw",
        boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        backdropFilter: "blur(24px)",
      }}>
        <div style={{
          fontFamily: "Fraunces, serif", fontSize: 18,
          color: "var(--cream)", marginBottom: 18,
        }}>
          Enviar lead para pipeline
        </div>

        {loading ? (
          <p style={{ color: "var(--cream-dim)", fontSize: 12, fontFamily: "Manrope, sans-serif" }}>Carregando pipelines…</p>
        ) : pipelines.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
            <p style={{ color: "var(--cream-dim)", fontSize: 13, fontFamily: "Manrope, sans-serif", margin: 0, lineHeight: 1.5 }}>
              Nenhum pipeline ativo ainda.
            </p>
            <a
              href="/admin/inbox/pipeline"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                background: "linear-gradient(135deg, rgba(185,146,77,0.18), rgba(185,146,77,0.08))",
                border: "1px solid rgba(185,146,77,0.35)",
                borderRadius: 10,
                color: "var(--gold-light)",
                fontFamily: "Manrope, sans-serif",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(185,146,77,0.22)")}
              onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(135deg, rgba(185,146,77,0.18), rgba(185,146,77,0.08))")}
            >
              <span style={{ fontSize: 14 }}>⬡</span>
              Criar pipeline CRM
              <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span>
            </a>
            <button
              onClick={async () => { setLoading(true); const list = await getPipelineOptions(); setPipelines(list); setLoading(false); }}
              style={{
                background: "none",
                border: "none",
                color: "rgba(242,236,223,0.4)",
                fontFamily: "Manrope, sans-serif",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              ↺ Recarregar após criar
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", letterSpacing: 0.8, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Pipeline
              </label>
              <select
                value={selectedPipeline}
                onChange={e => { setSelectedPipeline(e.target.value); setSelectedStage(""); }}
                style={{
                  width: "100%", background: "rgba(242,236,223,0.05)",
                  border: "1px solid rgba(242,236,223,0.12)",
                  borderRadius: 8, padding: "8px 10px",
                  color: "var(--cream)", fontFamily: "Manrope, sans-serif",
                  fontSize: 13, outline: "none",
                }}
              >
                <option value="">Selecionar…</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {pipeline && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", letterSpacing: 0.8, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Estágio
                </label>
                <select
                  value={selectedStage}
                  onChange={e => setSelectedStage(e.target.value)}
                  style={{
                    width: "100%", background: "rgba(242,236,223,0.05)",
                    border: "1px solid rgba(242,236,223,0.12)",
                    borderRadius: 8, padding: "8px 10px",
                    color: "var(--cream)", fontFamily: "Manrope, sans-serif",
                    fontSize: 13, outline: "none",
                  }}
                >
                  <option value="">Selecionar…</option>
                  {pipeline.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", letterSpacing: 0.8, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Observações (opcional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(242,236,223,0.05)",
                  border: "1px solid rgba(242,236,223,0.12)",
                  borderRadius: 8, padding: "8px 10px",
                  color: "var(--cream)", fontFamily: "Manrope, sans-serif",
                  fontSize: 13, outline: "none", resize: "vertical",
                }}
                placeholder="Contexto do lead, interesse, urgência…"
              />
            </div>
          </>
        )}

        {error && (
          <p style={{ color: "#ef4444", fontSize: 11.5, fontFamily: "Manrope, sans-serif", marginBottom: 12 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid rgba(242,236,223,0.12)",
              borderRadius: 8, padding: "7px 14px",
              color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif",
              fontSize: 12, cursor: "pointer",
            }}
          >Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={sending || !selectedPipeline || !selectedStage}
            style={{
              background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
              border: "none", borderRadius: 8,
              padding: "7px 16px",
              color: "var(--forest-950)", fontFamily: "Manrope, sans-serif",
              fontSize: 12, fontWeight: 800, letterSpacing: 0.8,
              cursor: sending ? "wait" : "pointer",
              opacity: sending || !selectedPipeline || !selectedStage ? 0.5 : 1,
            }}
          >{sending ? "Enviando…" : "Enviar para pipeline"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
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

interface Props { conversationId: string | null; onStatusChange?: () => void }

export function InboxDetail({ conversationId, onStatusChange }: Props) {
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

  // Triagem para pipeline
  const [showTriage, setShowTriage] = useState(false);

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
    if (resolveAfter) {
      await setStatusWithAudit(conversationId, "resolved");
      onStatusChange?.();
    }
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
    onStatusChange?.();
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

              {/* Triagem para Pipeline */}
              <button
                onClick={() => setShowTriage(true)}
                title="Enviar lead para o pipeline CRM"
                style={{
                  background: "rgba(167,139,250,0.08)",
                  border: "1px solid rgba(167,139,250,0.22)",
                  borderRadius: 8, color: "#a78bfa",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11, fontWeight: 600,
                  padding: "6px 11px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                  flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.08)")}
              >
                ◈ Pipeline
              </button>

              {/* WhatsApp — link wa.me gratuito (cliente inicia) */}
              {conv.contact_phone && (() => {
                const digits = conv.contact_phone.replace(/\D/g, "");
                const waNum  = digits.startsWith("55") ? digits : `55${digits}`;
                const name   = encodeURIComponent(conv.contact_name || "cliente");
                const waUrl  = `https://wa.me/${waNum}?text=Ol%C3%A1+${name}%2C+recebemos+seu+contato+pela+Flora+Botanics.+Como+podemos+ajudar%3F`;
                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Contatar via WhatsApp: ${conv.contact_phone}`}
                    style={{
                      background: "rgba(37,211,102,0.08)",
                      border: "1px solid rgba(37,211,102,0.25)",
                      borderRadius: 8, color: "#25d366",
                      fontFamily: "Manrope, sans-serif",
                      fontSize: 11, fontWeight: 600,
                      padding: "6px 11px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                      flexShrink: 0, whiteSpace: "nowrap",
                      textDecoration: "none", transition: "all 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(37,211,102,0.15)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(37,211,102,0.08)")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                );
              })()}

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
                        onMouseDown={e => e.preventDefault()}
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
                  {/* Mídia WA/IG (image, audio, video, document, sticker) */}
                  {item.media_type ? (
                    <MediaBubble
                      mediaType={item.media_type}
                      mediaUrl={item.media_url}
                      body={item.body}
                      isOut={isOut}
                    />
                  ) : item.body ? (
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
                  ) : null}
                  {/* Attachments (upload de arquivo pelo admin) */}
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

      {/* Modal de triagem */}
      {showTriage && conversationId && (
        <TriageModal
          conversationId={conversationId}
          onClose={() => setShowTriage(false)}
          onSuccess={(dealId) => {
            setShowTriage(false);
            // feedback visual
            setError(null);
            console.info("[triage] deal criado:", dealId);
          }}
        />
      )}
    </div>
  );
}
