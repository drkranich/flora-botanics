const STRIPE_API = "https://api.stripe.com";
const STRIPE_API_VERSION = "2026-06-24.dahlia";

export type StripeEnvironment = "test" | "production";

export type StripeResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string };

export type StripeProduct = {
  id: string;
  object: "product";
  active: boolean;
  name: string;
  description?: string | null;
  metadata?: Record<string, string>;
  default_price?: string | null;
};

export type StripePrice = {
  id: string;
  object: "price";
  active: boolean;
  currency: string;
  unit_amount: number | null;
  product: string | StripeProduct;
  lookup_key?: string | null;
  recurring?: {
    interval: "day" | "week" | "month" | "year";
    interval_count: number;
  } | null;
  metadata?: Record<string, string>;
};

export type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  url: string | null;
  payment_status?: string;
  status?: string;
  mode?: string;
  metadata?: Record<string, string>;
  payment_intent?: string | null;
  subscription?: string | null;
};

export type StripeCoupon = {
  id: string;
  object: "coupon";
  amount_off?: number | null;
  percent_off?: number | null;
  currency?: string | null;
  duration: string;
  name?: string | null;
};

export type StripePromotionCode = {
  id: string;
  object: "promotion_code";
  active: boolean;
  code: string;
  coupon: string | StripeCoupon;
};

export type StripeEvent = {
  id: string;
  object: "event";
  type: string;
  livemode: boolean;
  api_version?: string | null;
  data: { object: Record<string, unknown> };
};

type Primitive = string | number | boolean | null | undefined;
type StripeParamValue = Primitive | StripeParams | StripeParamValue[];
interface StripeParams {
  [key: string]: StripeParamValue;
}

function appendParam(params: URLSearchParams, key: string, value: StripeParamValue) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendParam(params, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => appendParam(params, `${key}[${childKey}]`, childValue));
    return;
  }
  params.append(key, String(value));
}

function encodeParams(input: StripeParams) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => appendParam(params, key, value));
  return params;
}

function normalizeStripeError(data: unknown, fallback: string) {
  const error = (data as { error?: { message?: string; code?: string } } | null)?.error;
  return {
    message: error?.message ?? fallback,
    code: error?.code,
  };
}

export async function stripeRequest<T>({
  apiKey,
  method = "GET",
  path,
  params,
  idempotencyKey,
}: {
  apiKey: string;
  method?: "GET" | "POST";
  path: string;
  params?: StripeParams;
  idempotencyKey?: string;
}): Promise<StripeResult<T>> {
  const url = new URL(`${STRIPE_API}${path}`);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  let body: URLSearchParams | undefined;

  if (method === "GET") {
    if (params) {
      const search = encodeParams(params);
      search.forEach((value, key) => url.searchParams.append(key, value));
    }
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    body = encodeParams(params ?? {});
  }

  try {
    const res = await fetch(url, { method, headers, body });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = normalizeStripeError(data, `Stripe retornou ${res.status}`);
      return { ok: false, status: res.status, error: err.message, code: err.code };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Falha de rede ao chamar o Stripe.",
    };
  }
}

export function createStripeProduct(apiKey: string, input: {
  name: string;
  description?: string | null;
  active?: boolean;
  images?: string[];
  metadata?: Record<string, string | null | undefined>;
  idempotencyKey: string;
}) {
  return stripeRequest<StripeProduct>({
    apiKey,
    method: "POST",
    path: "/v1/products",
    idempotencyKey: input.idempotencyKey,
    params: {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      active: input.active ?? true,
      ...(input.images?.length ? { images: input.images } : {}),
      metadata: cleanMetadata(input.metadata),
    },
  });
}

export function createStripePrice(apiKey: string, input: {
  productId: string;
  currency: string;
  unitAmountCents: number;
  lookupKey?: string | null;
  transferLookupKey?: boolean;
  nickname?: string | null;
  recurring?: { interval: "day" | "week" | "month" | "year"; intervalCount: number } | null;
  metadata?: Record<string, string | null | undefined>;
  idempotencyKey: string;
}) {
  return stripeRequest<StripePrice>({
    apiKey,
    method: "POST",
    path: "/v1/prices",
    idempotencyKey: input.idempotencyKey,
    params: {
      product: input.productId,
      currency: input.currency.toLowerCase(),
      unit_amount: input.unitAmountCents,
      ...(input.lookupKey ? { lookup_key: input.lookupKey } : {}),
      ...(input.transferLookupKey ? { transfer_lookup_key: true } : {}),
      ...(input.nickname ? { nickname: input.nickname } : {}),
      ...(input.recurring
        ? { recurring: { interval: input.recurring.interval, interval_count: input.recurring.intervalCount } }
        : {}),
      metadata: cleanMetadata(input.metadata),
    },
  });
}

