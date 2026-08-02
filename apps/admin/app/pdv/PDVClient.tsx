"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPDVOrder, type PDVProduct, type PDVVariant, type PDVCartItem, type PDVOrderPayment } from "./pdv-actions";

// ── helpers ───────────────────────────────────────────────────────────────────

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// ── tipos locais ──────────────────────────────────────────────────────────────

interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  variantSku: string | null;
  quantity: number;
  unitPrice: number; // cents
}

type PayStep = "cart" | "pay" | "done";

// ── Componente principal ──────────────────────────────────────────────────────

export function PDVClient({
  products,
  staffName,
}: {
  products: PDVProduct[];
  staffName: string;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<PayStep>("cart");
  const [lastOrder, setLastOrder] = useState<{ id: string; number: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pagamento
  const [payMethod, setPayMethod] = useState<"cash" | "credit" | "debit" | "pix">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [pdvNotes, setPdvNotes] = useState("");

  // Scanner barcode HID
  const barcodeBuffer = useRef<string>("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cashVal = Math.round(parseFloat(cashReceived.replace(",", ".") || "0") * 100);
  const change = payMethod === "cash" ? Math.max(0, cashVal - subtotal) : 0;

  // ── produto lookup ────────────────────────────────────────────────────────

  /** Busca variante por barcode ou SKU */
  const findVariantByCode = useCallback(
    (code: string): { product: PDVProduct; variant: PDVVariant } | null => {
      for (const product of products) {
        for (const v of product.variants) {
          if (
            (v.barcode && v.barcode.toLowerCase() === code.toLowerCase()) ||
            (v.sku && v.sku.toLowerCase() === code.toLowerCase())
          ) {
            return { product, variant: v };
          }
        }
      }
      return null;
    },
    [products]
  );

  // ── carrinho ──────────────────────────────────────────────────────────────

  const addToCart = useCallback(
    (product: PDVProduct, variant: PDVVariant, qty = 1) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.variantId === variant.id);
        if (existing) {
          return prev.map((i) =>
            i.variantId === variant.id ? { ...i, quantity: i.quantity + qty } : i
          );
        }
        return [
          ...prev,
          {
            variantId: variant.id,
            productId: product.id,
            productName: product.name,
            variantName: variant.name,
            variantSku: variant.sku,
            quantity: qty,
            unitPrice: variant.price_cents,
          },
        ];
      });
    },
    []
  );

  const removeFromCart = (variantId: string) =>
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));

  const changeQty = (variantId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((i) => (i.variantId === variantId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );

  // ── HID barcode scanner ───────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignora se o foco está em algum input que não seja o campo de busca
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isSearchFocused = document.activeElement === searchRef.current;

      if (tag === "input" && !isSearchFocused) return;
      if (tag === "textarea") return;

      // Enter = bipe completo → processa o buffer
      if (e.key === "Enter") {
        const code = barcodeBuffer.current.trim();
        barcodeBuffer.current = "";
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);

        if (code.length >= 4) {
          const found = findVariantByCode(code);
          if (found) {
            addToCart(found.product, found.variant);
            setSearch("");
            if (isSearchFocused) searchRef.current?.blur();
          }
        }
        return;
      }

      // Acumula caracteres
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        // Reset automático se não vier Enter em 120ms (digitação humana normal)
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 120);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [findVariantByCode, addToCart]);

  // ── busca manual ──────────────────────────────────────────────────────────

  const filteredProducts = search.trim()
    ? products.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.variants.some(
            (v) =>
              v.sku?.toLowerCase().includes(q) ||
              v.barcode?.toLowerCase().includes(q) ||
              v.name?.toLowerCase().includes(q)
          )
        );
      })
    : products;

  // ── finalizar venda ───────────────────────────────────────────────────────

  async function finalizeSale() {
    if (cart.length === 0) return;
    if (payMethod === "cash" && cashVal < subtotal) {
      setErr("Valor recebido insuficiente.");
      return;
    }
    setErr(null);
    setSubmitting(true);

    const items: PDVCartItem[] = cart.map((i) => ({
      variant_id: i.variantId,
      product_id: i.productId,
      product_name: i.productName,
      variant_sku: i.variantSku,
      quantity: i.quantity,
      unit_price_cents: i.unitPrice,
      total_cents: i.unitPrice * i.quantity,
    }));

    const payments: PDVOrderPayment[] = [
      {
        method: payMethod,
        amount_cents: payMethod === "cash" ? cashVal : subtotal,
        change_cents: change,
      },
    ];

    const result = await createPDVOrder(items, payments, customerName || undefined, pdvNotes || undefined);
    setSubmitting(false);

    if (!result.ok) {
      setErr(result.error ?? "Erro ao finalizar venda.");
      return;
    }

    setLastOrder({ id: result.orderId!, number: result.orderNumber! });
    setStep("done");
    setCart([]);
    setSearch("");
    setCashReceived("");
    setCustomerName("");
    setPdvNotes("");
  }

  function newSale() {
    setStep("cart");
    setLastOrder(null);
    setErr(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* ── HEADER ── */}
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/" style={{ color: "var(--gold-light)", fontSize: 13, textDecoration: "none", opacity: 0.75 }}>
            ← Admin
          </Link>
          <span className="eyebrow" style={{ letterSpacing: 3 }}>PDV · Ponto de Venda</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>· {staffName}</span>
        </div>
      </header>

      {/* ── DONE ── */}
      {step === "done" && lastOrder ? (
        <div style={styles.donePanel}>
          <div className="glass" style={{ maxWidth: 420, margin: "0 auto", padding: "48px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 className="display" style={{ fontSize: 32, marginBottom: 8 }}>Venda concluída!</h2>
            <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>Pedido <strong style={{ color: "var(--gold-light)" }}>#{lastOrder.number}</strong> registrado com sucesso.</p>
            {change > 0 ? (
              <div style={styles.changeBadge}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>TROCO</span>
                <span className="display" style={{ fontSize: 36, color: "#4ade80" }}>{money(change)}</span>
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
              <button className="btn btn-gold" style={{ padding: "13px 28px" }} onClick={newSale}>
                + Nova venda
              </button>
              <Link href={`/vendas/${lastOrder.id}`} className="btn btn-ghost" style={{ padding: "13px 20px" }}>
                Ver pedido
              </Link>
            </div>
          </div>
        </div>
      ) : step === "pay" ? (
        /* ── PAGAMENTO ── */
        <div style={styles.payPanel}>
          <div className="glass" style={{ maxWidth: 480, margin: "0 auto", padding: "36px 36px" }}>
            <button
              type="button"
              onClick={() => { setStep("cart"); setErr(null); }}
              style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 13, marginBottom: 24 }}
            >
              ← Voltar ao carrinho
            </button>

            <p className="eyebrow" style={{ marginBottom: 20 }}>Forma de pagamento</p>

            {/* Total */}
            <div style={styles.totalBox}>
              <span className="muted" style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Total</span>
              <span className="display" style={{ fontSize: 42, color: "var(--gold-light)", lineHeight: 1 }}>{money(subtotal)}</span>
            </div>

            {/* Métodos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {(["cash", "pix", "credit", "debit"] as const).map((m) => {
                const labels: Record<string, string> = { cash: "💵 Dinheiro", pix: "📱 PIX", credit: "💳 Crédito", debit: "💳 Débito" };
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    style={{
                      ...styles.payMethodBtn,
                      ...(payMethod === m ? styles.payMethodBtnActive : {}),
                    }}
                  >
                    {labels[m]}
                  </button>
                );
              })}
            </div>

            {/* Campo troco para dinheiro */}
            {payMethod === "cash" ? (
              <div className="field" style={{ marginBottom: 18 }}>
                <span className="field-label">Valor recebido (R$)</span>
                <input
                  className="input"
                  style={{ fontSize: 22, textAlign: "right", height: 56 }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  autoFocus
                />
                {cashVal > 0 && change > 0 ? (
                  <div style={{ ...styles.changeBadge, marginTop: 10 }}>
                    <span style={{ fontSize: 11, opacity: 0.75 }}>TROCO</span>
                    <span className="display" style={{ fontSize: 26, color: "#4ade80" }}>{money(change)}</span>
                  </div>
                ) : cashVal > 0 && cashVal < subtotal ? (
                  <p style={{ color: "#e8a0a0", fontSize: 12, marginTop: 8 }}>
                    Faltam {money(subtotal - cashVal)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Cliente e observações (opcionais) */}
            <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
              <div className="field">
                <span className="field-label">Nome do cliente (opcional)</span>
                <input
                  className="input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ex: Maria Silva"
                />
              </div>
              <div className="field">
                <span className="field-label">Observações (opcional)</span>
                <input
                  className="input"
                  value={pdvNotes}
                  onChange={(e) => setPdvNotes(e.target.value)}
                  placeholder="ex: embrulho para presente"
                />
              </div>
            </div>

            {err ? <p style={{ color: "#e8a0a0", fontSize: 13, marginBottom: 12 }}>⚠️ {err}</p> : null}

            <button
              type="button"
              className="btn btn-gold"
              style={{ width: "100%", padding: "16px", fontSize: 15, fontWeight: 800 }}
              disabled={submitting || (payMethod === "cash" && cashVal < subtotal)}
              onClick={finalizeSale}
            >
              {submitting ? "Processando…" : `✓ Confirmar venda · ${money(subtotal)}`}
            </button>
          </div>
        </div>
      ) : (
        /* ── TELA PRINCIPAL: produtos + carrinho ── */
        <div style={styles.main}>
          {/* Coluna esquerda: catálogo */}
          <div style={styles.catalogCol}>
            {/* Busca / barcode */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                ref={searchRef}
                className="input"
                style={{ paddingLeft: 38, fontSize: 14 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto ou bipe o código de barras…"
                autoFocus
              />
            </div>

            {/* Grid de produtos */}
            {filteredProducts.length === 0 ? (
              <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 40 }}>
                Nenhum produto encontrado.
              </p>
            ) : (
              <div style={styles.productGrid}>
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={(variant) => addToCart(product, variant)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Coluna direita: carrinho */}
          <aside style={styles.cartCol}>
            <div className="glass" style={{ height: "100%", display: "flex", flexDirection: "column", padding: 20, borderRadius: 16 }}>
              <p className="eyebrow" style={{ marginBottom: 14 }}>🛒 Carrinho</p>

              {cart.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>
                    Bipe um produto ou selecione ao lado
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 8, marginBottom: 12 }}>
                    {cart.map((item) => (
                      <CartRow
                        key={item.variantId}
                        item={item}
                        onChangeQty={(delta) => changeQty(item.variantId, delta)}
                        onRemove={() => removeFromCart(item.variantId)}
                      />
                    ))}
                  </div>

                  {/* Total */}
                  <div style={styles.cartTotal}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: 12 }}>{cart.reduce((s, i) => s + i.quantity, 0)} item(s)</span>
                      <span className="display" style={{ fontSize: 28, color: "var(--gold-light)" }}>{money(subtotal)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-gold"
                      style={{ width: "100%", marginTop: 14, padding: "14px", fontSize: 14, fontWeight: 800 }}
                      onClick={() => { setErr(null); setStep("pay"); }}
                    >
                      Avançar para pagamento →
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ width: "100%", marginTop: 8, padding: "10px", fontSize: 12 }}
                      onClick={() => setCart([])}
                    >
                      Limpar carrinho
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onAdd,
}: {
  product: PDVProduct;
  onAdd: (variant: PDVVariant) => void;
}) {
  const defaultVariant = product.variants[0];
  const hasMultiple = product.variants.length > 1;
  const [selected, setSelected] = useState(defaultVariant?.id ?? "");

  const variant = product.variants.find((v) => v.id === selected) ?? defaultVariant;
  if (!variant) return null;

  return (
    <div
      className="glass"
      style={styles.productCard}
      onClick={() => onAdd(variant)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onAdd(variant)}
    >
      {/* Imagem */}
      <div style={styles.productImg}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
        ) : (
          <span style={{ fontSize: 28, opacity: 0.3 }}>🌿</span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, color: "var(--cream)" }}>
          {product.name}
        </p>

        {hasMultiple ? (
          <select
            className="input"
            style={{ fontSize: 11, padding: "4px 8px", height: 28, marginBottom: 6 }}
            value={selected}
            onChange={(e) => { e.stopPropagation(); setSelected(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
          >
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name ?? v.sku ?? "Padrão"} — {money(v.price_cents)}</option>
            ))}
          </select>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--gold-light)" }}>{money(variant.price_cents)}</span>
          <span className="muted" style={{ fontSize: 10 }}>est. {variant.stock}</span>
        </div>
      </div>
    </div>
  );
}

function CartRow({
  item,
  onChangeQty,
  onRemove,
}: {
  item: CartItem;
  onChangeQty: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div style={styles.cartRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.productName}
        </p>
        {item.variantName ? <p className="muted" style={{ fontSize: 10, margin: "2px 0 0" }}>{item.variantName}</p> : null}
        <p style={{ fontSize: 11, color: "var(--gold-light)", margin: "2px 0 0" }}>{money(item.unitPrice * item.quantity)}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" style={styles.qtyBtn} onClick={() => onChangeQty(-1)}>−</button>
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
        <button type="button" style={styles.qtyBtn} onClick={() => onChangeQty(1)}>+</button>
        <button
          type="button"
          style={{ ...styles.qtyBtn, color: "#e8a0a0", marginLeft: 4 }}
          onClick={onRemove}
          title="Remover"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Estilos inline (glassmorfismo Flora) ─────────────────────────────────────

const styles = {
  root: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column" as const,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 28px",
    borderBottom: "1px solid var(--glass-border)",
    backdropFilter: "blur(12px)",
    background: "rgba(20,16,12,0.7)",
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
  },
  main: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: 20,
    flex: 1,
    padding: "20px 24px",
    minHeight: 0,
  },
  catalogCol: {
    overflowY: "auto" as const,
    paddingBottom: 40,
  },
  cartCol: {
    position: "sticky" as const,
    top: 64,
    height: "calc(100vh - 84px)",
    display: "flex",
    flexDirection: "column" as const,
  },
  searchIcon: {
    position: "absolute" as const,
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 15,
    pointerEvents: "none" as const,
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  productCard: {
    cursor: "pointer",
    borderRadius: 12,
    overflow: "hidden",
    transition: "transform 0.12s, box-shadow 0.12s",
    userSelect: "none" as const,
  },
  productImg: {
    height: 110,
    background: "rgba(242,236,223,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cartTotal: {
    borderTop: "1px solid var(--glass-border)",
    paddingTop: 14,
  },
  cartRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    background: "rgba(242,236,223,0.05)",
    borderRadius: 8,
    border: "1px solid var(--glass-border)",
  },
  qtyBtn: {
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(242,236,223,0.08)",
    border: "1px solid var(--glass-border)",
    borderRadius: 6,
    color: "var(--cream)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    padding: 0,
  },
  payPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  },
  donePanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  },
  totalBox: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    padding: "20px",
    background: "rgba(185,146,77,0.08)",
    borderRadius: 12,
    border: "1px solid rgba(185,146,77,0.25)",
    marginBottom: 24,
  },
  payMethodBtn: {
    padding: "12px 10px",
    borderRadius: 10,
    border: "1px solid var(--glass-border)",
    background: "rgba(242,236,223,0.05)",
    color: "var(--cream)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.15s",
  },
  payMethodBtnActive: {
    background: "rgba(185,146,77,0.2)",
    border: "1px solid var(--gold)",
    color: "var(--gold-light)",
  },
  changeBadge: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    padding: "14px",
    background: "rgba(74,222,128,0.08)",
    borderRadius: 10,
    border: "1px solid rgba(74,222,128,0.25)",
  },
};
