"use server";

import { revalidatePath } from "next/cache";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Nao autorizado");
  return session;
}

export type KitItemForm = {
  component_variant_id: string;
  quantity: number;
};

export type KitForm = {
  product_id?: string;
  variant_id?: string;
  name: string;
  subtitle?: string;
  slug?: string;
  sku?: string;
  price_cents: number;
  compare_at_cents?: number | null;
  status: "draft" | "published";
  media_id?: string | null;
  items: KitItemForm[];
};

export async function saveKit(form: KitForm) {
  await requireStaff();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const name = form.name.trim();
  if (!name) throw new Error("Informe o nome do kit.");
  if (form.items.length === 0) throw new Error("Adicione pelo menos um componente ao kit.");

  const slug = form.slug?.trim() || slugify(name);
  const sku = form.sku?.trim() || `KIT-${slug.toUpperCase().slice(0, 20)}`;

  let productId = form.product_id;
  let variantId = form.variant_id;

  if (productId) {
    const { error } = await supabase
      .from("products")
      .update({
        name,
        subtitle: form.subtitle?.trim() || null,
        slug,
        type: "kit",
        status: form.status,
      })
      .eq("id", productId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert({
        tenant_id: tenantId,
        name,
        subtitle: form.subtitle?.trim() || null,
        slug,
        type: "kit",
        status: form.status,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    productId = data.id;
  }

  if (variantId) {
    const { error } = await supabase
      .from("product_variants")
      .update({
        sku,
        price_cents: form.price_cents,
        compare_at_cents: form.compare_at_cents ?? null,
        is_default: true,
      })
      .eq("id", variantId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("product_variants")
      .insert({
        tenant_id: tenantId,
        product_id: productId,
        sku,
        price_cents: form.price_cents,
        compare_at_cents: form.compare_at_cents ?? null,
        is_default: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    variantId = data.id;
  }

  await supabase
    .from("inventory")
    .upsert({
      tenant_id: tenantId,
      variant_id: variantId,
      quantity: 0,
      reserved: 0,
      track: false,
    }, { onConflict: "variant_id" });

  await supabase.from("product_kit_items").delete().eq("kit_product_id", productId);

  const itemRows = form.items
    .filter((item) => item.component_variant_id && item.quantity > 0)
    .map((item, index) => ({
      tenant_id: tenantId,
      kit_product_id: productId,
      component_variant_id: item.component_variant_id,
      quantity: item.quantity,
      sort_order: index,
    }));

  if (itemRows.length === 0) throw new Error("Adicione pelo menos um componente valido ao kit.");

  const { error: itemError } = await supabase.from("product_kit_items").insert(itemRows);
  if (itemError) throw new Error(itemError.message);

  if (form.media_id !== undefined) {
    await supabase
      .from("product_media")
      .delete()
      .eq("product_id", productId)
      .eq("role", "cover");

    if (form.media_id) {
      await supabase.from("product_media").insert({
        product_id: productId,
        media_id: form.media_id,
        role: "cover",
      });
    }
  }

  revalidatePath("/catalogo");
  revalidatePath("/catalogo/kits");
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${slug}`);
}

export async function archiveKit(productId: string, archive: boolean) {
  await requireStaff();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("products")
    .update({ status: archive ? "archived" : "draft" })
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .eq("type", "kit");

  if (error) throw new Error(error.message);
  revalidatePath("/catalogo/kits");
  revalidatePath("/catalogo");
  revalidatePath("/produtos");
}
