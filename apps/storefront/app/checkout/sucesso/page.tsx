import Link from "next/link";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string; session_id?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="checkout-success-shell">
      <section className="checkout-success-card">
        <div className="checkout-success-icon">✓</div>
        <p className="eyebrow">Pagamento recebido</p>
        <h1>Seu pedido está em confirmação</h1>
        <p>
          O Stripe enviou a confirmação para a Flora. Assim que o webhook processar o pagamento,
          o pedido entra automaticamente no fluxo de separação, nota e envio.
        </p>
        {params.pedido ? (
          <div className="checkout-success-total">
            Pedido interno: <strong>{params.pedido}</strong>
          </div>
        ) : null}
        <div className="checkout-success-actions">
          <Link href="/conta" className="btn">Minha conta</Link>
          <Link href="/produtos" className="btn btn-outline">Continuar comprando</Link>
        </div>
      </section>
    </main>
  );
}
