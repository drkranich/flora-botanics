export const DEFAULT_STOREFRONT_URL = "https://florabotanics.com.br";

export function getStorefrontUrl(): string {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim();
  const unsafeLocalhost =
    configured &&
    process.env.NODE_ENV === "production" &&
    /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(configured);
  const value = configured && !unsafeLocalhost ? configured : DEFAULT_STOREFRONT_URL;
  return value.replace(/\/+$/, "");
}
