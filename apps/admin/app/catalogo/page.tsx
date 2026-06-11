import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { CategoryManager } from "./CategoryManager";

export default async function CatalogoPage() {
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
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 36 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>
          ← Painel
        </Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>
          Catálogo
        </h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Categorias da loja. O slug é o identificador usado nas seções do CMS
          (ex.: grade de categorias da home). Produtos chegam em seguida.
        </p>
      </header>

      <CategoryManager initial={categories ?? []} />
    </main>
  );
}
