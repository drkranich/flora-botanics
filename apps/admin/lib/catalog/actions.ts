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
  gallery_media_ids?: string[];
  editorial_content?: ProductEditorialContent;
  status: "draft" | "published";
};

export type ProductEditorialCard = {
  eyebrow: string;
  title: string;
  body: string;
};

export type ProductFaqItem = {
  question: string;
  answer: string;
};

export type ProductEditorialContent = {
  cards: ProductEditorialCard[];
  faq_title: string;
  faq: ProductFaqItem[];
};

function galleryIds(form: ProductForm) {
  const ids = form.gallery_media_ids?.length ? form.gallery_media_ids : form.media_id ? [form.media_id] : [];
  return Array.from(new Set(ids.filter(Boolean)));
}

function cleanText(value: unknown, max = 700) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeEditorialContent(value?: ProductEditorialContent) {
  const cards = (value?.cards ?? [])
    .slice(0, 6)
    .map((card) => ({
      eyebrow: cleanText(card.eyebrow, 80),
      title: cleanText(card.title, 140),
      body: cleanText(card.body, 900),
    }))
    .filter((card) => card.eyebrow || card.title || card.body);

  const faq = (value?.faq ?? [])
    .slice(0, 10)
    .map((item) => ({
      question: cleanText(item.question, 180),
      answer: cleanText(item.answer, 1000),
    }))
    .filter((item) => item.question || item.answer);

  return {
    cards,
    faq_title: cleanText(value?.faq_title, 100) || "Dúvidas rápidas",
    faq,
  };
}

async function replaceProductMedia(productId: string, mediaIds: string[]) {
  const supabase = await supabaseServer();

  await supabase.from("product_media").delete().eq("product_id", productId);

  if (mediaIds.length === 0) return;

  const { error } = await supabase.from("product_media").insert(
    mediaIds.map((mediaId, index) => ({
      product_id: productId,
      media_id: mediaId,
      role: index === 0 ? "cover" : "gallery",
      sort_order: index,
    }))
  );

  if (error) throw new Error(error.message);
}

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
      editorial_content: normalizeEditorialContent(form.editorial_content),
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
  await replaceProductMedia(product.id, galleryIds(form));

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
      editorial_content: normalizeEditorialContent(form.editorial_content),
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

  // Galeria/reel: primeira imagem vira capa, demais entram como galeria.
  if (form.gallery_media_ids !== undefined || form.media_id !== undefined) {
    await replaceProductMedia(productId, galleryIds(form));
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
