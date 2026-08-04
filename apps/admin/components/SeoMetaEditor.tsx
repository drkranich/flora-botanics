"use client";

import { useState, useTransition } from "react";
import type { SeoMeta, EntityType } from "@/app/seo/actions";

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
  const displayDesc = description || "Meta description da página...";
  const displayUrl = url || "floraBotanics.com.br/exemplo";

  const titleColor =
    displayTitle.length > 60 ? "#d93025" :
    displayTitle.length < 30 ? "#e37400" :
    "#1a0dab";

  return (
    <div style={{
      border: "1px solid #e0d5c5",
      borderRadius: 8,
      padding: "14px 16px",
      background: "#fff",
      fontFamily: "Arial, sans-serif",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, color: "#202124", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: "#666" }}>🌿</span>
        <span style={{ color: "#202124", fontSize: 11 }}>{displayUrl}</span>
        <span style={{ fontSize: 10, color: "#666" }}>▼</span>
      </div>
      <div style={{ color: titleColor, fontSize: 17, lineHeight: 1.3, marginBottom: 4 }}>
        {displayTitle.slice(0, 70)}{displayTitle.length > 70 ? "…" : ""}
      </div>
      <div style={{ color: "#4d5156", fontSize: 13, lineHeight: 1.5, maxWidth: 600 }}>
        {displayDesc.slice(0, 165)}{displayDesc.length > 165 ? "…" : ""}
      </div>
    </div>
  );
}

