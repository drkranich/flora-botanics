import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAnonClient } from "@flora/db";
import type { StripeEnvironment } from "@flora/core";

type RuntimeEnv = Record<string, string | undefined>;

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as RuntimeEnv;
  } catch {
    return process.env;
  }
}

export async function getServerSupabase() {
  const env = await getRuntimeEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL precisam existir no Worker do storefront.");
  }

  return createAnonClient(url, serviceRole);
}

export async function getStripeCheckoutEnvironment(): Promise<StripeEnvironment> {
  const env = await getRuntimeEnv();
  const configured = env.STRIPE_CHECKOUT_ENVIRONMENT ?? process.env.STRIPE_CHECKOUT_ENVIRONMENT;
  return configured === "production" ? "production" : "test";
}

export async function getStripeSecret(environment: StripeEnvironment): Promise<string | null> {
  const env = await getRuntimeEnv();
  if (environment === "production") {
    return env.STRIPE_LIVE_SECRET_KEY ?? env.STRIPE_SECRET_KEY ?? process.env.STRIPE_LIVE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? null;
  }
  return env.STRIPE_TEST_SECRET_KEY ?? env.STRIPE_SECRET_KEY ?? process.env.STRIPE_TEST_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? null;
}

export async function getStripeWebhookSecrets(): Promise<Array<{ environment: StripeEnvironment; secret: string }>> {
  const env = await getRuntimeEnv();
  const testSecret = env.STRIPE_TEST_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_TEST_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  const liveSecret = env.STRIPE_LIVE_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_LIVE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  const secrets: Array<{ environment: StripeEnvironment; secret: string }> = [];
  if (testSecret) secrets.push({ environment: "test", secret: testSecret });
  if (liveSecret && liveSecret !== testSecret) secrets.push({ environment: "production", secret: liveSecret });
  return secrets;
}
