import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { CatalogTabs } from "./Tabs";
import { ProductManager, type ProductRow } from "./ProductManager";
import { ImportProducts } from "./ImportProducts";

export default async function ProdutosPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, subtitle, slug, status,
         product_variants(id, sku, price_cents, compare_at_cents, is_default, inventory(quantity)),
         product_categories(category_id),
         product_media(role, media(id, storage_path))`
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
  ]);

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

  const rows: ProductRow[] = (products ?? []).map((p) => {
    const variants = (p.product_variants ?? []) as Array<{
      id: string;
      sku: string;
      price_cents: number;
      compare_at_cents: number | null;
      is_default: boolean;
      inventory: { quantity: number } | { quantity: number }[] | null;
    }>;
    const v = variants.find((x) => x.is_default) ?? variants[0];
    const inv = Array.isArray(v?.inventory) ? v?.inventory[0] : v?.inventory;
    const pm = (p.product_media ?? []) as Array<{
      role: string;
      media: { id: string; storage_path: string } | null;
    }>;
    const cover = pm.find((m) => m.role === "cover")?.media ?? null;
    const pc = (p.product_categories ?? []) as Array<{ category_id: string }>;

    return {
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      slug: p.slug,
      status: p.status,
      variant_id: v?.id ?? "",
      sku: v?.sku ?? "",
      price_cents: v?.price_cents ?? 0,
      compare_at_cents: v?.compare_at_cents ?? null,
      stock: inv?.quantity ?? 0,
      category_id: pc[0]?.category_id ?? null,
      cover_url: cover ? storageBase + cover.storage_path : null,
      cover_media_id: cover?.id ?? null,
    };
  });

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Catálogo</h1>
      </header>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <CatalogTabs />
        <div style={{ marginBottom: 26 }}>
          <ImportProducts />
        </div>
      </div>

      <ProductManager
        initial={rows}
        categories={(categories ?? []) as Array<{ id: string; name: string }>}
        tenantId={tenantId}
      />
    </main>
  );
}
