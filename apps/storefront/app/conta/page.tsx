import { currentTenant, db } from "@/lib/tenant";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { NewsletterForm } from "@/blocks/NewsletterForm";

export const revalidate = 60;

/**
 * Minha conta — a área do cliente (pedidos, endereços, login) é a
 * próxima etapa do roadmap. Por enquanto a página existe, explica e
 * captura o interesse via newsletter.
 */
export default async function AccountPage() {
  const tenant = await currentTenant();
  const menu = await getMenu(db(), tenant.tenantId, "header");

  return (
    <>
      <div className="page-hero">
        <SiteHeader menu={menu} />
        <div className="container">
          <span className="breadcrumb">Início / Minha conta</span>
          <h1>Minha conta</h1>
          <p>
            Acompanhe pedidos, endereços e benefícios exclusivos — sua área
            de cliente está em construção e abre junto com a loja.
          </p>
        </div>
      </div>

      <section className="container" style={{ padding: "60px 0 80px", maxWidth: 560 }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 500,
            color: "#2a271f",
            marginBottom: 14,
          }}
        >
          Seja a primeira a entrar
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 26 }}>
          Cadastre seu e-mail e avisaremos quando a área de cliente estiver no
          ar — com acesso antecipado, desconto de lançamento e amostras
          exclusivas.
        </p>
        <div style={{ maxWidth: 480 }}>
          <NewsletterForm />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
