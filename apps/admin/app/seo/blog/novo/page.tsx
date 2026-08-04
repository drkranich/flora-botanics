import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { saveBlogArticle, generateSeoWithAI } from "@/app/seo/actions";
import { BlogArticleForm } from "../BlogArticleForm";

export default async function NovoBlogArticlePage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/seo/blog");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: categories } = await supabase
    .from("blog_categories")
    .select("id,name,slug")
    .eq("tenant_id", tenantId)
    .order("sort_order");

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header style={{ marginBottom: 32 }}>
        <Link href="/seo/blog" className="eyebrow" style={{ opacity: 0.7, letterSpacing: "2px" }}>← Blog</Link>
        <h1 className="display" style={{ fontSize: 38, marginTop: 10, color: "var(--cream)" }}>Novo Artigo</h1>
      </header>

      <BlogArticleForm
        categories={(categories ?? []) as { id: string; name: string; slug: string }[]}
        onSave={saveBlogArticle}
        onGenerateAi={generateSeoWithAI}
      />
    </main>
  );
}
