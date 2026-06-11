"use client";

/**
 * CTA da página de produto.
 * Hoje: aviso de "em breve" (o checkout Stripe é a próxima etapa do roadmap).
 * Quando o checkout entrar, este botão chama a Edge Function create-checkout-session.
 */
export function BuyButton({ inStock }: { inStock: boolean }) {
  if (!inStock) {
    return (
      <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
        Esgotado
      </button>
    );
  }
  return (
    <>
      <button
        className="btn"
        onClick={() =>
          alert("A loja abre em breve! Cadastre-se na newsletter para ser avisada.")
        }
      >
        Comprar
      </button>
      <p className="pdp-note">Vendas abrem em breve — checkout seguro via Stripe.</p>
    </>
  );
}
