"use client";

import { useState } from "react";

interface Props {
  heading?: string;
  subheading?: string;
  successMessage?: string;
}

export function ContactForm({
  heading = "Fale conosco",
  subheading = "Preencha o formulário e retornaremos em breve.",
  successMessage = "Mensagem enviada! Em breve entraremos em contato.",
}: Props) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    fone: "",
    assunto: "",
    mensagem: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Erro ao enviar");
      }
      setStatus("success");
      setForm({ nome: "", email: "", fone: "", assunto: "", mensagem: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "var(--cream, #f2ecdf)",
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s, background 0.2s",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(242,236,223,0.55)",
    marginBottom: 6,
    fontFamily: "Inter, sans-serif",
  };

  return (
    <section
      style={{
        padding: "72px 16px",
        background: "linear-gradient(135deg, rgba(10,22,11,0.92) 0%, rgba(12,29,13,0.85) 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(32px) saturate(1.5)",
          WebkitBackdropFilter: "blur(32px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: 24,
          padding: "44px 40px 48px",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(185,146,77,0.08), inset 0 1px 0 rgba(255,255,255,0.07)",
        }}
      >
        {/* Cabeçalho */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "var(--gold, #b9924d)",
              marginBottom: 12,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Atendimento
          </span>
          <h2
            style={{
              margin: "0 0 10px",
              fontFamily: "Fraunces, serif",
              fontWeight: 500,
              fontSize: 30,
              color: "var(--cream, #f2ecdf)",
              letterSpacing: -0.5,
              lineHeight: 1.2,
            }}
          >
            {heading}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "rgba(242,236,223,0.55)",
              lineHeight: 1.6,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {subheading}
          </p>
        </div>

        {status === "success" ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 24px",
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: 14,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>✦</div>
            <p
              style={{
                margin: 0,
                color: "#4ade80",
                fontFamily: "Inter, sans-serif",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {successMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Nome */}
            <div>
              <label style={labelStyle}>Nome</label>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                required
                placeholder="Seu nome completo"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(185,146,77,0.5)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
              />
            </div>

            {/* E-mail + Fone lado a lado */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="seu@email.com"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(185,146,77,0.5)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input
                  name="fone"
                  type="tel"
                  value={form.fone}
                  onChange={handleChange}
                  placeholder="(11) 9 0000-0000"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(185,146,77,0.5)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                />
              </div>
            </div>

            {/* Assunto */}
            <div>
              <label style={labelStyle}>Assunto</label>
              <select
                name="assunto"
                value={form.assunto}
                onChange={handleChange}
                required
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(185,146,77,0.5)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
              >
                <option value="" disabled style={{ background: "#0c1a0e" }}>
                  Selecione um assunto
                </option>
                <option value="Dúvida sobre produto" style={{ background: "#0c1a0e" }}>Dúvida sobre produto</option>
                <option value="Pedido e entrega" style={{ background: "#0c1a0e" }}>Pedido e entrega</option>
                <option value="Troca ou devolução" style={{ background: "#0c1a0e" }}>Troca ou devolução</option>
                <option value="Parceria" style={{ background: "#0c1a0e" }}>Parceria</option>
                <option value="Outros" style={{ background: "#0c1a0e" }}>Outros</option>
              </select>
            </div>

            {/* Mensagem */}
            <div>
              <label style={labelStyle}>Mensagem</label>
              <textarea
                name="mensagem"
                value={form.mensagem}
                onChange={handleChange}
                required
                rows={5}
                placeholder="Como podemos ajudar?"
                style={{ ...inputStyle, resize: "vertical", minHeight: 110 }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(185,146,77,0.5)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
              />
            </div>

            {status === "error" && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#f87171",
                  fontFamily: "Inter, sans-serif",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                {errorMsg || "Erro ao enviar. Tente novamente."}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                marginTop: 4,
                padding: "14px 0",
                background:
                  status === "sending"
                    ? "rgba(185,146,77,0.4)"
                    : "linear-gradient(135deg, #c9a85c, #b9924d 55%, #9a7a38)",
                border: "none",
                borderRadius: 12,
                color: status === "sending" ? "rgba(255,255,255,0.5)" : "#0a160b",
                fontFamily: "Inter, sans-serif",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                cursor: status === "sending" ? "not-allowed" : "pointer",
                transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                boxShadow: status === "sending" ? "none" : "0 4px 20px rgba(185,146,77,0.35)",
              }}
            >
              {status === "sending" ? "Enviando…" : "Enviar mensagem"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
