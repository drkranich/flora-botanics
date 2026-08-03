"use client";

import { useEffect, useRef, useState } from "react";

// ── Tópicos ───────────────────────────────────────────────────────────────────

const TOPICS = [
  "Dúvida sobre produto",
  "Rastrear meu pedido",
  "Troca ou devolução",
  "Cupons e promoções",
  "Consultoria de skincare",
  "Encomenda especial",
  "Outro assunto",
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Attachment {
  url:  string;
  name: string;
  type: string;
  size: number;
}

interface ChatMessage {
  id:          string;
  direction:   "in" | "out";
  sender_name: string;
  body:        string;
  attachments: Attachment[];
  created_at:  string;
}

type Phase = "closed" | "form" | "chat";

const STORAGE_KEY = "flora_chat_session";

interface StoredSession {
  convId:   string;
  userName: string;
  topic:    string;
  messages: ChatMessage[];
  lastAt:   string;
}

function timeStr(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isRasterImage(type: string) {
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

// ── Componente de attachment ──────────────────────────────────────────────────

function AttachmentChip({ att }: { att: Attachment }) {
  const img    = isRasterImage(att.type);
  const isPdf  = att.type === "application/pdf";
  const isSvg  = att.type === "image/svg+xml";
  const icon   = isPdf ? "📄" : isSvg ? "🖼️" : "📎";

  return (
    <a
      href={att.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8, padding: "4px 8px",
        textDecoration: "none",
        maxWidth: 200, overflow: "hidden",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
    >
      {img ? (
        <img
          src={att.url} alt={att.name}
          style={{
            width: 32, height: 32, borderRadius: 5,
            objectFit: "cover", flexShrink: 0,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        />
      ) : (
        <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11, color: "#f2ecdf",
          fontFamily: "Manrope, sans-serif", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{att.name}</div>
        <div style={{
          fontSize: 9.5, color: "rgba(242,236,223,0.45)",
          fontFamily: "Manrope, sans-serif",
        }}>{fmtSize(att.size)}</div>
      </div>
    </a>
  );
}

// ── Widget principal ──────────────────────────────────────────────────────────

export function ChatWidget() {
  const [phase, setPhase]       = useState<Phase>("closed");
  const [convId, setConvId]     = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [topic, setTopic]       = useState<string | null>(null);
  const [unread, setUnread]     = useState(0);

  // Edição de mensagem
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Upload
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Refs estáveis para polling
  const lastAtRef   = useRef(new Date(0).toISOString());
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const endRef      = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const convIdRef   = useRef<string | null>(null);
  const userNameRef = useRef("");
  const topicRef    = useRef<string | null>(null);

  // ── SessionStorage ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as StoredSession;
      if (!s.convId) return;
      convIdRef.current   = s.convId;
      userNameRef.current = s.userName ?? "";
      topicRef.current    = s.topic ?? null;
      setConvId(s.convId);
      setUserName(s.userName ?? "");
      setTopic(s.topic ?? null);
      setMessages(s.messages ?? []);
      if (s.lastAt) lastAtRef.current = s.lastAt;
      setPhase("chat");
    } catch { /* ignora */ }
  }, []);

  function saveSession(cid: string, uName: string, tp: string, msgs: ChatMessage[], lat: string) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ convId: cid, userName: uName, topic: tp, messages: msgs, lastAt: lat }));
    } catch { /* quota */ }
  }
  function clearSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (phase === "chat") setTimeout(() => inputRef.current?.focus(), 120);
  }, [phase]);

  // ── Polling estável ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "chat" || !convId) return;

    async function poll() {
      const cid = convIdRef.current;
      if (!cid) return;
      try {
        const res = await fetch(`/api/chat?conv_id=${cid}&after=${encodeURIComponent(lastAtRef.current)}`);
        if (!res.ok) return;
        const json = await res.json() as { messages?: ChatMessage[] };
        const incoming = json.messages ?? [];
        if (!incoming.length) return;

        setMessages(prev => {
          const ids  = new Set(prev.map(m => m.id));
          const news = incoming.filter(m => !ids.has(m.id));
          if (!news.length) return prev;

          const newLastAt = news[news.length - 1].created_at;
          lastAtRef.current = newLastAt;
          const next = [...prev, ...news];
          if (convIdRef.current) {
            saveSession(convIdRef.current, userNameRef.current, topicRef.current ?? "", next, newLastAt);
          }
          return next;
        });
      } catch { /* ignora rede */ }
    }

    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, convId]);

  useEffect(() => {
    if (phase === "chat") setUnread(0);
  }, [phase]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    setError(null);
    const uploaded: Attachment[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { setError(`"${file.name}" excede 10 MB.`); continue; }
      const fd = new FormData();
      fd.append("file", file);
      if (convIdRef.current) fd.append("conv_id", convIdRef.current);
      try {
        const res  = await fetch("/api/chat/upload", { method: "POST", body: fd });
        const json = await res.json() as { url?: string; name?: string; type?: string; size?: number; error?: string };
        if (!res.ok || !json.url) { setError(json.error ?? "Falha no upload."); continue; }
        uploaded.push({ url: json.url, name: json.name ?? file.name, type: json.type ?? file.type, size: json.size ?? file.size });
      } catch { setError("Erro de conexão no upload."); }
    }

    setUploading(false);
    if (uploaded.length) setPendingFiles(prev => [...prev, ...uploaded]);
  }

  // ── Iniciar ────────────────────────────────────────────────────────────────
  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !phone.trim()) { setError("Preencha nome, e-mail e telefone."); return; }
    if (!topic) { setError("Selecione um tópico."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", name, email, phone, topic }),
      });
      const json = await res.json() as { conv_id?: string; error?: string };
      if (!res.ok || !json.conv_id) { setError(json.error ?? "Erro ao iniciar."); return; }

      const cid = json.conv_id;
      // lastAt fica em epoch: a primeira poll busca TODAS as mensagens da conversa
      // (incluindo a boas-vindas do admin criada no mesmo instante)
      lastAtRef.current   = new Date(0).toISOString();

      convIdRef.current   = cid;
      userNameRef.current = name;
      topicRef.current    = topic;

      setConvId(cid);
      setUserName(name);
      setMessages([]);
      saveSession(cid, name, topic, [], new Date(0).toISOString());
      setPhase("chat");
    } catch { setError("Falha de conexão."); }
    finally { setLoading(false); }
  }

  // ── Enviar ─────────────────────────────────────────────────────────────────
  async function handleSend() {
    if ((!text.trim() && !pendingFiles.length) || !convId) return;
    const body        = text.trim();
    const attachments = [...pendingFiles];
    setText("");
    setPendingFiles([]);

    const tempId  = `temp-${Date.now()}`;
    const now     = new Date().toISOString();
    const tempMsg: ChatMessage = {
      id: tempId, direction: "in", sender_name: userNameRef.current,
      body, attachments, created_at: now,
    };
    setMessages(prev => {
      const next = [...prev, tempMsg];
      saveSession(convId, userNameRef.current, topicRef.current ?? "", next, lastAtRef.current);
      return next;
    });

    try {
      await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", conv_id: convId, text: body, attachments }),
      });
    } catch { /* optimistic já apareceu */ }
  }

  // ── Editar mensagem do lead ────────────────────────────────────────────────
  function startEdit(msg: ChatMessage) {
    setEditingId(msg.id);
    setEditingText(msg.body);
  }

  async function submitEdit(msgId: string) {
    if (!convId || !editingText.trim()) { setEditingId(null); return; }
    const newBody = editingText.trim();
    setEditingId(null);

    // Atualiza optimisticamente
    setMessages(prev => {
      const next = prev.map(m => m.id === msgId ? { ...m, body: newBody } : m);
      saveSession(convId, userNameRef.current, topicRef.current ?? "", next, lastAtRef.current);
      return next;
    });

    try {
      await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", conv_id: convId, msg_id: msgId, text: newBody }),
      });
    } catch { /* ignora */ }
  }

  // ── Encerrar ───────────────────────────────────────────────────────────────
  function handleClose() {
    if (pollRef.current) clearInterval(pollRef.current);
    clearSession();
    convIdRef.current   = null;
    userNameRef.current = "";
    topicRef.current    = null;
    setPhase("closed");
    setConvId(null);
    setMessages([]);
    setName(""); setEmail(""); setPhone(""); setTopic(null);
    setUserName(""); setText(""); setPendingFiles([]);
    lastAtRef.current = new Date(0).toISOString();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Botão flutuante */}
      {phase === "closed" && (
        <button
          onClick={() => setPhase(convId ? "chat" : "form")}
          aria-label="Abrir chat"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9000,
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #b9924d, #d9b87a 60%, #7a5c1e)",
            border: "none",
            boxShadow: "0 8px 32px rgba(185,146,77,0.5), 0 0 0 2px rgba(185,146,77,0.2)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, transition: "transform 0.25s, box-shadow 0.25s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 12px 40px rgba(185,146,77,0.65)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 8px 32px rgba(185,146,77,0.5)";
          }}
        >
          💬
          {unread > 0 && (
            <span style={{
              position: "absolute", top: 2, right: 2,
              width: 18, height: 18, borderRadius: "50%",
              background: "#ef4444", color: "#fff",
              fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff",
            }}>{unread}</span>
          )}
        </button>
      )}

      {/* Painel */}
      {phase !== "closed" && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9000,
          width: "min(380px, calc(100vw - 32px))",
          borderRadius: 20,
          background: "rgba(8,15,9,0.96)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
          border: "1px solid rgba(185,146,77,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(185,146,77,0.1)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          fontFamily: "Manrope, sans-serif",
          maxHeight: "calc(100vh - 48px)",
        }}>

          {/* Header */}
          <div style={{
            padding: "16px 18px 14px",
            background: "linear-gradient(135deg, rgba(185,146,77,0.18), rgba(185,146,77,0.06))",
            borderBottom: "1px solid rgba(185,146,77,0.18)",
            display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #b9924d, #d9b87a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, boxShadow: "0 0 14px rgba(185,146,77,0.4)",
            }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f2ecdfe6", fontFamily: "Fraunces, serif" }}>
                Flora Botanics
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 5px #4ade80", display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "rgba(242,236,223,0.5)" }}>Online agora</span>
              </div>
            </div>
            <button
              onClick={() => setPhase("closed")}
              style={{
                background: "rgba(242,236,223,0.08)", border: "1px solid rgba(242,236,223,0.12)",
                borderRadius: 8, width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(242,236,223,0.5)", fontSize: 14,
              }}
            >×</button>
          </div>

          {/* Formulário */}
          {phase === "form" && (
            <form onSubmit={handleStart} style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(242,236,223,0.7)", lineHeight: 1.5 }}>
                Olá! Para iniciarmos seu atendimento, preencha os dados abaixo:
              </p>
              {[
                { label: "Nome *", value: name, set: setName, placeholder: "Seu nome completo", type: "text" },
                { label: "E-mail *", value: email, set: setEmail, placeholder: "seu@email.com", type: "email" },
                { label: "Telefone / WhatsApp *", value: phone, set: setPhone, placeholder: "(11) 9 0000-0000", type: "tel" },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "rgba(242,236,223,0.45)", letterSpacing: 0.5, marginBottom: 5 }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder} required
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(15,32,18,0.6)", border: "1px solid rgba(242,236,223,0.1)",
                      borderRadius: 9, padding: "9px 12px",
                      color: "#f2ecdf", fontSize: 13, fontFamily: "Manrope, sans-serif", outline: "none",
                    }}
                    onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.45)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "rgba(242,236,223,0.45)", letterSpacing: 0.5, marginBottom: 8 }}>
                  Como podemos ajudar? *
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TOPICS.map(t => (
                    <button key={t} type="button" onClick={() => setTopic(t)} style={{
                      background: topic === t ? "rgba(185,146,77,0.2)" : "rgba(15,32,18,0.6)",
                      border: `1px solid ${topic === t ? "rgba(185,146,77,0.5)" : "rgba(242,236,223,0.1)"}`,
                      borderRadius: 20, padding: "5px 12px",
                      fontSize: 11.5, color: topic === t ? "#d9b87a" : "rgba(242,236,223,0.6)",
                      cursor: "pointer", fontFamily: "Manrope, sans-serif",
                      fontWeight: topic === t ? 700 : 400, transition: "all 0.18s",
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              {error && <p style={{ margin: 0, fontSize: 11.5, color: "#ef4444" }}>{error}</p>}
              <button type="submit" disabled={loading} style={{
                background: loading ? "rgba(185,146,77,0.3)" : "linear-gradient(135deg, #d9b87a, #b9924d 55%, #7a5c1e)",
                border: "none", borderRadius: 10, color: "#0a160b",
                fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 800,
                letterSpacing: 1.2, textTransform: "uppercase", padding: "11px",
                cursor: loading ? "default" : "pointer",
                boxShadow: loading ? "none" : "0 4px 18px rgba(185,146,77,0.35)",
                transition: "all 0.2s", marginTop: 4,
              }}>{loading ? "Iniciando…" : "Iniciar conversa ✦"}</button>
              <p style={{ margin: 0, fontSize: 10.5, color: "rgba(242,236,223,0.3)", textAlign: "center" }}>
                Atendimento humano · Seg–Sex 08h–18h
              </p>
            </form>
          )}

          {/* Chat */}
          {phase === "chat" && (
            <>
              <div style={{
                flex: 1, overflowY: "auto",
                padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: 10,
                minHeight: 200, maxHeight: 360,
              }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(242,236,223,0.35)", fontSize: 12 }}>
                    Aguardando mensagens…
                  </div>
                )}
                {messages.map(msg => {
                  const isOut  = msg.direction === "out";
                  const atts   = msg.attachments ?? [];
                  const isEditing = editingId === msg.id;

                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-start" : "flex-end", gap: 3 }}>
                      {/* Bolha de texto */}
                      {isEditing ? (
                        <div style={{ maxWidth: "80%", width: "100%" }}>
                          <input
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") submitEdit(msg.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            style={{
                              width: "100%", boxSizing: "border-box",
                              background: "rgba(185,146,77,0.08)",
                              border: "1px solid rgba(185,146,77,0.4)",
                              borderRadius: 10, padding: "8px 12px",
                              color: "#f2ecdf", fontSize: 13,
                              fontFamily: "Manrope, sans-serif", outline: "none",
                            }}
                          />
                          <div style={{ display: "flex", gap: 6, marginTop: 4, justifyContent: "flex-end" }}>
                            <button onClick={() => setEditingId(null)} style={{
                              background: "none", border: "none", fontSize: 10.5,
                              color: "rgba(242,236,223,0.4)", cursor: "pointer",
                            }}>Cancelar</button>
                            <button onClick={() => submitEdit(msg.id)} style={{
                              background: "rgba(185,146,77,0.2)", border: "1px solid rgba(185,146,77,0.4)",
                              borderRadius: 6, fontSize: 10.5, color: "#d9b87a",
                              padding: "2px 8px", cursor: "pointer",
                            }}>Salvar</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ position: "relative", maxWidth: "80%" }}>
                          {msg.body && (
                            <div style={{
                              background: isOut ? "rgba(15,32,18,0.7)" : "linear-gradient(135deg, rgba(185,146,77,0.22), rgba(185,146,77,0.1))",
                              border: isOut ? "1px solid rgba(242,236,223,0.08)" : "1px solid rgba(185,146,77,0.28)",
                              borderRadius: isOut ? "4px 14px 14px 14px" : "14px 14px 4px 14px",
                              padding: "9px 13px", fontSize: 13, color: "#f2ecdf",
                              lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
                            }}>{msg.body}</div>
                          )}
                          {/* Botão ✏ — só nas mensagens DO LEAD (direction=in), aparece no hover */}
                          {!isOut && !msg.id.startsWith("temp-") && (
                            <button
                              onClick={() => startEdit(msg)}
                              title="Editar sua mensagem"
                              style={{
                                position: "absolute", top: 4, right: -20,
                                background: "none", border: "none",
                                fontSize: 11, color: "rgba(242,236,223,0.35)",
                                cursor: "pointer", padding: 2,
                                lineHeight: 1,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#d9b87a")}
                              onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,236,223,0.35)")}
                            >✏</button>
                          )}
                        </div>
                      )}
                      {/* Attachments */}
                      {atts.length > 0 && !isEditing && (
                        <div style={{
                          display: "flex", flexWrap: "wrap", gap: 5,
                          justifyContent: isOut ? "flex-start" : "flex-end",
                          maxWidth: "85%",
                        }}>
                          {atts.map((att, i) => <AttachmentChip key={i} att={att} />)}
                        </div>
                      )}
                      <span style={{ fontSize: 9.5, color: "rgba(242,236,223,0.25)" }}>
                        {isOut ? msg.sender_name : "Você"} · {timeStr(msg.created_at)}
                      </span>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Preview arquivos pendentes */}
              {pendingFiles.length > 0 && (
                <div style={{
                  padding: "6px 12px",
                  borderTop: "1px solid rgba(242,236,223,0.06)",
                  display: "flex", flexWrap: "wrap", gap: 6,
                  background: "rgba(10,22,11,0.4)",
                }}>
                  {pendingFiles.map((att, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <AttachmentChip att={att} />
                      <button
                        onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
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

              {/* Input bar */}
              <div style={{
                borderTop: "1px solid rgba(242,236,223,0.07)",
                padding: "10px 12px 12px",
                background: "rgba(10,22,11,0.5)",
                display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
              }}>
                <input
                  ref={fileInputRef} type="file" multiple
                  accept=".jpg,.jpeg,.png,.webp,.svg,.pdf"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Enviar arquivo (JPG, PNG, SVG, PDF — máx 10 MB)"
                  style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: "rgba(185,146,77,0.1)",
                    border: "1px solid rgba(185,146,77,0.22)",
                    cursor: uploading ? "wait" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, color: uploading ? "rgba(185,146,77,0.35)" : "#d9b87a",
                    transition: "all 0.2s",
                  }}
                >{uploading ? "⏳" : "📎"}</button>

                <input
                  ref={inputRef} value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                  placeholder="Digite sua mensagem…"
                  style={{
                    flex: 1, background: "rgba(15,32,18,0.7)",
                    border: "1px solid rgba(242,236,223,0.1)",
                    borderRadius: 10, padding: "9px 13px",
                    color: "#f2ecdf", fontSize: 13,
                    fontFamily: "Manrope, sans-serif", outline: "none",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.4)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() && !pendingFiles.length}
                  style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: (text.trim() || pendingFiles.length) ? "linear-gradient(135deg, #d9b87a, #b9924d)" : "rgba(185,146,77,0.2)",
                    border: "none", cursor: (text.trim() || pendingFiles.length) ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, color: (text.trim() || pendingFiles.length) ? "#0a160b" : "rgba(185,146,77,0.4)",
                    boxShadow: (text.trim() || pendingFiles.length) ? "0 4px 12px rgba(185,146,77,0.35)" : "none",
                    transition: "all 0.2s",
                  }}
                >↑</button>
              </div>

              <div style={{ padding: "5px 14px 9px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, color: "rgba(242,236,223,0.25)" }}>Enter · JPG, PNG, SVG, PDF até 10 MB</span>
                <button onClick={handleClose} style={{
                  background: "none", border: "none", fontSize: 10,
                  color: "rgba(242,236,223,0.3)", cursor: "pointer",
                  fontFamily: "Manrope, sans-serif", textDecoration: "underline",
                }}>Encerrar conversa</button>
              </div>
              {error && (
                <p style={{ margin: "0 14px 8px", fontSize: 11, color: "#ef4444", fontFamily: "Manrope, sans-serif" }}>
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
