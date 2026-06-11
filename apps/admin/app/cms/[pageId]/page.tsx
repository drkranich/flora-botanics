import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { PageEditor } from "./PageEditor";

export default async function CmsPageEditor({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const { pageId } = await params;
  const supabase = await supabaseServer();

  const { data: page } = await supabase
    .from("pages")
    .select("id, slug, title, status, published_version_id")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) notFound();

  // carrega a versão mais recente (rascunho de partida)
  const { data: latest } = await supabase
    .from("page_versions")
    .select("id, version, sections")
    .eq("page_id", pageId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sections = (latest?.sections ?? []) as Array<{
    id: string;
    block: string;
    props: Record<string, unknown>;
  }>;

  const isLatestPublished = latest?.id === page.published_version_id;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/cms" style={{ fontSize: 11, color: "#96763f", fontWeight: 700 }}>
          ← PÁGINAS
        </Link>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, margin: "6px 0 4px" }}>{page.title}</h1>
        <p style={{ fontSize: 12, color: "#5e584b", margin: 0 }}>
          /{page.slug} · versão {latest?.version ?? 0}
          {isLatestPublished ? " (publicada)" : " (há edições não publicadas)"}
        </p>
      </header>

      <PageEditor pageId={page.id} initialSections={sections} />
    </main>
  );
}
