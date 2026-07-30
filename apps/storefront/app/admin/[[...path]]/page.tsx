import { redirect } from "next/navigation";

/**
 * Catch-all para /admin/* no storefront.
 * Em produção, o Worker do admin intercepta /admin* antes deste app.
 * Este fallback evita página em branco em dev local / edge cases.
 */
export default function AdminFallbackPage() {
  redirect("https://florabotanics.com.br/admin");
}
