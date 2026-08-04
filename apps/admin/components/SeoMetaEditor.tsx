"use client";

import { useState, useTransition } from "react";
import type { SeoMeta, EntityType } from "@/app/seo/actions";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";

const SCHEMA_TYPE_OPTIONS: GlassSelectOption[] = [
  { value: "", label: "Automático" },
  { value: "Product", label: "Product" },
  { value: "Article", label: "Article" },
  { value: "FAQPage", label: "FAQPage" },
  { value: "Organization", label: "Organization" },
  { value: "LocalBusiness", label: "LocalBusiness" },
  { value: "BreadcrumbList", label: "BreadcrumbList" },
  { value: "WebPage", label: "WebPage" },
];

// ── shared styles ──────────────────────────────────────────────────────────────
const FL: React.CSSProperties = {
  display: "block",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "1.8px",
  textTransform: "uppercase",
  color: "var(--cream-dim)",
  marginBottom: 7,
};

const GLASS_CARD: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--radius-md)",
  backdropFilter: "blur(18px) saturate(1.25)",
  WebkitBackdropFilter: "blur(18px) saturate(1.25)",
  boxShadow: "var(--shadow-soft)",
};

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  entityDescription?: string;
  entityCategory?: string;
  initial?: SeoMeta;
  onSave: (meta: SeoMeta) => Promise<{ ok: boolean }>;
  onAiGenerate: (ctx: {
    entityType: EntityType;
    name: string;
    description?: string;
    keywords?: string[];
    category?: string;
  }) => Promise<SeoMeta & { faq?: { q: string; a: string }[] }>;
  onRunAudit?: () => Promise<{ score: number; issues: { code: string; severity: string; message: string }[] }>;
}

// ── Google SERP Preview ────────────────────────────────────────────────────────
function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const displayTitle = title || "Título da página";
  const displayDesc  = description || "Meta description da página...";
  const displayUrl   = url || "floraBotanics.com.br/exemplo";

  const titleLen = displayTitle.length;
  const titleColor =
    titleLen > 60 ? "rgba(252,165,165,.9)" :
    titleLen < 30 ? "rgba(253,224,71,.9)" :
    "var(--gold-light)";

  return (
    <div style={{
      ...GLASS_CARD,
      padding: "14px 18px",
      marginBottom: 4,
      fontFamily: "Arial, sans-serif",
    }}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>Preview Google SERP</p>
      <div style={{ fontSize: 11, color: "var(--cream-dim)", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
        <span>🌿</span>
        <span>{displayUrl}</span>
        <span style={{ opacity: .5 }}>▼</span>
      </div>
      <div style={{ color: titleColor, fontSize: 17, lineHeight: 1.3, marginBottom: 5, fontFamily: "Arial, sans-serif" }}>
        {displayTitle.slice(0, 70)}{displayTitle.length > 70 ? "…" : ""}
      </div>
      <div style={{ color: "var(--cream-soft)", fontSize: 13, lineHeight: 1.55, opacity: .8, fontFamily: "Arial, sans-serif" }}>
        {displayDesc.slice(0, 165)}{displayDesc.length > 165 ? "…" : ""}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10 }}>
        <span style={{ color: titleLen > 60 ? "rgba(252,165,165,.9)" : titleLen < 30 ? "rgba(253,224,71,.9)" : "rgba(134,239,172,.9)" }}>
          Título: {titleLen}/60 chars
        </span>
        <span style={{
          color: displayDesc.length > 160 ? "rgba(252,165,165,.9)" :
                 displayDesc.length < 100 ? "rgba(253,224,71,.9)" :
                 "rgba(134,239,172,.9)"
        }}>
          Desc: {displayDesc.length}/160 chars
        </span>
      </div>
    </div>
  );
}

// ── Keyword chip ───────────────────────────────────────────────────────────────
function KwChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
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
      {label}
      <button
        type="button"
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold)", fontSize: 14, lineHeight: 1, padding: 0 }}
      >×</button>
    </span>
  );
}

