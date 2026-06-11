import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

const TYPE_LABEL: Record<string, string> = {
  home: "Página inicial",
  landing: "Landing page",
  institutional: "Institucional",
  blog_post: "Blog",
};

export default async function CmsPagesList() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: pages } = await supabase
    .from("pages")
    .select("id, slug, title, type, status, updated_at, published_version_id")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div>
          <Link href="/" style={{ fontSize: 11, color: "#96763f", fontWeight: 700 }}>
            ← VOLTAR
          </Link>
          <h1 style={{ fontWeight: 900, letterSpacing: -1, margin: "6px 0 0" }}>CMS · Páginas</h1>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(pages ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/cms/${p.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fff8ea",
              border: "1px solid #e6ddcb",
              padding: "18px 22px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <strong style={{ fontSize: 15 }}>{p.title}</strong>
              <p style={{ fontSize: 11, color: "#5e584b", margin: "4px 0 0" }}>
                /{p.slug} · {TYPE_LABEL[p.type] ?? p.type}
              </p>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "4px 10px",
                background: p.status === "published" ? "#21351d" : "#b9924d",
                color: "#fff8ea",
              }}
            >
              {p.status === "published" ? "PUBLICADA" : "RASCUNHO"}
            </span>
          </Link>
        ))}
        {(pages ?? []).length === 0 ? (
          <p style={{ color: "#5e584b" }}>Nenhuma página ainda.</p>
        ) : null}
      </div>
    </main>
  );
}
