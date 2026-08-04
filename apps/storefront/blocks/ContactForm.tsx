"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  heading?: string;
  subheading?: string;
  successMessage?: string;
  /** Lista de assuntos para o select. Se vazio, campo não aparece. */
  subjects?: string[];
  show_phone?: boolean;
  phone_required?: boolean;
  /** Cor de destaque: botão, focus, dot decorativo */
  accent_color?: string;
  /** Gradiente do fundo da seção */
  bg_from?: string;
  bg_to?: string;
}

export function ContactForm({
  heading = "Fale conosco",
  subheading = "Preencha o formulário e nossa equipe retornará em breve.",
  successMessage = "Mensagem recebida! Em breve entraremos em contato.",
  subjects = ["Dúvida sobre produto", "Pedido e entrega", "Troca ou devolução", "Parceria", "Outros"],
  show_phone = true,
  phone_required = false,
  accent_color = "#b9924d",
  bg_from = "rgba(10,22,11,0.96)",
  bg_to = "rgba(12,29,13,0.92)",
}: Props) {
  const hasSubjects = Array.isArray(subjects) && subjects.length > 0;

  const [form, setForm] = useState({
    nome: "",
    email: "",
    fone: "",
    assunto: "",
    mensagem: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  /* dropdown customizado */
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  /* fecha ao clicar fora */
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
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
        throw new Error((data as { error?: string })?.error ?? "Erro ao enviar");
      }
      setStatus("success");
      setForm({ nome: "", email: "", fone: "", assunto: "", mensagem: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }

  /* ---- estilos inline reutilizáveis ---- */
  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.13)",
    borderRadius: 12,
    color: "#f2ecdf",
    fontFamily: "'Inter', 'Montserrat', sans-serif",
    fontSize: 14,
    outline: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    appearance: "none",
    colorScheme: "dark",
    transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
    /* Elimina highlight azul nativo do browser */
    WebkitTapHighlightColor: "transparent",
  };

  const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.8,
    textTransform: "uppercase" as const,
    color: "rgba(242,236,223,0.5)",
    marginBottom: 7,
    fontFamily: "'Inter', sans-serif",
  };

  function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = `${accent_color}88`;
    e.currentTarget.style.background = "rgba(255,255,255,0.085)";
    e.currentTarget.style.boxShadow = `0 0 0 3px ${accent_color}22`;
  }
  function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)";
    e.currentTarget.style.background = "rgba(255,255,255,0.055)";
    e.currentTarget.style.boxShadow = "none";
  }

  return (
    <section
      className="flora-contact-form"
      style={{
        position: "relative",
        /* Cancela o padding da .page-content e ocupa largura total */
        margin: "-54px -9999px -72px",
        padding: "96px calc(9999px + 16px) 112px",
        background: `linear-gradient(135deg, ${bg_from} 0%, ${bg_to} 100%)`,
        overflow: "hidden",
      }}
    >
      {/* CSS: elimina highlight azul nativo do browser em inputs/select */}
      <style>{`
        .flora-contact-form input,
        .flora-contact-form textarea,
        .flora-contact-form select {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          color-scheme: dark;
          outline: none !important;
          box-shadow: none;
        }
        .flora-contact-form input:focus,
        .flora-contact-form textarea:focus,
        .flora-contact-form select:focus {
          outline: none !important;
        }
        .flora-contact-form input::selection,
        .flora-contact-form textarea::selection {
          background: rgba(185,146,77,0.35);
          color: #f2ecdf;
        }
        .flora-contact-form select option {
          background: #0c1a0e;
          color: #f2ecdf;
        }
        .flora-contact-form select:focus option:checked {
          background: rgba(185,146,77,0.25);
        }
        .flora-contact-form button[type="submit"]:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }
      `}</style>

      {/* Orbs decorativos glassmorphism */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute",
          top: -120,
          left: "10%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent_color}22 0%, transparent 70%)`,
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute",
          bottom: -80,
          right: "8%",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(74,222,128,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
        }} />
      </div>

      {/* Card glassmorphism */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 580,
          margin: "0 auto",
          background: "rgba(255,255,255,0.045)",
          backdropFilter: "blur(40px) saturate(1.6)",
          WebkitBackdropFilter: "blur(40px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 28,
          padding: "48px 44px 52px",
          boxShadow: [
            "0 24px 64px rgba(0,0,0,0.55)",
            `0 0 0 1px ${accent_color}18`,
            "inset 0 1px 0 rgba(255,255,255,0.08)",
          ].join(", "),
        }}
      >
        {/* Cabeçalho */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          {/* Dot accent */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accent_color}44, ${accent_color}11)`,
              border: `1px solid ${accent_color}44`,
              margin: "0 auto 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              color: accent_color,
            }}
          >
            ✦
          </div>
          <span
            style={{
              display: "block",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 3.5,
              textTransform: "uppercase",
              color: accent_color,
              marginBottom: 10,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Atendimento
          </span>
          <h2
            style={{
              margin: "0 0 12px",
              fontFamily: "'Fraunces', 'Cormorant Garamond', Georgia, serif",
              fontWeight: 500,
              fontSize: 32,
              color: "#f2ecdf",
              letterSpacing: -0.6,
              lineHeight: 1.15,
            }}
          >
            {heading}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "rgba(242,236,223,0.5)",
              lineHeight: 1.65,
              fontFamily: "'Inter', sans-serif",
              maxWidth: 380,
              marginInline: "auto",
            }}
          >
            {subheading}
          </p>
        </div>

        {/* Separador */}
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${accent_color}44, transparent)`,
            marginBottom: 36,
          }}
        />

        {status === "success" ? (
          <div
            style={{
              textAlign: "center",
              padding: "36px 24px",
              background: "rgba(74,222,128,0.07)",
              border: "1px solid rgba(74,222,128,0.18)",
              borderRadius: 18,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(74,222,128,0.12)",
                border: "1px solid rgba(74,222,128,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                margin: "0 auto 16px",
              }}
            >
              ✓
            </div>
            <p
              style={{
                margin: 0,
                color: "#4ade80",
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              {successMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Nome */}
            <div>
              <label style={fieldLabel}>Nome completo</label>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                required
                placeholder="Seu nome"
                style={fieldInput}
                onFocus={focusOn}
                onBlur={focusOff}
              />
            </div>

            {/* E-mail + Telefone */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: show_phone ? "1fr 1fr" : "1fr",
                gap: 16,
              }}
            >
              <div>
                <label style={fieldLabel}>E-mail</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="seu@email.com"
                  style={fieldInput}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
              {show_phone && (
                <div>
                  <label style={fieldLabel}>
                    Telefone{phone_required ? "" : " (opcional)"}
                  </label>
                  <input
                    name="fone"
                    type="tel"
                    value={form.fone}
                    onChange={handleChange}
                    required={phone_required}
                    placeholder="(11) 9 0000-0000"
                    style={fieldInput}
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                </div>
              )}
            </div>

            {/* Assunto — dropdown 100% customizado (sem <select> nativo) */}
            {hasSubjects && (
              <div>
                <label style={fieldLabel}>Assunto</label>
                {/* input hidden para participar do form submit */}
                <input type="hidden" name="assunto" value={form.assunto} />
                <div ref={dropRef} style={{ position: "relative" }}>
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => setDropOpen((o) => !o)}
                    style={{
                      ...fieldInput,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      textAlign: "left",
                      border: dropOpen
                        ? `1px solid ${accent_color}88`
                        : "1px solid rgba(255,255,255,0.13)",
                      boxShadow: dropOpen ? `0 0 0 3px ${accent_color}22` : "none",
                      borderRadius: dropOpen ? "12px 12px 0 0" : 12,
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                  >
                    <span style={{
                      color: form.assunto ? "#f2ecdf" : "rgba(242,236,223,0.35)",
                      fontSize: 14,
                    }}>
                      {form.assunto || "Selecione um assunto"}
                    </span>
                    <span style={{
                      color: "rgba(242,236,223,0.4)",
                      fontSize: 10,
                      transform: dropOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                      flexShrink: 0,
                      marginLeft: 8,
                    }}>▾</span>
                  </button>

                  {/* Lista de opções */}
                  {dropOpen && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: "rgba(12,22,13,0.97)",
                      backdropFilter: "blur(24px) saturate(1.5)",
                      WebkitBackdropFilter: "blur(24px) saturate(1.5)",
                      border: `1px solid ${accent_color}55`,
                      borderTop: "none",
                      borderRadius: "0 0 12px 12px",
                      overflow: "hidden",
                      boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                    }}>
                      {subjects.map((s, i) => {
                        const isSelected = form.assunto === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, assunto: s }));
                              setDropOpen(false);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "12px 16px",
                              textAlign: "left",
                              background: isSelected
                                ? `${accent_color}22`
                                : "transparent",
                              color: isSelected ? accent_color : "rgba(242,236,223,0.85)",
                              fontFamily: "'Inter', 'Montserrat', sans-serif",
                              fontSize: 14,
                              cursor: "pointer",
                              border: "none",
                              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                            }}
                            onMouseLeave={e => {
                              if (!isSelected) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            {isSelected && (
                              <span style={{ marginRight: 8, fontSize: 10 }}>✦</span>
                            )}
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mensagem */}
            <div>
              <label style={fieldLabel}>Mensagem</label>
              <textarea
                name="mensagem"
                value={form.mensagem}
                onChange={handleChange}
                required
                rows={5}
                placeholder="Como podemos ajudar?"
                style={{ ...fieldInput, resize: "vertical", minHeight: 120, paddingTop: 13 }}
                onFocus={focusOn}
                onBlur={focusOff}
              />
            </div>

            {/* Erro */}
            {status === "error" && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.22)",
                  borderRadius: 10,
                  padding: "11px 16px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#f87171",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {errorMsg || "Erro ao enviar. Tente novamente."}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                marginTop: 6,
                padding: "15px 0",
                background:
                  status === "sending"
                    ? `${accent_color}55`
                    : `linear-gradient(135deg, ${accent_color}dd, ${accent_color} 55%, ${accent_color}cc)`,
                border: "none",
                borderRadius: 14,
                color: status === "sending" ? "rgba(10,22,11,0.4)" : "#0a160b",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                cursor: status === "sending" ? "not-allowed" : "pointer",
                transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                boxShadow:
                  status === "sending"
                    ? "none"
                    : `0 6px 24px ${accent_color}44, 0 0 0 1px ${accent_color}33`,
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
