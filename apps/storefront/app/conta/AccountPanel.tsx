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
      <section className="account-card account-status-card">
        <span className="account-kicker">Conta Flora</span>
        <p>Carregando sua conta...</p>
      </section>
    );
  }

  if (session?.user) {
    const user = session.user;
    const nameLabel = displayName(user, profile);

    return (
      <section className="account-card account-profile-card">
        <div className="account-profile-heading">
          <span className="account-kicker">Minha conta</span>
          <h1>Ola, {nameLabel}</h1>
          <p>Acompanhe seus dados, pedidos e preferencias da Flora Botanics.</p>
        </div>

        <div className="account-profile-summary">
          <strong>{user.email}</strong>
          <span>Login ativo via {user.app_metadata?.provider === "google" ? "Google" : "e-mail"}.</span>
          {customers.length > 0 ? (
            <span>Cadastro de cliente vinculado: {customers[0].full_name ?? customers[0].email}</span>
          ) : (
            <span>Nenhum pedido vinculado ainda. Ao comprar com este e-mail, seus pedidos aparecem aqui.</span>
          )}
        </div>

        <button type="button" className="account-secondary-button" onClick={logout} disabled={pending}>
          Sair da conta
        </button>
        {message ? <p className="account-success">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="account-auth-layout">
      <div className="account-card account-form-card">
        <div className="account-mode-switch" role="tablist" aria-label="Escolha o modo de acesso">
          <button
            type="button"
            onClick={() => setMode("entrar")}
            className={mode === "entrar" ? "is-active" : ""}
            aria-pressed={mode === "entrar"}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("cadastro")}
            className={mode === "cadastro" ? "is-active" : ""}
            aria-pressed={mode === "cadastro"}
          >
            Criar conta
          </button>
        </div>

        <button type="button" onClick={loginWithGoogle} disabled={pending} className="account-google-button">
          <span>G</span>
          Continuar com Google
        </button>

        <div className="account-divider">
          <span>ou acesse com e-mail</span>
        </div>

        <form onSubmit={submitEmailAuth} className="account-form">
          {mode === "cadastro" ? (
            <label>
              Nome completo
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
              />
            </label>
          ) : null}
          <label>
            E-mail
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@email.com"
            />
          </label>
          <label>
            Senha
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimo de 6 caracteres"
            />
          </label>
          <button type="submit" className="account-primary-button" disabled={pending}>
            {pending ? "Aguarde..." : mode === "cadastro" ? "Criar conta" : "Entrar"}
          </button>
        </form>

        {error ? <p className="account-error">{error}</p> : null}
        {message ? <p className="account-success">{message}</p> : null}
      </div>
    </section>
  );
}
