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
      <header style={{ marginBottom: 28 }}>
        <Link href="/seo/blog" className="eyebrow" style={{ opacity: 0.8 }}>← Blog</Link>
        <h1 className="display" style={{ fontSize: 36, marginTop: 10 }}>Nova Categoria</h1>
      </header>

      <div style={{ background: "rgba(255,255,255,0.8)", border: "1px solid #e0d5c5", borderRadius: 12, padding: "24px" }}>
        <form
          action={async (fd: FormData) => {
            "use server";
            const name = fd.get("name") as string;
            const slug = fd.get("slug") as string;
            await saveBlogCategory({ name, slug, description: fd.get("description") as string || undefined });
            redirect("/seo/blog");
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <label className="label">Nome *</label>
            <input name="name" className="glass-input" placeholder="Ex: Skincare" required />
          </div>
          <div>
            <label className="label">Slug *</label>
            <input name="slug" className="glass-input" placeholder="skincare" required style={{ fontFamily: "monospace" }} />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea name="description" className="glass-input" rows={2} placeholder="Breve descrição da categoria..." />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <Link href="/seo/blog" className="btn-ghost" style={{ fontSize: 13 }}>Cancelar</Link>
            <button type="submit" className="btn" style={{ fontSize: 13 }}>Criar categoria</button>
          </div>
        </form>
      </div>
    </main>
  );
}
