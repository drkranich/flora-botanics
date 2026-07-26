import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StripeEnvironment } from "@flora/core";

type WorkerEnv = Record<string, string | undefined>;

async function runtimeEnv(): Promise<WorkerEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as WorkerEnv;
  } catch {
    return process.env as WorkerEnv;
  }
}

export async function getStripeSecret(environment: StripeEnvironment): Promise<string | null> {
  const env = await runtimeEnv();
  if (environment === "test") {
    return env.STRIPE_TEST_SECRET_KEY ?? env.STRIPE_SECRET_KEY ?? null;
  }
  return env.STRIPE_LIVE_SECRET_KEY ?? env.STRIPE_SECRET_KEY ?? null;
}

export async function getStripeWebhookSecret(environment: StripeEnvironment): Promise<string | null> {
  const env = await runtimeEnv();
  if (environment === "test") {
    return env.STRIPE_TEST_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET ?? null;
  }
  return env.STRIPE_LIVE_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET ?? null;
}

export async function isStripeConfigured(environment: StripeEnvironment): Promise<boolean> {
  return (await getStripeSecret(environment)) !== null;
}
