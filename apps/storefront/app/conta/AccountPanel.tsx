"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { captureEmail } from "@/lib/cart";
import { storefrontSupabase } from "@/lib/supabase-browser";

type Mode = "entrar" | "cadastro";

interface ProfileRow {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface CustomerRow {
  id: string;
  email: string;
  full_name: string | null;
  accepts_marketing: boolean;
  created_at: string;
}

interface AccountUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, string | undefined>;
  app_metadata?: Record<string, string | undefined>;
}

interface AccountSession {
  user: AccountUser;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  border: "1px solid rgba(40, 37, 29, 0.18)",
  background: "rgba(255, 248, 234, 0.74)",
  color: "var(--text)",
  padding: "0 16px",
  fontFamily: "var(--font-body)",
  fontSize: 13,
};

function displayName(user: AccountUser, profile: ProfileRow | null) {
  return (
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "Cliente Flora"
  );
}

export function AccountPanel() {
  const supabase = useMemo(() => storefrontSupabase(), []);
  const [mode, setMode] = useState<Mode>("entrar");
  const [session, setSession] = useState<AccountSession | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  async function loadAccount(current: AccountSession | null) {
    setSession(current);
    setProfile(null);
    setCustomers([]);

    if (!current?.user) {
      setLoading(false);
      return;
    }

    try {
      await supabase.rpc("claim_my_customer");
    } catch {
      // A conta continua funcionando mesmo se ainda nao houver cliente para reivindicar.
    }

    const [{ data: profileData }, { data: customerData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, phone, avatar_url")
        .eq("id", current.user.id)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("id, email, full_name, accepts_marketing, created_at")
        .eq("profile_id", current.user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    setProfile((profileData ?? null) as ProfileRow | null);
    setCustomers((customerData ?? []) as CustomerRow[]);
    if (current.user.email) {
      await captureEmail(current.user.email, displayName(current.user, (profileData ?? null) as ProfileRow | null));
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      setError(null);

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState({}, "", "/conta");
        if (exchangeError && active) {
          setError(exchangeError.message);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (active) await loadAccount(data.session as AccountSession | null);
    }

    init();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) loadAccount(nextSession as AccountSession | null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  function loginWithGoogle() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/conta`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (googleError) setError(googleError.message);
    });
  }

  function submitEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      if (mode === "cadastro") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/conta`,
            data: { full_name: name },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        setMessage("Cadastro criado. Se o Supabase pedir confirmacao, verifique seu e-mail.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
      }
    });
  }

  function logout() {
    startTransition(async () => {
      await supabase.auth.signOut();
      setMessage("Voce saiu da sua conta.");
    });
  }

  if (loading) {
    return (
      <section style={{ maxWidth: 760 }}>
        <p style={{ color: "var(--muted)" }}>Carregando sua conta...</p>
      </section>
    );
  }

  if (session?.user) {
    const user = session.user;
    const nameLabel = displayName(user, profile);

    return (
      <section style={{ maxWidth: 820, display: "grid", gap: 22 }}>
        <div>
          <span className="eyebrow">Minha conta</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500, lineHeight: 1 }}>
            Ola, {nameLabel}
          </h1>
          <p style={{ marginTop: 12, color: "var(--muted)" }}>
            Acompanhe seus dados, pedidos e preferencias da Flora Botanics.
          </p>
        </div>

        <div
          style={{
            border: "1px solid rgba(40, 37, 29, 0.12)",
            background: "rgba(255, 248, 234, 0.52)",
            padding: 24,
            display: "grid",
            gap: 12,
          }}
        >
          <strong>{user.email}</strong>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            Login ativo via {user.app_metadata?.provider === "google" ? "Google" : "e-mail"}.
          </span>
          {customers.length > 0 ? (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              Cadastro de cliente vinculado: {customers[0].full_name ?? customers[0].email}
            </span>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              Nenhum pedido vinculado ainda. Ao comprar com este e-mail, seus pedidos aparecem aqui.
            </span>
          )}
        </div>

        <button type="button" className="btn" onClick={logout} disabled={pending} style={{ width: "fit-content" }}>
          Sair da conta
        </button>
        {message ? <p style={{ color: "var(--gold-dark)" }}>{message}</p> : null}
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 520, display: "grid", gap: 22 }}>
      <div>
        <span className="eyebrow">Conta Flora</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500, lineHeight: 1 }}>
          Entrar ou criar conta
        </h1>
        <p style={{ marginTop: 12, color: "var(--muted)" }}>
          Acesse seus dados, pedidos e beneficios usando e-mail ou Google.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => setMode("entrar")}
          className="btn"
          style={{
            background: mode === "entrar" ? "var(--gold)" : "transparent",
            color: mode === "entrar" ? "var(--white)" : "var(--text)",
            border: "1px solid var(--gold)",
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode("cadastro")}
          className="btn"
          style={{
            background: mode === "cadastro" ? "var(--gold)" : "transparent",
            color: mode === "cadastro" ? "var(--white)" : "var(--text)",
            border: "1px solid var(--gold)",
          }}
        >
          Criar conta
        </button>
      </div>

      <button
        type="button"
        onClick={loginWithGoogle}
        disabled={pending}
        style={{
          height: 50,
          border: "1px solid rgba(40, 37, 29, 0.2)",
          background: "#fff",
          color: "var(--text)",
          fontFamily: "var(--font-body)",
          fontWeight: 800,
          letterSpacing: 0.6,
          cursor: "pointer",
        }}
      >
        Continuar com Google
      </button>

      <form onSubmit={submitEmailAuth} style={{ display: "grid", gap: 12 }}>
        {mode === "cadastro" ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome completo"
            style={fieldStyle}
          />
        ) : null}
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-mail"
          style={fieldStyle}
        />
        <input
          required
          minLength={6}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Senha"
          style={fieldStyle}
        />
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Aguarde..." : mode === "cadastro" ? "Criar conta" : "Entrar"}
        </button>
      </form>

      {error ? <p style={{ color: "#9a3232", lineHeight: 1.5 }}>{error}</p> : null}
      {message ? <p style={{ color: "var(--gold-dark)", lineHeight: 1.5 }}>{message}</p> : null}
    </section>
  );
}
