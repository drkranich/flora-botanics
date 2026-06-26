/**
 * Utilitários de carrinho do storefront.
 *
 * Uso básico:
 *   import { getCart, addToCart, captureEmail } from "@/lib/cart";
 *
 * O session_id é um UUID v4 gerado uma vez e persistido em localStorage.
 * Toda operação de escrita sincroniza com /api/cart para rastreamento de
 * carrinhos abandonados no CMS admin.
 */

export interface CartItem {
  product_id: string;
  variant_id?: string;
  name: string;
  slug?: string;
  image?: string;
  price_cents: number;
  quantity: number;
}

const SESSION_KEY = "flora_cart_session";
const CART_KEY = "flora_cart_items";

// ── Session ID ──────────────────────────────────────────────────────────────

/** Retorna ou gera o session_id persistido em localStorage. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// ── Leitura local ────────────────────────────────────────────────────────────

/** Lê os itens do carrinho do localStorage (rápido, sem rede). */
export function getLocalCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

/** Subtotal em centavos. */
export function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
}

// ── Escrita (local + sync) ───────────────────────────────────────────────────

function saveLocal(items: CartItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }
}

async function syncToServer(items: CartItem[], extras?: { customer_email?: string; customer_name?: string }) {
  const session_id = getSessionId();
  if (!session_id) return;
  try {
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id,
        items,
        subtotal_cents: calcSubtotal(items),
        ...extras,
      }),
    });
  } catch {
    // Falha silenciosa — o remarketing pode perder este evento, mas o UX não é afetado
  }
}

/** Adiciona ou incrementa um item no carrinho. */
export async function addToCart(item: CartItem): Promise<CartItem[]> {
  const items = getLocalCart();
  const key = item.variant_id ?? item.product_id;
  const existing = items.find((i) => (i.variant_id ?? i.product_id) === key);

  let updated: CartItem[];
  if (existing) {
    updated = items.map((i) =>
      (i.variant_id ?? i.product_id) === key
        ? { ...i, quantity: i.quantity + item.quantity }
        : i
    );
  } else {
    updated = [...items, item];
  }

  saveLocal(updated);
  await syncToServer(updated);
  return updated;
}

/** Remove um item do carrinho. */
export async function removeFromCart(productId: string, variantId?: string): Promise<CartItem[]> {
  const key = variantId ?? productId;
  const updated = getLocalCart().filter((i) => (i.variant_id ?? i.product_id) !== key);
  saveLocal(updated);
  await syncToServer(updated);
  return updated;
}

/** Atualiza a quantidade de um item. */
export async function updateQuantity(
  productId: string,
  quantity: number,
  variantId?: string
): Promise<CartItem[]> {
  const key = variantId ?? productId;
  const updated =
    quantity <= 0
      ? getLocalCart().filter((i) => (i.variant_id ?? i.product_id) !== key)
      : getLocalCart().map((i) =>
          (i.variant_id ?? i.product_id) === key ? { ...i, quantity } : i
        );
  saveLocal(updated);
  await syncToServer(updated);
  return updated;
}

/** Limpa o carrinho (ex: após finalizar pedido). */
export async function clearCart(): Promise<void> {
  saveLocal([]);
  await syncToServer([]);
}

/**
 * Captura o e-mail do cliente para habilitar remarketing.
 * Chamar quando o usuário preenche o campo de e-mail (newsletter, checkout).
 */
export async function captureEmail(email: string, name?: string): Promise<void> {
  const items = getLocalCart();
  await syncToServer(items, { customer_email: email, customer_name: name });
}
