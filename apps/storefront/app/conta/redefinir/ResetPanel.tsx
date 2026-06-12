"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Página de destino do link "redefinir senha" do e-mail.
 * Não depende do evento PASSWORD_RECOVERY (que pode disparar antes do mount):
 * o supabase-js consome o token da URL e cria a sessão; aqui só esperamos
 * a sessão existir e mostramos o formulário de nova senha.
 */
export function ResetPanel() {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let tries = 0;

    // o token do link vem no fragment (#access_token...&type=recovery);
    // o supabase-js processa sozinho — aguardamos a sessão aparecer
    const timer = setInterval(async () => {
      tries += 1;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        clearInterval(timer);
        setEmail(data.session.user.email ?? null);
        setState("ready");
      } else if (tries > 10) {
        clearInterval(timer);
        setState("invalid");
      }
    }, 400);

    return () => clearInterval(timer);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password !== confirm) {
      setMsg("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) {
        setMsg(
          error.message.includes("different from the old")
            ? "A nova senha precisa ser diferente da anterior."
            : "Não foi possível salvar. A senha precisa ter ao menos 6 caracteres."
        );
      } else {
        setState("done");
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="auth-card">
        <p className="auth-text">Validando seu link…</p>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="auth-card">
        <h2 className="auth-title">Link inválido ou expirado</h2>
        <p className="auth-text" style={{ marginBottom: 16 }}>
          Por segurança, o link de redefinição vale por pouco tempo e só pode
          ser usado uma vez. Peça um novo em "Esqueci minha senha".
        </p>
        <a className="btn" href="/conta">Voltar para Minha conta</a>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="auth-card">
        <h2 className="auth-title">Senha atualizada!</h2>
        <p className="auth-text" style={{ marginBottom: 16 }}>
          Sua nova senha já está valendo. Você continua conectada.
        </p>
        <a className="btn" href="/conta">Ir para Minha conta</a>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2 className="auth-title">Criar nova senha</h2>
      <p className="auth-text" style={{ marginBottom: 16 }}>
        {email ? <>Definindo nova senha para <strong>{email}</strong>.</> : "Defina sua nova senha."}
      </p>
      <form onSubmit={submit} className="auth-form">
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
        <input
          className="auth-input"
          type="password"
          placeholder="Repita a nova senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
      {msg ? <p className="auth-msg">{msg}</p> : null}
    </div>
  );
}
