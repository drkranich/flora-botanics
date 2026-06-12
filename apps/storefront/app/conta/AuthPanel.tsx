"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { MyOrders } from "./MyOrders";

/**
 * Área do cliente — autenticação.
 * E-mail/senha (entrar e criar conta) + login social (Google, Facebook, Apple).
 * Os provedores sociais precisam estar habilitados no Supabase
 * (Authentication → Providers) com as credenciais de cada plataforma.
 */
export function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg("E-mail ou senha inválidos.");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/conta` : undefined,
          },
        });
        setMsg(
          error
            ? error.message
            : "Conta criada! Verifique seu e-mail para confirmar o cadastro."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "facebook" | "apple") {
    setMsg(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/conta` },
    });
    if (error) setMsg("Este login social ainda não está habilitado.");
  }

  /* ---------- logada ---------- */
  if (user) {
    return (
      <div className="auth-card" style={{ width: "min(560px, 100%)" }}>
        <h2 className="auth-title">Olá{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}!</h2>
        <p className="auth-text" style={{ marginBottom: 20 }}>
          Conectada como <strong>{user.email}</strong>.
        </p>

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "#6d4d2d", marginBottom: 12 }}>
          Meus pedidos
        </p>
        <MyOrders />

        <button
          className="btn"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
          }}
          style={{ marginTop: 22 }}
        >
          Sair da conta
        </button>
      </div>
    );
  }

  /* ---------- visitante ---------- */
  return (
    <div className="auth-card">
      <div className="auth-tabs">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => { setMode("login"); setMsg(null); }}
        >
          Entrar
        </button>
        <button
          className={mode === "signup" ? "active" : ""}
          onClick={() => { setMode("signup"); setMsg(null); }}
        >
          Criar conta
        </button>
      </div>

      <form onSubmit={submit} className="auth-form">
        {mode === "signup" ? (
          <input
            className="auth-input"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        ) : null}
        <input
          className="auth-input"
          type="email"
          placeholder="Seu e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className="auth-input"
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar minha conta"}
        </button>
      </form>

      <div className="auth-divider"><span>ou continue com</span></div>

      <div className="auth-social notranslate" translate="no">
        <button onClick={() => social("google")} title="Google">Google</button>
        <button onClick={() => social("facebook")} title="Facebook">Facebook</button>
        <button onClick={() => social("apple")} title="Apple">Apple</button>
      </div>

      {msg ? <p className="auth-msg">{msg}</p> : null}
    </div>
  );
}