export function archiveStripePrice(apiKey: string, priceId: string, idempotencyKey: string) {
  return stripeRequest<StripePrice>({
    apiKey,
    method: "POST",
    path: `/v1/prices/${encodeURIComponent(priceId)}`,
    idempotencyKey,
    params: { active: false },
  });
}

export function retrieveStripeProduct(apiKey: string, productId: string) {
  return stripeRequest<StripeProduct>({
    apiKey,
    path: `/v1/products/${encodeURIComponent(productId)}`,
  });
}

export function retrieveStripePrice(apiKey: string, priceId: string) {
  return stripeRequest<StripePrice>({
    apiKey,
    path: `/v1/prices/${encodeURIComponent(priceId)}`,
    params: { expand: ["product"] },
  });
}

export function createStripeCheckoutSession(apiKey: string, input: {
  mode: "payment" | "subscription";
  lineItems: Array<{ price: string; quantity: number }>;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  clientReferenceId?: string | null;
  discounts?: Array<{ coupon: string }>;
  shippingAmountCents?: number;
  shippingCurrency?: string;
  shippingLabel?: string;
  metadata?: Record<string, string | null | undefined>;
  idempotencyKey: string;
}) {
  const metadata = cleanMetadata(input.metadata);
  return stripeRequest<StripeCheckoutSession>({
    apiKey,
    method: "POST",
    path: "/v1/checkout/sessions",
    idempotencyKey: input.idempotencyKey,
    params: {
      mode: input.mode,
      line_items: input.lineItems.map((item) => ({ price: item.price, quantity: item.quantity })),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      ...(input.clientReferenceId ? { client_reference_id: input.clientReferenceId } : {}),
      ...(input.discounts?.length ? { discounts: input.discounts } : {}),
      ...(input.mode === "payment" ? { payment_intent_data: { metadata } } : {}),
      ...(input.mode === "subscription" ? { subscription_data: { metadata } } : {}),
      ...(input.shippingAmountCents && input.shippingAmountCents > 0
        ? {
            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount",
                  fixed_amount: {
                    amount: input.shippingAmountCents,
                    currency: (input.shippingCurrency ?? "BRL").toLowerCase(),
                  },
                  display_name: input.shippingLabel ?? "Frete Flora Botanics",
                },
              },
            ],
          }
        : {}),
      integration_identifier: `flora_checkout_${randomIdentifier()}`,
      metadata,
    },
  });
}

export function createStripeCoupon(apiKey: string, input: {
  amountOffCents?: number;
  percentOff?: number;
  currency?: string;
  name: string;
  metadata?: Record<string, string | null | undefined>;
  idempotencyKey: string;
}) {
  return stripeRequest<StripeCoupon>({
    apiKey,
    method: "POST",
    path: "/v1/coupons",
    idempotencyKey: input.idempotencyKey,
    params: {
      ...(input.amountOffCents && input.amountOffCents > 0 ? { amount_off: input.amountOffCents } : {}),
      ...(input.amountOffCents && input.amountOffCents > 0 ? { currency: (input.currency ?? "BRL").toLowerCase() } : {}),
      ...(input.percentOff && input.percentOff > 0 ? { percent_off: input.percentOff } : {}),
      duration: "once",
      name: input.name,
      metadata: cleanMetadata(input.metadata),
    },
  });
}

export function createStripePromotionCode(apiKey: string, input: {
  couponId: string;
  code: string;
  active?: boolean;
  maxRedemptions?: number | null;
  expiresAt?: number | null;
  metadata?: Record<string, string | null | undefined>;
  idempotencyKey: string;
}) {
  return stripeRequest<StripePromotionCode>({
    apiKey,
    method: "POST",
    path: "/v1/promotion_codes",
    idempotencyKey: input.idempotencyKey,
    params: {
      coupon: input.couponId,
      code: input.code,
      active: input.active ?? true,
      ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
      metadata: cleanMetadata(input.metadata),
    },
  });
}

export function cleanMetadata(input?: Record<string, string | null | undefined>): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null) continue;
    metadata[key] = String(value).slice(0, 500);
  }
  return metadata;
}

function randomIdentifier() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return suffix;
}

export async function verifyStripeWebhookSignature({
  payload,
  header,
  secret,
  toleranceSeconds = 300,
}: {
  payload: string;
  header: string | null;
  secret: string;
  toleranceSeconds?: number;
}): Promise<StripeResult<StripeEvent>> {
  if (!header) return { ok: false, status: 400, error: "Header Stripe-Signature ausente." };

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key, rest.join("=")];
    })
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature) {
    return { ok: false, status: 400, error: "Assinatura Stripe inválida." };
  }
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return { ok: false, status: 400, error: "Assinatura Stripe expirada." };
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, status: 400, error: "Assinatura Stripe não confere." };
  }

  try {
    return { ok: true, data: JSON.parse(payload) as StripeEvent };
  } catch {
    return { ok: false, status: 400, error: "Payload Stripe inválido." };
  }
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
