"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCategory(form: {
  name: string;
  description?: string;
  slug?: string;
}) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
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
  revalidatePath("/catalogo");
}

export async function updateCategory(
  id: string,
  form: { name: string; description?: string; slug: string; status: string }
) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
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
  revalidatePath("/catalogo");
}

export async function deleteCategory(id: string) {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  const supabase = await supabaseServer();

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogo");
}
