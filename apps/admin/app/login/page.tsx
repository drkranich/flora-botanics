"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "first">("login");
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

    const supabase = supabaseBrowser();

    if (mode === "first") {
      // primeiro acesso de quem foi convidada: cria a conta;
      // o convite pendente aplica tenant e papel automaticamente
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      setLoading(false);
      if (error) {
        setError(
          error.message.includes("already registered")
            ? "Este e-mail já tem conta — use Entrar."
            : "Não foi possível criar a conta. Verifique os dados."
        );
        return;
      }
      if (!data.session) {
        setNotice("Conta criada! Confirme o cadastro no seu e-mail e depois entre normalmente.");
        setMode("login");
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
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
            autoComplete="current-password"
          />
        </div>

        {error ? (
          <p style={{ color: "#e8a0a0", fontSize: 12, textAlign: "center" }}>{error}</p>
        ) : null}
        {notice ? (
          <p style={{ color: "var(--gold-light)", fontSize: 12, textAlign: "center" }}>{notice}</p>
        ) : null}

        <button type="submit" disabled={loading} className="btn btn-gold" style={{ marginTop: 6 }}>
          {loading
            ? "Aguarde…"
            : mode === "first"
              ? "Criar acesso"
              : "Entrar"}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "first" : "login"); setError(null); setNotice(null); }}
          style={{ background: "none", border: 0, cursor: "pointer", fontSize: 11.5, textDecoration: "underline", color: "var(--cream-soft, inherit)", opacity: 0.8, fontFamily: "inherit" }}
        >
          {mode === "login" ? "Primeiro acesso? Fui convidada(o) por e-mail" : "← Já tenho conta, entrar"}
        </button>

        <p className="muted" style={{ fontSize: 10.5, textAlign: "center", letterSpacing: 0.4 }}>
          Acesso restrito à equipe Flora Ecosystem
        </p>
      </form>
    </main>
  );
}
