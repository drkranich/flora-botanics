"use client";

import { useState, useTransition } from "react";
import { addToCart } from "@/lib/cart";

export function QuickAddToCartButton({
  productId,
  variantId,
  name,
  priceCents,
  image,
}: {
  productId: string;
  variantId?: string;
  name: string;
  priceCents: number;
  image?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending || added) return;
    startTransition(async () => {
      await addToCart({
        product_id: productId,
        variant_id: variantId,
        name,
        price_cents: priceCents,
        quantity: 1,
        image,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    });
  }

  return (
    <button
      type="button"
      className="quick-add-btn"
      disabled={pending}
      onClick={handleAdd}
      aria-label={`Adicionar ${name} à sacola`}
    >
      {pending ? "Adicionando…" : added ? "Adicionado ✓" : "Adicionar à sacola"}
    </button>
  );
}
