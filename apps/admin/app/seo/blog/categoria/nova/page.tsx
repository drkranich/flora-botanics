import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase/server";
import { saveBlogCategory } from "@/app/seo/actions";

export default async function NovaBlogCategoriaPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/seo/blog");

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header style={{ marginBottom: 32 }}>
        <Link href="/seo/blog" className="eyebrow" style={{ opacity: 0.7, letterSpacing: "2px" }}>← Blog</Link>
        <h1 className="display" style={{ fontSize: 36, marginTop: 10, color: "var(--cream)" }}>Nova Categoria</h1>
      </header>

      <div style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-md)",
        backdropFilter: "blur(18px) saturate(1.25)",
        WebkitBackdropFilter: "blur(18px) saturate(1.25)",
        boxShadow: "var(--shadow-soft)",
        padding: "28px 32px",
      }}>
        <form
          action={async (fd: FormData) => {
            "use server";
            const name = fd.get("name") as string;
            const slug = fd.get("slug") as string;
            await saveBlogCategory({ name, slug, description: fd.get("description") as string || undefined });
            redirect("/seo/blog");
          }}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <div>
            <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "1.8px", textTransform: "uppercase", color: "var(--cream-dim)", marginBottom: 7 }}>
              Nome *
            </label>
            <input name="name" className="input" placeholder="Ex: Skincare" required autoFocus />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "1.8px", textTransform: "uppercase", color: "var(--cream-dim)", marginBottom: 7 }}>
              Slug *
            </label>
            <input name="slug" className="input" placeholder="skincare" required style={{ fontFamily: "monospace", fontSize: 13 }} />
            <p style={{ fontSize: 11, color: "var(--cream-dim)", marginTop: 5 }}>
              Usado na URL: /blog?categoria=<span style={{ color: "var(--gold-light)" }}>skincare</span>
            </p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "1.8px", textTransform: "uppercase", color: "var(--cream-dim)", marginBottom: 7 }}>
              Descrição
            </label>
            <textarea name="description" className="input" rows={3} placeholder="Breve descrição da categoria..." />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--glass-border)", marginTop: 4 }}>
            <Link href="/seo/blog" className="btn btn-ghost" style={{ fontSize: 12 }}>Cancelar</Link>
            <button type="submit" className="btn btn-gold" style={{ fontSize: 12 }}>Criar categoria</button>
          </div>
        </form>
      </div>
    </main>
  );
}
