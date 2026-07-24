"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { captureEmail } from "@/lib/cart";
import { storefrontSupabase } from "@/lib/supabase-browser";

type Mode = "entrar" | "cadastro";
type AddrMode = "list" | "edit" | "new";
type AccountTab = "dados" | "enderecos" | "pedidos" | "pagamentos";

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
  payment_info: PaymentInfo | null;
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
  district: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface PaymentInfo {
  pix_key_type?: string;
  pix_key?: string;
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;
  bank_account_type?: string;
  bank_account_holder?: string;
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
  cancelled: "Cancelado",
  cancellation_requested: "Cancelamento solicitado",
  refunded: "Reembolsado",
};

const CANCELLABLE = new Set(["pending", "paid"]);

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Celular" },
  { value: "random", label: "Chave aleatória" },
];

const ADDRESS_LABELS = ["Principal", "Casa", "Trabalho", "Outro"];

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
    district: "",
    city: "",
    state: "",
    zip: "",
    country: "BR",
  };
}

function emptyPaymentInfo(): PaymentInfo {
  return {
    pix_key_type: "cpf",
    pix_key: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    bank_account_type: "corrente",
    bank_account_holder: "",
  };
}

/* ─────────────────────────────────────────────────────────────── */

export function AccountPanel({ tenantId }: { tenantId: string }) {
  const supabase = useMemo(() => storefrontSupabase(), []);

  const [mode, setMode] = useState<Mode>("entrar");
  const [session, setSession] = useState<AccountSession | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [payInfo, setPayInfo] = useState<PaymentInfo>(emptyPaymentInfo());

  // profile form
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  // address management
  const [addrMode, setAddrMode] = useState<AddrMode>("list");
  const [editAddr, setEditAddr] = useState<AddressRow | null>(null);

  // auth form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [tab, setTab] = useState<AccountTab>("dados");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const primaryCustomer = customers[0] ?? null;

  /* ── load ── */
  async function loadAccount(current: AccountSession | null) {
    setSession(current);
    setProfile(null);
    setCustomers([]);
    setOrders([]);
    setAddresses([]);

    if (!current?.user) {
      setLoading(false);
      return;
    }

    try {
      await supabase.rpc("claim_my_customer_for_tenant", { p_tenant_id: tenantId });
    } catch { /* continua */ }

    const [{ data: profileData }, { data: customerData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, phone, avatar_url")
        .eq("id", current.user.id)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("id, email, full_name, phone, accepts_marketing, created_at, payment_info")
        .eq("tenant_id", tenantId)
        .eq("profile_id", current.user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const loadedProfile = (profileData ?? null) as ProfileRow | null;
    let loadedCustomers = (customerData ?? []) as CustomerRow[];

    if (loadedCustomers.length === 0 && current.user.email) {
      const customerName = displayName(current.user, loadedProfile);
      const { data: created } = await supabase
        .from("customers")
        .insert({
          tenant_id: tenantId,
          profile_id: current.user.id,
          email: current.user.email,
          full_name: customerName,
          phone: loadedProfile?.phone ?? null,
          accepts_marketing: false,
        })
        .select("id, email, full_name, phone, accepts_marketing, created_at, payment_info")
        .maybeSingle();
      if (created) loadedCustomers = [created as CustomerRow];
    }

    const customerIds = loadedCustomers.map((c) => c.id);
    let loadedOrders: OrderRow[] = [];
    let loadedAddresses: AddressRow[] = [];

    if (customerIds.length > 0) {
      const [{ data: orderData }, { data: addressData }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, number, status, total_cents, currency, placed_at, created_at")
          .eq("tenant_id", tenantId)
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("addresses")
          .select("id, customer_id, label, recipient, street, number, complement, district, city, state, zip, country")
          .eq("tenant_id", tenantId)
          .in("customer_id", customerIds)
          .limit(20),
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
    setPayInfo({
      ...emptyPaymentInfo(),
      ...(loadedCustomers[0]?.payment_info ?? {}),
    });
    setAddrMode("list");

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
        const { error: ex } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState({}, "", "/conta");
        if (ex && active) setError(ex.message);
      }
      const { data } = await supabase.auth.getSession();
      if (active) await loadAccount(data.session as AccountSession | null);
    }
    init();
    const { data } = supabase.auth.onAuthStateChange((_e, next) => {
      if (active) loadAccount(next as AccountSession | null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  /* ── auth ── */
  function loginWithGoogle() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/conta`, queryParams: { access_type: "offline", prompt: "select_account" } },
      });
      if (e) setError(e.message);
    });
  }

  function submitEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (mode === "cadastro") {
        const { error: e } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/conta`, data: { full_name: name } },
        });
        if (e) { setError(e.message); return; }
        setMessage("Cadastro criado. Verifique seu e-mail se necessário.");
        return;
      }
      const { error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) setError(e.message);
    });
  }

  function sendPasswordReset() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (!email) { setError("Informe seu e-mail."); return; }
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/conta`,
      });
      if (e) { setError(e.message); return; }
      setMessage("Link de recuperação enviado.");
    });
  }

  function logout() {
    startTransition(async () => {
      await supabase.auth.signOut();
      setMessage("Você saiu da conta.");
    });
  }

  /* ── profile ── */
  function saveProfile() {
    if (!session?.user) return;
    setError(null); setMessage(null);
    startTransition(async () => {
      const { error: e } = await supabase
        .from("profiles")
        .update({ full_name: profileName, phone: profilePhone })
        .eq("id", session.user.id);
      if (e) { setError(e.message); return; }
      if (primaryCustomer) {
        await supabase.from("customers")
          .update({ full_name: profileName, phone: profilePhone })
          .eq("tenant_id", tenantId).eq("id", primaryCustomer.id);
      }
      setMessage("Dados atualizados.");
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
    });
  }

  function toggleMarketing(next: boolean) {
    if (!primaryCustomer) return;
    setError(null); setMessage(null);
    startTransition(async () => {
      const { error: e } = await supabase.from("customers")
        .update({ accepts_marketing: next })
        .eq("tenant_id", tenantId).eq("id", primaryCustomer.id);
      if (e) { setError(e.message); return; }
      setMessage(next ? "Preferência ativada." : "Preferência removida.");
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
    });
  }

  /* ── addresses ── */
  function startNewAddress() {
    if (!primaryCustomer) return;
    setEditAddr(emptyAddress(primaryCustomer.id));
    setAddrMode("new");
  }

  function startEditAddress(addr: AddressRow) {
    setEditAddr({ ...addr });
    setAddrMode("edit");
  }

  function cancelAddrEdit() {
    setAddrMode("list");
    setEditAddr(null);
  }

  function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editAddr || !primaryCustomer) return;
    setError(null); setMessage(null);
    startTransition(async () => {
      const payload = {
        tenant_id: tenantId,
        customer_id: primaryCustomer.id,
        label: editAddr.label || "Principal",
        recipient: editAddr.recipient || profileName,
        street: editAddr.street,
        number: editAddr.number || null,
        complement: editAddr.complement || null,
        district: editAddr.district || null,
        city: editAddr.city,
        state: editAddr.state,
        zip: editAddr.zip,
        country: editAddr.country || "BR",
      };
      const query = editAddr.id
        ? supabase.from("addresses").update(payload).eq("tenant_id", tenantId).eq("id", editAddr.id)
        : supabase.from("addresses").insert(payload);
      const { error: e } = await query;
      if (e) { setError(e.message); return; }
      setMessage(editAddr.id ? "Endereço atualizado." : "Endereço adicionado.");
      setAddrMode("list");
      setEditAddr(null);
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
    });
  }

  function deleteAddress(id: string) {
    setError(null); setMessage(null);
    startTransition(async () => {
      const { error: e } = await supabase.from("addresses")
        .delete().eq("tenant_id", tenantId).eq("id", id);
      if (e) { setError(e.message); return; }
      setMessage("Endereço removido.");
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
    });
  }

  /* ── orders ── */
  function requestCancellation(orderId: string) {
    setError(null); setMessage(null);
    setCancelConfirm(null);
    startTransition(async () => {
      const { error: e } = await supabase.from("orders")
        .update({ status: "cancellation_requested" })
        .eq("tenant_id", tenantId).eq("id", orderId);
      if (e) { setError(e.message); return; }
      setMessage("Cancelamento solicitado. Nossa equipe entrará em contato.");
      const { data } = await supabase.auth.getSession();
      await loadAccount(data.session as AccountSession | null);
    });
  }

  /* ── payment info ── */
  function savePaymentInfo() {
    if (!primaryCustomer) return;
    setError(null); setMessage(null);
    startTransition(async () => {
      const { error: e } = await supabase.from("customers")
        .update({ payment_info: payInfo })
        .eq("tenant_id", tenantId).eq("id", primaryCustomer.id);
      if (e) { setError(e.message); return; }
      setMessage("Dados bancários salvos.");
    });
  }

  /* ─── render helpers ───────────────────────────────────────── */

  if (loading) {
    return (
      <section className="account-card account-status-card">
        <span className="account-kicker">Conta Flora</span>
        <p>Carregando sua conta...</p>
      </section>
    );
  }

  if (!session?.user) {
    return (
      <section className="account-auth-layout single">
        <div className="account-card account-form-card">
          <div className="account-mode-switch" role="tablist">
            <button type="button" onClick={() => setMode("entrar")} className={mode === "entrar" ? "is-active" : ""}>Entrar</button>
            <button type="button" onClick={() => setMode("cadastro")} className={mode === "cadastro" ? "is-active" : ""}>Criar conta</button>
          </div>
          <button type="button" onClick={loginWithGoogle} disabled={pending} className="account-google-button">
            <span>G</span>Continuar com Google
          </button>
          <div className="account-divider"><span>ou acesse com e-mail</span></div>
          <form onSubmit={submitEmailAuth} className="account-form">
            {mode === "cadastro" && (
              <label>Nome completo<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></label>
            )}
            <label>E-mail<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></label>
            <label>Senha<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></label>
            <button type="submit" className="account-primary-button" disabled={pending}>
              {pending ? "Aguarde..." : mode === "cadastro" ? "Criar conta" : "Entrar"}
            </button>
          </form>
          {mode === "entrar" && (
            <button type="button" className="account-link-button" onClick={sendPasswordReset} disabled={pending}>Esqueci minha senha</button>
          )}
          {error ? <p className="account-error">{error}</p> : null}
          {message ? <p className="account-success">{message}</p> : null}
        </div>
      </section>
    );
  }

  const user = session.user;
  const nameLabel = displayName(user, profile);

  /* ── tabs ── */
  const TABS: { id: AccountTab; label: string; icon: string }[] = [
    { id: "dados", label: "Dados", icon: "👤" },
    { id: "enderecos", label: "Endereços", icon: "📍" },
    { id: "pedidos", label: "Pedidos", icon: "📦" },
    { id: "pagamentos", label: "Pagamentos", icon: "🏦" },
  ];

  return (
    <section className="account-card account-profile-card">
      <div className="account-profile-heading">
        <span className="account-kicker">Minha conta</span>
        <h1>Olá, {nameLabel}</h1>
        <p>Gerencie seus dados, endereços, pedidos e preferências de pagamento.</p>
      </div>

      {/* ── tabs nav ── */}
      <nav className="account-tabs-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`account-tab-btn${tab === t.id ? " is-active" : ""}`}
            onClick={() => { setTab(t.id); setMessage(null); setError(null); }}
          >
            <span>{t.icon}</span> {t.label}
            {t.id === "enderecos" && addresses.length > 0 && (
              <span className="account-tab-count">{addresses.length}</span>
            )}
            {t.id === "pedidos" && orders.length > 0 && (
              <span className="account-tab-count">{orders.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── tab: dados ── */}
      {tab === "dados" && (
        <div className="account-dashboard-grid">
          <section className="account-panel-block">
            <div className="account-block-heading"><span>Perfil</span><strong>Dados de acesso</strong></div>
            <div className="account-form compact">
              <label>Nome<input value={profileName} onChange={(e) => setProfileName(e.target.value)} /></label>
              <label>WhatsApp<input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+55 11 99999-9999" /></label>
              <button type="button" className="account-primary-button" onClick={saveProfile} disabled={pending}>Salvar dados</button>
            </div>
            <p className="account-fineprint">
              Login via {user.app_metadata?.provider === "google" ? "Google" : "e-mail"}: {user.email}
            </p>
          </section>

          <section className="account-panel-block">
            <div className="account-block-heading"><span>Preferências</span><strong>Privacidade e comunicação</strong></div>
            <label className="account-toggle">
              <input
                type="checkbox"
                checked={Boolean(primaryCustomer?.accepts_marketing)}
                disabled={!primaryCustomer || pending}
                onChange={(e) => toggleMarketing(e.target.checked)}
              />
              Receber avisos, lançamentos e recuperação de carrinho por e-mail.
            </label>
            <p className="account-fineprint" style={{ marginTop: 16 }}>
              Dados sensíveis de cartão nunca são armazenados pela Flora — são gerenciados diretamente pelo provedor de pagamento.
            </p>
            <div className="account-actions-row" style={{ marginTop: 20 }}>
              <Link href="/favoritos" className="account-secondary-button">Meus favoritos</Link>
              <button type="button" className="account-secondary-button" onClick={logout} disabled={pending}>Sair</button>
            </div>
          </section>
        </div>
      )}

      {/* ── tab: endereços ── */}
      {tab === "enderecos" && (
        <div className="account-panel-block" style={{ maxWidth: 680 }}>
          <div className="account-block-heading">
            <span>Entrega</span>
            <strong>Meus endereços ({addresses.length})</strong>
          </div>

          {addrMode === "list" && (
            <>
              {addresses.length === 0 ? (
                <p className="account-empty">Nenhum endereço cadastrado ainda.</p>
              ) : (
                <div className="account-address-cards">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="account-address-card">
                      <div className="account-address-card-label">{addr.label || "Endereço"}</div>
                      <div className="account-address-card-body">
                        <strong>{addr.recipient}</strong>
                        <span>{addr.street}{addr.number ? `, ${addr.number}` : ""}{addr.complement ? ` — ${addr.complement}` : ""}</span>
                        <span>{addr.district ? `${addr.district}, ` : ""}{addr.city} — {addr.state}</span>
                        <span>CEP {addr.zip}</span>
                      </div>
                      <div className="account-address-card-actions">
                        <button type="button" className="account-secondary-button" onClick={() => startEditAddress(addr)}>Editar</button>
                        <button
                          type="button"
                          className="account-danger-button"
                          onClick={() => { if (confirm("Remover este endereço?")) deleteAddress(addr.id); }}
                          disabled={pending}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="account-primary-button" onClick={startNewAddress} style={{ marginTop: 16 }}>
                + Adicionar endereço
              </button>
            </>
          )}

          {(addrMode === "edit" || addrMode === "new") && editAddr && (
            <form className="account-address-form" onSubmit={saveAddress}>
              <div className="account-form-row">
                <label style={{ flex: 1 }}>
                  Rótulo
                  <select
                    value={editAddr.label ?? "Principal"}
                    onChange={(e) => setEditAddr({ ...editAddr, label: e.target.value })}
                    className="account-select"
                  >
                    {ADDRESS_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label style={{ flex: 2 }}>
                  Destinatário
                  <input
                    placeholder="Nome do destinatário"
                    value={editAddr.recipient}
                    onChange={(e) => setEditAddr({ ...editAddr, recipient: e.target.value })}
                    required
                  />
                </label>
              </div>
              <label>
                CEP
                <input placeholder="00000-000" value={editAddr.zip} onChange={(e) => setEditAddr({ ...editAddr, zip: e.target.value })} required />
              </label>
              <label>
                Rua / Avenida
                <input placeholder="Rua das Flores" value={editAddr.street} onChange={(e) => setEditAddr({ ...editAddr, street: e.target.value })} required />
              </label>
              <div className="account-address-row">
                <input placeholder="Número" value={editAddr.number ?? ""} onChange={(e) => setEditAddr({ ...editAddr, number: e.target.value })} />
                <input placeholder="Complemento" value={editAddr.complement ?? ""} onChange={(e) => setEditAddr({ ...editAddr, complement: e.target.value })} />
              </div>
              <input placeholder="Bairro" value={editAddr.district ?? ""} onChange={(e) => setEditAddr({ ...editAddr, district: e.target.value })} />
              <div className="account-address-row">
                <input placeholder="Cidade" value={editAddr.city} onChange={(e) => setEditAddr({ ...editAddr, city: e.target.value })} required />
                <input
                  placeholder="UF"
                  value={editAddr.state}
                  onChange={(e) => setEditAddr({ ...editAddr, state: e.target.value.toUpperCase().slice(0, 2) })}
                  required
                  maxLength={2}
                  style={{ maxWidth: 80 }}
                />
              </div>
              <div className="account-form-actions">
                <button type="submit" className="account-primary-button" disabled={pending}>
                  {addrMode === "new" ? "Adicionar endereço" : "Salvar alterações"}
                </button>
                <button type="button" className="account-secondary-button" onClick={cancelAddrEdit}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── tab: pedidos ── */}
      {tab === "pedidos" && (
        <div className="account-panel-block" style={{ maxWidth: 720 }}>
          <div className="account-block-heading"><span>Compras</span><strong>Histórico de pedidos</strong></div>
          {orders.length === 0 ? (
            <p className="account-empty">Nenhum pedido ainda.</p>
          ) : (
            <div className="account-order-list-full">
              {orders.map((order) => (
                <article key={order.id} className="account-order-card">
                  <div className="account-order-card-header">
                    <div>
                      <strong>Pedido #{order.number}</strong>
                      <span>{formatDate(order.placed_at ?? order.created_at)}</span>
                    </div>
                    <div className="account-order-card-meta">
                      <span
                        className={`account-order-status account-order-status-${order.status}`}
                      >
                        {ORDER_STATUS[order.status] ?? order.status}
                      </span>
                      <b>{money(order.total_cents, order.currency)}</b>
                    </div>
                  </div>

                  {CANCELLABLE.has(order.status) && (
                    cancelConfirm === order.id ? (
                      <div className="account-cancel-confirm">
                        <span>Confirmar solicitação de cancelamento?</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            className="account-danger-button"
                            onClick={() => requestCancellation(order.id)}
                            disabled={pending}
                          >
                            Confirmar
                          </button>
                          <button type="button" className="account-secondary-button" onClick={() => setCancelConfirm(null)}>
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="account-link-button"
                        onClick={() => setCancelConfirm(order.id)}
                        style={{ marginTop: 8, fontSize: 12, color: "var(--account-muted)" }}
                      >
                        Solicitar cancelamento
                      </button>
                    )
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── tab: pagamentos ── */}
      {tab === "pagamentos" && (
        <div className="account-dashboard-grid">
          {/* PIX */}
          <section className="account-panel-block">
            <div className="account-block-heading"><span>PIX</span><strong>Chave PIX para reembolso</strong></div>
            <p className="account-fineprint" style={{ marginBottom: 12 }}>
              Informe sua chave PIX para facilitar reembolsos. Nunca pediremos senha ou dados sensíveis.
            </p>
            <div className="account-form compact">
              <label>
                Tipo de chave
                <select
                  value={payInfo.pix_key_type ?? "cpf"}
                  onChange={(e) => setPayInfo({ ...payInfo, pix_key_type: e.target.value })}
                  className="account-select"
                >
                  {PIX_KEY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label>
                Chave PIX
                <input
                  value={payInfo.pix_key ?? ""}
                  onChange={(e) => setPayInfo({ ...payInfo, pix_key: e.target.value })}
                  placeholder={
                    payInfo.pix_key_type === "cpf" ? "000.000.000-00"
                    : payInfo.pix_key_type === "phone" ? "+55 11 99999-9999"
                    : payInfo.pix_key_type === "email" ? "voce@email.com"
                    : "Sua chave"
                  }
                />
              </label>
              <button type="button" className="account-primary-button" onClick={savePaymentInfo} disabled={pending}>
                Salvar chave PIX
              </button>
            </div>
          </section>

          {/* Dados bancários */}
          <section className="account-panel-block">
            <div className="account-block-heading"><span>Banco</span><strong>Dados para transferência</strong></div>
            <p className="account-fineprint" style={{ marginBottom: 12 }}>
              Dados opcionais para receber reembolsos via TED/DOC, caso o PIX não seja possível.
            </p>
            <div className="account-form compact">
              <label>
                Titular da conta
                <input
                  value={payInfo.bank_account_holder ?? ""}
                  onChange={(e) => setPayInfo({ ...payInfo, bank_account_holder: e.target.value })}
                  placeholder="Nome completo ou razão social"
                />
              </label>
              <label>
                Banco
                <input
                  value={payInfo.bank_name ?? ""}
                  onChange={(e) => setPayInfo({ ...payInfo, bank_name: e.target.value })}
                  placeholder="Ex: Nubank, Itaú, Bradesco"
                />
              </label>
              <div className="account-address-row">
                <label style={{ flex: 1 }}>
                  Agência
                  <input
                    value={payInfo.bank_agency ?? ""}
                    onChange={(e) => setPayInfo({ ...payInfo, bank_agency: e.target.value })}
                    placeholder="0000"
                  />
                </label>
                <label style={{ flex: 2 }}>
                  Conta
                  <input
                    value={payInfo.bank_account ?? ""}
                    onChange={(e) => setPayInfo({ ...payInfo, bank_account: e.target.value })}
                    placeholder="00000-0"
                  />
                </label>
              </div>
              <label>
                Tipo de conta
                <select
                  value={payInfo.bank_account_type ?? "corrente"}
                  onChange={(e) => setPayInfo({ ...payInfo, bank_account_type: e.target.value })}
                  className="account-select"
                >
                  <option value="corrente">Conta corrente</option>
                  <option value="poupanca">Conta poupança</option>
                </select>
              </label>
              <button type="button" className="account-primary-button" onClick={savePaymentInfo} disabled={pending}>
                Salvar dados bancários
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── feedback global ── */}
      {error ? <p className="account-error" style={{ marginTop: 16 }}>{error}</p> : null}
      {message ? <p className="account-success" style={{ marginTop: 16 }}>{message}</p> : null}
    </section>
  );
}
