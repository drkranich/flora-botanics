import Link from "next/link";
import { NewsletterForm } from "@/blocks/NewsletterForm";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string | null;
}

interface PremiumHomeProps {
  products: ProductCardProduct[];
  reviews: Review[];
  storageBase: string;
  tenantId: string;
}

function stars(value: number) {
  return "★".repeat(Math.min(value, 5)) + "☆".repeat(Math.max(5 - value, 0));
}

const ROUTINE_STEPS = [
  { step: "01", label: "Limpeza", desc: "Remova impurezas sem agredir a barreira natural da pele." },
  { step: "02", label: "Tônico", desc: "Equilibre o pH e prepare a pele para absorver os próximos passos." },
  { step: "03", label: "Sérum", desc: "Ativo concentrado para tratar necessidades específicas da pele." },
  { step: "04", label: "Hidratação", desc: "Sele toda a nutrição e mantenha o viço ao longo do dia." },
];

const INGREDIENTS = [
  { name: "Óleo de Babaçu", origin: "Maranhão, Brasil", benefit: "Hidratação profunda e leveza" },
  { name: "Extrato de Buriti", origin: "Cerrado, Brasil", benefit: "Antioxidante e regenerador" },
  { name: "Manteiga de Ucuúba", origin: "Amazônia, Brasil", benefit: "Nutrição e barreira protetora" },
  { name: "Aloe Vera Orgânico", origin: "Nordeste, Brasil", benefit: "Calmante e hidratante intensivo" },
];

