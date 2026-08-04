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

  const [kwInput, setKwInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(article?.keywords ?? []);

  const [seo, setSeo] = useState<SeoMeta>(article?.seo ?? {});
  const [faq, setFaq] = useState<{ q: string; a: string }[]>(article?.faq ?? []);

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
        published_at: finalStatus === "published" ? (publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString()) : null,
        reading_time_min: readingTime,
        keywords,
        seo: { ...seo, faq } as SeoMeta,
        faq,
      });
      router.push("/seo/blog");
    });
  }

  const TABS = [
    { key: "conteudo", label: "Conteúdo" },
    { key: "seo", label: "SEO & FAQ" },
    { key: "publicacao", label: "Publicação" },
  ] as const;

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e0d5c5", marginBottom: 24, gap: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #b9924d" : "2px solid transparent",
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? "#7a5c1e" : "#666",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTEÚDO ──────────────────────────────────────────────────────────── */}
      {tab === "conteudo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Título do artigo *</label>
            <input
              className="glass-input"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Ex: Como montar uma rotina de skincare natural"
              style={{ fontSize: 18, fontWeight: 600 }}
            />
          </div>

          <div>
            <label className="label">Slug (URL)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#888" }}>/blog/</span>
              <input
                className="glass-input"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="como-montar-rotina-skincare"
                style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
              />
            </div>
          </div>

          <div>
            <label className="label">Subtítulo / Chapéu</label>
            <input
              className="glass-input"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="Ex: Guia completo para iniciantes"
            />
          </div>

          <div>
            <label className="label">Resumo (excerpt)</label>
            <textarea
              className="glass-input"
              value={excerpt}
              rows={3}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="Breve resumo exibido nas listagens do blog (160-200 chars)..."
            />
          </div>

          <div>
            <label className="label">Categoria</label>
            <GlassSelect
              options={[
                { value: "", label: "— Sem categoria —" },
                ...categories.map(c => ({ value: c.id, label: c.name })),
              ]}
              value={catId}
              onChange={v => setCatId(v)}
            />
          </div>

          <div>
            <label className="label">Palavras-chave do artigo</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                className="glass-input"
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKw())}
                placeholder="skincare, vegano, argan... (Enter)"
                style={{ flex: 1 }}
              />
              <button type="button" onClick={addKw} className="btn-ghost" style={{ fontSize: 12 }}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {keywords.map(kw => (
                <span
                  key={kw}
                  style={{
                    background: "#fef3d7",
                    border: "1px solid #e0c070",
                    borderRadius: 12,
                    padding: "2px 10px",
                    fontSize: 11,
                    color: "#7a5c1e",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#b9924d", fontSize: 12 }}
                  >×</button>
                </span>
              ))}
            </div>
          </div>

          <div style={{
            background: "#fffbf5",
            border: "1px dashed #b9924d",
            borderRadius: 8,
            padding: "20px 24px",
            color: "#888",
            fontSize: 13,
            textAlign: "center",
          }}>
            <p style={{ marginBottom: 8, fontWeight: 600 }}>Conteúdo Rico (Rich Text)</p>
            <p style={{ fontSize: 12, lineHeight: 1.5 }}>
              O editor de conteúdo rico será integrado via TipTap ou Lexical.<br />
              Por ora, o conteúdo é gerenciado via campo <code>body_rich</code> (JSON) no banco.<br />
              Salve os demais campos e edite o conteúdo diretamente pelo Supabase Studio.
            </p>
          </div>
        </div>
      )}

      {/* ── SEO & FAQ ─────────────────────────────────────────────────────────── */}
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

      {/* ── PUBLICAÇÃO ────────────────────────────────────────────────────────── */}
      {tab === "publicacao" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Status</label>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { v: "draft", label: "Rascunho" },
                { v: "published", label: "Publicado" },
                { v: "archived", label: "Arquivado" },
              ].map(opt => (
                <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="radio"
                    name="status"
                    value={opt.v}
                    checked={status === opt.v}
                    onChange={() => setStatus(opt.v as "draft" | "published" | "archived")}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Data de publicação</label>
            <input
              type="date"
              className="glass-input"
              value={publishedAt}
              onChange={e => setPublishedAt(e.target.value)}
              style={{ width: 180 }}
            />
          </div>

          <div>
            <label className="label">Tempo de leitura (minutos)</label>
            <input
              type="number"
              className="glass-input"
              value={readingTime}
              min={1}
              max={60}
              onChange={e => setReadingTime(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Nome do autor</label>
              <input
                className="glass-input"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="Ex: Equipe Flora Botanics"
              />
            </div>
            <div>
              <label className="label">Cargo / Especialidade</label>
              <input
                className="glass-input"
                value={authorRole}
                onChange={e => setAuthorRole(e.target.value)}
                placeholder="Ex: Especialista em Skincare"
              />
            </div>
          </div>

          {/* Info de autoria para IA */}
          <div style={{
            background: "#f5f9ff",
            border: "1px solid #c5d8f5",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 12,
            color: "#1a5276",
          }}>
            <strong>💡 AI Visibility:</strong> Artigos com autoria definida, FAQ e palavras-chave ganham até <strong>+40 pontos</strong> no score de visibilidade em IA (SGE, Perplexity, ChatGPT).
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 32,
        paddingTop: 20,
        borderTop: "1px solid #e0d5c5",
      }}>
        <button
          type="button"
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="btn-secondary"
          style={{ fontSize: 13 }}
        >
          {saving ? "Salvando…" : "Salvar rascunho"}
        </button>
        <button
          type="button"
          onClick={() => handleSave("published")}
          disabled={saving || !title || !slug}
          className="btn"
          style={{ fontSize: 13 }}
        >
          {saving ? "Publicando…" : "Publicar artigo"}
        </button>
      </div>
    </div>
  );
}
