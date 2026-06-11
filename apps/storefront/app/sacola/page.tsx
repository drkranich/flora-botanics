import Link from "next/link";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const revalidate = 60;

/**
 * Sacola — o MVP usa compra rápida (1 clique → checkout Stripe).
 * O carrinho multi-itens chega junto com a área do cliente.
 */
export default async function BagPage() {
  const tenant = await currentTenant();
  const client = db();

  const [menu, { data: categories }] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    client
      .from("categories")
      .select("slug, name")
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .order("sort_order"),
  ]);

  return (
    <>
      <div className="page-hero">
        <SiteHeader menu={menu} />
        <div className="container">
          <span className="breadcrumb">Início / Sacola</span>
          <h1>Sua sacola</h1>
          <p>
            Por aqui a compra é direta: escolha um produto e finalize com
            segurança em um clique, sem filas nem etapas extras.
          </p>
        </div>
      </div>

      <section className="container" style={{ padding: "60px 0 80px" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 500,
            color: "#2a271f",
            marginBottom: 14,
          }}
        >
          Comece pela coleção
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 26, maxWidth: 640 }}>
          Cada produto tem o botão <strong>Comprar</strong> que leva direto ao
          pagamento seguro via Stripe. A sacola com vários itens chega em breve,
          junto com a sua área de cliente.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 8 }}>
          {(categories ?? []).map((c) => (
            <Link key={c.slug} href={`/categorias/${c.slug}`} className="btn">
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
