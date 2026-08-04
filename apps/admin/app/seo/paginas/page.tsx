import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { saveSeoMeta, runSeoAudit, generateSeoWithAI } from "@/app/seo/actions";
import { SeoMetaEditor } from "@/components/SeoMetaEditor";
import type { SeoMeta } from "@/app/seo/actions";
import { SeoCenterPage } from "../SeoCenterPage";

export default async function SeoPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  // Sem ID → lista normal
  if (!id) return <SeoCenterPage activeSection="paginas" />;

  // Com ID → abre editor da página específica
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: page } = await supabase
    .from("pages")
    .select("id,title,slug,seo")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!page) redirect("/seo/paginas");

  async function save(meta: SeoMeta) {
    "use server";
    return saveSeoMeta("page", id!, meta);
  }
  async function generateAi(ctx: Parameters<typeof generateSeoWithAI>[0]) {
    "use server";
    return generateSeoWithAI(ctx);
  }
  async function audit() {
    "use server";
    return runSeoAudit("page", id!);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header style={{ marginBottom: 32 }}>
        <Link href="/seo/paginas" className="eyebrow" style={{ opacity: 0.7, letterSpacing: "2px" }}>
          ← Páginas
        </Link>
        <h1 className="display" style={{ fontSize: 36, marginTop: 10, color: "var(--cream)" }}>
          {page.title ?? page.slug}
        </h1>
        <p style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 4, fontFamily: "monospace" }}>
          /{page.slug}
        </p>
      </header>

      <SeoMetaEditor
        entityType="page"
        entityId={page.id}
        entityName={page.title ?? page.slug}
        initial={(page.seo ?? {}) as SeoMeta}
        onSave={save}
        onAiGenerate={generateAi}
        onRunAudit={audit}
      />
    </main>
  );
}
