"use client";

import { createBrowserAuthClient } from "@flora/db";

let browserClient: ReturnType<typeof createBrowserAuthClient> | null = null;

export function storefrontSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase público não configurado no storefront.");
  }

  if (!browserClient) {
    browserClient = createBrowserAuthClient(url, key);
  }

  return browserClient;
}
