"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Destino do link "esqueci minha senha" do painel.
 * O supabase-js consome o token do fragment da URL e cria a sessão;
 * aguardamos a sessão e mostramos o formulário de nova senha.
 */
export default function AdminResetPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let tries = 0;
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
        router.push("/");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="glass rise" style={{ width: "min(400px, 92vw)", padding: "44px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <p className="eyebrow" style={{ textAlign: "center" }}>Painel · Nova senha</p>

        {state === "checking" ? (
          <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>Validando seu link…</p>
        ) : state === "invalid" ? (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, textAlign: "center" }}>
              Link inválido ou expirado. Peça um novo em
              {" "}<strong>Esqueci minha senha</strong> na tela de login.
            </p>
            <a className="btn btn-gold" href="/login" style={{ textAlign: "center" }}>Voltar ao login</a>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="muted" style={{ fontSize: 12.5, textAlign: "center" }}>
              Nova senha para <strong>{email}</strong>
            </p>
            <div className="field">
              <label className="field-label" htmlFor="pw">Nova senha</label>
              <input
                id="pw"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pw2">Repita a nova senha</label>
              <input
                id="pw2"
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            {msg ? <p style={{ color: "#e8a0a0", fontSize: 12, textAlign: "center" }}>{msg}</p> : null}
            <button type="submit" disabled={busy} className="btn btn-gold">
              {busy ? "Salvando…" : "Salvar e entrar no painel"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