// ── Counter badge ──────────────────────────────────────────────────────────────
function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length;
  const color = len < min ? "#e37400" : len > max ? "#d93025" : "#2e7d32";
  return (
    <span style={{ fontSize: 10, color, marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>
      {len}/{max}
    </span>
  );
}

// ── FAQ editor ─────────────────────────────────────────────────────────────────
function FaqEditor({
  items,
  onChange,
}: {
  items: { q: string; a: string }[];
  onChange: (items: { q: string; a: string }[]) => void;
}) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{
          border: "1px solid #e0d5c5",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 8,
          background: "#fffbf5",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label className="label">Pergunta {i + 1}</label>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="btn-ghost"
              style={{ color: "#c0392b", fontSize: 11 }}
            >
              remover
            </button>
          </div>
          <input
            className="glass-input"
            value={item.q}
            onChange={e => {
              const next = [...items];
              next[i] = { ...next[i], q: e.target.value };
              onChange(next);
            }}
            placeholder="Ex: O produto é vegano?"
            style={{ marginBottom: 6 }}
          />
          <textarea
            className="glass-input"
            value={item.a}
            rows={2}
            onChange={e => {
              const next = [...items];
              next[i] = { ...next[i], a: e.target.value };
              onChange(next);
            }}
            placeholder="Resposta detalhada..."
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { q: "", a: "" }])}
        className="btn-ghost"
        style={{ fontSize: 12, color: "#7a5c1e" }}
      >
        + Adicionar pergunta
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function SeoMetaEditor({
  entityType,
  entityId,
  entityName,
  entityDescription,
  entityCategory,
  initial = {},
  onSave,
  onAiGenerate,
  onRunAudit,
}: Props) {
  const [tab, setTab] = useState<"basico" | "og" | "faq" | "avancado">("basico");
  const [saving, startSave] = useTransition();
  const [generating, startGen] = useTransition();
  const [auditing, startAudit] = useTransition();
  const [saved, setSaved] = useState(false);
  const [auditResult, setAuditResult] = useState<null | { score: number; issues: { code: string; severity: string; message: string }[] }>(null);

  const [meta, setMeta] = useState<SeoMeta & { faq?: { q: string; a: string }[] }>({
    title: "",
    description: "",
    canonical: "",
    robots: "index,follow",
    og_title: "",
    og_description: "",
    og_image: "",
    twitter_card: "summary_large_image",
    twitter_title: "",
    twitter_description: "",
    keywords: [],
    faq: [],
    ...initial,
  });

  const [keywordInput, setKeywordInput] = useState("");

  function set(k: keyof typeof meta, v: unknown) {
    setMeta(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  function addKeyword() {
    const kw = keywordInput.trim();
    if (!kw) return;
    const current = meta.keywords ?? [];
    if (!current.includes(kw)) set("keywords", [...current, kw]);
    setKeywordInput("");
  }

  function removeKeyword(kw: string) {
    set("keywords", (meta.keywords ?? []).filter(k => k !== kw));
  }

  function handleSave() {
    startSave(async () => {
      await onSave(meta);
      setSaved(true);
    });
  }

  function handleGenerate() {
    startGen(async () => {
      const result = await onAiGenerate({
        entityType,
        name: entityName,
        description: entityDescription,
        keywords: meta.keywords,
        category: entityCategory,
      });
      setMeta(prev => ({ ...prev, ...result }));
      setSaved(false);
    });
  }

  function handleAudit() {
    if (!onRunAudit) return;
    startAudit(async () => {
      const result = await onRunAudit();
      setAuditResult(result);
    });
  }

  const tabs = [
    { key: "basico", label: "Meta Tags" },
    { key: "og", label: "Open Graph" },
    { key: "faq", label: `FAQ (${meta.faq?.length ?? 0})` },
    { key: "avancado", label: "Avançado" },
  ] as const;

  const scoreColor = auditResult
    ? auditResult.score >= 80 ? "#2e7d32" : auditResult.score >= 50 ? "#e37400" : "#c0392b"
    : "#666";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          {generating ? "⏳ Gerando…" : "✨ Sugerir com IA"}
        </button>

        {onRunAudit && (
          <button
            type="button"
            onClick={handleAudit}
            disabled={auditing}
            className="btn-ghost"
            style={{ fontSize: 12 }}
          >
            {auditing ? "Auditando…" : "🔍 Auditar"}
          </button>
        )}

        {auditResult && (
          <span style={{ fontSize: 12, color: scoreColor, fontWeight: 600 }}>
            Score: {auditResult.score}/100
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn"
          style={{ fontSize: 12 }}
        >
          {saving ? "Salvando…" : saved ? "✓ Salvo" : "Salvar SEO"}
        </button>
      </div>

      {/* Audit issues */}
      {auditResult && auditResult.issues.length > 0 && (
        <div style={{
          borderRadius: 8,
          border: "1px solid #e0d5c5",
          overflow: "hidden",
        }}>
          {auditResult.issues.map((issue, i) => {
            const bg = issue.severity === "error" ? "#fff5f5" : issue.severity === "warning" ? "#fff8e1" : "#f5f9ff";
            const border = issue.severity === "error" ? "#d93025" : issue.severity === "warning" ? "#e37400" : "#1a73e8";
            const icon = issue.severity === "error" ? "✗" : issue.severity === "warning" ? "⚠" : "ℹ";
            return (
              <div key={i} style={{ background: bg, borderLeft: `3px solid ${border}`, padding: "6px 12px", fontSize: 11, color: "#333" }}>
                <span style={{ color: border, fontWeight: 700, marginRight: 4 }}>{icon}</span>
                {issue.message}
              </div>
            );
          })}
        </div>
      )}

      {/* SERP Preview */}
      <SerpPreview
        title={meta.title ?? ""}
        description={meta.description ?? ""}
        url={`floraBotanics.com.br/${entityType}/${entityName.toLowerCase().replace(/\s+/g, "-")}`}
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #e0d5c5", marginBottom: 4 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #b9924d" : "2px solid transparent",
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? "#7a5c1e" : "#666",
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Meta Tags */}
      {tab === "basico" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">
              Título SEO
              <Counter value={meta.title ?? ""} min={30} max={60} />
            </label>
            <input
              className="glass-input"
              value={meta.title ?? ""}
              onChange={e => set("title", e.target.value)}
              placeholder="Ex: Shampoo Vegano de Argan | Flora Botanics"
              maxLength={80}
            />
          </div>

          <div>
            <label className="label">
              Meta Description
              <Counter value={meta.description ?? ""} min={100} max={160} />
            </label>
            <textarea
              className="glass-input"
              value={meta.description ?? ""}
              rows={3}
              onChange={e => set("description", e.target.value)}
              placeholder="Ex: Shampoo vegano com óleo de argan. Hidrata, nutre e dá brilho sem sulfatos. Frete grátis acima de R$ 150. Compre na Flora Botanics."
              maxLength={200}
            />
          </div>

          <div>
            <label className="label">Palavras-chave</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                className="glass-input"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                placeholder="Digite e pressione Enter"
                style={{ flex: 1 }}
              />
              <button type="button" onClick={addKeyword} className="btn-ghost" style={{ fontSize: 12 }}>
                +
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {(meta.keywords ?? []).map(kw => (
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
                    onClick={() => removeKeyword(kw)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#b9924d", fontSize: 12, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Open Graph */}
      {tab === "og" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">
              og:title
              <Counter value={meta.og_title ?? ""} min={30} max={95} />
            </label>
            <input
              className="glass-input"
              value={meta.og_title ?? ""}
              onChange={e => set("og_title", e.target.value)}
              placeholder="Título para redes sociais (pode ser mais longo)"
            />
          </div>

          <div>
            <label className="label">
              og:description
              <Counter value={meta.og_description ?? ""} min={60} max={200} />
            </label>
            <textarea
              className="glass-input"
              value={meta.og_description ?? ""}
              rows={2}
              onChange={e => set("og_description", e.target.value)}
              placeholder="Descrição para Facebook, LinkedIn, WhatsApp..."
            />
          </div>

          <div>
            <label className="label">og:image (URL)</label>
            <input
              className="glass-input"
              value={meta.og_image ?? ""}
              onChange={e => set("og_image", e.target.value)}
              placeholder="https://floraBotanics.com.br/og/produto.jpg (1200×630px ideal)"
            />
          </div>

          <div style={{ borderTop: "1px solid #e0d5c5", paddingTop: 12 }}>
            <label className="label" style={{ marginBottom: 8, display: "block" }}>Twitter Card</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["summary", "summary_large_image"].map(v => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                  <input
                    type="radio"
                    name="twitter_card"
                    value={v}
                    checked={meta.twitter_card === v}
                    onChange={() => set("twitter_card", v)}
                  />
                  {v === "summary" ? "Resumo (pequeno)" : "Imagem grande (recomendado)"}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Twitter Title</label>
            <input
              className="glass-input"
              value={meta.twitter_title ?? ""}
              onChange={e => set("twitter_title", e.target.value)}
              placeholder="Deixe vazio para usar og:title"
            />
          </div>

          <div>
            <label className="label">Twitter Description</label>
            <textarea
              className="glass-input"
              value={meta.twitter_description ?? ""}
              rows={2}
              onChange={e => set("twitter_description", e.target.value)}
              placeholder="Deixe vazio para usar og:description"
            />
          </div>
        </div>
      )}

      {/* Tab: FAQ */}
      {tab === "faq" && (
        <div>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
            FAQs geram marcação JSON-LD <code>FAQPage</code> que pode aparecer diretamente nos resultados do Google e aumenta a visibilidade em IA (SGE, Perplexity, ChatGPT).
          </p>
          <FaqEditor
            items={meta.faq ?? []}
            onChange={items => set("faq", items)}
          />
        </div>
      )}

      {/* Tab: Avançado */}
      {tab === "avancado" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">URL Canônica</label>
            <input
              className="glass-input"
              value={meta.canonical ?? ""}
              onChange={e => set("canonical", e.target.value)}
              placeholder="https://floraBotanics.com.br/produtos/meu-produto (deixe vazio para automático)"
            />
          </div>

          <div>
            <label className="label">Robots</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"].map(v => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                  <input
                    type="radio"
                    name="robots"
                    value={v}
                    checked={meta.robots === v}
                    onChange={() => set("robots", v)}
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Schema.org Type</label>
            <select
              className="glass-input"
              value={meta.schema_type ?? ""}
              onChange={e => set("schema_type", e.target.value || undefined)}
            >
              <option value="">Automático</option>
              <option value="Product">Product</option>
              <option value="Article">Article</option>
              <option value="FAQPage">FAQPage</option>
              <option value="Organization">Organization</option>
              <option value="LocalBusiness">LocalBusiness</option>
              <option value="BreadcrumbList">BreadcrumbList</option>
              <option value="WebPage">WebPage</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
