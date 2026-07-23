"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import {
  calcSubtotal,
  clearLocalCart,
  getLocalCart,
  getSessionId,
  syncCart,
  type CartItem,
} from "@/lib/cart";

interface CheckoutResult {
  ok?: boolean;
  error?: string;
  order_number?: number;
  subtotal_cents?: number;
  discount_cents?: number;
  shipping_cents?: number;
  total_cents?: number;
  currency?: string;
}

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function CheckoutPanel() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const [customer, setCustomer] = useState({
    email: "",
    name: "",
    phone: "",
    acceptsMarketing: true,
  });
  const [address, setAddress] = useState({
    recipient: "",
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "SP",
  });
  const [couponCode, setCouponCode] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setItems(getLocalCart());
    setSessionId(getSessionId());
  }, []);

  const subtotal = useMemo(() => calcSubtotal(items), [items]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (items.length === 0) {
      setError("Sua sacola está vazia.");
      return;
    }

    startTransition(async () => {
      const synced = await syncCart({
        customer_email: customer.email,
        customer_name: customer.name,
      });
      if (Array.isArray(synced)) setItems(synced);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId || getSessionId(),
          coupon_code: couponCode.trim().toUpperCase() || null,
          notes: notes.trim() || null,
          customer: {
            email: customer.email,
            name: customer.name,
            phone: customer.phone,
            accepts_marketing: customer.acceptsMarketing,
          },
          shipping_address: {
            recipient: address.recipient || customer.name,
            street: address.street,
            number: address.number,
            complement: address.complement,
            district: address.district,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: "BR",
          },
        }),
      });

      const data = (await res.json().catch(() => null)) as CheckoutResult | null;

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Não foi possível finalizar o pedido.");
        return;
      }

      clearLocalCart();
      setItems([]);
      setResult(data);
    });
  }

  if (result?.ok) {
    return (
      <section className="checkout-success-card">
        <span className="eyebrow">Pedido recebido</span>
        <h1>Pedido #{result.order_number} criado</h1>
        <p>
          Sua compra ficou registrada no sistema. O pagamento online entra na próxima etapa de integração
          com a Stripe; por enquanto o pedido nasce como pendente para acompanhamento no painel.
        </p>
        <div className="checkout-total-line">
          <span>Total do pedido</span>
          <strong>{money(Number(result.total_cents ?? 0), result.currency ?? "BRL")}</strong>
        </div>
        <div className="cart-actions-row">
          <Link href="/conta" className="btn">
            Acompanhar na conta
          </Link>
          <Link href="/produtos" className="btn btn-secondary">
            Voltar ao catálogo
          </Link>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="checkout-empty-card">
        <span className="eyebrow">Checkout</span>
        <h1>Sua sacola está vazia</h1>
        <p>Adicione um produto antes de finalizar o pedido.</p>
        <Link href="/produtos" className="btn">
          Ver catálogo
        </Link>
      </section>
    );
  }

  return (
    <form className="checkout-grid" onSubmit={submit}>
      <section className="checkout-panel">
        <span className="eyebrow">Checkout Flora</span>
        <h1>Dados para finalizar</h1>
        <p className="checkout-copy">
          O pedido é recalculado no servidor antes de ser criado. Assim preço, cupom e produtos vêm do
          catálogo publicado, não do navegador.
        </p>

        <div className="checkout-section">
          <h2>Contato</h2>
          <div className="checkout-field-grid">
            <label className="checkout-field">
              <span>E-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={customer.email}
                onChange={(e) => setCustomer((current) => ({ ...current, email: e.target.value }))}
              />
            </label>
            <label className="checkout-field">
              <span>Nome</span>
              <input
                required
                autoComplete="name"
                value={customer.name}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomer((current) => ({ ...current, name: value }));
                  setAddress((current) => ({
                    ...current,
                    recipient: current.recipient || value,
                  }));
                }}
              />
            </label>
            <label className="checkout-field">
              <span>Telefone</span>
              <input
                autoComplete="tel"
                value={customer.phone}
                onChange={(e) => setCustomer((current) => ({ ...current, phone: e.target.value }))}
              />
            </label>
          </div>
          <label className="checkout-checkbox">
            <input
              type="checkbox"
              checked={customer.acceptsMarketing}
              onChange={(e) =>
                setCustomer((current) => ({ ...current, acceptsMarketing: e.target.checked }))
              }
            />
            <span>Receber novidades, recompra e recuperação de carrinho por e-mail.</span>
          </label>
        </div>

        <div className="checkout-section">
          <h2>Entrega</h2>
          <div className="checkout-field-grid">
            <label className="checkout-field checkout-field-wide">
              <span>Destinatário</span>
              <input
                required
                autoComplete="name"
                value={address.recipient}
                onChange={(e) => setAddress((current) => ({ ...current, recipient: e.target.value }))}
              />
            </label>
            <label className="checkout-field">
              <span>CEP</span>
              <input
                required
                inputMode="numeric"
                autoComplete="postal-code"
                value={address.zip}
                onChange={(e) => setAddress((current) => ({ ...current, zip: e.target.value }))}
              />
            </label>
            <label className="checkout-field checkout-field-wide">
              <span>Rua</span>
              <input
                required
                autoComplete="address-line1"
                value={address.street}
                onChange={(e) => setAddress((current) => ({ ...current, street: e.target.value }))}
              />
            </label>
            <label className="checkout-field">
              <span>Número</span>
              <input
                autoComplete="address-line2"
                value={address.number}
                onChange={(e) => setAddress((current) => ({ ...current, number: e.target.value }))}
              />
            </label>
            <label className="checkout-field">
              <span>Complemento</span>
              <input
                value={address.complement}
                onChange={(e) => setAddress((current) => ({ ...current, complement: e.target.value }))}
              />
            </label>
            <label className="checkout-field">
              <span>Bairro</span>
              <input
                value={address.district}
                onChange={(e) => setAddress((current) => ({ ...current, district: e.target.value }))}
              />
            </label>
            <label className="checkout-field">
              <span>Cidade</span>
              <input
                required
                autoComplete="address-level2"
                value={address.city}
                onChange={(e) => setAddress((current) => ({ ...current, city: e.target.value }))}
              />
            </label>
            <label className="checkout-field">
              <span>UF</span>
              <input
                required
                maxLength={2}
                autoComplete="address-level1"
                value={address.state}
                onChange={(e) =>
                  setAddress((current) => ({ ...current, state: e.target.value.toUpperCase() }))
                }
              />
            </label>
          </div>
        </div>

        <div className="checkout-section">
          <h2>Pedido</h2>
          <div className="checkout-field-grid">
            <label className="checkout-field">
              <span>Cupom</span>
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="FLORA10"
                autoComplete="off"
              />
            </label>
            <label className="checkout-field checkout-field-wide">
              <span>Observação</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alguma orientação para o pedido?"
              />
            </label>
          </div>
        </div>

        {error ? <p className="checkout-error">{error}</p> : null}

        <button type="submit" className="btn checkout-submit" disabled={pending}>
          {pending ? "Criando pedido..." : "Criar pedido"}
        </button>
      </section>

      <aside className="checkout-summary-panel" aria-label="Resumo do pedido">
        <span className="eyebrow">Sacola</span>
        <h2>Resumo</h2>
        <div className="checkout-summary-list">
          {items.map((item) => (
            <article className="checkout-summary-item" key={item.variant_id ?? item.product_id}>
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.name} />
              ) : (
                <div className="checkout-summary-thumb" />
              )}
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} x {money(item.price_cents)}
                </span>
              </div>
              <b>{money(item.price_cents * item.quantity)}</b>
            </article>
          ))}
        </div>
        <div className="checkout-total-line">
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <p className="checkout-summary-note">
          Cupom e endereço são validados no envio. Frete e pagamento Stripe entram na próxima etapa.
        </p>
      </aside>
    </form>
  );
}
