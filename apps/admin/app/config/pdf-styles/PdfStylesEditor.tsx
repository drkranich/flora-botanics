"use client";

import { useState, useTransition } from "react";
import { savePdfConfig } from "@/lib/pdf/actions";
import type { PdfConfig, PdfCategory } from "@/lib/pdf/template";
import { buildFloraKraftPDF, openAndPrint, PDF_CATEGORIES } from "@/lib/pdf/template";

// ─── Presets de tema ──────────────────────────────────────────────────────────

const PRESETS: { label: string; values: Partial<PdfConfig> }[] = [
  {
    label: "🌿 Kraft (padrão)",
    values: {
      bgColor: "#f2e8d9",
      accentColor: "#2a4a2c",
      headerBorderColor: "#5a3e2b",
      textColor: "#1a1a1a",
      fontFamily: "Georgia, 'Times New Roman', serif",
      watermarkOpacity: 6,
      watermarkSize: 260,
    },
  },
  {
    label: "🎨 Cores de destaque",
    values: {
      bgColor: "#f5f0e8",
      accentColor: "#7c4a1e",
      headerBorderColor: "#c8843c",
      textColor: "#2a1a0a",
      fontFamily: "Georgia, 'Times New Roman', serif",
      watermarkOpacity: 7,
      watermarkSize: 240,
    },
  },
  {
    label: "⬜ Branco clássico",
    values: {
      bgColor: "#ffffff",
      accentColor: "#1a3a1a",
      headerBorderColor: "#cccccc",
      textColor: "#111111",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      watermarkOpacity: 5,
      watermarkSize: 220,
    },
  },
  {
    label: "🌸 Rosa botânico",
    values: {
      bgColor: "#fdf6f0",
      accentColor: "#8b3a52",
      headerBorderColor: "#d4a0b0",
      textColor: "#2a0f1a",
      fontFamily: "Georgia, 'Times New Roman', serif",
      watermarkOpacity: 5,
      watermarkSize: 240,
    },
  },
  {
    label: "🌊 Azul corporativo",
    values: {
      bgColor: "#f0f4fa",
      accentColor: "#1a3a6b",
      headerBorderColor: "#5a80b8",
      textColor: "#0d1a2e",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      watermarkOpacity: 5,
      watermarkSize: 230,
    },
  },
];

// ─── Categorias com sugestão de cor padrão ────────────────────────────────────

const CATEGORY_DEFAULTS: Record<PdfCategory, { accentColor: string; headerBorderColor: string; textColor?: string }> = {
  orcamento:           { accentColor: "#2a4a2c", headerBorderColor: "#5a3e2b" },
  cotacao:             { accentColor: "#1a3a6b", headerBorderColor: "#5a80b8" },
  proposta_comercial:  { accentColor: "#7c4a1e", headerBorderColor: "#c8843c" },
  pedido:              { accentColor: "#2a4a2c", headerBorderColor: "#5a3e2b" },
  nota_fiscal:         { accentColor: "#1a3a1a", headerBorderColor: "#4a7a4a" },
  recibo:              { accentColor: "#3a3a1a", headerBorderColor: "#8a8a2a" },
  boleto:              { accentColor: "#1a1a3a", headerBorderColor: "#4a4a8a" },
  contrato:            { accentColor: "#2a0a0a", headerBorderColor: "#8a2a2a" },
  relatorio_financeiro:{ accentColor: "#0a2a1a", headerBorderColor: "#2a6a4a" },
  relatorio_estoque:   { accentColor: "#1a2a3a", headerBorderColor: "#3a6a8a" },
  relatorio_vendas:    { accentColor: "#3a1a0a", headerBorderColor: "#8a4a2a" },
  relatorio_crm:       { accentColor: "#2a1a3a", headerBorderColor: "#6a4a8a" },
  relatorio_auditoria: { accentColor: "#1a1a1a", headerBorderColor: "#5a5a5a" },
  relatorio_remessa:   { accentColor: "#0a3a2a", headerBorderColor: "#2a7a5a" },
  relatorio_pdv:       { accentColor: "#2a3a0a", headerBorderColor: "#6a8a2a" },
  contabil:            { accentColor: "#0a1a3a", headerBorderColor: "#2a4a8a" },
  fiscal:              { accentColor: "#3a0a0a", headerBorderColor: "#8a2a2a" },
  exportacao:          { accentColor: "#0a2a3a", headerBorderColor: "#2a6a8a" },
  etiqueta:            { accentColor: "#1a1a1a", headerBorderColor: "#7a7a7a" },
  assinatura:          { accentColor: "#1a2a1a", headerBorderColor: "#4a6a4a" },
  interno:             { accentColor: "#2a2a2a", headerBorderColor: "#6a6a6a" },
};

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  initial: PdfConfig;
}

