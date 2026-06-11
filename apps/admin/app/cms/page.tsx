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
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 36 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>
          ← Painel
        </Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>
          Páginas do site
        </h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Edite e publique sem precisar de deploy — o site atualiza em até um minuto.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(pages ?? []).map((p, i) => (
          <Link key={p.id} href={`/cms/${p.id}`}>
            <div
              className={`glass glass-hover rise rise-${Math.min(i + 1, 4)}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 18,
                padding: "22px 26px",
              }}
            >
              <div>
                <strong style={{ fontSize: 16, letterSpacing: 0.2 }}>{p.title}</strong>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                  /{p.slug} · {TYPE_LABEL[p.type] ?? p.type}
                </p>
              </div>
              <span className={`chip ${p.status === "published" ? "chip-live" : "chip-draft"}`}>
                {p.status === "published" ? "No ar" : "Rascunho"}
              </span>
            </div>
          </Link>
        ))}
        {(pages ?? []).length === 0 ? (
          <p className="muted">Nenhuma página ainda.</p>
        ) : null}
      </div>
    </main>
  );
}
