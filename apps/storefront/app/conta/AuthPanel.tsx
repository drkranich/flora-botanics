"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { MyOrders } from "./MyOrders";
import { ProfileForm } from "./ProfileForm";

/**
 * Área do cliente — autenticação.
 * E-mail/senha (entrar e criar conta) + login social (Google, Facebook, Apple).
 * Os provedores sociais precisam estar habilitados no Supabase
 * (Authentication → Providers) com as credenciais de cada plataforma.
 */
export function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [recovery, setRecovery] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // fallback: se o link de redefinição cair aqui (em vez de /conta/redefinir),
    // o token vem no fragment da URL — detectamos antes do evento disparar
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setRecovery(true);
    }
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // usuária chegou pelo link de redefinição do e-mail
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/conta/redefinir`,
      });
      setMsg(
        error
          ? "Não foi possível enviar o e-mail. Confira o endereço e tente novamente."
          : "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) {
        setMsg("Não foi possível salvar. A senha precisa ter ao menos 6 caracteres.");
      } else {
        setRecovery(false);
        setPassword("");
        setMsg("Senha atualizada com sucesso!");
      }
    } finally {
      setBusy(false);
    }
  }

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
    // obtém a URL sem navegar; só redireciona se o provedor estiver habilitado
    const { data, error } = await supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/conta`,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      setMsg("Este login social ainda não está disponível — use e-mail e senha.");
      return;
    }
    try {
      const probe = await fetch(data.url, { redirect: "manual" });
      if (probe.type === "opaqueredirect" || probe.ok || probe.status === 0) {
        window.location.href = data.url; // habilitado: segue o fluxo normal
        return;
      }
      setMsg("Este login social ainda não está disponível — use e-mail e senha.");
    } catch {
      // rede/CORS impediu a checagem: tenta o fluxo normal
      window.location.href = data.url;
    }
  }

  /* ---------- redefinindo a senha (chegou pelo link do e-mail) ---------- */
  if (user && recovery) {
    return (
      <div className="auth-card">
        <h2 className="auth-title">Definir nova senha</h2>
        <p className="auth-text" style={{ marginBottom: 16 }}>
          Escolha uma nova senha para <strong>{user.email}</strong>.
        </p>
        <form onSubmit={saveNewPassword} className="auth-form">
          <input
            className="auth-input"
            type="password"
            placeholder="Nova senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Aguarde…" : "Salvar nova senha"}
          </button>
        </form>
        {msg ? <p className="auth-msg">{msg}</p> : null}
      </div>
    );
  }

  /* ---------- logada ---------- */
  if (user) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%" }}>
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

        <ProfileForm userId={user.id} email={user.email ?? ""} />
      </div>
    );
  }

  /* ---------- visitante: recuperar conta ---------- */
  if (mode === "forgot") {
    return (
      <div className="auth-card">
        <h2 className="auth-title">Recuperar conta</h2>
        <p className="auth-text" style={{ marginBottom: 16 }}>
          Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
        </p>
        <form onSubmit={sendReset} className="auth-form">
          <input
            className="auth-input"
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Enviando…" : "Enviar link de recuperação"}
          </button>
        </form>
        {msg ? <p className="auth-msg">{msg}</p> : null}
        <button
          onClick={() => { setMode("login"); setMsg(null); }}
          style={{ background: "none", border: 0, cursor: "pointer", marginTop: 16, fontSize: 12.5, textDecoration: "underline", color: "inherit", opacity: 0.75, fontFamily: "inherit" }}
        >
          ← Voltar para entrar
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

      {mode === "login" ? (
        <button
          onClick={() => { setMode("forgot"); setMsg(null); }}
          style={{ background: "none", border: 0, cursor: "pointer", marginTop: 12, fontSize: 12.5, textDecoration: "underline", color: "inherit", opacity: 0.75, fontFamily: "inherit" }}
        >
          Esqueci minha senha
        </button>
      ) : null}

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
