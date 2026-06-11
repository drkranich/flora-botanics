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

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  return session;
}

/* ================= CATEGORIAS ================= */

export async function createCategory(form: {
  name: string;
  description?: string;
  slug?: string;
}) {
  await requireStaff();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("categories").insert({
    tenant_id: tenantId,
    name: form.name.trim(),
    slug: form.slug?.trim() || slugify(form.name),
    description: form.description?.trim() || null,
    status: "published",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/catalogo/categorias");
}

export async function updateCategory(
  id: string,
  form: { name: string; description?: string; slug: string; status: string }
) {
  await requireStaff();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("categories")
    .update({
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description?.trim() || null,
      status: form.status,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogo/categorias");
}

export async function deleteCategory(id: string) {
  await requireStaff();
  const supabase = await supabaseServer();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogo/categorias");
}

/* ================= PRODUTOS ================= */

export type ProductForm = {
  name: string;
  subtitle?: string;
  slug?: string;
  price_cents: number;
  compare_at_cents?: number | null;
  sku?: string;
  stock: number;
  category_id?: string | null;
  media_id?: string | null;
  status: "draft" | "published";
};

export async function createProduct(form: ProductForm) {
  await requireStaff();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const slug = form.slug?.trim() || slugify(form.name);

  const { data: product, error: pErr } = await supabase
    .from("products")
    .insert({
      tenant_id: tenantId,
      name: form.name.trim(),
      subtitle: form.subtitle?.trim() || null,
      slug,
      type: "simple",
      status: form.status,
    })
    .select("id")
    .single();
  if (pErr) throw new Error(pErr.message);

  const { data: variant, error: vErr } = await supabase
    .from("product_variants")
    .insert({
      tenant_id: tenantId,
      product_id: product.id,
      sku: form.sku?.trim() || slug.toUpperCase().slice(0, 24),
      price_cents: form.price_cents,
      compare_at_cents: form.compare_at_cents ?? null,
      is_default: true,
    })
    .select("id")
    .single();
  if (vErr) throw new Error(vErr.message);

  const { error: iErr } = await supabase.from("inventory").insert({
    tenant_id: tenantId,
    variant_id: variant.id,
    quantity: form.stock,
  });
  if (iErr) throw new Error(iErr.message);

  if (form.category_id) {
    await supabase
      .from("product_categories")
      .insert({ product_id: product.id, category_id: form.category_id });
  }
  if (form.media_id) {
    await supabase
      .from("product_media")
      .insert({ product_id: product.id, media_id: form.media_id, role: "cover" });
  }

  revalidatePath("/catalogo");
}

export async function updateProduct(
  productId: string,
  variantId: string,
  form: ProductForm
) {
  await requireStaff();
  const supabase = await supabaseServer();

  const { error: pErr } = await supabase
    .from("products")
    .update({
      name: form.name.trim(),
      subtitle: form.subtitle?.trim() || null,
      slug: form.slug?.trim() || slugify(form.name),
      status: form.status,
    })
    .eq("id", productId);
  if (pErr) throw new Error(pErr.message);

  const { error: vErr } = await supabase
    .from("product_variants")
    .update({
      price_cents: form.price_cents,
      compare_at_cents: form.compare_at_cents ?? null,
      ...(form.sku ? { sku: form.sku.trim() } : {}),
    })
    .eq("id", variantId);
  if (vErr) throw new Error(vErr.message);

  await supabase
    .from("inventory")
    .update({ quantity: form.stock })
    .eq("variant_id", variantId);

  // categoria (single-select no MVP): substitui vínculos
  await supabase.from("product_categories").delete().eq("product_id", productId);
  if (form.category_id) {
    await supabase
      .from("product_categories")
      .insert({ product_id: productId, category_id: form.category_id });
  }

  // capa
  if (form.media_id !== undefined) {
    await supabase
      .from("product_media")
      .delete()
      .eq("product_id", productId)
      .eq("role", "cover");
    if (form.media_id) {
      await supabase
        .from("product_media")
        .insert({ product_id: productId, media_id: form.media_id, role: "cover" });
    }
  }

  revalidatePath("/catalogo");
}

export async function archiveProduct(productId: string, archive: boolean) {
  await requireStaff();
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("products")
    .update({ status: archive ? "archived" : "draft" })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogo");
}
