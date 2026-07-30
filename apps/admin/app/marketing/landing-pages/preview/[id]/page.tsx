import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

type LandingBlock = {
  type?: string;
  title?: string | null;
  text?: string | null;
  label?: string | null;
  url?: string | null;
};

type LandingContent = {
  eyebrow?: string | null;
  headline?: string | null;
  intro?: string | null;
  body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  blocks?: LandingBlock[];
};

type LandingRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  content: LandingContent | null;
};

function asContent(value: unknown): LandingContent {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as LandingContent) : {};
}

export default async function MarketingLandingPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const { id } = await params;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("marketing_landing_pages")
    .select("id, slug, title, status, content")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!data) notFound();

  const landing = data as LandingRow;
  const content = asContent(landing.content);
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];

  return (
    <main style={{ minHeight: "100vh", padding: "42px 28px 90px" }}>
      <section
        className="glass"
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          overflow: "hidden",
          borderRadius: 22,
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            borderBottom: "1px solid var(--glass-border)",
            background: "rgba(10,22,11,0.42)",
          }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Prévia interna</p>
            <strong>{landing.title}</strong>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className={landing.status === "published" ? "chip chip-live" : "chip chip-draft"}>
              {landing.status === "published" ? "Publicada" : "Não publicada"}
            </span>
            <Link href={`/marketing/landing-pages?edit=${landing.id}`} className="btn btn-ghost" style={{ padding: "9px 16px", fontSize: 10 }}>
              Editar no CMS
            </Link>
          </div>
        </div>

        <div
          style={{
            padding: "54px 48px",
            background: "linear-gradient(135deg, var(--forest-950), #223018)",
            color: "var(--cream)",
          }}
        >
          <span className="eyebrow">{content.eyebrow ?? "Campanha Flora"}</span>
          <h1 className="display" style={{ fontSize: 52, maxWidth: 760, margin: "16px 0 18px" }}>
            {content.headline ?? landing.title}
          </h1>
          {content.intro ? (
            <p style={{ maxWidth: 720, lineHeight: 1.75, color: "var(--cream-soft)", fontSize: 17 }}>
              {content.intro}
            </p>
          ) : null}
        </div>

        <div style={{ padding: "42px 48px", background: "var(--cream)", color: "#173019" }}>
          {content.body ? (
            <div style={{ maxWidth: 760, display: "grid", gap: 12, fontSize: 16, lineHeight: 1.75 }}>
              {content.body.split(/\n{2,}/).map((paragraph) => (
                <p key={paragraph} style={{ margin: 0 }}>{paragraph}</p>
              ))}
            </div>
          ) : null}

          {blocks.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 34 }}>
              {blocks.map((block, index) => (
                <article
                  key={`${block.type ?? "bloco"}-${index}`}
                  style={{
                    minHeight: 210,
                    padding: 22,
                    border: "1px solid rgba(23,48,25,0.14)",
                    background: "rgba(23,48,25,0.045)",
                    display: "grid",
                    alignContent: "start",
                    gap: 10,
                  }}
                >
                  <span style={{ color: "#b9924d", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontWeight: 900 }}>
                    {block.type ?? "Flora"}
                  </span>
                  <h2 style={{ margin: 0, fontSize: 25 }}>{block.title ?? "Cuidado Flora"}</h2>
                  {block.text ? <p style={{ margin: 0, lineHeight: 1.65 }}>{block.text}</p> : null}
                  {block.url && block.label ? (
                    <Link href={block.url} style={{ color: "#173019", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 11 }}>
                      {block.label} →
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {content.cta_url && content.cta_label ? (
            <Link
              href={content.cta_url}
              style={{
                display: "inline-flex",
                marginTop: 34,
                minHeight: 48,
                alignItems: "center",
                padding: "0 24px",
                background: "#173019",
                color: "var(--cream)",
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: 1.4,
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              {content.cta_label}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
