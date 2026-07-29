import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { CatalogTabs } from "../Tabs";
import { deleteReview, setReviewStatus } from "./actions";

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string | null;
  status: string;
  created_at: string;
  products: { name: string; slug: string } | { name: string; slug: string }[] | null;
  profiles: { email: string | null; full_name: string | null } | { email: string | null; full_name: string | null }[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

function stars(value: number) {
  return "★★★★★".slice(0, value) + "☆☆☆☆☆".slice(0, Math.max(5 - value, 0));
}

export default async function ReviewsPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("product_reviews")
    .select("id, rating, title, body, display_name, status, created_at, products(name, slug), profiles(email, full_name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(120);
  const rows = (data ?? []) as unknown as ReviewRow[];
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const storefrontUrl = (process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "https://florabotanics.com.br").replace(/\/+$/, "");

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Avaliações</h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Modere avaliações enviadas pelos clientes antes de publicar na página do produto.
        </p>
      </header>

      <CatalogTabs />

      <section className="glass rise" style={{ padding: 20, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Fila de moderação</p>
        <strong style={{ color: "var(--gold-light)", fontSize: 30 }}>{pendingCount}</strong>
        <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
          avaliações aguardando revisão
        </span>
      </section>

      <section style={cardStyle}>
        {rows.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Nenhuma avaliação enviada ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((review) => {
              const product = first(review.products);
              const profile = first(review.profiles);
              const author = review.display_name || profile?.full_name || profile?.email || "Cliente Flora";

              return (
                <article key={review.id} style={reviewStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{review.title || "Avaliação sem título"}</strong>
                      <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {author} · {product?.name ?? "Produto"} · {dateLabel(review.created_at)}
                      </p>
                    </div>
                    <span className={review.status === "approved" ? "chip chip-live" : "chip chip-draft"}>
                      {STATUS_LABEL[review.status] ?? review.status}
                    </span>
                  </div>

                  <p style={{ margin: "8px 0 0", color: "var(--gold-light)", fontSize: 13 }}>
                    {stars(review.rating)}
                  </p>
                  <p style={{ margin: "8px 0 0", color: "var(--cream-soft)", fontSize: 13, lineHeight: 1.65 }}>
                    {review.body}
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {review.status !== "approved" ? (
                      <form action={setReviewStatus.bind(null, review.id, "approved")}>
                        <button className="btn btn-gold" style={buttonStyle}>Aprovar</button>
                      </form>
                    ) : null}
                    {review.status !== "rejected" ? (
                      <form action={setReviewStatus.bind(null, review.id, "rejected")}>
                        <button className="btn btn-ghost" style={buttonStyle}>Rejeitar</button>
                      </form>
                    ) : null}
                    {review.status !== "pending" ? (
                      <form action={setReviewStatus.bind(null, review.id, "pending")}>
                        <button className="btn btn-ghost" style={buttonStyle}>Voltar para análise</button>
                      </form>
                    ) : null}
                    <form action={deleteReview.bind(null, review.id)}>
                      <button className="btn btn-ghost" style={{ ...buttonStyle, color: "#e8a0a0", borderColor: "rgba(232,160,160,0.38)" }}>
                        Excluir
                      </button>
                    </form>
                    {product?.slug ? (
                      <Link href={`${storefrontUrl}/produtos/${product.slug}`} className="btn btn-ghost" style={buttonStyle}>
                        Ver produto
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--glass-bg-strong)",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  padding: 20,
  backdropFilter: "blur(18px) saturate(1.25)",
  WebkitBackdropFilter: "blur(18px) saturate(1.25)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
};

const reviewStyle: React.CSSProperties = {
  border: "1px solid rgba(242,236,223,0.10)",
  borderRadius: 12,
  padding: 16,
  background: "rgba(10,22,11,0.28)",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: 10,
};
