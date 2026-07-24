"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCart, type CartItem } from "@/lib/cart";

interface KitActionsProps {
  item: Omit<CartItem, "gift_wrap" | "note">;
  disabled?: boolean;
  disabledLabel?: string;
  kitAvailable: number;
}

export function KitActions({ item, disabled, disabledLabel = "Kit indisponível", kitAvailable }: KitActionsProps) {
  const [giftWrap, setGiftWrap] = useState(false);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  function add() {
    setAdded(false);
    startTransition(async () => {
      await addToCart({
        ...item,
        gift_wrap: giftWrap || undefined,
        note: giftWrap ? "Embalagem para presente solicitada." : undefined,
      });
      setAdded(true);
    });
  }

  return (
    <div className="kit-actions-block">
      {/* gift wrap */}
      <label className="kit-gift-wrap-option">
        <span className="kit-gift-wrap-checkbox-wrap">
          <input
            type="checkbox"
            checked={giftWrap}
            onChange={(e) => setGiftWrap(e.target.checked)}
            aria-label="Adicionar embalagem para presente"
          />
          <span className="kit-gift-wrap-checkmark" aria-hidden>
            {giftWrap ? "✓" : ""}
          </span>
        </span>
        <span className="kit-gift-wrap-label">
          <strong>Embalagem para presente</strong>
          <span>Tecido, laço e cartão personalizado inclusos</span>
        </span>
        <span className="kit-gift-wrap-badge">Grátis</span>
      </label>

      {/* add to cart */}
      <div className="product-buy-box">
        <button
          type="button"
          className="btn product-buy-button"
          disabled={disabled || pending}
          onClick={add}
        >
          {pending
            ? "Adicionando..."
            : disabled
            ? disabledLabel
            : giftWrap
            ? "Adicionar como presente 🎁"
            : "Adicionar a sacola"}
        </button>
        {added ? (
          <Link href="/carrinho" className="product-cart-link">
            Ver sacola
          </Link>
        ) : null}
      </div>

      {kitAvailable > 0 && kitAvailable <= 5 ? (
        <p className="kit-low-stock">
          ⚠️ Apenas <strong>{kitAvailable} kit{kitAvailable > 1 ? "s" : ""}</strong> em estoque
        </p>
      ) : null}
    </div>
  );
}
