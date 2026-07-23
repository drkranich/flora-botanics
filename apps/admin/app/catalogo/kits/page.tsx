import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogTabs } from "../Tabs";
import { KitManager, type ComponentVariantRow, type KitItemRow, type KitRow } from "./KitManager";
import { SiteChip } from "@/components/SiteChip";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

type MaybeArray<T> = T | T[] | null | undefined;

type ProductVariantRecord = {
  id: string;
  sku: string;
  name: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  currency: string;
  is_default: boolean;
  inventory?: MaybeArray<{ quantity: number; reserved: number | null; track: boolean | null }>;
};

type ProductMediaRecord = {
  role: string;
  media: MaybeArray<{ id: string; storage_path: string }>;
};

type ProductRecord = {
  id: string;
  name: string;
  subtitle: string | null;
  slug: string;
  status: string;
  product_variants?: ProductVariantRecord[];
  product_media?: ProductMediaRecord[];
};

type KitItemRecord = {
  id: string;
  kit_product_id: string;
  component_variant_id: string;
  quantity: number;
  sort_order: number;
};

type ComponentRecord = {
  id: string;
  product_id: string;
  sku: string;
  name: string | null;
  price_cents: number;
  currency: string;
  inventory?: MaybeArray<{ quantity: number; reserved: number | null; track: boolean | null }>;
  products?: MaybeArray<{ id: string; name: string; slug: string; type: string; status: string }>;
};

function first<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function availableForKit(items: KitItemRow[], components: Map<string, ComponentVariantRow>) {
  if (items.length === 0) return 0;
  return Math.min(
    ...items.map((item) => {
      const component = components.get(item.component_variant_id);
      if (!component) return 0;
      return Math.floor(component.stock / Math.max(item.quantity, 1));
    })
  );
}

export default async function KitsPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [tenantRes, kitsRes, kitItemsRes, componentsRes] = await Promise.all([
    supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
    supabase
      .from("products")
      .select(
        `id, name, subtitle, slug, status,
         product_variants(id, sku, name, price_cents, compare_at_cents, currency, is_default, inventory(quantity, reserved, track)),
         product_media(role, media(id, storage_path))`
      )
      .eq("tenant_id", tenantId)
      .eq("type", "kit")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_kit_items")
      .select("id, kit_product_id, component_variant_id, quantity, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase
      .from("product_variants")
      .select("id, product_id, sku, name, price_cents, currency, inventory(quantity, reserved, track), products(id, name, slug, type, status)")
      .eq("tenant_id", tenantId)
      .order("sku"),
  ]);

  const migrationMissing = Boolean(
    kitItemsRes.error &&
      /product_kit_items|schema cache|does not exist|could not find/i.test(kitItemsRes.error.message)
  );

  if (kitsRes.error) throw new Error(kitsRes.error.message);
  if (componentsRes.error) throw new Error(componentsRes.error.message);
  if (kitItemsRes.error && !migrationMissing) throw new Error(kitItemsRes.error.message);

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

  const components: ComponentVariantRow[] = ((componentsRes.data ?? []) as unknown as ComponentRecord[])
    .map((variant) => {
      const product = first(variant.products);
      const inventory = first(variant.inventory);
      return {
        id: variant.id,
        product_id: variant.product_id,
        product_name: product?.name ?? "Produto sem nome",
        variant_name: variant.name,
        sku: variant.sku,
        price_cents: variant.price_cents,
        currency: variant.currency,
        stock: Math.max((inventory?.quantity ?? 0) - (inventory?.reserved ?? 0), 0),
        product_type: product?.type,
        product_status: product?.status,
      };
    })
    .filter((component) => component.product_type !== "kit" && component.product_status !== "archived")
    .map(({ product_type: _productType, product_status: _productStatus, ...component }) => component);

  const componentMap = new Map(components.map((component) => [component.id, component]));
  const itemsByKit = new Map<string, KitItemRow[]>();

  for (const item of ((kitItemsRes.data ?? []) as KitItemRecord[])) {
    const current = itemsByKit.get(item.kit_product_id) ?? [];
    current.push({
      id: item.id,
      component_variant_id: item.component_variant_id,
      quantity: item.quantity,
    });
    itemsByKit.set(item.kit_product_id, current);
  }

  const kits: KitRow[] = ((kitsRes.data ?? []) as unknown as ProductRecord[]).map((product) => {
    const variants = product.product_variants ?? [];
    const variant = variants.find((item) => item.is_default) ?? variants[0];
    const mediaRows = product.product_media ?? [];
    const coverRaw = mediaRows.find((item) => item.role === "cover")?.media ?? mediaRows[0]?.media ?? null;
    const cover = first(coverRaw);
    const items = itemsByKit.get(product.id) ?? [];

    return {
      id: product.id,
      name: product.name,
      subtitle: product.subtitle,
      slug: product.slug,
      status: product.status,
      variant_id: variant?.id ?? "",
      sku: variant?.sku ?? "",
      price_cents: variant?.price_cents ?? 0,
      compare_at_cents: variant?.compare_at_cents ?? null,
      cover_url: cover ? storageBase + cover.storage_path : null,
      cover_media_id: cover?.id ?? null,
      available_stock: availableForKit(items, componentMap),
      items,
    };
  });

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 44 }}>Kits</h1>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              Monte combos reais usando produtos e variantes ja cadastrados.
            </p>
          </div>
          <SiteChip name={tenantRes.data?.name} isPlatformAdmin={session.role === "platform_admin"} />
        </div>
      </header>

      <CatalogTabs />

      <KitManager
        initial={kits}
        components={components}
        tenantId={tenantId}
        migrationMissing={migrationMissing}
      />
    </main>
  );
}