// ── FAQ editor ─────────────────────────────────────────────────────────────────
function FaqEditor({ items, onChange }: { items: { q: string; a: string }[]; onChange: (i: { q: string; a: string }[]) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          ...GLASS_CARD,
          padding: "14px 16px",
          borderLeft: "3px solid rgba(var(--gold-rgb),.4)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ ...FL, marginBottom: 0 }}>Pergunta {i + 1}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="btn btn-ghost"
              style={{ fontSize: 10, padding: "3px 10px", color: "rgba(252,165,165,.8)" }}
            >
              remover
            </button>
          </div>
          <input
            className="input"
            value={item.q}
            onChange={e => { const n = [...items]; n[i] = { ...n[i], q: e.target.value }; onChange(n); }}
            placeholder="Ex: O produto é vegano?"
            style={{ marginBottom: 8 }}
          />
          <textarea
            className="input"
            value={item.a}
            rows={2}
            onChange={e => { const n = [...items]; n[i] = { ...n[i], a: e.target.value }; onChange(n); }}
            placeholder="Resposta detalhada..."
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { q: "", a: "" }])}
        className="btn btn-ghost"
        style={{ fontSize: 12, alignSelf: "flex-start" }}
      >
        + Adicionar pergunta
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function SeoMetaEditor({
  entityType, entityId, entityName, entityDescription, entityCategory,
  initial = {}, onSave, onAiGenerate, onRunAudit,
}: Props) {
  const [tab, setTab]       = useState<"basico" | "og" | "faq" | "avancado">("basico");
  const [saving, startSave] = useTransition();
  const [generating, startGen] = useTransition();
  const [auditing, startAudit] = useTransition();
  const [saved, setSaved]   = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<null | { score: number; issues: { code: string; severity: string; message: string }[] }>(null);
  const [keywordInput, setKeywordInput] = useState("");

  const [meta, setMeta] = useState<SeoMeta & { faq?: { q: string; a: string }[] }>({
    title: "", description: "", canonical: "", robots: "index,follow",
    og_title: "", og_description: "", og_image: "",
    twitter_card: "summary_large_image", twitter_title: "", twitter_description: "",
    keywords: [], faq: [],
    ...initial,
  });

  function set(k: keyof typeof meta, v: unknown) {
    setMeta(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  function addKeyword() {
    const kw = keywordInput.trim();
    if (!kw) return;
    const cur = meta.keywords ?? [];
    if (!cur.includes(kw)) set("keywords", [...cur, kw]);
    setKeywordInput("");
  }

  function handleSave() {
    startSave(async () => { await onSave(meta); setSaved(true); });
  }

  function handleGenerate() {
    setAiError(null);
    startGen(async () => {
      try {
        const r = await onAiGenerate({ entityType, name: entityName, description: entityDescription, keywords: meta.keywords, category: entityCategory });
        setMeta(prev => ({ ...prev, ...r }));
        setSaved(false);
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "Erro ao gerar sugestão");
      }
    });
  }

  function handleAudit() {
    if (!onRunAudit) return;
    startAudit(async () => { setAuditResult(await onRunAudit()); });
  }

  const TABS = [
    { key: "basico",   label: "Meta Tags" },
    { key: "og",       label: "Open Graph" },
    { key: "faq",      label: `FAQ (${meta.faq?.length ?? 0})` },
    { key: "avancado", label: "Avançado" },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Header actions ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="btn btn-ghost"
          style={{ fontSize: 11, color: "var(--gold-light)", borderColor: "rgba(var(--gold-rgb),.4)" }}
        >
          {generating ? "⏳ Gerando…" : "✦ Sugerir com IA"}
        </button>

        {onRunAudit && (
          <button type="button" onClick={handleAudit} disabled={auditing} className="btn btn-ghost" style={{ fontSize: 11 }}>
            {auditing ? "Auditando…" : "⚑ Auditar"}
          </button>
        )}

        {auditResult && (
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: auditResult.score >= 80 ? "rgba(134,239,172,.9)" : auditResult.score >= 50 ? "rgba(253,224,71,.9)" : "rgba(252,165,165,.9)",
          }}>
            Score: {auditResult.score}/100
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`btn ${saved ? "btn-ghost" : "btn-gold"}`}
          style={{ fontSize: 11 }}
        >
          {saving ? "Salvando…" : saved ? "✓ Salvo" : "Salvar SEO"}
        </button>
      </div>

      {/* ── AI error ────────────────────────────────────────────────────────── */}
      {aiError && (
        <div style={{
          background: "rgba(239,68,68,.1)",
          border: "1px solid rgba(252,165,165,.5)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 14px",
          fontSize: 12,
          color: "rgba(252,165,165,.9)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontWeight: 700 }}>✗</span>
          <span>{aiError}</span>
          <button type="button" onClick={() => setAiError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(252,165,165,.7)", fontSize: 14 }}>×</button>
        </div>
      )}

      {/* ── Audit issues ────────────────────────────────────────────────────── */}
      {auditResult && auditResult.issues.length > 0 && (
        <div style={{ ...GLASS_CARD, overflow: "hidden" }}>
          {auditResult.issues.map((issue, i) => {
            const [bg, border, icon] =
              issue.severity === "error"   ? ["rgba(239,68,68,.1)",  "rgba(252,165,165,.7)", "✗"] :
              issue.severity === "warning" ? ["rgba(234,179,8,.1)", "rgba(253,224,71,.7)",  "⚠"] :
                                             ["rgba(var(--gold-rgb),.06)", "rgba(var(--gold-rgb),.3)", "ℹ"];
            return (
              <div key={i} style={{ background: bg, borderLeft: `3px solid ${border}`, padding: "7px 14px", fontSize: 11, color: "var(--cream-soft)" }}>
                <span style={{ color: border, fontWeight: 700, marginRight: 6 }}>{icon}</span>
                {issue.message}
              </div>
            );
          })}
        </div>
      )}

      {/* ── SERP Preview ────────────────────────────────────────────────────── */}
      <SerpPreview
        title={meta.title ?? ""}
        description={meta.description ?? ""}
        url={`floraBotanics.com.br/${entityType}/${entityName.toLowerCase().replace(/\s+/g, "-")}`}
      />

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 2,
        ...GLASS_CARD,
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
                flex: 1,
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "7px 10px",
                fontSize: 11.5,
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
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Meta Tags ──────────────────────────────────────────────────── */}
      {tab === "basico" && (
        <div style={{ ...GLASS_CARD, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={FL}>Título SEO</span>
              <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums",
                color: (meta.title?.length ?? 0) > 60 ? "rgba(252,165,165,.9)" : (meta.title?.length ?? 0) < 30 ? "rgba(253,224,71,.9)" : "rgba(134,239,172,.9)" }}>
                {meta.title?.length ?? 0}/60
              </span>
            </div>
            <input
              className="input"
              value={meta.title ?? ""}
              onChange={e => set("title", e.target.value)}
              placeholder="Ex: Shampoo Vegano de Argan | Flora Botanics"
              maxLength={80}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={FL}>Meta Description</span>
              <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums",
                color: (meta.description?.length ?? 0) > 160 ? "rgba(252,165,165,.9)" : (meta.description?.length ?? 0) < 100 ? "rgba(253,224,71,.9)" : "rgba(134,239,172,.9)" }}>
                {meta.description?.length ?? 0}/160
              </span>
            </div>
            <textarea
              className="input"
              value={meta.description ?? ""}
              rows={3}
              onChange={e => set("description", e.target.value)}
              placeholder="Ex: Shampoo vegano com óleo de argan. Hidrata, nutre e dá brilho sem sulfatos. Frete grátis acima de R$ 150."
              maxLength={200}
            />
          </div>

          <div>
            <label style={FL}>Palavras-chave</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                placeholder="Digite e pressione Enter"
                style={{ flex: 1 }}
              />
              <button type="button" onClick={addKeyword} className="btn btn-ghost" style={{ fontSize: 12, padding: "0 14px" }}>+</button>
            </div>
            {(meta.keywords ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(meta.keywords ?? []).map(kw => (
                  <KwChip key={kw} label={kw} onRemove={() => set("keywords", (meta.keywords ?? []).filter(k => k !== kw))} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Open Graph ─────────────────────────────────────────────────── */}
      {tab === "og" && (
        <div style={{ ...GLASS_CARD, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={FL}>og:title</label>
            <input className="input" value={meta.og_title ?? ""} onChange={e => set("og_title", e.target.value)} placeholder="Título para redes sociais (pode ser mais longo)" />
          </div>
          <div>
            <label style={FL}>og:description</label>
            <textarea className="input" value={meta.og_description ?? ""} rows={2} onChange={e => set("og_description", e.target.value)} placeholder="Descrição para Facebook, LinkedIn, WhatsApp..." />
          </div>
          <div>
            <label style={FL}>og:image (URL)</label>
            <input className="input" value={meta.og_image ?? ""} onChange={e => set("og_image", e.target.value)} placeholder="https://floraBotanics.com.br/og/produto.jpg (1200×630px ideal)" />
          </div>
          <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 14 }}>
            <label style={{ ...FL, marginBottom: 10 }}>Twitter Card</label>
            <div style={{ display: "flex", gap: 12 }}>
              {["summary", "summary_large_image"].map(v => (
                <label key={v} style={{
                  display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12,
                  padding: "7px 14px", borderRadius: "var(--radius-sm)",
                  border: `1px solid ${meta.twitter_card === v ? "rgba(var(--gold-rgb),.5)" : "var(--glass-border)"}`,
                  background: meta.twitter_card === v ? "rgba(var(--gold-rgb),.1)" : "transparent",
                  color: meta.twitter_card === v ? "var(--gold-light)" : "var(--cream-soft)",
                  transition: "all .15s",
                }}>
                  <input type="radio" name="twitter_card" value={v} checked={meta.twitter_card === v} onChange={() => set("twitter_card", v)} style={{ accentColor: "var(--gold)" }} />
                  {v === "summary" ? "Resumo (pequeno)" : "Imagem grande"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={FL}>Twitter Title</label>
            <input className="input" value={meta.twitter_title ?? ""} onChange={e => set("twitter_title", e.target.value)} placeholder="Deixe vazio para usar og:title" />
          </div>
          <div>
            <label style={FL}>Twitter Description</label>
            <textarea className="input" value={meta.twitter_description ?? ""} rows={2} onChange={e => set("twitter_description", e.target.value)} placeholder="Deixe vazio para usar og:description" />
          </div>
        </div>
      )}

      {/* ── Tab: FAQ ────────────────────────────────────────────────────────── */}
      {tab === "faq" && (
        <div style={{ ...GLASS_CARD, padding: "20px 22px" }}>
          <p style={{ fontSize: 12, color: "var(--cream-dim)", marginBottom: 14, lineHeight: 1.6 }}>
            FAQs geram marcação <code style={{ fontFamily: "monospace", color: "var(--gold-light)" }}>FAQPage</code> JSON-LD — aparecem diretamente nos resultados do Google e aumentam visibilidade em IA (SGE, Perplexity, ChatGPT).
          </p>
          <FaqEditor items={meta.faq ?? []} onChange={items => set("faq", items)} />
        </div>
      )}

      {/* ── Tab: Avançado ───────────────────────────────────────────────────── */}
      {tab === "avancado" && (
        <div style={{ ...GLASS_CARD, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={FL}>URL Canônica</label>
            <input className="input" value={meta.canonical ?? ""} onChange={e => set("canonical", e.target.value)} placeholder="https://floraBotanics.com.br/produtos/meu-produto (vazio = automático)" />
          </div>
          <div>
            <label style={{ ...FL, marginBottom: 10 }}>Robots</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"].map(v => (
                <label key={v} style={{
                  display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11.5,
                  padding: "6px 12px", borderRadius: "var(--radius-sm)",
                  border: `1px solid ${meta.robots === v ? "rgba(var(--gold-rgb),.5)" : "var(--glass-border)"}`,
                  background: meta.robots === v ? "rgba(var(--gold-rgb),.1)" : "transparent",
                  color: meta.robots === v ? "var(--gold-light)" : "var(--cream-soft)",
                  transition: "all .15s",
                }}>
                  <input type="radio" name="robots" value={v} checked={meta.robots === v} onChange={() => set("robots", v)} style={{ accentColor: "var(--gold)" }} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={FL}>Schema.org Type</label>
            <GlassSelect options={SCHEMA_TYPE_OPTIONS} value={meta.schema_type ?? ""} onChange={v => set("schema_type", v || undefined)} />
          </div>
        </div>
      )}
    </div>
  );
}
