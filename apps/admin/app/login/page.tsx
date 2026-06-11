"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
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

        <button type="submit" disabled={loading} className="btn btn-gold" style={{ marginTop: 6 }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <p className="muted" style={{ fontSize: 10.5, textAlign: "center", letterSpacing: 0.4 }}>
          Acesso restrito à equipe Flora Ecosystem
        </p>
      </form>
    </main>
  );
}
