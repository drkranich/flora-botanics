"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ImportItem = {
  name: string;
  subtitle: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  category_key: string | null; // nome ou slug da categoria
  sku: string | null;
  published: boolean;
};

export type ImportResult = {
  created: number;
  skipped: { name: string; reason: string }[];
};

const MAX_ROWS = 500;

/** Importa produtos em lote. Slugs já existentes são pulados (não sobrescreve). */
export async function importProducts(items: ImportItem[]): Promise<ImportResult> {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  if (items.length === 0) throw new Error("Nenhuma linha válida para importar");
  if (items.length > MAX_ROWS) throw new Error(`Máximo de ${MAX_ROWS} linhas por importação`);

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  // categorias do tenant (resolve por slug ou nome, sem acento/caixa)
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("tenant_id", tenantId);
  const catMap = new Map<string, string>();
  for (const c of cats ?? []) {
    catMap.set(c.slug, c.id);
    catMap.set(slugify(c.name), c.id);
  }

  // slugs de produto já existentes
  const { data: existing } = await supabase
    .from("products")
    .select("slug")
    .eq("tenant_id", tenantId);
  const taken = new Set((existing ?? []).map((p) => p.slug));

  const result: ImportResult = { created: 0, skipped: [] };

  for (const item of items) {
    const slug = slugify(item.name);
    if (!slug) {
      result.skipped.push({ name: item.name, reason: "nome inválido" });
      continue;
    }
    if (taken.has(slug)) {
      result.skipped.push({ name: item.name, reason: "já existe (slug repetido)" });
      continue;
    }

    const { data: product, error: pErr } = await supabase
      .from("products")
      .insert({
        tenant_id: tenantId,
        name: item.name,
        subtitle: item.subtitle,
        slug,
        type: "simple",
        status: item.published ? "published" : "draft",
      })
      .select("id")
      .single();
    if (pErr) {
      result.skipped.push({ name: item.name, reason: pErr.message });
      continue;
    }
    taken.add(slug);

    const { data: variant, error: vErr } = await supabase
      .from("product_variants")
      .insert({
        tenant_id: tenantId,
        product_id: product.id,
        sku: item.sku || slug.toUpperCase().slice(0, 24),
        price_cents: item.price_cents,
        compare_at_cents: item.compare_at_cents,
        is_default: true,
      })
      .select("id")
      .single();
    if (vErr) {
      result.skipped.push({ name: item.name, reason: `variante: ${vErr.message}` });
      continue;
    }

    await supabase.from("inventory").insert({
      tenant_id: tenantId,
      variant_id: variant.id,
      quantity: item.stock,
    });

    if (item.category_key) {
      const catId = catMap.get(slugify(item.category_key));
      if (catId) {
        await supabase
          .from("product_categories")
          .insert({ product_id: product.id, category_id: catId });
      }
    }

    result.created++;
  }

  revalidatePath("/catalogo");
  return result;
}
