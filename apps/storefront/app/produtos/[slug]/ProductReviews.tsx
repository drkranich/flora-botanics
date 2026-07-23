"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { storefrontSupabase } from "@/lib/supabase-browser";

export interface ApprovedReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string | null;
  created_at: string;
}

interface OwnReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Em análise",
  approved: "Publicado",
  rejected: "Revisar e reenviar",
};

function reviewDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(iso));
}

function average(reviews: ApprovedReview[]) {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

function stars(value: number) {
  return "★★★★★".slice(0, value) + "☆☆☆☆☆".slice(0, Math.max(5 - value, 0));
}

export function ProductReviews({
  tenantId,
  productId,
  reviews,
}: {
  tenantId: string;
  productId: string;
  reviews: ApprovedReview[];
}) {
  const supabase = useMemo(() => storefrontSupabase(), []);
  const [authenticated, setAuthenticated] = useState(false);
  const [ownReview, setOwnReview] = useState<OwnReview | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const score = average(reviews);

  useEffect(() => {
    let mounted = true;

    async function loadOwnReview() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        if (mounted) setAuthenticated(false);
        return;
      }

      const { data } = await supabase
        .from("product_reviews")
        .select("id, rating, title, body, status")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("profile_id", userId)
        .maybeSingle();

      if (!mounted) return;
      setAuthenticated(true);

      if (data) {
        const review = data as OwnReview;
        setOwnReview(review);
        setRating(review.rating);
        setTitle(review.title ?? "");
        setBody(review.body);
      }
    }

    loadOwnReview();
    return () => {
      mounted = false;
    };
  }, [productId, supabase, tenantId]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        window.location.href = "/conta";
        return;
      }

      if (!body.trim()) {
        setError("Escreva sua avaliação antes de enviar.");
        return;
      }

      const displayName =
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
        user.email ||
        "Cliente Flora";
      const payload = {
        tenant_id: tenantId,
        product_id: productId,
        profile_id: user.id,
        rating,
        title: title.trim() || null,
        body: body.trim(),
        display_name: displayName,
        status: "pending",
      };

      const result =
        ownReview && ownReview.status !== "approved"
          ? await supabase.from("product_reviews").update(payload).eq("id", ownReview.id)
          : await supabase.from("product_reviews").insert(payload).select("id").maybeSingle();

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setOwnReview({
        id: ownReview?.id ?? ((result.data as { id?: string } | null)?.id ?? ""),
        rating,
        title: title.trim() || null,
        body: body.trim(),
        status: "pending",
      });
      setMessage("Avaliação enviada para análise.");
    });
  }

  return (
    <section className="product-reviews-panel" aria-label="Avaliações do produto">
      <div className="product-reviews-head">
        <div>
          <span className="eyebrow">Avaliações</span>
          <h2>Opiniões de quem já cuidou da pele com este produto</h2>
        </div>
        <div className="product-review-score">
          <strong>{score ? score.toFixed(1).replace(".", ",") : "0,0"}</strong>
          <span>{stars(Math.round(score || 0))}</span>
          <em>{reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"}</em>
        </div>
      </div>

      <div className="product-reviews-grid">
        <div className="product-review-list">
          {reviews.length === 0 ? (
            <article className="product-review-card">
              <strong>Nenhuma avaliação publicada ainda</strong>
              <p>Seja a primeira pessoa a registrar sua experiência com este produto.</p>
            </article>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className="product-review-card">
                <div>
                  <span aria-label={`${review.rating} de 5 estrelas`}>{stars(review.rating)}</span>
                  <em>{reviewDate(review.created_at)}</em>
                </div>
                <strong>{review.title || "Avaliação Flora"}</strong>
                <p>{review.body}</p>
                <small>{review.display_name || "Cliente Flora"}</small>
              </article>
            ))
          )}
        </div>

        <form className="product-review-form" onSubmit={submit}>
          <span className="eyebrow">Sua avaliação</span>
          {ownReview ? (
            <p className="product-review-status">
              Status: {STATUS_LABEL[ownReview.status] ?? ownReview.status}
            </p>
          ) : null}

          {!authenticated ? (
            <div className="product-review-login">
              <p>Entre na sua conta para avaliar este produto.</p>
              <Link href="/conta" className="btn">
                Entrar ou criar conta
              </Link>
            </div>
          ) : ownReview?.status === "approved" ? (
            <p className="product-review-status">Sua avaliação já está publicada.</p>
          ) : (
            <>
              <div className="product-rating-picker" aria-label="Nota">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={value <= rating ? "is-active" : ""}
                    onClick={() => setRating(value)}
                    aria-label={`${value} estrelas`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Título da avaliação"
                maxLength={120}
              />
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Conte como foi sua experiência"
                rows={5}
                required
                maxLength={1000}
              />
              <button type="submit" className="btn" disabled={pending}>
                {pending ? "Enviando..." : ownReview ? "Reenviar avaliação" : "Enviar avaliação"}
              </button>
            </>
          )}

          {error ? <p className="product-review-error">{error}</p> : null}
          {message ? <p className="product-review-ok">{message}</p> : null}
        </form>
      </div>
    </section>
  );
}
