"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  calcSubtotal,
  getLocalCart,
  removeFromCart,
  updateQuantity,
  type CartItem,
} from "@/lib/cart";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CartPanel() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(getLocalCart());
  }, []);

  const subtotal = useMemo(() => calcSubtotal(items), [items]);

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

  if (items.length === 0) {
    return (
      <section className="cart-card">
        <span className="eyebrow">Sacola</span>
        <h1>Sua sacola esta vazia</h1>
        <p>
          Escolha produtos da rotina Flora Botanics e volte aqui para revisar sua compra.
        </p>
        <Link href="/produtos" className="btn">
          Ver catalogo
        </Link>
      </section>
    );
  }

  return (
    <section className="cart-card">
      <span className="eyebrow">Sacola</span>
      <h1>Revise sua compra</h1>
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
      <p className="cart-note">
        Checkout com pagamento e frete sera ligado ao fluxo final. Por enquanto, a sacola ja registra
        atividade para carrinhos abandonados.
      </p>
      <Link href="/produtos" className="btn">
        Continuar comprando
      </Link>
    </section>
  );
}
