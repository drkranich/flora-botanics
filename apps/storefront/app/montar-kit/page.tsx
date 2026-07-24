import type { Metadata } from "next";
import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { buildMetadata, currentSiteUrl } from "@/lib/seo";
import { KitBuilder } from "./KitBuilder";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await currentSiteUrl();
  return buildMetadata({
    baseUrl,
    title: "Monte seu kit",
    description: "Escolha seus produtos favoritos e monte um kit personalizado com desconto.",
    path: "/montar-kit",
  });
}

export interface KitProduct {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  variant_id: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  weight_g: number;
}

export default async function MontarKitPage() {
  const tenant = await currentTenant();
  const client = db();

  const [menu, logoSetting, { data: rawProducts }] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client, tenant.tenantId, "logo"
    ),
    client
      .from("products")
      .select(`
        id, slug, name, subtitle, weight_g,
        product_variants(id, price_cents, currency, is_default),
        product_media(role, sort_order, media(storage_path, alt))
      `)
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "published")
      .is("deleted_at", null)
      .in("type", ["simple", "variable"])
      .order("name", { ascending: true })
      .limit(60),
  ]);

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

  const products: KitProduct[] = (rawProducts ?? []).flatMap((p) => {
    const variants = Array.isArray(p.product_variants) ? p.product_variants : [p.product_variants].filter(Boolean);
    const variant = (variants as Array<{ id: string; price_cents: number; currency: string; is_default: boolean }>)
      .find((v) => v.is_default) ?? (variants as Array<{ id: string; price_cents: number; currency: string; is_default: boolean }>)[0];
    if (!variant) return [];

    const mediaList = (Array.isArray(p.product_media) ? p.product_media : []) as Array<{
      role: string;
      sort_order: number;
      media: { storage_path: string } | Array<{ storage_path: string }> | null;
    }>;
    const coverMedia = mediaList.find((m) => m.role === "cover")?.media ?? mediaList[0]?.media ?? null;
    const media = Array.isArray(coverMedia) ? coverMedia[0] : coverMedia;
    const imageUrl = media?.storage_path ? `${storageBase}${media.storage_path}` : null;

    return [{
      id: p.id,
      slug: p.slug,
      name: p.name,
      subtitle: p.subtitle ?? null,
      variant_id: variant.id,
      price_cents: variant.price_cents,
      currency: variant.currency ?? "BRL",
      image_url: imageUrl,
      weight_g: (p as unknown as { weight_g?: number }).weight_g ?? 200,
    }];
  });

  const logoUrl = logoSetting?.image ?? "";
  const logoWidth = logoSetting?.width ?? 160;
  const logoHeight = logoSetting?.height ?? 48;
  const logoColor = logoSetting?.color ?? "";

  return (
    <>
      {/* ── Hero ── */}
      <div className="kit-page-hero">
        <SiteHeader menu={menu} logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        <div className="kit-page-hero-content container">
          <span className="eyebrow">Personalizado</span>
          <h1 className="kit-page-hero-title">Monte seu kit Flora</h1>
          <p className="kit-page-hero-sub">
            Escolha seus produtos favoritos, combine a rotina ideal para sua pele e ganhe desconto progressivo. Quanto mais itens, maior o desconto.
          </p>
          <div className="kit-page-hero-badges">
            <span className="kit-hero-badge">✦ Até 15% de desconto</span>
            <span className="kit-hero-badge">✦ Embalagem para presente</span>
            <span className="kit-hero-badge">✦ Fórmula natural certificada</span>
          </div>
        </div>
      </div>

      <main className="kit-builder-page">
        <div className="container">

          {/* ── Rotina sugerida ── */}
          <section className="kit-routine-section">
            <div className="section-heading" style={{ marginBottom: "2rem" }}>
              <span className="eyebrow">Sequência de uso</span>
              <h2>A rotina completa em 3 passos</h2>
            </div>
            <div className="kit-routine-steps">
              <div className="kit-routine-step">
                <div className="kit-routine-step-number">01</div>
                <div className="kit-routine-step-content">
                  <strong>Limpar</strong>
                  <span>Prepare a pele removendo impurezas e excesso de oleosidade. Base para qualquer rotina eficaz.</span>
                </div>
              </div>
              <div className="kit-routine-arrow" aria-hidden="true">→</div>
              <div className="kit-routine-step">
                <div className="kit-routine-step-number">02</div>
                <div className="kit-routine-step-content">
                  <strong>Tratar</strong>
                  <span>Aplique o sérum com ativos concentrados. Ação profunda e resultados visíveis em 14 dias.</span>
                </div>
              </div>
              <div className="kit-routine-arrow" aria-hidden="true">→</div>
              <div className="kit-routine-step">
                <div className="kit-routine-step-number">03</div>
                <div className="kit-routine-step-content">
                  <strong>Hidratar</strong>
                  <span>Sele os nutrientes com hidratação profunda. Pele protegida, macia e radiante o dia todo.</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Builder ── */}
          <section className="kit-builder-section">
            <div className="section-heading" style={{ marginBottom: "2rem" }}>
              <span className="eyebrow">Monte agora</span>
              <h2>Escolha seus produtos</h2>
            </div>
            <KitBuilder products={products} />
          </section>

          {/* ── Economia ── */}
          <section className="kit-economy-section">
            <div className="kit-economy-inner glass">
              <div className="kit-economy-text">
                <span className="eyebrow">Economia real</span>
                <h2 className="kit-economy-title">Quanto mais você cuida,<br/>mais você economiza</h2>
                <p className="kit-economy-desc">
                  Descontos progressivos foram pensados para incentivar a rotina completa — porque pele saudável é resultado de consistência, não de um único produto.
                </p>
              </div>
              <div className="kit-economy-tiers">
                <div className="kit-economy-tier">
                  <span className="kit-economy-pct">5%</span>
                  <span className="kit-economy-label">Dupla</span>
                  <span className="kit-economy-detail">2 produtos</span>
                </div>
                <div className="kit-economy-tier kit-economy-tier-mid">
                  <span className="kit-economy-pct">10%</span>
                  <span className="kit-economy-label">Trio</span>
                  <span className="kit-economy-detail">3 produtos</span>
                </div>
                <div className="kit-economy-tier kit-economy-tier-best">
                  <span className="kit-economy-badge">Melhor</span>
                  <span className="kit-economy-pct">15%</span>
                  <span className="kit-economy-label">Rotina completa</span>
                  <span className="kit-economy-detail">4+ produtos</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Presente ── */}
          <section className="kit-gift-section">
            <div className="kit-gift-inner">
              <div className="kit-gift-visual" aria-hidden="true">
                <div className="kit-gift-box">🎁</div>
              </div>
              <div className="kit-gift-text">
                <span className="eyebrow">Para presentear</span>
                <h2 className="kit-gift-title">O presente perfeito para quem você ama</h2>
                <p className="kit-gift-desc">
                  Ao montar seu kit, você pode selecionar a opção de embalagem especial para presente, com papel seda, laço e cartão personalizado. Entrega direta para quem você quer surpreender.
                </p>
                <ul className="kit-gift-list">
                  <li>✦ Embalagem premium com papel seda e laço</li>
                  <li>✦ Cartão com sua mensagem personalizada</li>
                  <li>✦ Nota fiscal sem valores a pedido</li>
                </ul>
              </div>
            </div>
          </section>

        </div>
      </main>

      <SiteFooter logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
    </>
  );
}
