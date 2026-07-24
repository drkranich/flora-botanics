"use client";

import { createBrowserClient } from "@supabase/ssr";

// NEXT_PUBLIC_* são vars de runtime no Cloudflare Workers — nem sempre
// são inlinadas pelo bundler no cliente. Fallback garante que o cliente
// Supabase sempre inicializa, mesmo quando process.env é undefined.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://mbpvzhcrimdwcqkqvoqr.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_zZbCUfG-1KifCBk1VJ_NTw_-RpL9A8g";

export function supabaseBrowser() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
