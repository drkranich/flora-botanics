import type { Metadata } from "next";
import { headers } from "next/headers";

export const DEFAULT_SITE_URL = "https://florabotanics.com.br";
export const DEFAULT_SITE_NAME = "Flora Botanics";
export const DEFAULT_DESCRIPTION =
  "Cosmeticos inspirados pela biodiversidade brasileira, criados para uma rotina de cuidado simples, sensorial e eficaz.";

type SeoValue = {
  title?: string;
  description?: string;
  image?: string;
};

function cleanBaseUrl(value: string | undefined | null) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export async function currentSiteUrl() {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = (forwardedHost ?? h.get("host") ?? "").split(",")[0].split(":")[0].trim();

  if (
    host &&
    host !== "127.0.0.1" &&
    !host.startsWith("localhost") &&
    !host.endsWith(".workers.dev")
  ) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  return cleanBaseUrl(process.env.NEXT_PUBLIC_STOREFRONT_URL) || DEFAULT_SITE_URL;
}

export function absoluteUrl(baseUrl: string, path = "/") {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBaseUrl(baseUrl) || DEFAULT_SITE_URL}${safePath}`;
}

export function seoFromValue(value: unknown): SeoValue {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    title: typeof record.title === "string" ? record.title : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    image: typeof record.image === "string" ? record.image : undefined,
  };
}

export function buildMetadata(input: {
  baseUrl: string;
  title?: string | null;
  description?: string | null;
  path?: string;
  image?: string | null;
  type?: "website" | "article";
}): Metadata {
  const title = input.title || DEFAULT_SITE_NAME;
  const description = input.description || DEFAULT_DESCRIPTION;
  const url = absoluteUrl(input.baseUrl, input.path ?? "/");
  const images = input.image ? [{ url: input.image }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: DEFAULT_SITE_NAME,
      locale: "pt_BR",
      type: input.type ?? "website",
      images,
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      title,
      description,
      images: input.image ? [input.image] : undefined,
    },
  };
}
