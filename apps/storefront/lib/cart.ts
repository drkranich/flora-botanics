/**
 * Utilitarios de carrinho do storefront.
 *
 * O session_id e um UUID v4 gerado uma vez e persistido em localStorage.
 * Toda escrita sincroniza com /api/cart para carrinhos abandonados.
 * O servidor recalcula nome, preco e subtotal com dados do Supabase.
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

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getLocalCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
}

function saveLocal(items: CartItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }
}

async function syncToServer(
  items: CartItem[],
  extras?: { customer_email?: string; customer_name?: string }
): Promise<CartItem[] | null> {
  const session_id = getSessionId();
  if (!session_id) return null;

  try {
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id,
        items,
        subtotal_cents: calcSubtotal(items),
        ...extras,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as { items?: CartItem[] } | null;
    if (Array.isArray(data?.items)) {
      saveLocal(data.items);
      return data.items;
    }
  } catch {
    // O carrinho local continua funcionando mesmo se a sincronizacao falhar.
  }

  return null;
}

export async function addToCart(item: CartItem): Promise<CartItem[]> {
  const items = getLocalCart();
  const key = item.variant_id ?? item.product_id;
  const existing = items.find((i) => (i.variant_id ?? i.product_id) === key);

  const updated = existing
    ? items.map((i) =>
        (i.variant_id ?? i.product_id) === key
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
      )
    : [...items, item];

  saveLocal(updated);
  return (await syncToServer(updated)) ?? updated;
}

export async function removeFromCart(productId: string, variantId?: string): Promise<CartItem[]> {
  const key = variantId ?? productId;
  const updated = getLocalCart().filter((i) => (i.variant_id ?? i.product_id) !== key);
  saveLocal(updated);
  return (await syncToServer(updated)) ?? updated;
}

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
  return (await syncToServer(updated)) ?? updated;
}

export async function clearCart(): Promise<void> {
  saveLocal([]);
  await syncToServer([]);
}

export async function captureEmail(email: string, name?: string): Promise<void> {
  const items = getLocalCart();
  await syncToServer(items, { customer_email: email, customer_name: name });
}
