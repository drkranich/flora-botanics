import Link from "next/link";
import { notFound } from "next/navigation";
import { currentTenant, db } from "@/lib/tenant";
import { getCategoryWithProducts, money } from "@/lib/catalog";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";

export const revalidate = 60;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [result, menu] = await Promise.all([
    getCategoryWithProducts(client, tenant.tenantId, slug),
    getMenu(client, tenant.tenantId, "header"),
  ]);
  if (!result) notFound();

  const { category, products } = result;

  return (
    <>
      <div className="page-hero">
        <SiteHeader menu={menu} />
        <div className="container">
          <span className="breadcrumb">Início / {category.name}</span>
          <h1>{category.name}</h1>
          {category.description ? <p>{category.description}</p> : null}
        </div>
      </div>

      <section className="container">
        {products.length === 0 ? (
          <p style={{ padding: "60px 0", fontSize: 14, color: "var(--muted)" }}>
            Em breve novos produtos nesta categoria.
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
