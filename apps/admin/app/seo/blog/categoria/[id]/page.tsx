import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { saveBlogCategory } from "@/app/seo/actions";

export default async function EditBlogCategoriaPage({
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

  const { data: cat } = await supabase
    .from("blog_categories")
    .select("id,name,slug,description,sort_order")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!cat) notFound();

  const GLASS_CARD = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: "var(--radius-md)",
    backdropFilter: "blur(18px) saturate(1.25)",
    WebkitBackdropFilter: "blur(18px) saturate(1.25)",
    boxShadow: "var(--shadow-soft)",
    padding: "28px 32px",
  } as const;

  const FL = {
    display: "block",
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: "1.8px",
    textTransform: "uppercase" as const,
    color: "var(--cream-dim)",
    marginBottom: 7,
  };

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header style={{ marginBottom: 32 }}>
        <Link href="/seo/blog" className="eyebrow" style={{ opacity: 0.7, letterSpacing: "2px" }}>
          ← Blog
        </Link>
        <h1 className="display" style={{ fontSize: 36, marginTop: 10, color: "var(--cream)" }}>
          Editar Categoria
        </h1>
      </header>

      <div style={GLASS_CARD}>
        <form
          action={async (fd: FormData) => {
            "use server";
            await saveBlogCategory({
              id,
              name: fd.get("name") as string,
              slug: fd.get("slug") as string,
              description: (fd.get("description") as string) || undefined,
              sort_order: Number(fd.get("sort_order")) || 0,
            });
            redirect("/seo/blog");
          }}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <div>
            <label style={FL}>Nome *</label>
            <input name="name" className="input" defaultValue={cat.name} required autoFocus />
          </div>

          <div>
            <label style={FL}>Slug *</label>
            <input
              name="slug"
              className="input"
              defaultValue={cat.slug}
              required
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
            <p style={{ fontSize: 11, color: "var(--cream-dim)", marginTop: 5 }}>
              Usado na URL: /blog?categoria=
              <span style={{ color: "var(--gold-light)" }}>{cat.slug}</span>
            </p>
          </div>

          <div>
            <label style={FL}>Descrição</label>
            <textarea
              name="description"
              className="input"
              rows={3}
              defaultValue={cat.description ?? ""}
              placeholder="Breve descrição da categoria..."
            />
          </div>

          <div>
            <label style={FL}>Ordem de exibição</label>
            <input
              name="sort_order"
              type="number"
              className="input"
              defaultValue={cat.sort_order ?? 0}
              style={{ width: 100 }}
            />
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 8,
            borderTop: "1px solid var(--glass-border)",
            marginTop: 4,
          }}>
            <Link href="/seo/blog" className="btn btn-ghost" style={{ fontSize: 12 }}>
              Cancelar
            </Link>
            <button type="submit" className="btn btn-gold" style={{ fontSize: 12 }}>
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
