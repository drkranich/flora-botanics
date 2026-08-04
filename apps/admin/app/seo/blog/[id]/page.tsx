import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { saveBlogArticle, generateSeoWithAI } from "@/app/seo/actions";
import { BlogArticleForm } from "../BlogArticleForm";
import type { SeoMeta } from "@/app/seo/actions";

export default async function EditBlogArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/seo/blog");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: article }, { data: categories }] = await Promise.all([
    supabase
      .from("blog_articles")
      .select("id,title,slug,subtitle,excerpt,status,category_id,author_name,author_role,published_at,reading_time_min,keywords,seo,faq")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single(),
    supabase
      .from("blog_categories")
      .select("id,name,slug")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
  ]);

  if (!article) notFound();

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header style={{ marginBottom: 32 }}>
        <Link href="/seo/blog" className="eyebrow" style={{ opacity: 0.7, letterSpacing: "2px" }}>← Blog</Link>
        <h1 className="display" style={{ fontSize: 38, marginTop: 10, color: "var(--cream)" }}>Editar Artigo</h1>
      </header>

      <BlogArticleForm
        article={{
          ...article,
          seo: (article.seo ?? {}) as SeoMeta,
          keywords: article.keywords ?? [],
          faq: (article.faq ?? []) as { q: string; a: string }[],
        }}
        categories={(categories ?? []) as { id: string; name: string; slug: string }[]}
        onSave={saveBlogArticle}
        onGenerateAi={generateSeoWithAI}
      />
    </main>
  );
}
