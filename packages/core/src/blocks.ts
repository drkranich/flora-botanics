import { z } from "zod";

/**
 * Registro de blocos do CMS — Blueprint seção 5.1.
 * Cada página = lista ordenada de seções; cada seção = instância de um bloco.
 * O storefront tem 1 componente React por bloco; o admin gera o formulário
 * de edição a partir destes mesmos schemas.
 */

export const Cta = z.object({
  label: z.string(),
  href: z.string(),
});

export const HeroProps = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  image: z.string(),            // caminho público ou media_id futuramente
  product_image: z.string().optional(),
  overlay: z.boolean().default(true),
  cta: Cta.optional(),
});

export const CategoryGridProps = z.object({
  heading: z.string(),
  items: z.array(
    z.object({
      category_slug: z.string(),
      image: z.string().optional(),
    })
  ),
});

export const IngredientGridProps = z.object({
  heading: z.string(),
  text: z.string().optional(),
  cta: Cta.optional(),
  items: z.array(
    z.object({
      title: z.string(),
      text: z.string(),
      image: z.string().optional(),
    })
  ),
});

export const ManifestoProps = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  text: z.string(),
  image: z.string().optional(),
  cta: Cta.optional(),
});

export const BenefitsProps = z.object({
  items: z.array(
    z.object({
      icon: z.string(),
      title: z.string(),
      text: z.string(),
    })
  ),
});

export const NewsletterProps = z.object({
  title: z.string(),
  text: z.string().optional(),
  perks: z.array(z.string()).default([]),
});

export const RichTextProps = z.object({
  content: z.string(), // HTML sanitizado ou markdown
});

export const BannerProps = z.object({
  image: z.string(),
  href: z.string().optional(),
  full_width: z.boolean().default(true),
});

export const FaqProps = z.object({
  items: z.array(z.object({ q: z.string(), a: z.string() })),
});

export const ProductCarouselProps = z.object({
  heading: z.string(),
  collection_slug: z.string().optional(),
  product_slugs: z.array(z.string()).optional(),
});

export const blockRegistry = {
  hero: HeroProps,
  category_grid: CategoryGridProps,
  ingredient_grid: IngredientGridProps,
  manifesto: ManifestoProps,
  benefits: BenefitsProps,
  newsletter: NewsletterProps,
  rich_text: RichTextProps,
  banner: BannerProps,
  faq: FaqProps,
  product_carousel: ProductCarouselProps,
} as const;

export type BlockType = keyof typeof blockRegistry;

export const Section = z.object({
  id: z.string(),
  block: z.string(),
  props: z.record(z.unknown()),
});
export type Section = z.infer<typeof Section>;

export const PageSections = z.array(Section);

/** Valida uma seção contra o schema do seu bloco. Retorna null se o bloco for desconhecido. */
export function parseSection(section: Section) {
  const schema = blockRegistry[section.block as BlockType];
  if (!schema) return null;
  const result = schema.safeParse(section.props);
  return result.success ? { block: section.block as BlockType, props: result.data } : null;
}
