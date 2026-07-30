"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  calcSubtotal,
  clearLocalCart,
  getLocalCart,
  getSessionId,
  syncCart,
  type CartItem,
} from "@/lib/cart";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShippingQuote {
  service_id: number;
  service_name: string;
  carrier: string;
  carrier_logo: string;
  price_cents: number;
  days: number;
  days_min: number;
}

interface CouponResult {
  ok: boolean;
  code?: string;
  discount_cents?: number;
  free_shipping?: boolean;
  error?: string;
}

type Step = "contact" | "address" | "shipping" | "payment" | "confirm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function maskCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
}

const STEPS: { id: Step; label: string }[] = [
  { id: "contact", label: "Contato" },
  { id: "address", label: "Endereço" },
  { id: "shipping", label: "Frete" },
  { id: "payment", label: "Pagamento" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckoutPanel() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [step, setStep] = useState<Step>("contact");
  const [pending, startTransition] = useTransition();

  // Contact
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(true);

  // Address
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [recipient, setRecipient] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Shipping
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<ShippingQuote | null>(null);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Forma de pagamento
  type PayMethod = "pix" | "card" | "pix_card" | "card2" | "card3";
  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  // Valores em R$ digitados por cartão (somente para card2/card3)
  const [cardAmt, setCardAmt] = useState<[string, string, string]>(["", "", ""]);

  // Notes / Order result
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [orderResult, setOrderResult] = useState<{ order_number: number; total_cents: number } | null>(null);

  const _zipRef = useRef<HTMLInputElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setItems(getLocalCart());
    setSessionId(getSessionId());
  }, []);

  const subtotal = useMemo(() => calcSubtotal(items), [items]);
  const discount = couponResult?.discount_cents ?? 0;
  const shippingCents = couponResult?.free_shipping ? 0 : (selectedQuote?.price_cents ?? 0);
  const total = Math.max(subtotal - discount + shippingCents, 0);

  // ── CEP lookup ────────────────────────────────────────────────────────────

  const lookupCep = useCallback(async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`/api/cep?cep=${clean}`);
      const data = await res.json() as { ok: boolean; street?: string; district?: string; city?: string; state?: string };
      if (data.ok) {
        setStreet(data.street ?? "");
        setDistrict(data.district ?? "");
        setCity(data.city ?? "");
        setState(data.state ?? "");
      }
    } catch { /* silent */ }
    finally { setCepLoading(false); }
  }, []);

  // ── CEP via GPS ───────────────────────────────────────────────────────────

  const detectGps = useCallback(async () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&addressdetails=1`,
            { headers: { "Accept-Language": "pt-BR" } }
          );
          const data = await res.json() as { address?: { postcode?: string } };
          const postcode = data.address?.postcode?.replace(/\D/g, "");
          if (postcode && postcode.length === 8) {
            setZip(postcode.replace(/^(\d{5})(\d)/, "$1-$2"));
            await lookupCep(postcode);
          }
        } catch { /* silent */ }
        finally { setGpsLoading(false); }
      },
      () => setGpsLoading(false),
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [lookupCep]);

  // ── Shipping quotes ───────────────────────────────────────────────────────

  const fetchQuotes = useCallback(async () => {
    const cleanZip = zip.replace(/\D/g, "");
    if (cleanZip.length !== 8) return;
    setQuotesLoading(true);
    setQuotesError("");
    setSelectedQuote(null);
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip_to: cleanZip,
          items: items.map((item) => ({
            weight_g: 200,
            width_cm: 10,
            height_cm: 5,
            depth_cm: 10,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json() as { ok: boolean; quotes?: ShippingQuote[]; error?: string };
      if (data.ok && data.quotes?.length) {
        setQuotes(data.quotes);
        setSelectedQuote(data.quotes[0]);
      } else {
        setQuotesError(data.error ?? "Sem opções de frete disponíveis.");
      }
    } catch {
      setQuotesError("Erro ao buscar frete. Tente novamente.");
    } finally {
      setQuotesLoading(false);
    }
  }, [zip, items]);

  // ── Coupon ────────────────────────────────────────────────────────────────

  async function validateCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim().toUpperCase(), subtotal_cents: subtotal }),
      });
      const data = await res.json() as CouponResult;
      setCouponResult(data);
    } catch {
      setCouponResult({ ok: false, error: "Erro ao validar cupom." });
    } finally {
      setCouponLoading(false);
    }
  }

  // ── Step navigation ───────────────────────────────────────────────────────

  function goTo(target: Step) {
    setError("");
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitContact(e: FormEvent) {
    e.preventDefault();
    if (!email || !name) { setError("Preencha e-mail e nome."); return; }
    if (!recipient) setRecipient(name);
    goTo("address");
  }

  function submitAddress(e: FormEvent) {
    e.preventDefault();
    const cleanZip = zip.replace(/\D/g, "");
    if (cleanZip.length !== 8 || !street || !city || state.length !== 2) {
      setError("Preencha todos os campos obrigatórios do endereço.");
      return;
    }
    fetchQuotes().then(() => goTo("shipping"));
  }

  function submitShipping(e: FormEvent) {
    e.preventDefault();
    if (!selectedQuote && !quotesError) { setError("Selecione uma opção de frete."); return; }
    goTo("payment");
  }

  /** Retorna array de centavos por cartão para split (card2 / card3) */
  function getSplitCents(): number[] {
    const numCards = payMethod === "card3" ? 3 : 2;
    const result: number[] = [];
    let remaining = total;
    for (let i = 0; i < numCards; i++) {
      if (i === numCards - 1) {
        result.push(Math.max(remaining, 0));
      } else {
        const raw = parseFloat((cardAmt[i] || "0").replace(",", "."));
        const cents = Math.max(Math.round(raw * 100), 0);
        result.push(cents);
        remaining -= cents;
      }
    }
    return result;
  }

  function submitPayment(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Validação de split antes de prosseguir
    if (payMethod === "card2" || payMethod === "card3") {
      const splits = getSplitCents();
      const sum = splits.reduce((a, b) => a + b, 0);
      if (splits.some((v) => v <= 0)) {
        setError("Informe o valor de cada cartão (maior que zero).");
        return;
      }
      if (Math.abs(sum - total) > 1) {
        setError(`A soma dos cartões (${money(sum)}) não bate com o total (${money(total)}).`);
        return;
      }
    }

    startTransition(async () => {
      const synced = await syncCart({ customer_email: email, customer_name: name });
      if (Array.isArray(synced)) setItems(synced);

      const isSplit = payMethod === "card2" || payMethod === "card3";
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId || getSessionId(),
          coupon_code: couponResult?.ok ? couponCode.trim().toUpperCase() : null,
          notes: notes.trim() || null,
          payment_method: payMethod,
          ...(isSplit ? { card_splits: getSplitCents() } : {}),
          customer: { email, name, phone: phone.replace(/\D/g, ""), accepts_marketing: acceptsMarketing },
          shipping_address: {
            recipient: recipient || name,
            street, number, complement, district, city,
            state: state.toUpperCase().slice(0, 2),
            zip: zip.replace(/\D/g, ""),
            country: "BR",
          },
        }),
      });

      const data = await res.json().catch(() => null) as {
        ok?: boolean; error?: string; order_number?: number; total_cents?: number; checkout_url?: string
      } | null;

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Não foi possível finalizar o pedido.");
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      clearLocalCart();
      setItems([]);
      setOrderResult({ order_number: data.order_number!, total_cents: data.total_cents! });
      goTo("confirm");
    });
  }

  // ── Confirmation ──────────────────────────────────────────────────────────

  if (step === "confirm" && orderResult) {
    return (
      <section className="checkout-success-card">
        <div className="checkout-success-icon">✓</div>
        <h1>Pedido #{orderResult.order_number} confirmado!</h1>
        <p>
          Você receberá um e-mail em <strong>{email}</strong> com os detalhes e rastreamento.
        </p>
        <div className="checkout-success-total">
          Total: <strong>{money(orderResult.total_cents)}</strong>
        </div>
        <div className="checkout-success-actions">
          <a href="/conta" className="btn">Minha conta</a>
          <a href="/produtos" className="btn btn-outline">Continuar comprando</a>
        </div>
      </section>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="checkout-grid">

      {/* ── Left: Form steps ── */}
      <section className="checkout-panel">

        {/* Step progress */}
        <nav className="checkout-steps" aria-label="Etapas">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`checkout-step${i < stepIndex ? " is-done" : i === stepIndex ? " is-active" : ""}`}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              <span className="checkout-step-num">{i < stepIndex ? "✓" : i + 1}</span>
              <span className="checkout-step-label">{s.label}</span>
            </div>
          ))}
        </nav>

        {/* ── 1: Contato ── */}
        {step === "contact" && (
          <form onSubmit={submitContact} className="checkout-form" noValidate>
            <h2 className="checkout-section-title">Suas informações</h2>
            <div className="checkout-field-grid">
              <label className="checkout-field checkout-field-wide">
                <span>E-mail *</span>
                <input type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </label>
              <label className="checkout-field">
                <span>Nome completo *</span>
                <input required autoComplete="name" value={name}
                  onChange={(e) => { setName(e.target.value); if (!recipient) setRecipient(e.target.value); }}
                  placeholder="Seu nome" />
              </label>
              <label className="checkout-field">
                <span>Telefone / WhatsApp</span>
                <input type="tel" autoComplete="tel" value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999" />
              </label>
            </div>
            <label className="checkout-checkbox">
              <input type="checkbox" checked={acceptsMarketing}
                onChange={(e) => setAcceptsMarketing(e.target.checked)} />
              <span>Quero receber novidades e ofertas exclusivas por e-mail.</span>
            </label>
            {error && <p className="checkout-error" role="alert">{error}</p>}
            <button type="submit" className="btn checkout-next-btn">Continuar →</button>
          </form>
        )}

        {/* ── 2: Endereço ── */}
        {step === "address" && (
          <form onSubmit={submitAddress} className="checkout-form" noValidate>
            <h2 className="checkout-section-title">Endereço de entrega</h2>
            <div className="checkout-field-grid">
              <label className="checkout-field checkout-field-wide">
                <span>Destinatário *</span>
                <input required value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </label>
              <label className="checkout-field">
                <span>CEP *</span>
                <div className="checkout-cep-wrap">
                  <input
                    ref={_zipRef}
                    required
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={zip}
                    onChange={(e) => setZip(maskCep(e.target.value))}
                    onBlur={(e) => lookupCep(e.target.value)}
                    placeholder="00000-000"
                  />
                  <button
                    type="button"
                    className="checkout-cep-gps"
                    onClick={detectGps}
                    disabled={gpsLoading || cepLoading}
                    title="Detectar CEP pela localização"
                    aria-label="Usar localização GPS"
                  >
                    {gpsLoading ? (
                      <span className="checkout-cep-loader" style={{ position: "static" }}>…</span>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="5" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="5" y2="12" />
                        <line x1="19" y1="12" x2="22" y2="12" />
                      </svg>
                    )}
                  </button>
                  {cepLoading && !gpsLoading && <span className="checkout-cep-loader" aria-live="polite">buscando…</span>}
                </div>
                <a className="checkout-cep-link"
                  href="https://buscacepinter.correios.com.br/app/endereco/"
                  target="_blank" rel="noreferrer">
                  Não sei meu CEP
                </a>
              </label>
              <label className="checkout-field checkout-field-wide">
                <span>Rua *</span>
                <input required autoComplete="address-line1" value={street}
                  onChange={(e) => setStreet(e.target.value)} />
              </label>
              <label className="checkout-field">
                <span>Número *</span>
                <input required value={number} onChange={(e) => setNumber(e.target.value)} />
              </label>
              <label className="checkout-field">
                <span>Complemento</span>
                <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, bloco…" />
              </label>
              <label className="checkout-field">
                <span>Bairro</span>
                <input value={district} onChange={(e) => setDistrict(e.target.value)} />
              </label>
              <label className="checkout-field">
                <span>Cidade *</span>
                <input required autoComplete="address-level2" value={city}
                  onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className="checkout-field">
                <span>UF *</span>
                <input required maxLength={2} value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())} />
              </label>
            </div>
            {error && <p className="checkout-error" role="alert">{error}</p>}
            <div className="checkout-btn-row">
              <button type="button" className="btn btn-outline" onClick={() => goTo("contact")}>← Voltar</button>
              <button type="submit" className="btn checkout-next-btn">Calcular frete →</button>
            </div>
          </form>
        )}

        {/* ── 3: Frete ── */}
        {step === "shipping" && (
          <form onSubmit={submitShipping} className="checkout-form">
            <h2 className="checkout-section-title">Opções de entrega</h2>
            <p className="checkout-shipping-to">
              Entregando em <strong>{city} – {state}</strong>, CEP {zip}
            </p>
            {quotesLoading && (
              <div className="checkout-shipping-loading">
                <span className="checkout-spinner" role="status" aria-label="Calculando" />
                Calculando opções de frete…
              </div>
            )}
            {!quotesLoading && quotesError && (
              <div className="checkout-error">
                <p>{quotesError}</p>
                <button type="button" className="btn btn-sm" onClick={fetchQuotes}>Tentar novamente</button>
              </div>
            )}
            {!quotesLoading && quotes.length > 0 && (
              <div className="checkout-shipping-list" role="radiogroup" aria-label="Transportadoras">
                {quotes.map((q) => (
                  <label
                    key={q.service_id}
                    className={`checkout-shipping-option${selectedQuote?.service_id === q.service_id ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={q.service_id}
                      checked={selectedQuote?.service_id === q.service_id}
                      onChange={() => setSelectedQuote(q)}
                    />
                    <div className="checkout-shipping-info">
                      <span className="checkout-shipping-carrier">{q.carrier} — {q.service_name}</span>
                      <span className="checkout-shipping-days">
                        {q.days_min === q.days
                          ? `${q.days} dias úteis`
                          : `${q.days_min}–${q.days} dias úteis`}
                      </span>
                    </div>
                    <span className="checkout-shipping-price">
                      {couponResult?.free_shipping
                        ? <><s>{money(q.price_cents)}</s> <strong className="checkout-free-badge">Grátis</strong></>
                        : money(q.price_cents)
                      }
                    </span>
                  </label>
                ))}
              </div>
            )}
            {error && <p className="checkout-error" role="alert">{error}</p>}
            <div className="checkout-btn-row">
              <button type="button" className="btn btn-outline" onClick={() => goTo("address")}>← Voltar</button>
              <button type="submit" className="btn checkout-next-btn"
                disabled={!selectedQuote && !quotesError}>
                Ir para pagamento →
              </button>
            </div>
          </form>
        )}

        {/* ── 4: Pagamento ── */}
        {step === "payment" && (
          <form onSubmit={submitPayment} className="checkout-form">
            <h2 className="checkout-section-title">Finalizar pedido</h2>

            {/* Seletor de forma de pagamento */}
            <div>
              <p className="checkout-card-split-title" style={{ marginBottom: 10 }}>Forma de pagamento</p>
              <div className="checkout-payment-methods">
                {([
                  { id: "card",     icon: "💳",   label: "Cartão\nde crédito" },
                  { id: "pix",      icon: "⚡",    label: "PIX\nIntegral" },
                  { id: "pix_card", icon: "⚡💳",  label: "PIX +\nCartão" },
                  { id: "card2",    icon: "💳💳",  label: "2 Cartões" },
                  { id: "card3",    icon: "💳💳💳", label: "3 Cartões" },
                ] as { id: PayMethod; icon: string; label: string }[]).map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    className={`checkout-pm-option${payMethod === pm.id ? " is-active" : ""}`}
                    onClick={() => setPayMethod(pm.id)}
                  >
                    <span className="checkout-pm-icon">{pm.icon}</span>
                    <span className="checkout-pm-label">{pm.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divisão de valores para 2 ou 3 cartões */}
            {(payMethod === "card2" || payMethod === "card3") && (() => {
              const numCards = payMethod === "card3" ? 3 : 2;
              const defaultSplit = (total / numCards / 100).toFixed(2);
              const splits = getSplitCents();
              const sumSplits = splits.reduce((a, b) => a + b, 0);
              const ok = Math.abs(sumSplits - total) <= 1;

              return (
                <div className="checkout-card-split">
                  <p className="checkout-card-split-title">Divisão entre os cartões</p>
                  {Array.from({ length: numCards }).map((_, i) => {
                    const isLast = i === numCards - 1;
                    return (
                      <div key={i} className="checkout-card-split-row">
                        <span className="checkout-card-split-label">Cartão {i + 1}</span>
                        {isLast ? (
                          <input
                            className="checkout-field"
                            style={{ padding: "8px 12px", fontSize: 13 }}
                            readOnly
                            value={`R$ ${(Math.max(total - splits.slice(0, -1).reduce((a, b) => a + b, 0), 0) / 100).toFixed(2)}`}
                            tabIndex={-1}
                          />
                        ) : (
                          <input
                            className="checkout-field"
                            style={{ padding: "8px 12px", fontSize: 13 }}
                            type="number"
                            min="0.01"
                            max={(total / 100).toFixed(2)}
                            step="0.01"
                            value={cardAmt[i]}
                            onChange={(e) => {
                              const next = [...cardAmt] as [string, string, string];
                              next[i] = e.target.value;
                              setCardAmt(next);
                            }}
                            placeholder={`R$ ${defaultSplit}`}
                          />
                        )}
                        <span className="checkout-card-split-note">
                          {money(splits[i])}
                        </span>
                      </div>
                    );
                  })}
                  <p className={`checkout-card-split-total${ok ? " is-ok" : " is-err"}`}>
                    {ok
                      ? `✓ Total correto: ${money(total)}`
                      : `Faltam ${money(Math.abs(total - sumSplits))} · total deve ser ${money(total)}`}
                  </p>
                </div>
              );
            })()}

            {/* Cupom */}
            <div className="checkout-section">
              <label className="checkout-field">
                <span>Cupom de desconto</span>
                <div className="checkout-coupon-row">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validateCoupon(); } }}
                    placeholder="FLORA10"
                    autoComplete="off"
                  />
                  <button type="button" className="btn btn-sm" onClick={validateCoupon} disabled={couponLoading}>
                    {couponLoading ? "…" : "Aplicar"}
                  </button>
                </div>
              </label>
              {couponResult?.ok && (
                <p className="checkout-coupon-ok">
                  ✓ {couponResult.free_shipping
                    ? "Frete grátis aplicado!"
                    : `Desconto de ${money(couponResult.discount_cents ?? 0)} aplicado.`}
                </p>
              )}
              {couponResult && !couponResult.ok && (
                <p className="checkout-error">{couponResult.error}</p>
              )}
            </div>

            <label className="checkout-field">
              <span>Observação para o pedido</span>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Alguma instrução especial?" />
            </label>

            {payMethod === "pix" && (
              <div className="checkout-payment-notice">
                <span className="checkout-payment-icon">⚡</span>
                <div>
                  <strong>PIX — pagamento instantâneo</strong>
                  <p>Você será redirecionado para o Stripe e poderá pagar via QR Code ou chave PIX. Aprovação em segundos.</p>
                </div>
              </div>
            )}
            {payMethod === "pix_card" && (
              <div className="checkout-payment-notice">
                <span className="checkout-payment-icon">⚡💳</span>
                <div>
                  <strong>PIX ou Cartão — você escolhe</strong>
                  <p>Na próxima tela você seleciona se prefere pagar com PIX ou cartão de crédito.</p>
                </div>
              </div>
            )}
            {(payMethod === "card2" || payMethod === "card3") && (
              <div className="checkout-payment-notice">
                <span className="checkout-payment-icon">💳</span>
                <div>
                  <strong>{payMethod === "card3" ? "3 cartões" : "2 cartões"} — pagamento sequencial</strong>
                  <p>Você será redirecionado para pagar no cartão 1, depois no cartão 2{payMethod === "card3" ? " e no cartão 3" : ""}. Cada etapa abre uma tela segura do Stripe.</p>
                </div>
              </div>
            )}
            {payMethod === "card" && (
              <div className="checkout-payment-notice">
                <span className="checkout-payment-icon">💳</span>
                <div>
                  <strong>Cartão de crédito</strong>
                  <p>Você será direcionado para a página segura de pagamento do Stripe.</p>
                </div>
              </div>
            )}

            {error && <p className="checkout-error" role="alert">{error}</p>}
            <div className="checkout-btn-row">
              <button type="button" className="btn btn-outline" onClick={() => goTo("shipping")}>← Voltar</button>
              <button type="submit" className="btn checkout-next-btn checkout-submit" disabled={pending}>
                {pending ? "Criando pedido…" : `Criar pedido · ${money(total)}`}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── Right: Order summary ── */}
      <aside className="checkout-summary-panel" aria-label="Resumo do pedido">
        <h2 className="checkout-summary-title">Resumo</h2>
        <div className="checkout-summary-list">
          {items.map((item) => (
            <article className="checkout-summary-item" key={item.variant_id ?? item.product_id}>
              {item.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={item.image} alt={item.name} />
                : <div className="checkout-summary-thumb" />}
              <div>
                <strong>{item.name}</strong>
                <span>{item.quantity} × {money(item.price_cents)}</span>
              </div>
              <b>{money(item.price_cents * item.quantity)}</b>
            </article>
          ))}
        </div>
        <div className="checkout-summary-lines">
          <div className="checkout-total-line">
            <span>Subtotal</span><strong>{money(subtotal)}</strong>
          </div>
          {discount > 0 && (
            <div className="checkout-total-line checkout-discount-line">
              <span>Desconto</span><strong>− {money(discount)}</strong>
            </div>
          )}
          {selectedQuote && (
            <div className="checkout-total-line">
              <span>Frete</span>
              <strong>{couponResult?.free_shipping ? "Grátis" : money(shippingCents)}</strong>
            </div>
          )}
          <div className="checkout-total-line checkout-grand-total">
            <span>Total</span><strong>{money(total)}</strong>
          </div>
        </div>
        {selectedQuote && (
          <p className="checkout-summary-delivery">
            🚚 {selectedQuote.carrier} — {selectedQuote.service_name} ·{" "}
            {selectedQuote.days_min === selectedQuote.days
              ? `${selectedQuote.days} dias úteis`
              : `${selectedQuote.days_min}–${selectedQuote.days} dias úteis`}
          </p>
        )}
      </aside>
    </div>
  );
}
