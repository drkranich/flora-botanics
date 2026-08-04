import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { saveSeoMeta, runSeoAudit, generateSeoWithAI } from "@/app/seo/actions";
import { SeoMetaEditor } from "@/components/SeoMetaEditor";
import type { SeoMeta } from "@/app/seo/actions";
import { SeoCenterPage } from "../SeoCenterPage";

export default async function SeoProductRoute({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  // Sem ID → grid de produtos
  if (!id) return <SeoCenterPage activeSection="produtos" />;

  // Com ID → abre editor do produto específico
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: product } = await supabase
    .from("products")
    .select("id,name,slug,seo,status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!product) redirect("/seo/produtos");

  async function save(meta: SeoMeta) {
    "use server";
    return saveSeoMeta("product", id!, meta);
  }
  async function generateAi(ctx: Parameters<typeof generateSeoWithAI>[0]) {
    "use server";
    return generateSeoWithAI(ctx);
  }
  async function audit() {
    "use server";
    return runSeoAudit("product", id!);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header style={{ marginBottom: 32 }}>
        <Link href="/seo/produtos" className="eyebrow" style={{ opacity: 0.7, letterSpacing: "2px" }}>
          ← Produtos
        </Link>
        <h1 className="display" style={{ fontSize: 36, marginTop: 10, color: "var(--cream)" }}>
          {product.name ?? product.slug}
        </h1>
        <p style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 4, fontFamily: "monospace" }}>
          /{product.slug}
        </p>
      </header>

      <SeoMetaEditor
        entityType="product"
        entityId={product.id}
        entityName={product.name ?? product.slug}
        initial={(product.seo ?? {}) as SeoMeta}
        onSave={save}
        onAiGenerate={generateAi}
        onRunAudit={audit}
      />
    </main>
  );
}
