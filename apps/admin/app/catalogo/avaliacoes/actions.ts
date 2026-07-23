"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

const VALID_STATUS = new Set(["pending", "approved", "rejected"]);

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function revalidateProductReviewPaths(reviewId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("product_reviews")
    .select("products(slug)")
    .eq("id", reviewId)
    .maybeSingle();
  const product = first((data as { products?: { slug: string } | { slug: string }[] | null } | null)?.products);

  revalidatePath("/catalogo/avaliacoes");
  if (product?.slug) revalidatePath(`/produtos/${product.slug}`);
}

async function requireReviewer() {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  if (session.role === "tenant_editor") throw new Error("Seu perfil não aprova avaliações.");
}

export async function setReviewStatus(reviewId: string, status: string) {
  await requireReviewer();
  if (!VALID_STATUS.has(status)) throw new Error("Status inválido.");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("product_reviews")
    .update({ status })
    .eq("tenant_id", tenantId)
    .eq("id", reviewId);

  if (error) throw new Error(error.message);
  await revalidateProductReviewPaths(reviewId);
}

export async function deleteReview(reviewId: string) {
  await requireReviewer();

  const tenantId = await effectiveTenantId();
  await revalidateProductReviewPaths(reviewId);

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", reviewId);

  if (error) throw new Error(error.message);
  revalidatePath("/catalogo/avaliacoes");
}