export function PremiumHome({ products, reviews, storageBase, tenantId }: PremiumHomeProps) {
  return (
    <div className="premium-home">

      {/* ── HERO ── */}
      <section className="premium-hero">
        <div className="premium-hero-bg" aria-hidden />
        <div className="container">
          <div className="premium-hero-inner">
            <div className="premium-hero-text">
              <span className="premium-kicker">Cosméticos naturais do Brasil</span>
              <h1 className="premium-hero-title">
                Ciência botânica<br />para a sua pele
              </h1>
              <p className="premium-hero-body">
                Formulações que unem ingredientes ativos da biodiversidade brasileira com dermatologia de precisão.
              </p>
              <div className="premium-hero-actions">
                <Link href="/produtos" className="btn">
                  Explorar produtos
                </Link>
                <Link href="/montar-kit" className="btn btn-secondary" style={{ color: "var(--white)", borderColor: "rgba(242,236,223,0.4)" }}>
                  Montar meu kit
                </Link>
              </div>
              <div className="premium-hero-trust">
                <span>✓ Sem parabenos</span>
                <span>✓ Cruelty free</span>
                <span>✓ Ingredientes naturais</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROTINA ── */}
      <section className="premium-section premium-routine-section">
        <div className="container">
          <div className="premium-section-head">
            <span className="premium-eyebrow">Ritual Flora</span>
            <h2 className="premium-section-title">Rotina que transforma</h2>
            <p className="premium-section-sub">Quatro passos essenciais para uma pele saudável, radiante e protegida.</p>
          </div>
          <div className="premium-routine-grid">
            {ROUTINE_STEPS.map((item) => (
              <div key={item.step} className="premium-routine-card">
                <div className="premium-routine-step">{item.step}</div>
                <h3 className="premium-routine-label">{item.label}</h3>
                <p className="premium-routine-desc">{item.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link href="/produtos" className="link">
              Ver todos os produtos
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRODUTOS EM DESTAQUE ── */}
      {products.length > 0 ? (
        <section className="premium-section premium-products-section">
          <div className="container">
            <div className="premium-section-head premium-section-head--alt">
              <span className="premium-eyebrow premium-eyebrow--dark">Em destaque</span>
              <h2 className="premium-section-title premium-section-title--dark">Cuidados selecionados</h2>
            </div>
            <div className="category-grid">
              {products.slice(0, 4).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  storageBase={storageBase}
                  tenantId={tenantId}
                />
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <Link href="/produtos" className="btn btn-secondary">
                Ver catálogo completo
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── CIÊNCIA + NATUREZA ── */}
      <section className="premium-section premium-science-section">
        <div className="container">
          <div className="premium-science-grid">
            <div className="premium-science-text">
              <span className="premium-eyebrow">Nossa filosofia</span>
              <h2 className="premium-science-title">Onde a ciência encontra a natureza</h2>
              <p className="premium-science-body">
                Cada formulação Flora Botanics nasce de anos de pesquisa com a biodiversidade brasileira. Identificamos, testamos e combinamos ativos com comprovação dermatológica — sempre respeitando o ecossistema de origem.
              </p>
              <p className="premium-science-body">
                Sem ingredientes desnecessários. Sem promessas vazias. Apenas o que sua pele precisa, entregue com a precisão que ela merece.
              </p>
              <Link href="/produtos" className="link premium-link-light">
                Conhecer a linha
              </Link>
            </div>
            <div className="premium-science-features">
              {[
                { icon: "🌿", title: "100% Natural", desc: "Ativos extraídos de fontes sustentáveis da flora brasileira." },
                { icon: "🔬", title: "Testado clinicamente", desc: "Eficácia comprovada em estudos dermatológicos independentes." },
                { icon: "♻️", title: "Embalagem sustentável", desc: "Vidro reciclável e plástico de fonte renovável." },
                { icon: "🤝", title: "Cadeia justa", desc: "Parcerias diretas com comunidades extrativistas brasileiras." },
              ].map((item) => (
                <div key={item.title} className="premium-science-feature">
                  <span className="premium-science-icon">{item.icon}</span>
                  <div>
                    <strong className="premium-science-feat-title">{item.title}</strong>
                    <p className="premium-science-feat-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── INGREDIENTES ── */}
      <section className="premium-section premium-ingredients-section">
        <div className="container">
          <div className="premium-section-head premium-section-head--alt">
            <span className="premium-eyebrow premium-eyebrow--dark">Da terra à pele</span>
            <h2 className="premium-section-title premium-section-title--dark">Ingredientes de origem</h2>
            <p className="premium-section-sub premium-section-sub--dark">Cada ativo, rastreado da colheita ao frasco.</p>
          </div>
          <div className="premium-ingredients-grid">
            {INGREDIENTS.map((item) => (
              <div key={item.name} className="premium-ingredient-card">
                <div className="premium-ingredient-origin">{item.origin}</div>
                <h3 className="premium-ingredient-name">{item.name}</h3>
                <p className="premium-ingredient-benefit">{item.benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AVALIAÇÕES ── */}
      {reviews.length > 0 ? (
        <section className="premium-section premium-reviews-section">
          <div className="container">
            <div className="premium-section-head">
              <span className="premium-eyebrow">Clientes Flora</span>
              <h2 className="premium-section-title">O que dizem sobre nós</h2>
            </div>
            <div className="premium-reviews-grid">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="premium-review-card">
                  <span className="premium-review-stars">{stars(review.rating)}</span>
                  {review.title ? <strong className="premium-review-title">{review.title}</strong> : null}
                  <p className="premium-review-body">{review.body}</p>
                  <span className="premium-review-author">{review.display_name ?? "Cliente Flora"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── NEWSLETTER ── */}
      <section
        className="newsletter premium-newsletter"
        style={{
          background: "linear-gradient(125deg, rgba(10,22,11,0.98) 0%, rgba(23,43,23,0.95) 60%, rgba(15,32,18,0.98) 100%)",
        }}
      >
        <div className="container">
          <div className="newsletter-layout">
            <div>
              <span className="eyebrow">Ritual semanal</span>
              <h2>Receba dicas de<br />skincare e lançamentos</h2>
              <p>Segredos de formulação, rotinas sazonais e acesso antecipado aos nossos lançamentos.</p>
            </div>
            <div>
              <NewsletterForm />
              <div className="newsletter-list" style={{ marginTop: 20 }}>
                <span>Dicas semanais de skincare</span>
                <span>Lançamentos em primeira mão</span>
                <span>Desconto exclusivo na 1ª compra</span>
                <span>Sem spam, só o que importa</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
