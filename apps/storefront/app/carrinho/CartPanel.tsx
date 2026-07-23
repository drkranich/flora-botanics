"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  calcSubtotal,
  captureEmail,
  getLocalCart,
  removeFromCart,
  updateQuantity,
  type CartItem,
} from "@/lib/cart";

const FREE_SHIPPING_TARGET_CENTS = 29900;

type CouponState =
  | { status: "idle"; code: ""; discount_cents: 0; free_shipping: false; message: "" }
  | { status: "checking"; code: string; discount_cents: 0; free_shipping: false; message: string }
  | { status: "valid"; code: string; discount_cents: number; free_shipping: boolean; message: string }
  | { status: "error"; code: string; discount_cents: 0; free_shipping: false; message: string };

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CartPanel() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [email, setEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponState>({
    status: "idle",
    code: "",
    discount_cents: 0,
    free_shipping: false,
    message: "",
  });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(getLocalCart());
  }, []);

  const subtotal = useMemo(() => calcSubtotal(items), [items]);
  const discount = coupon.status === "valid" ? coupon.discount_cents : 0;
  const estimatedTotal = Math.max(subtotal - discount, 0);
  const freeShippingRemaining = Math.max(FREE_SHIPPING_TARGET_CENTS - subtotal, 0);
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_TARGET_CENTS) * 100));

  function setQty(item: CartItem, quantity: number) {
    startTransition(async () => {
      const next = await updateQuantity(item.product_id, quantity, item.variant_id);
      setItems(next);
    });
  }

  function remove(item: CartItem) {
    startTransition(async () => {
      const next = await removeFromCart(item.product_id, item.variant_id);
      setItems(next);
    });
  }

  function saveEmail(formData: FormData) {
    const value = String(formData.get("email") ?? "").trim();
    if (!value) return;

    setEmailMessage("");
    startTransition(async () => {
      await captureEmail(value);
      setEmail(value);
      setEmailMessage("E-mail salvo para recuperar sua sacola.");
    });
  }

  function applyCoupon(formData: FormData) {
    const code = String(formData.get("coupon") ?? "").trim().toUpperCase();
    if (!code) {
      setCoupon({
        status: "error",
        code: "",
        discount_cents: 0,
        free_shipping: false,
        message: "Informe um cupom.",
      });
      return;
    }

    setCoupon({
      status: "checking",
      code,
      discount_cents: 0,
      free_shipping: false,
      message: "Validando cupom...",
    });

    startTransition(async () => {
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, subtotal_cents: subtotal }),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              ok?: boolean;
              code?: string;
              discount_cents?: number;
              free_shipping?: boolean;
              error?: string;
            }
          | null;

        if (!res.ok || !data?.ok) {
          setCoupon({
            status: "error",
            code,
            discount_cents: 0,
            free_shipping: false,
            message: data?.error ?? "Cupom inválido.",
          });
          return;
        }

        const discountCents = Number(data.discount_cents ?? 0);
        setCoupon({
          status: "valid",
          code: data.code ?? code,
          discount_cents: discountCents,
          free_shipping: Boolean(data.free_shipping),
          message: data.free_shipping
            ? "Frete grátis habilitado para este pedido."
            : `Desconto aplicado: ${money(discountCents)}.`,
        });
      } catch {
        setCoupon({
          status: "error",
          code,
          discount_cents: 0,
          free_shipping: false,
          message: "Não foi possível validar o cupom agora.",
        });
      }
    });
  }

  if (items.length === 0) {
    return (
      <section className="cart-card">
        <span className="eyebrow">Sacola</span>
        <h1>Sua sacola está vazia</h1>
        <p>
          Escolha produtos da rotina Flora Botanics e volte aqui para revisar sua compra.
        </p>
        <Link href="/produtos" className="btn">
          Ver catálogo
        </Link>
      </section>
    );
  }

  return (
    <section className="cart-card">
      <span className="eyebrow">Sacola</span>
      <h1>Revise sua compra</h1>
      <div className="cart-progress-card">
        <div>
          <strong>
            {freeShippingRemaining === 0
              ? "Você atingiu a faixa de frete especial."
              : `Faltam ${money(freeShippingRemaining)} para a faixa de frete especial.`}
          </strong>
          <span>Estimativa visual. O frete final será calculado no checkout.</span>
        </div>
        <div className="cart-progress-track" aria-hidden>
          <i style={{ width: `${freeShippingProgress}%` }} />
        </div>
      </div>
      <div className="cart-list">
        {items.map((item) => (
          <article className="cart-item" key={item.variant_id ?? item.product_id}>
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.name} />
            ) : (
              <div className="cart-item-image" />
            )}
            <div>
              <strong>{item.name}</strong>
              <span>{money(item.price_cents)}</span>
            </div>
            <div className="cart-qty">
              <button type="button" disabled={pending} onClick={() => setQty(item, item.quantity - 1)}>
                -
              </button>
              <span>{item.quantity}</span>
              <button type="button" disabled={pending} onClick={() => setQty(item, item.quantity + 1)}>
                +
              </button>
            </div>
            <button type="button" disabled={pending} className="cart-remove" onClick={() => remove(item)}>
              Remover
            </button>
          </article>
        ))}
      </div>
      <div className="cart-summary">
        <span>Subtotal</span>
        <strong>{money(subtotal)}</strong>
      </div>
      {coupon.status === "valid" && discount > 0 ? (
        <div className="cart-summary cart-summary-soft">
          <span>Cupom {coupon.code}</span>
          <strong>-{money(discount)}</strong>
        </div>
      ) : null}
      {coupon.status === "valid" && coupon.free_shipping ? (
        <div className="cart-summary cart-summary-soft">
          <span>Frete</span>
          <strong>Grátis</strong>
        </div>
      ) : null}
      <div className="cart-summary cart-total">
        <span>Total estimado</span>
        <strong>{money(estimatedTotal)}</strong>
      </div>
      <div className="cart-tools-grid">
        <form action={applyCoupon} className="cart-mini-form">
          <label htmlFor="cart-coupon">Cupom</label>
          <div>
            <input
              id="cart-coupon"
              name="coupon"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="FLORA10"
              autoComplete="off"
            />
            <button type="submit" disabled={pending}>
              Aplicar
            </button>
          </div>
          {coupon.message ? (
            <p className={coupon.status === "error" ? "cart-form-error" : "cart-form-ok"}>{coupon.message}</p>
          ) : null}
        </form>
        <form action={saveEmail} className="cart-mini-form">
          <label htmlFor="cart-email">Salvar sacola por e-mail</label>
          <div>
            <input
              id="cart-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
            />
            <button type="submit" disabled={pending}>
              Salvar
            </button>
          </div>
          {emailMessage ? <p className="cart-form-ok">{emailMessage}</p> : null}
        </form>
      </div>
      <p className="cart-note">
        Checkout com pagamento e frete será ligado ao fluxo final. A sacola já registra atividade para
        carrinhos abandonados e recalcula os preços no servidor.
      </p>
      <div className="cart-actions-row">
        <Link href="/produtos" className="btn btn-secondary">
          Continuar comprando
        </Link>
        <Link href="/conta" className="btn">
          Entrar para finalizar
        </Link>
      </div>
    </section>
  );
}
