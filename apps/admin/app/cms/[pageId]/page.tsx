import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
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
  const tenantId = await effectiveTenantId();
  const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";

  return (
    <main style={{ maxWidth: 1480, margin: "0 auto", padding: "48px 28px 120px" }}>
      <header className="rise" style={{ marginBottom: 32 }}>
        <Link href="/cms" className="eyebrow" style={{ opacity: 0.8 }}>
          ← Páginas
        </Link>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 14,
            marginTop: 10,
          }}
        >
          <div>
            <h1 className="display" style={{ fontSize: 42 }}>{page.title}</h1>
            <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>
              /{page.slug} · versão {latest?.version ?? 0}
            </p>
          </div>
          <span className={`chip ${isLatestPublished ? "chip-live" : "chip-draft"}`}>
            {isLatestPublished ? "Versão no ar" : "Edições não publicadas"}
          </span>
        </div>
      </header>

      <PageEditor
        pageId={page.id}
        initialSections={sections}
        tenantId={tenantId}
        storefrontUrl={storefrontUrl}
      />
    </main>
  );
}
