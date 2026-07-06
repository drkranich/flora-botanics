export const DEFAULT_STOREFRONT_URL = "https://florabotanics.com.br";

export function getStorefrontUrl(): string {
  const value = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim() || DEFAULT_STOREFRONT_URL;
  return value.replace(/\/+$/, "");
}
