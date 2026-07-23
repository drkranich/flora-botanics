"use client";

import { useMemo, useState } from "react";
import type { KitProduct } from "./page";
import { addToCart } from "@/lib/cart";

// ─── Regras de desconto progressivo ──────────────────────────────────────────
// Configuráveis via CMS (packaging_types / admin) — aqui são os defaults.
const DISCOUNT_TIERS = [
  { min: 2, label: "2 itens", percent: 5 },
  { min: 3, label: "3 itens", percent: 10 },
  { min: 4, label: "4+ itens", percent: 15 },
];

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getDiscount(totalQty: number) {
  return [...DISCOUNT_TIERS].reverse().find((t) => totalQty >= t.min) ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KitBuilder({ products }: { products: KitProduct[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [isGift, setIsGift] = useState(false);

  const totalQty = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + q, 0),
    [quantities]
  );

  const subtotal = useMemo(
    () =>
      products.reduce((sum, p) => {
        const qty = quantities[p.id] ?? 0;
        return sum + p.price_cents * qty;
      }, 0),
    [products, quantities]
  );

  const discount = getDiscount(totalQty);
  const discountAmount = discount ? Math.round(subtotal * discount.percent / 100) : 0;
  const total = subtotal - discountAmount;

  const selectedProducts = products.filter((p) => (quantities[p.id] ?? 0) > 0);

  function setQty(productId: string, qty: number) {
    setAdded(false);
    setQuantities((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }

  function handleAddToCart() {
    if (selectedProducts.length === 0) return;
    for (const p of selectedProducts) {
      const qty = quantities[p.id] ?? 0;
      if (qty <= 0) continue;
      addToCart({
        product_id: p.id,
        variant_id: p.variant_id,
        name: p.name,
        slug: p.slug,
        image: p.image_url ?? undefined,
        price_cents: p.price_cents,
        quantity: qty,
      });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  }

  const nextTier = DISCOUNT_TIERS.find((t) => totalQty < t.min);

  return (
    <div className="kit-builder">
      {/* ── Discount progress bar ── */}
      <div className="kit-discount-bar">
        {DISCOUNT_TIERS.map((tier) => (
          <div
            key={tier.min}
            className={`kit-discount-tier${totalQty >= tier.min ? " is-active" : ""}`}
          >
            <span className="kit-discount-pct">{tier.percent}%</span>
            <span className="kit-discount-label">{tier.label}</span>
          </div>
        ))}
        {nextTier && totalQty > 0 && (
          <p className="kit-discount-hint">
            Adicione mais {nextTier.min - totalQty} {nextTier.min - totalQty === 1 ? "item" : "itens"} para {nextTier.percent}% de desconto
          </p>
        )}
      </div>

      <div className="kit-builder-body">
        {/* ── Product selection ── */}
        <div className="kit-product-grid">
          {products.map((p) => {
            const qty = quantities[p.id] ?? 0;
            return (
              <article
                key={p.id}
                className={`kit-product-card${qty > 0 ? " is-selected" : ""}`}
              >
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="kit-product-img" />
                ) : (
                  <div className="kit-product-img kit-product-img-placeholder" />
                )}
                <div className="kit-product-info">
                  <h3 className="kit-product-name">{p.name}</h3>
                  {p.subtitle && <p className="kit-product-subtitle">{p.subtitle}</p>}
                  <span className="kit-product-price">{money(p.price_cents)}</span>
                </div>
                <div className="kit-product-qty">
                  <button
                    type="button"
                    className="kit-qty-btn"
                    aria-label="Remover"
                    onClick={() => setQty(p.id, qty - 1)}
                    disabled={qty === 0}
                  >−</button>
                  <span className="kit-qty-value" aria-live="polite">{qty}</span>
                  <button
                    type="button"
                    className="kit-qty-btn"
                    aria-label="Adicionar"
                    onClick={() => setQty(p.id, qty + 1)}
                  >+</button>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Summary sidebar ── */}
        <aside className="kit-summary">
          <h2 className="kit-summary-title">Seu kit</h2>

          {selectedProducts.length === 0 ? (
            <p className="kit-summary-empty">Selecione os produtos acima para montar seu kit.</p>
          ) : (
            <>
              <ul className="kit-summary-list">
                {selectedProducts.map((p) => (
                  <li key={p.id} className="kit-summary-item">
                    <span>{quantities[p.id]}× {p.name}</span>
                    <span>{money(p.price_cents * (quantities[p.id] ?? 0))}</span>
                  </li>
                ))}
              </ul>

              <div className="kit-summary-totals">
                <div className="kit-total-line">
                  <span>Subtotal ({totalQty} {totalQty === 1 ? "item" : "itens"})</span>
                  <span>{money(subtotal)}</span>
                </div>
                {discount && (
                  <div className="kit-total-line kit-discount-line">
                    <span>Desconto {discount.percent}%</span>
                    <span>− {money(discountAmount)}</span>
                  </div>
                )}
                <div className="kit-total-line kit-grand-total">
                  <strong>Total</strong>
                  <strong>{money(total)}</strong>
                </div>
              </div>

              {/* Gift option */}
              <label className="kit-gift-toggle">
                <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                <span>Embalagem de presente 🎁</span>
              </label>
              {isGift && (
                <label className="kit-gift-message">
                  <span>Mensagem do cartão</span>
                  <textarea
                    rows={3}
                    maxLength={200}
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Escreva uma mensagem especial…"
                  />
                  <span className="kit-gift-counter">{giftMessage.length}/200</span>
                </label>
              )}

              <button
                type="button"
                className={`btn kit-add-btn${added ? " is-added" : ""}`}
                onClick={handleAddToCart}
              >
                {added ? "✓ Adicionado ao carrinho!" : "Adicionar ao carrinho"}
              </button>
              {added && (
                <a href="/carrinho" className="kit-go-cart">Ver carrinho →</a>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
