import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { CategoryManager } from "../CategoryManager";
import { CatalogTabs } from "../Tabs";

export default async function CategoriasPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name, description, status, sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order");

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Catálogo</h1>
      </header>

      <CatalogTabs />

      <CategoryManager initial={categories ?? []} />
    </main>
  );
}
