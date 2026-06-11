import Link from "next/link";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const dynamic = "force-dynamic";

export default async function OrderConfirmedPage() {
  const tenant = await currentTenant();
  const menu = await getMenu(db(), tenant.tenantId, "header");

  return (
    <>
      <div className="page-hero" style={{ paddingBottom: 0 }}>
        <SiteHeader menu={menu} />
      </div>

      <section
        className="container"
        style={{ padding: "90px 0 110px", textAlign: "center", maxWidth: 560 }}
      >
        <span
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--green-900)",
            color: "var(--gold)",
            fontSize: 30,
            marginBottom: 26,
          }}
        >
          ✓
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 42,
            fontWeight: 500,
            color: "#2a271f",
            lineHeight: 1.05,
          }}
        >
          Pedido confirmado!
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 16, lineHeight: 1.7 }}>
          Obrigado por escolher a {tenant.name}. Você receberá os detalhes
          do pedido por e-mail. Cuidamos de cada envio com o mesmo carinho
          que colocamos em cada fórmula.
        </p>
        <Link href="/" className="btn" style={{ marginTop: 30 }}>
          Voltar à loja
        </Link>
      </section>

      <SiteFooter />
    </>
  );
}
