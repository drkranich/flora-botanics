/**
 * /checkout/proximo — Ponte entre sessões Stripe em pagamentos com múltiplos cartões.
 *
 * Quando o cliente paga com 2 ou 3 cartões, o success_url do cartão N aponta
 * para esta página, que recebe a URL do próximo checkout Stripe e redireciona.
 *
 * Params:
 *   pedido — order_id (UUID)
 *   url    — URL codificada da próxima sessão Stripe
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redirecionando pagamento… — Flora Botanics",
  robots: { index: false },
};

export default async function ProximoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const orderId = params.pedido ?? "";
  const encodedUrl = params.url ?? "";

  if (encodedUrl) {
    let nextUrl: string;
    try {
      nextUrl = decodeURIComponent(encodedUrl);
    } catch {
      nextUrl = "";
    }

    // Aceita somente URLs do Stripe Checkout (segurança)
    if (nextUrl.startsWith("https://checkout.stripe.com/")) {
      redirect(nextUrl);
    }
  }

  // Fallback: vai para a página de sucesso se não tiver próxima URL
  redirect(`/checkout/sucesso${orderId ? `?pedido=${orderId}` : ""}`);
}
