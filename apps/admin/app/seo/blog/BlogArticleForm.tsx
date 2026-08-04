"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoMetaEditor } from "@/components/SeoMetaEditor";
import { GlassSelect } from "@/components/GlassSelect";
import type { SeoMeta, EntityType } from "@/app/seo/actions";

interface Category { id: string; name: string; slug: string }

interface Props {
  article?: {
    id: string;
    title: string;
    slug: string;
    subtitle?: string | null;
    excerpt?: string | null;
    status: string;
    category_id?: string | null;
    author_name?: string | null;
    author_role?: string | null;
    published_at?: string | null;
    reading_time_min?: number | null;
    keywords: string[];
    seo: SeoMeta | null;
    faq?: { q: string; a: string }[];
  };
  categories: Category[];
  onSave: (data: {
    id?: string;
    title: string;
    slug: string;
    subtitle?: string;
    excerpt?: string;
    status: "draft" | "published" | "archived";
    category_id?: string | null;
    author_name?: string;
    author_role?: string;
    published_at?: string | null;
    reading_time_min?: number;
    keywords?: string[];
    seo?: SeoMeta;
    faq?: { q: string; a: string }[];
  }) => Promise<{ ok: boolean }>;
  onGenerateAi: (ctx: {
    entityType: EntityType;
    name: string;
    description?: string;
    keywords?: string[];
    category?: string;
  }) => Promise<SeoMeta & { faq?: { q: string; a: string }[] }>;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function BlogArticleForm({ article, categories, onSave, onGenerateAi }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [tab, setTab] = useState<"conteudo" | "seo" | "publicacao">("conteudo");

  const [title, setTitle]       = useState(article?.title ?? "");
  const [slug, setSlug]         = useState(article?.slug ?? "");
  const [subtitle, setSubtitle] = useState(article?.subtitle ?? "");
  const [excerpt, setExcerpt]   = useState(article?.excerpt ?? "");
  const [catId, setCatId]       = useState(article?.category_id ?? "");
  const [status, setStatus]     = useState<"draft" | "published" | "archived">(
    (article?.status as "draft" | "published" | "archived") ?? "draft",
  );
  const [authorName, setAuthorName] = useState(article?.author_name ?? "");
  const [authorRole, setAuthorRole] = useState(article?.author_role ?? "");
  const [publishedAt, setPublishedAt] = useState(
    article?.published_at ? article.published_at.slice(0, 10) : "",
  );
  const [readingTime, setReadingTime] = useState(article?.reading_time_min ?? 5);
  const [kwInput, setKwInput]   = useState("");
  const [keywords, setKeywords] = useState<string[]>(article?.keywords ?? []);
  const [seo, setSeo]           = useState<SeoMeta>(article?.seo ?? {});
  const [faq, setFaq]           = useState<{ q: string; a: string }[]>(article?.faq ?? []);

  function handleTitleChange(t: string) {
    setTitle(t);
    if (!article) setSlug(slugify(t));
  }

  function addKw() {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw]);
    setKwInput("");
  }

  async function handleSave(targetStatus?: "draft" | "published") {
    startSave(async () => {
      const finalStatus = targetStatus ?? status;
      await onSave({
        id: article?.id,
        title,
        slug,
        subtitle: subtitle || undefined,
        excerpt: excerpt || undefined,
        status: finalStatus,
        category_id: catId || null,
        author_name: authorName || undefined,
        author_role: authorRole || undefined,
        published_at:
          finalStatus === "published"
            ? publishedAt
              ? new Date(publishedAt).toISOString()
              : new Date().toISOString()
            : null,
        reading_time_min: readingTime,
        keywords,
        seo: { ...seo, faq } as SeoMeta,
        faq,
      });
      router.push("/seo/blog");
    });
  }

  const TABS = [
    { key: "conteudo",   label: "Conteúdo",   icon: "✎" },
    { key: "seo",        label: "SEO & FAQ",  icon: "◈" },
    { key: "publicacao", label: "Publicação", icon: "◉" },
  ] as const;

  // ── shared inline styles ──────────────────────────────────────────────────
  const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: "1.8px",
    textTransform: "uppercase",
    color: "var(--cream-dim)",
    marginBottom: 6,
  };

  const glassCard: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: "var(--radius-md)",
    backdropFilter: "blur(18px) saturate(1.25)",
    WebkitBackdropFilter: "blur(18px) saturate(1.25)",
    boxShadow: "var(--shadow-soft)",
  };

  return (
    <div>
      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 2,
        marginBottom: 24,
        ...glassCard,
        padding: "5px 6px",
      }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                fontFamily: "inherit",
                cursor: "pointer",
                color: active ? "var(--forest-950)" : "var(--cream-soft)",
                background: active
                  ? "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))"
                  : "transparent",
                boxShadow: active ? "0 4px 14px rgba(var(--gold-rgb),.35)" : "none",
                transition: "all .2s var(--ease)",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 11, opacity: active ? 1 : 0.6 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTEÚDO
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "conteudo" && (
        <div style={{ ...glassCard, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Título */}
          <div>
            <label style={fieldLabel}>Título do artigo *</label>
            <input
              className="input"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Ex: Como montar uma rotina de skincare natural"
              style={{ fontSize: 16, fontWeight: 600 }}
            />
          </div>

          {/* Slug */}
          <div>
            <label style={fieldLabel}>Slug (URL)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--cream-dim)", whiteSpace: "nowrap" }}>/blog/</span>
              <input
                className="input"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="como-montar-rotina-skincare"
                style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
              />
            </div>
          </div>

          {/* Subtítulo */}
          <div>
            <label style={fieldLabel}>Subtítulo / Chapéu</label>
            <input
              className="input"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="Ex: Guia completo para iniciantes"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label style={fieldLabel}>Resumo (excerpt)</label>
            <textarea
              className="input"
              value={excerpt}
              rows={3}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="Breve resumo exibido nas listagens do blog (160-200 chars)..."
            />
          </div>

          {/* Categoria */}
          <div>
            <label style={fieldLabel}>Categoria</label>
            <GlassSelect
              options={[
                { value: "", label: "— Sem categoria —" },
                ...categories.map(c => ({ value: c.id, label: c.name })),
              ]}
              value={catId}
              onChange={v => setCatId(v)}
            />
          </div>

          {/* Palavras-chave */}
          <div>
            <label style={fieldLabel}>Palavras-chave do artigo</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKw())}
                placeholder="skincare, vegano, argan... (Enter para adicionar)"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={addKw}
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "0 16px" }}
              >
                +
              </button>
            </div>
            {keywords.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {keywords.map(kw => (
                  <span key={kw} style={{
                    background: "rgba(var(--gold-rgb),.12)",
                    border: "1px solid rgba(var(--gold-rgb),.3)",
                    borderRadius: 999,
                    padding: "3px 12px",
                    fontSize: 11,
                    color: "var(--gold-light)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    {kw}
                    <button
                      type="button"
                      onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--gold)",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rich text placeholder */}
          <div style={{
            background: "rgba(var(--gold-rgb),.06)",
            border: "1px dashed rgba(var(--gold-rgb),.35)",
            borderRadius: "var(--radius-sm)",
            padding: "20px 24px",
            textAlign: "center",
          }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: "var(--cream-soft)", marginBottom: 6 }}>
              ✎ Conteúdo Rico (Rich Text)
            </p>
            <p style={{ fontSize: 11.5, lineHeight: 1.7, color: "var(--cream-dim)" }}>
              O editor TipTap será integrado em breve.<br />
              Salve os demais campos e edite o campo <code style={{ fontFamily: "monospace", color: "var(--gold-light)" }}>body_rich</code> diretamente no Supabase Studio.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SEO & FAQ
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "seo" && (
        <SeoMetaEditor
          entityType="article"
          entityId={article?.id ?? "new"}
          entityName={title || "Novo artigo"}
          initial={{ ...seo, faq }}
          onSave={async (meta) => {
            const { faq: newFaq, ...rest } = meta as SeoMeta & { faq?: { q: string; a: string }[] };
            setSeo(rest);
            if (newFaq) setFaq(newFaq);
            return { ok: true };
          }}
          onAiGenerate={async (ctx) => {
            const result = await onGenerateAi(ctx);
            const { faq: newFaq, ...rest } = result;
            setSeo(prev => ({ ...prev, ...rest }));
            if (newFaq) setFaq(newFaq);
            return result;
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PUBLICAÇÃO
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === "publicacao" && (
        <div style={{ ...glassCard, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Status */}
          <div>
            <label style={fieldLabel}>Status</label>
            <div style={{ display: "flex", gap: 10 }}>
              {([
                { v: "draft",     label: "Rascunho",  color: "rgba(253,224,71,.9)" },
                { v: "published", label: "Publicado", color: "rgba(134,239,172,.9)" },
                { v: "archived",  label: "Arquivado", color: "var(--cream-dim)" },
              ] as const).map(opt => (
                <label key={opt.v} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: "8px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${status === opt.v ? "rgba(var(--gold-rgb),.5)" : "var(--glass-border)"}`,
                  background: status === opt.v ? "rgba(var(--gold-rgb),.1)" : "transparent",
                  color: status === opt.v ? opt.color : "var(--cream-soft)",
                  transition: "all .15s",
                }}>
                  <input
                    type="radio"
                    name="status"
                    value={opt.v}
                    checked={status === opt.v}
                    onChange={() => setStatus(opt.v)}
                    style={{ accentColor: "var(--gold)" }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Data de publicação */}
          <div>
            <label style={fieldLabel}>Data de publicação</label>
            <input
              type="date"
              className="input"
              value={publishedAt}
              onChange={e => setPublishedAt(e.target.value)}
              style={{ width: 200 }}
            />
          </div>

          {/* Tempo de leitura */}
          <div>
            <label style={fieldLabel}>Tempo de leitura (minutos)</label>
            <input
              type="number"
              className="input"
              value={readingTime}
              min={1}
              max={60}
              onChange={e => setReadingTime(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </div>

          {/* Autoria */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={fieldLabel}>Nome do autor</label>
              <input
                className="input"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="Ex: Equipe Flora Botanics"
              />
            </div>
            <div>
              <label style={fieldLabel}>Cargo / Especialidade</label>
              <input
                className="input"
                value={authorRole}
                onChange={e => setAuthorRole(e.target.value)}
                placeholder="Ex: Especialista em Skincare"
              />
            </div>
          </div>

          {/* Dica AI */}
          <div style={{
            background: "rgba(var(--gold-rgb),.08)",
            border: "1px solid rgba(var(--gold-rgb),.25)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            fontSize: 12,
            color: "var(--gold-light)",
            lineHeight: 1.6,
          }}>
            <strong>◈ AI Visibility:</strong> Artigos com autoria definida, FAQ e palavras-chave ganham até{" "}
            <strong>+40 pontos</strong> no score de visibilidade em IA (SGE, Perplexity, ChatGPT).
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid var(--glass-border)",
      }}>
        <button
          type="button"
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="btn btn-ghost"
          style={{ fontSize: 12 }}
        >
          {saving ? "Salvando…" : "Salvar rascunho"}
        </button>
        <button
          type="button"
          onClick={() => handleSave("published")}
          disabled={saving || !title || !slug}
          className="btn btn-gold"
          style={{ fontSize: 12 }}
        >
          {saving ? "Publicando…" : "◉ Publicar artigo"}
        </button>
      </div>
    </div>
  );
}
