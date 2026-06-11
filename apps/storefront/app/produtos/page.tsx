import Link from "next/link";
import { currentTenant, db } from "@/lib/tenant";
import { getAllProducts, money } from "@/lib/catalog";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const revalidate = 60;

/** Vitrine completa — destino de "Conheça a coleção" e do menu Produtos. */
export default async function AllProductsPage() {
  const tenant = await currentTenant();
  const client = db();

  const [products, menu] = await Promise.all([
    getAllProducts(client, tenant.tenantId),
    getMenu(client, tenant.tenantId, "header"),
  ]);

  return (
    <>
      <div className="page-hero">
        <SiteHeader menu={menu} />
        <div className="container">
          <span className="breadcrumb">Início / Coleção</span>
          <h1>A coleção</h1>
          <p>
            Fórmulas botânicas brasileiras, criadas com ciência e respeito —
            explore todos os nossos produtos.
          </p>
        </div>
      </div>

      <section className="container">
        {products.length === 0 ? (
          <p style={{ padding: "60px 0", fontSize: 14, color: "var(--muted)" }}>
            A coleção está sendo preparada — cadastre-se na newsletter para
            saber do lançamento.
          </p>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <Link key={p.id} href={`/produtos/${p.slug}`} className="product-card">
                <div
                  className="photo"
                  style={p.cover_url ? { backgroundImage: `url("${p.cover_url}")` } : undefined}
                />
                <h3>{p.name}</h3>
                {p.subtitle ? <p className="sub">{p.subtitle}</p> : null}
                <div className="price-row">
                  <span className="price">{money(p.price_cents)}</span>
                  {p.compare_at_cents ? (
                    <span className="price-compare">{money(p.compare_at_cents)}</span>
                  ) : null}
                </div>
                {!p.in_stock ? <span className="badge-out">Esgotado</span> : null}
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </>
  );
}
