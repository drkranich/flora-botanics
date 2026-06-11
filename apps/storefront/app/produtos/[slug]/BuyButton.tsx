"use client";

import { useState } from "react";

/**
 * CTA da página de produto — inicia o checkout Stripe.
 * O preço e o estoque são validados no servidor (Edge Function);
 * o cliente só informa qual variante e a quantidade.
 */
export function BuyButton({
  variantId,
  inStock,
}: {
  variantId: string;
  inStock: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!inStock) {
    return (
      <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
        Esgotado
      </button>
    );
  }

  async function buy() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            variant_id: variantId,
            quantity: 1,
            tenant_slug: process.env.NEXT_PUBLIC_TENANT_SLUG ?? "flora-botanics",
          }),
        }
      );
      const body = await res.json();
      if (res.ok && body.url) {
        window.location.href = body.url; // página segura do Stripe
        return;
      }
      setErrorMsg(body.error ?? "Não foi possível iniciar o pagamento.");
      setStatus("error");
    } catch {
      setErrorMsg("Falha de conexão — tente novamente.");
      setStatus("error");
    }
  }

  return (
    <>
      <button className="btn" onClick={buy} disabled={status === "loading"}>
        {status === "loading" ? "Abrindo pagamento…" : "Comprar"}
      </button>
      <p className="pdp-note">
        {errorMsg ?? "Pagamento seguro processado pela Stripe."}
      </p>
    </>
  );
}