type CategoryStyleState = Record<PdfCategory, {
  bgColor: string;
  accentColor: string;
  headerBorderColor: string;
  textColor: string;
  fontFamily: string;
  enabled: boolean;
}>;

function buildInitialCatState(config: PdfConfig): CategoryStyleState {
  const result = {} as CategoryStyleState;
  for (const cat of Object.keys(PDF_CATEGORIES) as PdfCategory[]) {
    const saved = config.categoryStyles?.[cat];
    const def = CATEGORY_DEFAULTS[cat];
    result[cat] = {
      bgColor:           saved?.bgColor           ?? config.bgColor           ?? "#f2e8d9",
      accentColor:       saved?.accentColor       ?? def.accentColor,
      headerBorderColor: saved?.headerBorderColor ?? def.headerBorderColor,
      textColor:         saved?.textColor         ?? config.textColor         ?? "#1a1a1a",
      fontFamily:        saved?.fontFamily        ?? config.fontFamily        ?? "Georgia, 'Times New Roman', serif",
      enabled:           !!saved,
    };
  }
  return result;
}

export function PdfStylesEditor({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "categorias">("global");

  // ── Estilos globais ──
  const [bgColor,           setBgColor]           = useState(initial.bgColor           ?? "#f2e8d9");
  const [accentColor,       setAccentColor]       = useState(initial.accentColor       ?? "#2a4a2c");
  const [headerBorderColor, setHeaderBorderColor] = useState(initial.headerBorderColor ?? "#5a3e2b");
  const [textColor,         setTextColor]         = useState(initial.textColor         ?? "#1a1a1a");
  const [fontFamily,        setFontFamily]        = useState(initial.fontFamily        ?? "Georgia, 'Times New Roman', serif");
  const [watermarkOpacity,  setWatermarkOpacity]  = useState(initial.watermarkOpacity  ?? 6);
  const [watermarkSize,     setWatermarkSize]     = useState(initial.watermarkSize     ?? 260);

  // ── Assinante ──
  const [signerName, setSignerName] = useState(initial.signerName ?? "");
  const [signerRole, setSignerRole] = useState(initial.signerRole ?? "");

  // ── Estilos por categoria ──
  const [catStyles, setCatStyles] = useState<CategoryStyleState>(() =>
    buildInitialCatState(initial)
  );

  function updateCat(cat: PdfCategory, field: keyof CategoryStyleState[PdfCategory], value: string | boolean) {
    setCatStyles((prev) => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }));
  }

  function applyPreset(preset: (typeof PRESETS)[number]["values"]) {
    if (preset.bgColor)            setBgColor(preset.bgColor);
    if (preset.accentColor)        setAccentColor(preset.accentColor);
    if (preset.headerBorderColor)  setHeaderBorderColor(preset.headerBorderColor);
    if (preset.textColor)          setTextColor(preset.textColor ?? "#1a1a1a");
    if (preset.fontFamily)         setFontFamily(preset.fontFamily);
    if (preset.watermarkOpacity !== undefined) setWatermarkOpacity(preset.watermarkOpacity);
    if (preset.watermarkSize    !== undefined) setWatermarkSize(preset.watermarkSize);
  }

  function flash(ok: boolean, text: string) {
    if (ok) { setMsg(text); setErr(null); }
    else    { setErr(text); setMsg(null); }
    setTimeout(() => { setMsg(null); setErr(null); }, 4000);
  }

  function handleSubmit(formData: FormData) {
    // Injeta estilos de categoria habilitados no formData
    for (const cat of Object.keys(catStyles) as PdfCategory[]) {
      const s = catStyles[cat];
      if (s.enabled) {
        formData.set(`cat_${cat}_bgColor`,            s.bgColor);
        formData.set(`cat_${cat}_accentColor`,        s.accentColor);
        formData.set(`cat_${cat}_headerBorderColor`,  s.headerBorderColor);
        formData.set(`cat_${cat}_textColor`,          s.textColor);
        formData.set(`cat_${cat}_fontFamily`,         s.fontFamily);
      }
    }
    startTransition(async () => {
      const result = await savePdfConfig(formData);
      if (result.ok) flash(true, "Estilos de PDF salvos com sucesso.");
      else flash(false, result.error);
    });
  }

  function handlePreview(cat?: PdfCategory) {
    const effectiveCat = cat;
    const effectiveCatStyle = cat && catStyles[cat].enabled ? {
      bgColor:           catStyles[cat].bgColor,
      accentColor:       catStyles[cat].accentColor,
      headerBorderColor: catStyles[cat].headerBorderColor,
      textColor:         catStyles[cat].textColor,
      fontFamily:        catStyles[cat].fontFamily,
    } : undefined;

    const config: PdfConfig = {
      companyName:       initial.companyName   ?? "Flora Botanics",
      address:           initial.address       ?? "Rua das Flores, 123 — São Paulo, SP",
      cnpj:              initial.cnpj          ?? "12.345.678/0001-99",
      phone:             initial.phone         ?? "(11) 9 9999-9999",
      email:             initial.email         ?? "contato@florabotanics.com.br",
      website:           initial.website       ?? "florabotanics.com.br",
      defaultNotes:      "",
      signerName:        signerName || undefined,
      signerRole:        signerRole || undefined,
      bgColor,
      accentColor,
      headerBorderColor,
      textColor,
      fontFamily,
      watermarkOpacity,
      watermarkSize,
      categoryStyles: effectiveCat && effectiveCatStyle
        ? { [effectiveCat]: effectiveCatStyle } as PdfConfig["categoryStyles"]
        : undefined,
    };

    const html = buildFloraKraftPDF({
      title: cat ? `${PDF_CATEGORIES[cat]} — Pré-visualização` : "Estilos globais — Pré-visualização",
      subtitle: "Este é um exemplo de como o PDF ficará com as configurações atuais.",
      category: effectiveCat,
      body: `
        <div class="section">
          <div class="section-title">Exemplo de tabela</div>
          <table>
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>01/08/2026</td><td>Produto A — Flora Kit Premium</td><td>R$ 289,90</td><td>Aprovado</td></tr>
              <tr><td>01/08/2026</td><td>Produto B — Linha Orgânica</td><td>R$ 154,00</td><td>Em análise</td></tr>
              <tr><td>31/07/2026</td><td>Produto C — Cuidados Capilares</td><td>R$ 312,50</td><td>Entregue</td></tr>
            </tbody>
          </table>
        </div>
        <div class="section">
          <div class="section-title">Dados do documento</div>
          <pre>{ "numero": "0042", "cliente": "Exemplo Ltda", "validade": "30 dias" }</pre>
        </div>
      `,
      config,
    });
    openAndPrint(html);
  }

  return (
    <form action={handleSubmit} style={{ display: "grid", gap: 24 }}>
      {/* Campos hidden para os estilos globais controlados por state */}
      <input type="hidden" name="bgColor"           value={bgColor} />
      <input type="hidden" name="accentColor"       value={accentColor} />
      <input type="hidden" name="headerBorderColor" value={headerBorderColor} />
      <input type="hidden" name="textColor"         value={textColor} />
      <input type="hidden" name="fontFamily"        value={fontFamily} />
      <input type="hidden" name="watermarkOpacity"  value={watermarkOpacity} />
      <input type="hidden" name="watermarkSize"     value={watermarkSize} />
      <input type="hidden" name="signerName"        value={signerName} />
      <input type="hidden" name="signerRole"        value={signerRole} />

      {/* Feedback */}
      {msg && <FeedbackBar ok>{msg}</FeedbackBar>}
      {err && <FeedbackBar>{err}</FeedbackBar>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        {(["global", "categorias"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === t ? "2px solid var(--color-gold, #c8a84b)" : "2px solid transparent",
              color: activeTab === t ? "var(--color-gold, #c8a84b)" : "var(--color-muted, #8a9580)",
              padding: "8px 18px",
              fontSize: 12,
              fontWeight: activeTab === t ? 700 : 400,
              cursor: "pointer",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: -1,
            }}
          >
            {t === "global" ? "🎨 Estilo global" : "📂 Por categoria"}
          </button>
        ))}
      </div>

      {/* ── ABA GLOBAL ── */}
      {activeTab === "global" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Presets */}
          <Section title="Temas prontos">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.values)}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "7px 14px" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Cores */}
          <Section title="Cores do documento">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <ColorField label="Fundo do documento" value={bgColor} onChange={setBgColor} />
              <ColorField label="Cor de destaque / cabeçalho" value={accentColor} onChange={setAccentColor} />
              <ColorField label="Cor da borda do cabeçalho" value={headerBorderColor} onChange={setHeaderBorderColor} />
              <ColorField label="Cor do texto" value={textColor} onChange={setTextColor} />
            </div>
            <div style={{ marginTop: 12 }}>
              <PreviewSwatch
                bgColor={bgColor}
                accentColor={accentColor}
                headerBorderColor={headerBorderColor}
                textColor={textColor}
              />
            </div>
          </Section>

          {/* Tipografia */}
          <Section title="Tipografia">
            <label className="field" style={{ maxWidth: 360 }}>
              <span className="field-label">Fonte principal</span>
              <select
                className="input"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
              >
                <option value="Georgia, 'Times New Roman', serif">Georgia (clássica serif)</option>
                <option value="'Helvetica Neue', Arial, sans-serif">Helvetica / Arial (moderna)</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Courier New', monospace">Courier New (monospace)</option>
              </select>
            </label>
          </Section>

          {/* Marca d'água */}
          <Section title="Marca d'água">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 380 }}>
              <label className="field">
                <span className="field-label">Opacidade ({watermarkOpacity}%)</span>
                <input
                  type="range" min={0} max={30} step={1}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </label>
              <label className="field">
                <span className="field-label">Tamanho ({watermarkSize}px)</span>
                <input
                  type="range" min={100} max={500} step={10}
                  value={watermarkSize}
                  onChange={(e) => setWatermarkSize(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
          </Section>

          {/* Assinante */}
          <Section title="Responsável / Assinante (opcional)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 520 }}>
              <label className="field">
                <span className="field-label">Nome do funcionário</span>
                <input
                  className="input"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Ex.: Ana Paula Souza"
                />
              </label>
              <label className="field">
                <span className="field-label">Cargo</span>
                <input
                  className="input"
                  value={signerRole}
                  onChange={(e) => setSignerRole(e.target.value)}
                  placeholder="Ex.: Gerente Comercial"
                />
              </label>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-muted, #8a9580)", marginTop: 6 }}>
              Aparece em itálico no rodapé de todos os PDFs quando preenchido.
            </p>
          </Section>

          {/* Preview + salvar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px", fontSize: 10 }}>
              {pending ? "Salvando…" : "Salvar estilos"}
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: "11px 18px", fontSize: 10 }} onClick={() => handlePreview()}>
              📄 Pré-visualizar estilo global
            </button>
          </div>
        </div>
      )}

      {/* ── ABA CATEGORIAS ── */}
      {activeTab === "categorias" && (
        <div style={{ display: "grid", gap: 16 }}>
          <p style={{ fontSize: 12, color: "var(--color-muted, #8a9580)", lineHeight: 1.6 }}>
            Quando um PDF é gerado com uma categoria específica, o estilo definido aqui sobrepõe o estilo global.
            Ative apenas as categorias que precisam de visual diferenciado.
          </p>

          {(Object.keys(PDF_CATEGORIES) as PdfCategory[]).map((cat) => {
            const s = catStyles[cat];
            const label = PDF_CATEGORIES[cat];
            return (
              <div
                key={cat}
                style={{
                  background: s.enabled ? "rgba(200,168,77,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${s.enabled ? "rgba(200,168,77,0.25)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  transition: "all 0.2s",
                }}
              >
                {/* Cabeçalho da linha */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: s.enabled ? 14 : 0 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => updateCat(cat, "enabled", e.target.checked)}
                      style={{ accentColor: "var(--color-gold, #c8a84b)", width: 14, height: 14 }}
                    />
                    <span style={{
                      fontSize: 12,
                      fontWeight: s.enabled ? 600 : 400,
                      color: s.enabled ? "var(--color-text, #e8e3d9)" : "var(--color-muted, #8a9580)",
                    }}>
                      {label}
                    </span>
                  </label>
                  {s.enabled && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <span title="Fundo" style={{ width: 18, height: 18, borderRadius: 3, background: s.bgColor, border: "1px solid rgba(255,255,255,0.2)", display: "inline-block" }} />
                      <span title="Destaque" style={{ width: 18, height: 18, borderRadius: 3, background: s.accentColor, border: "1px solid rgba(255,255,255,0.2)", display: "inline-block" }} />
                      <span title="Borda" style={{ width: 18, height: 18, borderRadius: 3, background: s.headerBorderColor, border: "1px solid rgba(255,255,255,0.2)", display: "inline-block" }} />
                      <span title="Texto" style={{ width: 18, height: 18, borderRadius: 3, background: s.textColor, border: "1px solid rgba(255,255,255,0.2)", display: "inline-block" }} />
                    </div>
                  )}
                  {s.enabled && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 10, padding: "4px 10px" }}
                      onClick={() => handlePreview(cat)}
                    >
                      📄 Ver
                    </button>
                  )}
                </div>

                {/* Campos de cor (só quando habilitado) */}
                {s.enabled && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <ColorField
                      label="Fundo"
                      value={s.bgColor}
                      onChange={(v) => updateCat(cat, "bgColor", v)}
                      small
                    />
                    <ColorField
                      label="Destaque"
                      value={s.accentColor}
                      onChange={(v) => updateCat(cat, "accentColor", v)}
                      small
                    />
                    <ColorField
                      label="Borda cabeçalho"
                      value={s.headerBorderColor}
                      onChange={(v) => updateCat(cat, "headerBorderColor", v)}
                      small
                    />
                    <ColorField
                      label="Texto"
                      value={s.textColor}
                      onChange={(v) => updateCat(cat, "textColor", v)}
                      small
                    />
                    <label className="field">
                      <span className="field-label" style={{ fontSize: 10 }}>Fonte</span>
                      <select
                        className="input"
                        style={{ fontSize: 11 }}
                        value={s.fontFamily}
                        onChange={(e) => updateCat(cat, "fontFamily", e.target.value)}
                      >
                        <option value="Georgia, 'Times New Roman', serif">Georgia (serif)</option>
                        <option value="'Helvetica Neue', Arial, sans-serif">Helvetica (sans)</option>
                        <option value="'Times New Roman', serif">Times New Roman</option>
                        <option value="'Courier New', monospace">Courier (mono)</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px", fontSize: 10 }}>
              {pending ? "Salvando…" : "Salvar estilos"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1,
        textTransform: "uppercase", color: "var(--color-gold, #c8a84b)",
        marginBottom: 12,
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function ColorField({
  label, value, onChange, small,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label" style={small ? { fontSize: 10 } : undefined}>{label}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 32, border: "none", background: "none", cursor: "pointer", padding: 0 }}
        />
        <input
          type="text"
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          style={{ flex: 1, fontSize: small ? 11 : 12, fontFamily: "monospace" }}
          maxLength={7}
        />
      </div>
    </label>
  );
}

function PreviewSwatch({
  bgColor, accentColor, headerBorderColor, textColor,
}: {
  bgColor: string;
  accentColor: string;
  headerBorderColor: string;
  textColor: string;
}) {
  return (
    <div style={{
      background: bgColor,
      border: `2px solid ${headerBorderColor}`,
      borderRadius: 8,
      padding: "10px 14px",
      maxWidth: 340,
      display: "grid",
      gap: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, borderBottom: `1px solid ${headerBorderColor}`, paddingBottom: 4 }}>
        FLORA BOTANICS — Exemplo de cabeçalho
      </div>
      <div style={{ fontSize: 11, color: textColor, lineHeight: 1.5 }}>
        Texto do documento: <strong style={{ color: accentColor }}>Produto Premium</strong> · R$ 289,90
      </div>
      <div style={{ fontSize: 10, color: textColor, opacity: 0.6, borderTop: `1px solid ${headerBorderColor}`, paddingTop: 4 }}>
        florabotanics.com.br · rodapé do documento
      </div>
    </div>
  );
}

function FeedbackBar({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <p style={{
      color: ok ? "#8fd486" : "#e8a0a0",
      fontSize: 12,
      padding: "8px 12px",
      background: ok ? "rgba(143,212,134,0.08)" : "rgba(232,160,160,0.08)",
      borderRadius: 8,
      border: `1px solid ${ok ? "rgba(143,212,134,0.3)" : "rgba(232,160,160,0.3)"}`,
    }}>
      {ok ? "✓ " : "⚠️ "}{children}
    </p>
  );
}
