"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { requestAdminPasswordReset } from "./reset-actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "first" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const result = await requestAdminPasswordReset(email);
      setLoading(false);
      setNotice(result.notice);
      setMode("login");
      return;
    }

    const supabase = supabaseBrowser();

    if (mode === "first") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      setLoading(false);

      if (signUpError) {
        setError(
          signUpError.message.includes("already registered")
            ? "Este e-mail ja tem conta - use Entrar."
            : "Nao foi possivel criar a conta. Verifique os dados."
        );
        return;
      }

      if (!data.session) {
        setNotice("Conta criada. Confirme o cadastro no seu e-mail e depois entre normalmente.");
        setMode("login");
        return;
      }

      // window.location evita bug basePath do opennextjs-cloudflare
      window.location.href = "/admin/";
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("E-mail ou senha invalidos.");
      setLoading(false);
      return;
    }

    // window.location evita bug basePath do opennextjs-cloudflare
    window.location.href = "/admin/";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="glass rise"
        style={{
          width: "min(400px, 92vw)",
          padding: "48px 40px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span className="brand">
            <span className="brand-main">
              FL<span className="brand-dot">•</span>RA
            </span>
            <span className="brand-sub">BOTANICS</span>
          </span>
          <p className="eyebrow" style={{ marginTop: 18 }}>
            Painel Administrativo
          </p>
        </div>

        {mode === "first" ? (
          <div className="field">
            <label className="field-label" htmlFor="name">Seu nome</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome e sobrenome"
              required
            />
          </div>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@florabotanics.com"
            required
            autoComplete="email"
          />
        </div>

        {mode !== "forgot" ? (
          <div className="field">
            <label className="field-label" htmlFor="password">Senha</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === "first" ? "new-password" : "current-password"}
            />
          </div>
        ) : null}

        {error ? (
          <p style={{ color: "#e8a0a0", fontSize: 12, textAlign: "center" }}>{error}</p>
        ) : null}
        {notice ? (
          <p style={{ color: "var(--gold-light)", fontSize: 12, textAlign: "center" }}>{notice}</p>
        ) : null}

        <button type="submit" disabled={loading} className="btn btn-gold" style={{ marginTop: 6 }}>
          {loading
            ? "Aguarde..."
            : mode === "first"
              ? "Criar acesso"
              : mode === "forgot"
                ? "Enviar link de recuperacao"
                : "Entrar"}
        </button>

        {mode === "login" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => { setMode("first"); setError(null); setNotice(null); }}
              style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11.5, textDecoration: "underline", color: "var(--cream-soft, inherit)", opacity: 0.8, fontFamily: "inherit" }}
            >
              Primeiro acesso? Fui convidada(o) por e-mail
            </button>
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}
              style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11.5, textDecoration: "underline", color: "var(--cream-soft, inherit)", opacity: 0.8, fontFamily: "inherit" }}
            >
              Esqueci minha senha
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); setNotice(null); }}
            style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11.5, textDecoration: "underline", color: "var(--cream-soft, inherit)", opacity: 0.8, fontFamily: "inherit" }}
          >
            ← Voltar para entrar
          </button>
        )}

        <p className="muted" style={{ fontSize: 10.5, textAlign: "center", letterSpacing: 0.4 }}>
          Acesso restrito a equipe Flora Ecosystem
        </p>
      </form>
    </main>
  );
}
