"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  createPDVOrder,
  type PDVProduct,
  type PDVVariant,
  type PDVCartItem,
  type PDVOrderPayment,
} from "./pdv-actions";
import { buildFloraKraftPDF, openAndPrint } from "@/lib/pdf/template";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function parseCents(s: string) {
  return Math.round(parseFloat(s.replace(",", ".") || "0") * 100);
}

// ── tipos ─────────────────────────────────────────────────────────────────────

interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  variantSku: string | null;
  quantity: number;
  unitPrice: number;
}

interface PayLine {
  method: "cash" | "credit" | "debit" | "pix";
  amountStr: string;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
};

// ── estado do caixa ───────────────────────────────────────────────────────────

interface CaixaState {
  open: boolean;
  openedAt: string | null;
  salesCount: number;
  salesTotal: number; // cents
  fundoCaixa: number; // cents — valor inicial
}

const CAIXA_KEY = "flora_pdv_caixa";

function loadCaixa(): CaixaState {
  if (typeof window === "undefined") return { open: false, openedAt: null, salesCount: 0, salesTotal: 0, fundoCaixa: 0 };
  try {
    const s = localStorage.getItem(CAIXA_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { open: false, openedAt: null, salesCount: 0, salesTotal: 0, fundoCaixa: 0 };
}

function saveCaixa(c: CaixaState) {
  localStorage.setItem(CAIXA_KEY, JSON.stringify(c));
}

// ── componente principal ──────────────────────────────────────────────────────

export function PDVClient({ products, staffName }: { products: PDVProduct[]; staffName: string }) {
  // caixa
  const [caixa, setCaixaRaw] = useState<CaixaState>({ open: false, openedAt: null, salesCount: 0, salesTotal: 0, fundoCaixa: 0 });
  const [fundoStr, setFundoStr] = useState(""); // input fundo de caixa
  const [modal, setModal] = useState<"none" | "open" | "close" | "resumo" | "suprimento" | "sangria" | "receipt">("none");

  // suprimento / sangria
  const [movStr, setMovStr] = useState("");
  const [movObs, setMovObs] = useState("");

  // carrinho
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("__all__");

  // pagamento (tudo inline no carrinho)
  const [payLines, setPayLines] = useState<PayLine[]>([{ method: "cash", amountStr: "" }]);
  const [discountStr, setDiscountStr] = useState("");
  const [discountType, setDiscountType] = useState<"R$" | "%">("R$");
  const [customer, setCustomer] = useState("Consumidor final");
  const [notes, setNotes] = useState("");

  // estado de submit
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{
    number: string; orderId: string;
    items: CartItem[]; subtotal: number; discount: number; total: number;
    payLines: PayLine[]; customer: string; notes: string;
  } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // carrega estado do caixa do localStorage
  useEffect(() => { setCaixaRaw(loadCaixa()); }, []);

  function setCaixa(c: CaixaState) { setCaixaRaw(c); saveCaixa(c); }

  // ── caixa ────────────────────────────────────────────────────────────
  function openCaixa() {
    const next: CaixaState = {
      open: true,
      openedAt: new Date().toISOString(),
      salesCount: 0,
      salesTotal: 0,
      fundoCaixa: parseCents(fundoStr),
    };
    setCaixa(next);
    setFundoStr("");
    setModal("none");
  }

  function closeCaixa() {
    setCaixa({ ...caixa, open: false });
    setModal("none");
  }

  // ── categorias ────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { const c = p.name.trim()[0]?.toUpperCase(); if (c) set.add(c); });
    return Array.from(set).sort();
  }, [products]);

  // ── cálculos ──────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const discountCents = useMemo(() => {
    if (!discountStr) return 0;
    if (discountType === "%") {
      const pct = parseFloat(discountStr.replace(",", ".")) || 0;
      return Math.round((subtotal * Math.min(pct, 100)) / 100);
    }
    return Math.min(parseCents(discountStr), subtotal);
  }, [discountStr, discountType, subtotal]);

  const totalDue = Math.max(0, subtotal - discountCents);

  const totalPaid = useMemo(
    () => payLines.reduce((s, l) => s + parseCents(l.amountStr), 0),
    [payLines]
  );
  const remaining = Math.max(0, totalDue - totalPaid);

  const cashChange = useMemo(() => {
    const cashIn = payLines.filter((l) => l.method === "cash").reduce((s, l) => s + parseCents(l.amountStr), 0);
    const nonCash = payLines.filter((l) => l.method !== "cash").reduce((s, l) => s + parseCents(l.amountStr), 0);
    return Math.max(0, cashIn - Math.max(0, totalDue - nonCash));
  }, [payLines, totalDue]);

  // ── barcode ────────────────────────────────────────────────────────────
  const findVariantByCode = useCallback(
    (code: string): { product: PDVProduct; variant: PDVVariant } | null => {
      for (const p of products) {
        for (const v of p.variants) {
          if ((v.barcode && v.barcode.toLowerCase() === code.toLowerCase()) ||
              (v.sku && v.sku.toLowerCase() === code.toLowerCase())) {
            return { product: p, variant: v };
          }
        }
      }
      return null;
    },
    [products]
  );

  const addToCart = useCallback((product: PDVProduct, variant: PDVVariant, qty = 1) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.variantId === variant.id);
      if (ex) return prev.map((i) => i.variantId === variant.id ? { ...i, quantity: i.quantity + qty } : i);
      return [...prev, {
        variantId: variant.id, productId: product.id,
        productName: product.name, variantName: variant.name,
        variantSku: variant.sku, quantity: qty, unitPrice: variant.price_cents,
      }];
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isSearch = document.activeElement === searchRef.current;
      if (tag === "input" && !isSearch) return;
      if (tag === "textarea") return;

      if (e.key === "Enter") {
        const code = barcodeBuffer.current.trim();
        barcodeBuffer.current = "";
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        if (code.length >= 4) {
          const found = findVariantByCode(code);
          if (found) { addToCart(found.product, found.variant); setSearch(""); }
        }
        return;
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ""; }, 120);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [findVariantByCode, addToCart]);

  // ── filtro ────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== "__all__") list = list.filter((p) => p.name.trim()[0]?.toUpperCase() === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku?.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q) || v.name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, search, activeCategory]);

  // ── pay lines ─────────────────────────────────────────────────────────
  function addPayLine() {
    setPayLines((prev) => {
      const used = new Set(prev.map((l) => l.method));
      const next = (["cash", "pix", "credit", "debit"] as const).find((m) => !used.has(m));
      return next ? [...prev, { method: next, amountStr: "" }] : prev;
    });
  }
  function removePayLine(i: number) { setPayLines((p) => p.length > 1 ? p.filter((_, j) => j !== i) : p); }
  function updatePayLine(i: number, patch: Partial<PayLine>) { setPayLines((p) => p.map((l, j) => j === i ? { ...l, ...patch } : l)); }
  function fillRemaining(i: number) {
    const others = payLines.filter((_, j) => j !== i).reduce((s, l) => s + parseCents(l.amountStr), 0);
    const rem = Math.max(0, totalDue - others);
    if (rem > 0) updatePayLine(i, { amountStr: (rem / 100).toFixed(2).replace(".", ",") });
  }

  // ── finalizar ─────────────────────────────────────────────────────────
  async function finalizeSale() {
    if (!caixa.open) { setErr("Abra o caixa primeiro."); return; }
    if (cart.length === 0) return;
    if (remaining > 0) { setErr(`Falta cobrir ${fmt(remaining)}.`); return; }
    setErr(null);
    setSubmitting(true);

    const items: PDVCartItem[] = cart.map((i) => ({
      variant_id: i.variantId, product_id: i.productId,
      product_name: i.productName, variant_sku: i.variantSku,
      quantity: i.quantity, unit_price_cents: i.unitPrice, total_cents: i.unitPrice * i.quantity,
    }));

    const payments: PDVOrderPayment[] = payLines
      .filter((l) => parseCents(l.amountStr) > 0)
      .map((l) => ({ method: l.method, amount_cents: parseCents(l.amountStr), change_cents: l.method === "cash" ? cashChange : 0 }));

    const res = await createPDVOrder(items, payments, customer || undefined, notes || undefined, discountCents);
    setSubmitting(false);

    if (!res.ok) { setErr(res.error ?? "Erro ao finalizar."); return; }

    // atualiza resumo do caixa
    setCaixa({ ...caixa, salesCount: caixa.salesCount + 1, salesTotal: caixa.salesTotal + totalDue });

    setLastReceipt({
      number: res.orderNumber!,
      orderId: res.orderId!,
      items: [...cart],
      subtotal, discount: discountCents, total: totalDue,
      payLines: [...payLines], customer, notes,
    });
    setModal("receipt");

    // limpa
    setCart([]);
    setSearch("");
    setPayLines([{ method: "cash", amountStr: "" }]);
    setDiscountStr("");
    setNotes("");
    setCustomer("Consumidor final");
  }

  // ── recibo ────────────────────────────────────────────────────────────
  function printReceipt(r = lastReceipt) {
    if (!r) return;
    const rows = r.items.map((i) =>
      `<tr><td>${i.productName}${i.variantName ? ` <small>(${i.variantName})</small>` : ""}</td>
       <td style="text-align:center">${i.quantity}</td>
       <td style="text-align:right">${fmt(i.unitPrice)}</td>
       <td style="text-align:right">${fmt(i.unitPrice * i.quantity)}</td></tr>`
    ).join("");
    const prows = r.payLines.filter((l) => parseCents(l.amountStr) > 0).map((l) =>
      `<tr><td>${METHOD_LABEL[l.method]}</td><td style="text-align:right">${fmt(parseCents(l.amountStr))}</td></tr>`
    ).join("");
    const body = `
      <div class="section"><div class="section-title">Itens</div>
        <table><thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="section"><div class="section-title">Totais</div>
        <table><tbody>
          <tr><td>Subtotal</td><td style="text-align:right">${fmt(r.subtotal)}</td></tr>
          ${r.discount > 0 ? `<tr><td>Desconto</td><td style="text-align:right;color:#2a4a2c">− ${fmt(r.discount)}</td></tr>` : ""}
          <tr style="font-weight:800"><td>Total</td><td style="text-align:right">${fmt(r.total)}</td></tr>
        </tbody></table></div>
      <div class="section"><div class="section-title">Pagamento</div>
        <table><thead><tr><th>Forma</th><th style="text-align:right">Valor</th></tr></thead>
        <tbody>${prows}${cashChange > 0 ? `<tr><td>Troco (dinheiro)</td><td style="text-align:right;color:#2a7a4a">${fmt(cashChange)}</td></tr>` : ""}</tbody></table></div>
      ${r.customer && r.customer !== "Consumidor final" ? `<div class="section"><div class="section-title">Cliente</div><p style="font-size:13px">${r.customer}</p></div>` : ""}
      ${r.notes ? `<div class="notes-box"><strong>Observações</strong>${r.notes}</div>` : ""}`;
    openAndPrint(buildFloraKraftPDF({
      title: `Comprovante de Venda · #${r.number}`,
      subtitle: `Vendedor: ${staffName} · ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      body, maxWidth: 680,
    }));
  }

  // ── render ────────────────────────────────────────────────────────────

  // Tela de caixa fechado
  if (!caixa.open) {
    return (
      <div style={S.root}>
        <div style={S.closedScreen}>
          <div className="glass" style={{ maxWidth: 420, width: "100%", padding: "48px 40px", textAlign: "center", borderRadius: 18 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏪</div>
            <h2 className="display" style={{ fontSize: 28, marginBottom: 8 }}>Caixa fechado</h2>
            <p className="muted" style={{ fontSize: 13, marginBottom: 32 }}>Informe o fundo de caixa para iniciar o turno.</p>
            <div className="field" style={{ marginBottom: 20, textAlign: "left" }}>
              <span className="field-label">Fundo de caixa (R$)</span>
              <input
                className="input"
                style={{ fontSize: 22, textAlign: "right", height: 54 }}
                placeholder="0,00"
                value={fundoStr}
                onChange={(e) => setFundoStr(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && openCaixa()}
                autoFocus
              />
            </div>
            <button className="btn btn-gold" style={{ width: "100%", padding: "16px", fontSize: 15, fontWeight: 800 }} onClick={openCaixa}>
              Abrir caixa
            </button>
            <Link href="/" style={{ display: "block", marginTop: 16, fontSize: 12, color: "var(--cream-dim)", textDecoration: "none", opacity: 0.6 }}>
              ← Voltar ao painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <header style={S.header}>
        {/* Status caixa */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--cream)" }}>Caixa aberto</div>
            <div style={{ fontSize: 10, color: "var(--cream-dim)", opacity: 0.7 }}>
              {caixa.salesCount} venda{caixa.salesCount !== 1 ? "s" : ""} · {fmt(caixa.salesTotal)} · em caixa {fmt(caixa.fundoCaixa + caixa.salesTotal)}
            </div>
          </div>
        </div>

        {/* Ações do caixa */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost" style={S.hdrBtn} onClick={() => setModal("resumo")}>Resumo do dia</button>
          <button className="btn btn-ghost" style={S.hdrBtn} onClick={() => { setMovStr(""); setMovObs(""); setModal("suprimento"); }}>Suprimento</button>
          <button className="btn btn-ghost" style={S.hdrBtn} onClick={() => { setMovStr(""); setMovObs(""); setModal("sangria"); }}>Sangria</button>
          <button style={{ ...S.hdrBtn, background: "rgba(232,100,100,0.15)", border: "1px solid rgba(232,100,100,0.35)", color: "#f87171", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }} onClick={() => setModal("close")}>
            Fechar caixa
          </button>
          <span className="muted" style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>· {staffName}</span>
        </div>
      </header>

      {/* ── CORPO: catálogo + carrinho ─────────────────────────────────── */}
      <div style={S.body}>

        {/* ESQUERDA: busca + categorias + grid */}
        <div style={S.catalogCol}>
          {/* Busca */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            <span style={S.searchIcon}>🔍</span>
            <input
              ref={searchRef}
              className="input"
              style={{ paddingLeft: 38, fontSize: 14, borderRadius: 10 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto ou SKU…"
              autoFocus
            />
          </div>

          {/* Código de barras (visual — scanner HID funciona globalmente) */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ ...S.searchIcon, fontSize: 13 }}>◇</span>
            <input
              className="input"
              style={{ paddingLeft: 38, fontSize: 13, borderRadius: 10, color: "var(--cream-dim)" }}
              placeholder="Código de barras — bipe ou digite…"
              readOnly
            />
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#4ade80", fontWeight: 600 }}>
              ● Leitor pronto
            </span>
          </div>

          {/* Categorias */}
          {categories.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {[{ key: "__all__", label: "Todos" }, ...categories.map((c) => ({ key: c, label: c }))].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setActiveCategory(key)}
                  style={{ ...S.catTab, ...(activeCategory === key ? S.catTabOn : {}) }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {filteredProducts.length === 0 ? (
            <div className="glass" style={{ padding: "60px 24px", textAlign: "center", borderRadius: 14 }}>
              <p className="muted" style={{ fontSize: 13 }}>
                {products.length === 0 ? "Nenhum produto. Cadastre em Catálogo." : "Nenhum produto encontrado."}
              </p>
            </div>
          ) : (
            <div style={S.grid}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={(v) => addToCart(product, v)} />
              ))}
            </div>
          )}
        </div>

        {/* DIREITA: carrinho + pagamento inline */}
        <aside style={S.cartCol}>
          {/* Cliente */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--glass-border)" }}>
            <span style={{ fontSize: 16, opacity: 0.5 }}>👤</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--cream-dim)", opacity: 0.6, marginBottom: 2 }}>Cliente</div>
              <input
                className="input"
                style={{ background: "transparent", border: "none", padding: 0, fontSize: 14, fontWeight: 600, color: "var(--cream)", width: "100%" }}
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Consumidor final"
              />
            </div>
          </div>

          {/* Itens do carrinho */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
            {cart.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: 0.4 }}>
                <span style={{ fontSize: 32 }}>◇</span>
                <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>Toque nos produtos para adicionar</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {cart.map((item) => (
                  <CartRow
                    key={item.variantId}
                    item={item}
                    onQty={(d) => setCart((p) => p.map((i) => i.variantId === item.variantId ? { ...i, quantity: Math.max(1, i.quantity + d) } : i))}
                    onSetQty={(q) => setCart((p) => p.map((i) => i.variantId === item.variantId ? { ...i, quantity: q } : i).filter((i) => i.quantity > 0))}
                    onRemove={() => setCart((p) => p.filter((i) => i.variantId !== item.variantId))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Totais + desconto + pagamento + finalizar */}
          <div style={{ borderTop: "1px solid var(--glass-border)", padding: "12px 14px", display: "grid", gap: 10 }}>

            {/* Subtotal */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>

            {/* Desconto geral */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13, flex: "0 0 auto" }}>Desconto geral</span>
              <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                <button type="button" onClick={() => setDiscountType("R$")}
                  style={{ ...S.discTypeBtn, ...(discountType === "R$" ? S.discTypeBtnOn : {}) }}>R$</button>
                <button type="button" onClick={() => setDiscountType("%")}
                  style={{ ...S.discTypeBtn, ...(discountType === "%" ? S.discTypeBtnOn : {}) }}>%</button>
              </div>
              <input
                className="input"
                style={{ width: 90, textAlign: "right", padding: "6px 10px", fontSize: 13 }}
                placeholder={discountType === "R$" ? "0,00" : "0"}
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
              />
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 22, color: "var(--gold-light)", borderTop: "1px solid var(--glass-border)", paddingTop: 8 }}>
              <span>Total</span>
              <span>{fmt(totalDue)}</span>
            </div>

            {/* Formas de pagamento */}
            <div style={{ display: "grid", gap: 8 }}>
              {payLines.map((line, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--cream-dim)", marginBottom: 3, opacity: 0.7 }}>Forma</div>
                    <select
                      className="input"
                      style={{ fontSize: 13, padding: "7px 10px" }}
                      value={line.method}
                      onChange={(e) => updatePayLine(idx, { method: e.target.value as PayLine["method"] })}
                    >
                      {(["cash", "pix", "credit", "debit"] as const).map((m) => (
                        <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--cream-dim)", marginBottom: 3, opacity: 0.7 }}>Valor R$</div>
                    <input
                      className="input"
                      style={{ textAlign: "right", fontSize: 13, padding: "7px 10px" }}
                      placeholder="0,00"
                      value={line.amountStr}
                      onChange={(e) => updatePayLine(idx, { amountStr: e.target.value })}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 4, paddingBottom: 1 }}>
                    <button type="button" title="Preencher restante" onClick={() => fillRemaining(idx)} style={S.smBtn}>⬇</button>
                    {payLines.length > 1 && (
                      <button type="button" onClick={() => removePayLine(idx)} style={{ ...S.smBtn, color: "#f87171" }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar forma + troco */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {payLines.length < 4 ? (
                <button type="button" onClick={addPayLine} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}>
                  + pagamento
                </button>
              ) : <div />}
              {cashChange > 0 && (
                <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>Troco: {fmt(cashChange)}</div>
              )}
            </div>

            {/* Observações */}
            <input
              className="input"
              style={{ fontSize: 12, padding: "8px 12px" }}
              placeholder="Observações da venda…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {err && <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>⚠️ {err}</p>}

            {/* Segurar + Finalizar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "13px", fontSize: 13 }}
                onClick={() => { setCart([]); setPayLines([{ method: "cash", amountStr: "" }]); setDiscountStr(""); setNotes(""); setCustomer("Consumidor final"); setErr(null); }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-gold"
                style={{ padding: "13px", fontSize: 14, fontWeight: 800, opacity: (submitting || remaining > 0 || cart.length === 0) ? 0.5 : 1 }}
                disabled={submitting || remaining > 0 || cart.length === 0}
                onClick={finalizeSale}
              >
                {submitting ? "Processando…" : "Finalizar"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── MODAIS ────────────────────────────────────────────────────── */}
      {modal !== "none" && (
        <div style={S.overlay} onClick={() => setModal("none")}>
          <div className="glass" style={S.modal} onClick={(e) => e.stopPropagation()}>

            {/* Resumo do dia */}
            {modal === "resumo" && (
              <>
                <h3 style={S.modalTitle}>📊 Resumo do dia</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {[
                    ["Abertura", caixa.openedAt ? new Date(caixa.openedAt).toLocaleTimeString("pt-BR") : "—"],
                    ["Fundo de caixa", fmt(caixa.fundoCaixa)],
                    ["Vendas realizadas", String(caixa.salesCount)],
                    ["Total em vendas", fmt(caixa.salesTotal)],
                    ["Total em caixa", fmt(caixa.fundoCaixa + caixa.salesTotal)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="muted">{k}</span>
                      <span style={{ fontWeight: 700, color: "var(--gold-light)" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost" style={{ width: "100%", marginTop: 20, padding: "11px" }} onClick={() => setModal("none")}>Fechar</button>
              </>
            )}

            {/* Suprimento */}
            {modal === "suprimento" && (
              <>
                <h3 style={S.modalTitle}>⬆ Suprimento de caixa</h3>
                <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>Registra entrada de dinheiro no caixa (ex: troco inicial extra).</p>
                <div className="field" style={{ marginBottom: 12 }}>
                  <span className="field-label">Valor (R$)</span>
                  <input className="input" style={{ textAlign: "right", fontSize: 18 }} placeholder="0,00" value={movStr} onChange={(e) => setMovStr(e.target.value)} autoFocus />
                </div>
                <div className="field" style={{ marginBottom: 20 }}>
                  <span className="field-label">Observação</span>
                  <input className="input" placeholder="ex: troco adicional" value={movObs} onChange={(e) => setMovObs(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button className="btn btn-ghost" style={{ padding: "12px" }} onClick={() => setModal("none")}>Cancelar</button>
                  <button className="btn btn-gold" style={{ padding: "12px" }} onClick={() => {
                    const v = parseCents(movStr);
                    if (v > 0) setCaixa({ ...caixa, fundoCaixa: caixa.fundoCaixa + v });
                    setModal("none");
                  }}>Confirmar</button>
                </div>
              </>
            )}

            {/* Sangria */}
            {modal === "sangria" && (
              <>
                <h3 style={S.modalTitle}>⬇ Sangria de caixa</h3>
                <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>Registra retirada de dinheiro do caixa.</p>
                <div className="field" style={{ marginBottom: 12 }}>
                  <span className="field-label">Valor (R$)</span>
                  <input className="input" style={{ textAlign: "right", fontSize: 18 }} placeholder="0,00" value={movStr} onChange={(e) => setMovStr(e.target.value)} autoFocus />
                </div>
                <div className="field" style={{ marginBottom: 20 }}>
                  <span className="field-label">Motivo</span>
                  <input className="input" placeholder="ex: retirada para depósito" value={movObs} onChange={(e) => setMovObs(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button className="btn btn-ghost" style={{ padding: "12px" }} onClick={() => setModal("none")}>Cancelar</button>
                  <button style={{ padding: "12px", background: "rgba(232,100,100,0.15)", border: "1px solid rgba(232,100,100,0.35)", color: "#f87171", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13 }} onClick={() => {
                    const v = parseCents(movStr);
                    if (v > 0) setCaixa({ ...caixa, fundoCaixa: Math.max(0, caixa.fundoCaixa - v) });
                    setModal("none");
                  }}>Confirmar sangria</button>
                </div>
              </>
            )}

            {/* Fechar caixa */}
            {modal === "close" && (
              <>
                <h3 style={S.modalTitle}>🔒 Fechar caixa</h3>
                <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
                  {[
                    ["Vendas do turno", caixa.salesCount],
                    ["Total em vendas", fmt(caixa.salesTotal)],
                    ["Fundo inicial", fmt(caixa.fundoCaixa)],
                    ["Total esperado em caixa", fmt(caixa.fundoCaixa + caixa.salesTotal)],
                  ].map(([k, v]) => (
                    <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="muted">{k}</span>
                      <span style={{ fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button className="btn btn-ghost" style={{ padding: "12px" }} onClick={() => setModal("none")}>Cancelar</button>
                  <button style={{ padding: "12px", background: "rgba(232,100,100,0.15)", border: "1px solid rgba(232,100,100,0.35)", color: "#f87171", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13 }} onClick={closeCaixa}>
                    Confirmar fechamento
                  </button>
                </div>
              </>
            )}

            {/* Recibo pós-venda */}
            {modal === "receipt" && lastReceipt && (
              <>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
                  <h3 style={{ ...S.modalTitle, textAlign: "center", marginBottom: 4 }}>Venda concluída!</h3>
                  <p className="muted" style={{ fontSize: 13 }}>Pedido <strong style={{ color: "var(--gold-light)" }}>#{lastReceipt.number}</strong></p>
                </div>
                <div style={{ background: "rgba(185,146,77,0.07)", borderRadius: 10, border: "1px solid rgba(185,146,77,0.2)", padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span className="muted">Total cobrado</span>
                    <span style={{ fontWeight: 800, color: "var(--gold-light)" }}>{fmt(lastReceipt.total)}</span>
                  </div>
                  {lastReceipt.payLines.filter((l) => parseCents(l.amountStr) > 0).map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span className="muted">{METHOD_LABEL[l.method]}</span>
                      <span>{fmt(parseCents(l.amountStr))}</span>
                    </div>
                  ))}
                  {cashChange > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(74,222,128,0.2)", color: "#4ade80", fontWeight: 800, fontSize: 18 }}>
                      <span>Troco</span><span>{fmt(cashChange)}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button className="btn btn-gold" style={{ padding: "12px", fontSize: 14, fontWeight: 800 }} onClick={() => setModal("none")}>
                    + Nova venda
                  </button>
                  <button className="btn btn-ghost" style={{ padding: "11px", fontSize: 12 }} onClick={() => printReceipt()}>
                    🖨️ Imprimir recibo
                  </button>
                  <Link href={`/vendas/${lastReceipt.orderId}`} className="btn btn-ghost" style={{ padding: "11px", fontSize: 12, textAlign: "center", textDecoration: "none" }}>
                    Ver pedido →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── subcomponentes ────────────────────────────────────────────────────────────

function ProductCard({ product, onAdd }: { product: PDVProduct; onAdd: (v: PDVVariant) => void }) {
  const [sel, setSel] = useState(product.variants[0]?.id ?? "");
  const variant = product.variants.find((v) => v.id === sel) ?? product.variants[0];
  if (!variant) return null;
  return (
    <div className="glass" style={S.prodCard} onClick={() => onAdd(variant)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onAdd(variant)}>
      <div style={S.prodImg}>
        {product.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 28, opacity: 0.2 }}>🌿</span>}
        {variant.stock <= 3 && <span style={S.lowBadge}>BAIXO</span>}
      </div>
      <div style={{ padding: "9px 11px 11px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginBottom: 5, color: "var(--cream)" }}>{product.name}</p>
        {product.variants.length > 1 && (
          <select className="input" style={{ fontSize: 11, padding: "3px 6px", height: 25, marginBottom: 5 }}
            value={sel} onChange={(e) => { e.stopPropagation(); setSel(e.target.value); }}
            onClick={(e) => e.stopPropagation()}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name ?? v.sku ?? "Padrão"} — {fmt(v.price_cents)}</option>
            ))}
          </select>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--gold-light)" }}>{fmt(variant.price_cents)}</span>
          <span className="muted" style={{ fontSize: 10 }}>est. {variant.stock}</span>
        </div>
      </div>
    </div>
  );
}

function CartRow({ item, onQty, onSetQty, onRemove }: {
  item: CartItem;
  onQty: (d: number) => void;
  onSetQty: (q: number) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(item.quantity));
  return (
    <div style={S.cartRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.productName}</p>
        {item.variantName && <p className="muted" style={{ fontSize: 10, margin: "1px 0 0" }}>{item.variantName}</p>}
        <p style={{ fontSize: 11, color: "var(--gold-light)", margin: "2px 0 0" }}>{fmt(item.unitPrice * item.quantity)}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <button style={S.qBtn} onClick={() => onQty(-1)}>−</button>
        {editing
          ? <input type="number" autoFocus style={{ width: 34, textAlign: "center", background: "rgba(255,255,255,0.07)", border: "1px solid var(--glass-border)", borderRadius: 5, color: "var(--cream)", fontSize: 12, padding: "2px" }}
              value={val} onChange={(e) => setVal(e.target.value)}
              onBlur={() => { onSetQty(parseInt(val) || 1); setEditing(false); }}
              onKeyDown={(e) => e.key === "Enter" && (onSetQty(parseInt(val) || 1), setEditing(false))} />
          : <span style={{ fontSize: 12, fontWeight: 700, minWidth: 20, textAlign: "center", cursor: "pointer" }}
              onClick={() => { setVal(String(item.quantity)); setEditing(true); }}>{item.quantity}</span>}
        <button style={S.qBtn} onClick={() => onQty(1)}>+</button>
        <button style={{ ...S.qBtn, color: "#f87171", marginLeft: 2 }} onClick={onRemove}>✕</button>
      </div>
    </div>
  );
}

// ── estilos ───────────────────────────────────────────────────────────────────

const S = {
  root: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" as const },
  closedScreen: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 20px", borderBottom: "1px solid var(--glass-border)",
    background: "rgba(14,12,10,0.85)", backdropFilter: "blur(14px)",
    position: "sticky" as const, top: 0, zIndex: 100,
  },
  hdrBtn: { padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  body: { display: "grid", gridTemplateColumns: "1fr 340px", flex: 1, minHeight: 0 },
  catalogCol: { overflowY: "auto" as const, padding: "14px 16px 40px" },
  cartCol: {
    borderLeft: "1px solid var(--glass-border)",
    display: "flex", flexDirection: "column" as const,
    height: "calc(100vh - 49px)", position: "sticky" as const, top: 49,
    background: "rgba(16,14,11,0.6)",
  },
  searchIcon: { position: "absolute" as const, left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" as const },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 },
  catTab: { padding: "4px 12px", borderRadius: 20, border: "1px solid var(--glass-border)", background: "rgba(242,236,223,0.04)", color: "var(--cream-dim)", fontSize: 11, cursor: "pointer", fontWeight: 600, transition: "all .12s" },
  catTabOn: { background: "rgba(185,146,77,0.18)", border: "1px solid var(--gold)", color: "var(--gold-light)" },
  prodCard: { cursor: "pointer", borderRadius: 12, overflow: "hidden", userSelect: "none" as const, position: "relative" as const, transition: "transform .12s" },
  prodImg: { height: 100, background: "rgba(242,236,223,0.04)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" as const },
  lowBadge: { position: "absolute" as const, top: 5, right: 5, background: "rgba(232,100,100,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4 },
  cartRow: { display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", background: "rgba(242,236,223,0.03)", borderRadius: 8, border: "1px solid var(--glass-border)" },
  qBtn: { width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(242,236,223,0.06)", border: "1px solid var(--glass-border)", borderRadius: 5, color: "var(--cream)", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0 },
  smBtn: { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(242,236,223,0.06)", border: "1px solid var(--glass-border)", borderRadius: 7, color: "var(--gold)", cursor: "pointer", fontSize: 13, padding: 0 },
  discTypeBtn: { padding: "4px 8px", borderRadius: 6, border: "1px solid var(--glass-border)", background: "rgba(255,255,255,0.04)", color: "var(--cream-dim)", fontSize: 11, cursor: "pointer", fontWeight: 700 },
  discTypeBtnOn: { background: "rgba(185,146,77,0.2)", border: "1px solid var(--gold)", color: "var(--gold-light)" },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 420, borderRadius: 18, padding: "28px 28px", position: "relative" as const },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "var(--cream)", marginBottom: 18 },
};
