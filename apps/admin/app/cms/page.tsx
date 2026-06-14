import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { PagesList, type PageRow } from "./PagesList";

export default async function CmsPagesList() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: pages } = await supabase
    .from("pages")
    .select("id, slug, title, type, status, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 28 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Site · Páginas</h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Edite e publique sem deploy — o site atualiza em até um minuto.
        </p>
      </header>

      <PagesList rows={(pages ?? []) as PageRow[]} storefrontUrl={storefrontUrl} />
    </main>
  );
}
