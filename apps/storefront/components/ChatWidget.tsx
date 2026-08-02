"use client";

import { useEffect, useRef, useState } from "react";

// ── Tópicos de interesse sugeridos ────────────────────────────────────────────

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

interface ChatMessage {
  id: string;
  direction: "in" | "out";
  sender_name: string;
  body: string;
  created_at: string;
}

type Phase = "closed" | "form" | "chat";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeStr(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ChatWidget() {
  const [phase, setPhase]         = useState<Phase>("closed");
  const [convId, setConvId]       = useState<string | null>(null);
  const [userName, setUserName]   = useState("");
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [text, setText]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [lastAt, setLastAt]       = useState(new Date(0).toISOString());
  const [topic, setTopic]         = useState<string | null>(null);
  const [unread, setUnread]       = useState(0);

  // Form fields
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const endRef    = useRef<HTMLDivElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Foco no input quando abre o chat
  useEffect(() => {
    if (phase === "chat") setTimeout(() => inputRef.current?.focus(), 100);
  }, [phase]);

  // Polling de mensagens
  useEffect(() => {
    if (phase !== "chat" || !convId) return;

    async function poll() {
      if (!convId) return;
      try {
        const res = await fetch(`/api/chat?conv_id=${convId}&after=${encodeURIComponent(lastAt)}`);
        if (!res.ok) return;
        const json = await res.json() as { messages: ChatMessage[] };
        if (json.messages?.length) {
          setMessages(prev => {
            // Evita duplicatas
            const ids = new Set(prev.map(m => m.id));
            const news = json.messages.filter((m: ChatMessage) => !ids.has(m.id));
            if (!news.length) return prev;
            setLastAt(news[news.length - 1].created_at);
            if (phase === "chat") setUnread(0);
            else setUnread(u => u + news.filter((m: ChatMessage) => m.direction === "out").length);
            return [...prev, ...news];
          });
        }
      } catch { /* silencia */ }
    }

    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, convId, lastAt]); // eslint-disable-line

  // Quando abre o chat — zera unread
  useEffect(() => {
    if (phase === "chat") setUnread(0);
  }, [phase]);

  // ── Iniciar sessão ─────────────────────────────────────────────────────────
  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Preencha nome, e-mail e telefone."); return;
    }
    if (!topic) { setError("Selecione um tópico."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", name, email, phone, topic }),
      });
      const json = await res.json() as { conv_id?: string; error?: string };
      if (!res.ok || !json.conv_id) { setError(json.error ?? "Erro ao iniciar."); return; }
      setConvId(json.conv_id);
      setUserName(name);
      setLastAt(new Date(Date.now() - 5000).toISOString());
      setPhase("chat");
    } catch { setError("Falha de conexão."); }
    finally { setLoading(false); }
  }

  // ── Enviar mensagem ────────────────────────────────────────────────────────
  async function handleSend() {
    if (!text.trim() || !convId) return;
    const body = text.trim();
    setText("");
    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const now    = new Date().toISOString();
    setMessages(prev => [...prev, { id: tempId, direction: "in", sender_name: userName, body, created_at: now }]);
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", conv_id: convId, text: body }),
      });
    } catch { /* mensagem enviada optimistically */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Botão flutuante ── */}
      {phase === "closed" && (
        <button
          onClick={() => setPhase("form")}
          aria-label="Abrir chat de atendimento"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9000,
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #b9924d, #d9b87a 60%, #7a5c1e)",
            border: "none",
            boxShadow: "0 8px 32px rgba(185,146,77,0.5), 0 0 0 2px rgba(185,146,77,0.2)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
            transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 12px 40px rgba(185,146,77,0.65), 0 0 0 2px rgba(185,146,77,0.35)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 8px 32px rgba(185,146,77,0.5), 0 0 0 2px rgba(185,146,77,0.2)";
          }}
        >
          💬
          {unread > 0 && (
            <span style={{
              position: "absolute", top: 2, right: 2,
              width: 18, height: 18, borderRadius: "50%",
              background: "#ef4444",
              color: "#fff", fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff",
            }}>
              {unread}
            </span>
          )}
        </button>
      )}

      {/* ── Painel do widget ── */}
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
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #b9924d, #d9b87a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, boxShadow: "0 0 14px rgba(185,146,77,0.4)",
            }}>
              ✦
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: "#f2ecdfe6",
                fontFamily: "Fraunces, serif", letterSpacing: -0.3,
              }}>
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
                background: "rgba(242,236,223,0.08)",
                border: "1px solid rgba(242,236,223,0.12)",
                borderRadius: 8, width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(242,236,223,0.5)", fontSize: 14,
              }}
            >
              ×
            </button>
          </div>

          {/* ── Fase: formulário de lead ── */}
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
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    required
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(15,32,18,0.6)",
                      border: "1px solid rgba(242,236,223,0.1)",
                      borderRadius: 9, padding: "9px 12px",
                      color: "#f2ecdf", fontSize: 13,
                      fontFamily: "Manrope, sans-serif", outline: "none",
                    }}
                    onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.45)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
                  />
                </div>
              ))}

              {/* Tópicos */}
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "rgba(242,236,223,0.45)", letterSpacing: 0.5, marginBottom: 8 }}>
                  Como podemos ajudar? *
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TOPICS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      style={{
                        background: topic === t ? "rgba(185,146,77,0.2)" : "rgba(15,32,18,0.6)",
                        border: `1px solid ${topic === t ? "rgba(185,146,77,0.5)" : "rgba(242,236,223,0.1)"}`,
                        borderRadius: 20, padding: "5px 12px",
                        fontSize: 11.5, color: topic === t ? "#d9b87a" : "rgba(242,236,223,0.6)",
                        cursor: "pointer", fontFamily: "Manrope, sans-serif",
                        fontWeight: topic === t ? 700 : 400,
                        transition: "all 0.18s",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p style={{ margin: 0, fontSize: 11.5, color: "#ef4444", fontFamily: "Manrope, sans-serif" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading
                    ? "rgba(185,146,77,0.3)"
                    : "linear-gradient(135deg, #d9b87a, #b9924d 55%, #7a5c1e)",
                  border: "none", borderRadius: 10,
                  color: "#0a160b",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 12, fontWeight: 800,
                  letterSpacing: 1.2, textTransform: "uppercase",
                  padding: "11px",
                  cursor: loading ? "default" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 18px rgba(185,146,77,0.35)",
                  transition: "all 0.2s",
                  marginTop: 4,
                }}
              >
                {loading ? "Iniciando…" : "Iniciar conversa ✦"}
              </button>

              <p style={{ margin: 0, fontSize: 10.5, color: "rgba(242,236,223,0.3)", textAlign: "center" }}>
                Atendimento humano · Seg–Sex 08h–18h
              </p>
            </form>
          )}

          {/* ── Fase: chat ── */}
          {phase === "chat" && (
            <>
              {/* Thread */}
              <div style={{
                flex: 1, overflowY: "auto",
                padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: 10,
                minHeight: 280, maxHeight: 340,
              }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(242,236,223,0.35)", fontSize: 12 }}>
                    Aguardando mensagens…
                  </div>
                )}

                {messages.map(msg => {
                  const isOut = msg.direction === "out"; // mensagem do atendente
                  return (
                    <div key={msg.id} style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isOut ? "flex-start" : "flex-end",
                      gap: 3,
                    }}>
                      <div style={{
                        maxWidth: "80%",
                        background: isOut
                          ? "rgba(15,32,18,0.7)"
                          : "linear-gradient(135deg, rgba(185,146,77,0.22), rgba(185,146,77,0.1))",
                        border: isOut
                          ? "1px solid rgba(242,236,223,0.08)"
                          : "1px solid rgba(185,146,77,0.28)",
                        borderRadius: isOut ? "4px 14px 14px 14px" : "14px 14px 4px 14px",
                        padding: "9px 13px",
                        fontSize: 13, color: "#f2ecdf", lineHeight: 1.55,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {msg.body}
                      </div>
                      <span style={{ fontSize: 9.5, color: "rgba(242,236,223,0.25)" }}>
                        {isOut ? msg.sender_name : "Você"} · {timeStr(msg.created_at)}
                      </span>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div style={{
                borderTop: "1px solid rgba(242,236,223,0.07)",
                padding: "10px 12px 12px",
                background: "rgba(10,22,11,0.5)",
                display: "flex", gap: 8, alignItems: "flex-end",
              }}>
                <input
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                  placeholder="Digite sua mensagem…"
                  style={{
                    flex: 1,
                    background: "rgba(15,32,18,0.7)",
                    border: "1px solid rgba(242,236,223,0.1)",
                    borderRadius: 10, padding: "9px 13px",
                    color: "#f2ecdf", fontSize: 13,
                    fontFamily: "Manrope, sans-serif", outline: "none",
                    resize: "none",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.4)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: text.trim()
                      ? "linear-gradient(135deg, #d9b87a, #b9924d)"
                      : "rgba(185,146,77,0.2)",
                    border: "none",
                    cursor: text.trim() ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, color: text.trim() ? "#0a160b" : "rgba(185,146,77,0.4)",
                    boxShadow: text.trim() ? "0 4px 12px rgba(185,146,77,0.35)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  ↑
                </button>
              </div>

              {/* Rodapé */}
              <div style={{
                padding: "6px 14px 10px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 9.5, color: "rgba(242,236,223,0.25)" }}>
                  Enter para enviar · Atendimento Flora
                </span>
                <button
                  onClick={() => {
                    setPhase("closed");
                    setConvId(null);
                    setMessages([]);
                    setName(""); setEmail(""); setPhone(""); setTopic(null);
                    setUserName(""); setText("");
                  }}
                  style={{
                    background: "none", border: "none",
                    fontSize: 10, color: "rgba(242,236,223,0.3)",
                    cursor: "pointer", fontFamily: "Manrope, sans-serif",
                    textDecoration: "underline",
                  }}
                >
                  Encerrar conversa
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
