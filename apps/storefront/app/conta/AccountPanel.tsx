"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
  phone: string | null;
  accepts_marketing: boolean;
  created_at: string;
}

interface OrderRow {
  id: string;
  number: string | number;
  status: string;
  total_cents: number;
  currency: string;
  placed_at: string | null;
  created_at: string;
}

interface AddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  recipient: string;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
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

const ORDER_STATUS: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparo",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
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

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function formatDate(iso: string | null) {
  if (!iso) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

function emptyAddress(customerId: string): AddressRow {
  return {
    id: "",
    customer_id: customerId,
    label: "Principal",
    recipient: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    postal_code: "",
    country: "BR",
  };
}

export function AccountPanel({ tenantId }: { tenantId: string }) {
  const supabase = useMemo(() => storefrontSupabase(), []);
  const [mode, setMode] = useState<Mode>("entrar");
  const [session, setSession] = useState<AccountSession | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [address, setAddress] = useState<AddressRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const primaryCustomer = customers[0] ?? null;

  async function loadAccount(current: AccountSession | null) {
    setSession(current);
    setProfile(null);
    setCustomers([]);
    setOrders([]);
    setAddresses([]);
    setAddress(null);

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
        .select("id, email, full_name, phone, accepts_marketing, created_at")
        .eq("profile_id", current.user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const loadedProfile = (profileData ?? null) as ProfileRow | null;
    const loadedCustomers = (customerData ?? []) as CustomerRow[];
    const customerIds = loadedCustomers.map((customer) => customer.id);

    let loadedOrders: OrderRow[] = [];
    let loadedAddresses: AddressRow[] = [];

    if (customerIds.length > 0) {
      const [{ data: orderData }, { data: addressData }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, number, status, total_cents, currency, placed_at, created_at")
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("addresses")
          .select("id, customer_id, label, recipient, street, number, complement, neighborhood, city, state, postal_code, country")
          .in("customer_id", customerIds)
          .limit(8),
      ]);

      loadedOrders = (orderData ?? []) as OrderRow[];
      loadedAddresses = (addressData ?? []) as AddressRow[];
    }

    setProfile(loadedProfile);
    setCustomers(loadedCustomers);
    setOrders(loadedOrders);
    setAddresses(loadedAddresses);
    setProfileName(displayName(current.user, loadedProfile));
    setProfilePhone(loadedProfile?.phone ?? loadedCustomers[0]?.phone ?? "");
    setAddress(loadedAddresses[0] ?? (loadedCustomers[0] ? emptyAddress(loadedCustomers[0].id) : null));

    if (current.user.email) {
      await captureEmail(current.user.email, displayName(current.user, loadedProfile));
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
        if (exchangeError && active) setError(exchangeError.message);
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
          queryParams: { access_type: "offline", prompt: "select_account" },
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
      if (signInError) setError(signInError.message);
    });
  }

  function sendPasswordReset() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (!email) {
        setError("Informe seu e-mail para receber o link de recuperacao.");
        return;
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/conta`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setMessage("Se este e-mail existir, o link de recuperacao sera enviado para ele.");
    });
  }

  function saveProfile() {
    if (!session?.user) return;
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: profileName, phone: profilePhone })
        .eq("id", session.user.id);

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (primaryCustomer) {
        await supabase
          .from("customers")
          .update({
            full_name: profileName,
            phone: profilePhone,
          })
          .eq("id", primaryCustomer.id);
      }

      setMessage("Dados atualizados.");
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
    });
  }

  function toggleMarketing(next: boolean) {
    if (!primaryCustomer) return;
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const { error: customerError } = await supabase
        .from("customers")
        .update({ accepts_marketing: next })
        .eq("id", primaryCustomer.id);

      if (customerError) {
        setError(customerError.message);
        return;
      }

      setMessage(next ? "Preferencia ativada." : "Preferencia removida.");
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
    });
  }

  function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address || !primaryCustomer) return;
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const payload = {
        tenant_id: tenantId,
        customer_id: primaryCustomer.id,
        label: address.label || "Principal",
        recipient: address.recipient || profileName,
        street: address.street,
        number: address.number || null,
        complement: address.complement || null,
        neighborhood: address.neighborhood || null,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country || "BR",
      };

      const query = address.id
        ? supabase.from("addresses").update(payload).eq("id", address.id)
        : supabase.from("addresses").insert(payload);

      const { error: addressError } = await query;
      if (addressError) {
        setError(addressError.message);
        return;
      }

      setMessage("Endereco salvo.");
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
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
          <p>Acompanhe dados, pedidos, enderecos e preferencias da Flora Botanics.</p>
        </div>

        <div className="account-dashboard-grid">
          <section className="account-panel-block">
            <div className="account-block-heading">
              <span>Perfil</span>
              <strong>Dados de acesso</strong>
            </div>
            <div className="account-form compact">
              <label>
                Nome
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
              </label>
              <label>
                WhatsApp
                <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} />
              </label>
              <button type="button" className="account-primary-button" onClick={saveProfile} disabled={pending}>
                Salvar dados
              </button>
            </div>
            <p className="account-fineprint">
              Login ativo via {user.app_metadata?.provider === "google" ? "Google" : "e-mail"}: {user.email}
            </p>
          </section>

          <section className="account-panel-block">
            <div className="account-block-heading">
              <span>Pedidos</span>
              <strong>Historico recente</strong>
            </div>
            {orders.length === 0 ? (
              <p className="account-empty">Nenhum pedido vinculado a esta conta ainda.</p>
            ) : (
              <div className="account-order-list">
                {orders.map((order) => (
                  <article key={order.id}>
                    <div>
                      <strong>Pedido #{order.number}</strong>
                      <span>{formatDate(order.placed_at ?? order.created_at)}</span>
                    </div>
                    <div>
                      <em>{ORDER_STATUS[order.status] ?? order.status}</em>
                      <b>{money(order.total_cents, order.currency)}</b>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="account-panel-block">
            <div className="account-block-heading">
              <span>Entrega</span>
              <strong>Endereco principal</strong>
            </div>
            {primaryCustomer && address ? (
              <form className="account-address-form" onSubmit={saveAddress}>
                <input placeholder="Nome do destinatario" value={address.recipient} onChange={(event) => setAddress({ ...address, recipient: event.target.value })} required />
                <input placeholder="CEP" value={address.postal_code} onChange={(event) => setAddress({ ...address, postal_code: event.target.value })} required />
                <input placeholder="Rua" value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} required />
                <div className="account-address-row">
                  <input placeholder="Numero" value={address.number ?? ""} onChange={(event) => setAddress({ ...address, number: event.target.value })} />
                  <input placeholder="Complemento" value={address.complement ?? ""} onChange={(event) => setAddress({ ...address, complement: event.target.value })} />
                </div>
                <div className="account-address-row">
                  <input placeholder="Cidade" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} required />
                  <input placeholder="UF" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value.toUpperCase().slice(0, 2) })} required />
                </div>
                <button type="submit" className="account-primary-button" disabled={pending}>
                  Salvar endereco
                </button>
              </form>
            ) : (
              <p className="account-empty">Seu endereco aparece aqui apos o primeiro cadastro de cliente.</p>
            )}
          </section>

          <section className="account-panel-block">
            <div className="account-block-heading">
              <span>Preferencias</span>
              <strong>Privacidade e comunicacao</strong>
            </div>
            <label className="account-toggle">
              <input
                type="checkbox"
                checked={Boolean(primaryCustomer?.accepts_marketing)}
                disabled={!primaryCustomer || pending}
                onChange={(event) => toggleMarketing(event.target.checked)}
              />
              Receber avisos, lancamentos e recuperacao de carrinho por e-mail.
            </label>
            <p className="account-fineprint">
              Cartoes e pagamentos serao gerenciados pelo provedor de pagamento; dados sensiveis nao ficam salvos na Flora.
            </p>
          </section>
        </div>

        <div className="account-actions-row">
          <Link href="/produtos" className="account-secondary-button">
            Continuar comprando
          </Link>
          <button type="button" className="account-secondary-button" onClick={logout} disabled={pending}>
            Sair da conta
          </button>
        </div>

        {error ? <p className="account-error">{error}</p> : null}
        {message ? <p className="account-success">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="account-auth-layout single">
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
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" />
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

        {mode === "entrar" ? (
          <button type="button" className="account-link-button" onClick={sendPasswordReset} disabled={pending}>
            Esqueci minha senha
          </button>
        ) : null}

        {error ? <p className="account-error">{error}</p> : null}
        {message ? <p className="account-success">{message}</p> : null}
      </div>
    </section>
  );
}
