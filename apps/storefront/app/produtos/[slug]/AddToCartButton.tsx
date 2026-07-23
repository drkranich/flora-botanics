"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCart, type CartItem } from "@/lib/cart";

export function AddToCartButton({
  item,
  disabled,
  disabledLabel = "Indisponível",
}: {
  item: CartItem;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  function add() {
    setAdded(false);
    startTransition(async () => {
      await addToCart(item);
      setAdded(true);
    });
  }

  return (
    <div className="product-buy-box">
      <button
        type="button"
        className="btn product-buy-button"
        disabled={disabled || pending}
        onClick={add}
      >
        {pending ? "Adicionando..." : disabled ? disabledLabel : "Adicionar a sacola"}
      </button>
      {added ? (
        <Link href="/carrinho" className="product-cart-link">
          Ver sacola
        </Link>
      ) : null}
    </div>
  );
}
