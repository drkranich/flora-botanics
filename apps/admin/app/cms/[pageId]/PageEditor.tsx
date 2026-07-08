"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { saveDraft, saveAndPublish, type SectionData } from "@/lib/cms/actions";
import { ImageField } from "@/components/MediaPicker";
import { BackgroundField, type SectionBackground } from "./BackgroundField";

const BLOCK_LABEL: Record<string, string> = {
  hero: "Hero — banner principal",
  category_grid: "Grade de categorias",
  ingredient_grid: "Grade de ingredientes",
  manifesto: "Manifesto",
  benefits: "Benefícios",
  newsletter: "Newsletter",
  rich_text: "Texto livre",
  banner: "Banner",
  faq: "Perguntas frequentes",
  product_carousel: "Carrossel de produtos",
};

const BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
  hero: {
    title: "Novo título",
    subtitle: "",
    image: "assets/hero-floresta.jpg",
    cta: { label: "Saiba mais", href: "#" },
  },
  category_grid: {
    heading: "Título da seção",
    items: [{ category_slug: "", image: "" }],
  },
  ingredient_grid: {
    heading: "Título da seção",
    text: "",
    cta: { label: "Saiba mais", href: "#" },
    items: [{ title: "Novo item", text: "", image: "" }],
  },
  manifesto: {
    eyebrow: "Sobretítulo",
    title: "Novo título",
    text: "",
    image: "",
    imageFit: "contain",
    imageX: 50,
    imageY: 50,
    imageHeight: "380px",
    cta: { label: "Saiba mais", href: "#" },
  },
  benefits: { items: [{ icon: "leaf", title: "Novo benefício", text: "" }] },
  newsletter: { title: "Título", text: "", perks: [""] },
  rich_text: {
    content: "<h2>Um texto com respiro editorial</h2><p>Escreva aqui com parágrafos, subtítulos e ritmo de leitura. O resultado no site público não precisa parecer um bloco colado: ele pode ter largura, alinhamento, contraste e tipografia de publicação.</p>",
    typography: {
      displayFont: "Cormorant Garamond",
      bodyFont: "Montserrat",
      align: "left",
      width: "760px",
      titleSize: "42px",
      bodySize: "17px",
      lineHeight: "1.85",
    },
  },
  banner: { image: "", href: "", full_width: true },
  faq: { items: [{ q: "Pergunta?", a: "Resposta." }] },
  product_carousel: { heading: "Título da seção", collection_slug: "" },
};

const ITEM_TEMPLATES: Record<string, unknown> = {
  "category_grid.items": { category_slug: "", image: "" },
  "ingredient_grid.items": { title: "", text: "", image: "" },
  "benefits.items": { icon: "leaf", title: "", text: "" },
  "faq.items": { q: "", a: "" },
  "newsletter.perks": "",
};

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  text: "Texto",
  heading: "Título da seção",
  eyebrow: "Sobretítulo",
  image: "Imagem",
  product_image: "Imagem de produto",
  label: "Rótulo",
  href: "Link",
  cta: "Botão (CTA)",
  items: "Itens",
  perks: "Vantagens",
  content: "Conteúdo",
  category_slug: "Categoria (slug)",
  icon: "Ícone",
  q: "Pergunta",
  a: "Resposta",
  collection_slug: "Coleção (slug)",
  full_width: "Largura total",
  overlay: "Sobreposição escura",
};

const IMAGE_KEYS = new Set(["image", "product_image"]);
const TYPOGRAPHY_KEY = "typography";
const DEDICATED_PROP_KEYS = new Set([
  "background",
  TYPOGRAPHY_KEY,
  "imageFit",
  "imageX",
  "imageY",
  "imageHeight",
]);

const DISPLAY_FONTS = [
  { label: "Cormorant editorial", value: "Cormorant Garamond" },
  { label: "Fraunces sofisticada", value: "Fraunces" },
  { label: "Lora clássica", value: "Lora" },
  { label: "Montserrat limpa", value: "Montserrat" },
];

const BODY_FONTS = [
  { label: "Montserrat", value: "Montserrat" },
  { label: "Inter", value: "Inter" },
  { label: "Lora", value: "Lora" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond" },
];

type TypographySettings = {
  displayFont?: string;
  bodyFont?: string;
  align?: "left" | "center" | "right";
  width?: string;
  titleSize?: string;
  bodySize?: string;
  lineHeight?: string;
  color?: string;
};

type ImageFrameSettings = {
  imageFit?: "cover" | "contain";
  imageX?: number;
  imageY?: number;
  imageHeight?: string;
};

const label = (k: string) => FIELD_LABEL[k] ?? k;

function blankClone(v: unknown): unknown {
  if (typeof v === "string") return "";
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return 0;
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, blankClone(x)])
    );
  }
  return v;
}

function typographyValue(value: unknown): TypographySettings {
  return value && typeof value === "object" ? (value as TypographySettings) : {};
}

function inputMiniStyle(): CSSProperties {
  return {
    minHeight: 38,
    border: "1px solid var(--glass-border)",
    borderRadius: 9,
    padding: "0 10px",
    color: "var(--cream)",
    background: "rgba(10, 22, 11, 0.42)",
    fontFamily: "inherit",
    fontSize: 12,
  };
}

function numberValue(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ImageFrameEditor({
  value,
  onChange,
}: {
  value: ImageFrameSettings;
  onChange: (value: ImageFrameSettings) => void;
}) {
  const settings: ImageFrameSettings = {
    imageFit: value.imageFit ?? "contain",
    imageX: numberValue(value.imageX, 50),
    imageY: numberValue(value.imageY, 50),
    imageHeight: value.imageHeight ?? "380px",
  };
  const patch = (next: Partial<ImageFrameSettings>) => onChange({ ...settings, ...next });

  return (
    <div className="glass" style={{ padding: 16, marginBottom: 16, background: "rgba(255, 248, 234, 0.045)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 5 }}>Enquadramento da imagem</p>
          <p className="muted" style={{ fontSize: 11 }}>
            Ajuste como a imagem ocupa a faixa no site público.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => onChange({ imageFit: "contain", imageX: 50, imageY: 50, imageHeight: "380px" })} style={{ padding: "8px 12px", fontSize: 9 }}>
          Padrão
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <label className="field">
          <span className="field-label">Modo da imagem</span>
          <select value={settings.imageFit} onChange={(e) => patch({ imageFit: e.target.value as ImageFrameSettings["imageFit"] })} style={inputMiniStyle()}>
            <option value="contain">Imagem completa</option>
            <option value="cover">Preencher área</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Altura da faixa</span>
          <select value={settings.imageHeight} onChange={(e) => patch({ imageHeight: e.target.value })} style={inputMiniStyle()}>
            <option value="315px">Compacta</option>
            <option value="380px">Equilibrada</option>
            <option value="460px">Editorial</option>
            <option value="560px">Imersiva</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Posição horizontal: {settings.imageX}%</span>
          <input type="range" min={0} max={100} value={settings.imageX} onChange={(e) => patch({ imageX: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span className="field-label">Posição vertical: {settings.imageY}%</span>
          <input type="range" min={0} max={100} value={settings.imageY} onChange={(e) => patch({ imageY: Number(e.target.value) })} />
        </label>
      </div>
    </div>
  );
}

function TypographyEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: TypographySettings) => void;
}) {
  const settings = typographyValue(value);
  const patch = (next: Partial<TypographySettings>) => onChange({ ...settings, ...next });

  return (
    <div className="glass" style={{ padding: 16, marginBottom: 16, background: "rgba(255, 248, 234, 0.045)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 5 }}>Tipografia da seção</p>
          <p className="muted" style={{ fontSize: 11 }}>
            Fonte, largura, alinhamento e ritmo do texto no site público.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => onChange({})} style={{ padding: "8px 12px", fontSize: 9 }}>
          Limpar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <label className="field">
          <span className="field-label">Fonte dos títulos</span>
          <select value={settings.displayFont ?? "Cormorant Garamond"} onChange={(e) => patch({ displayFont: e.target.value })} style={inputMiniStyle()}>
            {DISPLAY_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Fonte do texto</span>
          <select value={settings.bodyFont ?? "Montserrat"} onChange={(e) => patch({ bodyFont: e.target.value })} style={inputMiniStyle()}>
            {BODY_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Posição</span>
          <select value={settings.align ?? "left"} onChange={(e) => patch({ align: e.target.value as TypographySettings["align"] })} style={inputMiniStyle()}>
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Largura do texto</span>
          <select value={settings.width ?? "760px"} onChange={(e) => patch({ width: e.target.value })} style={inputMiniStyle()}>
            <option value="620px">Coluna estreita</option>
            <option value="760px">Editorial</option>
            <option value="920px">Página larga</option>
            <option value="1120px">Cheio na seção</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Tamanho do título</span>
          <input value={settings.titleSize ?? "42px"} onChange={(e) => patch({ titleSize: e.target.value })} placeholder="42px" style={inputMiniStyle()} />
        </label>
        <label className="field">
          <span className="field-label">Tamanho do texto</span>
          <input value={settings.bodySize ?? "17px"} onChange={(e) => patch({ bodySize: e.target.value })} placeholder="17px" style={inputMiniStyle()} />
        </label>
        <label className="field">
          <span className="field-label">Entrelinha</span>
          <input value={settings.lineHeight ?? "1.85"} onChange={(e) => patch({ lineHeight: e.target.value })} placeholder="1.85" style={inputMiniStyle()} />
        </label>
        <label className="field">
          <span className="field-label">Cor do texto</span>
          <input value={settings.color ?? ""} onChange={(e) => patch({ color: e.target.value })} placeholder="ex: #28251d" style={inputMiniStyle()} />
        </label>
      </div>
    </div>
  );
}

function RichTextContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);

  useEffect(() => {
    if (!source && editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value, source]);

  function sync() {
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function command(cmd: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  }

  function addLink() {
    const href = window.prompt("Cole o link");
    if (!href) return;
    command("createLink", href);
  }

  const toolStyle: CSSProperties = {
    minWidth: 34,
    height: 34,
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    color: "var(--cream)",
    background: "rgba(255, 248, 234, 0.07)",
    cursor: "pointer",
    fontWeight: 800,
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" style={toolStyle} onClick={() => command("formatBlock", "p")}>P</button>
        <button type="button" style={toolStyle} onClick={() => command("formatBlock", "h2")}>H2</button>
        <button type="button" style={toolStyle} onClick={() => command("formatBlock", "h3")}>H3</button>
        <button type="button" style={toolStyle} onClick={() => command("bold")}>B</button>
        <button type="button" style={{ ...toolStyle, fontStyle: "italic" }} onClick={() => command("italic")}>I</button>
        <button type="button" style={{ ...toolStyle, textDecoration: "underline" }} onClick={() => command("underline")}>U</button>
        <button type="button" style={toolStyle} onClick={() => command("justifyLeft")}>←</button>
        <button type="button" style={toolStyle} onClick={() => command("justifyCenter")}>↔</button>
        <button type="button" style={toolStyle} onClick={() => command("justifyRight")}>→</button>
        <button type="button" style={toolStyle} onClick={() => command("insertUnorderedList")}>•</button>
        <button type="button" style={toolStyle} onClick={() => command("insertOrderedList")}>1.</button>
        <button type="button" style={toolStyle} onClick={addLink}>↗</button>
        <button type="button" className="btn btn-ghost" onClick={() => setSource((v) => !v)} style={{ padding: "0 12px", fontSize: 9 }}>
          {source ? "Visual" : "HTML"}
        </button>
      </div>

      {source ? (
        <textarea
          className="input"
          value={value}
          rows={10}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          style={{
            minHeight: 220,
            border: "1px solid var(--glass-border)",
            borderRadius: 14,
            padding: 16,
            background: "rgba(10, 22, 11, 0.48)",
            color: "var(--cream)",
            lineHeight: 1.75,
            outline: "none",
          }}
        />
      )}
    </div>
  );
}

/* ---------- editor genérico de props ---------- */

function FieldEditor({
  value,
  onChange,
  fieldKey,
  blockType,
  tenantId,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  fieldKey: string;
  blockType: string;
  tenantId: string;
}) {
  if (typeof value === "string") {
    if (blockType === "rich_text" && fieldKey === "content") {
      return <RichTextContentEditor value={value} onChange={onChange as (value: string) => void} />;
    }
    if (IMAGE_KEYS.has(fieldKey)) {
      return <ImageField value={value} tenantId={tenantId} onChange={onChange} />;
    }
    const long = value.length > 60;
    return long ? (
      <textarea
        className="input"
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }

  if (typeof value === "boolean") {
    return (
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    );
  }

  if (Array.isArray(value)) {
    const addItem = () => {
      const template =
        value.length > 0
          ? blankClone(value[value.length - 1])
          : ITEM_TEMPLATES[`${blockType}.${fieldKey}`] ?? "";
      onChange([...value, template]);
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {value.map((item, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              border: "1px dashed var(--glass-border)",
              borderRadius: "var(--radius-md)",
              padding: 14,
            }}
          >
            <button
              type="button"
              className="btn-icon"
              title="Remover item"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 24,
                height: 24,
                fontSize: 11,
                color: "#e8a0a0",
              }}
            >
              ✕
            </button>
            <div style={{ paddingRight: 28 }}>
              <FieldEditor
                fieldKey={fieldKey}
                blockType={blockType}
                tenantId={tenantId}
                value={item}
                onChange={(v) => {
                  const next = [...value];
                  next[i] = v;
                  onChange(next);
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={addItem}
          style={{ padding: "10px 18px", alignSelf: "flex-start", fontSize: 10 }}
        >
          + Adicionar item
        </button>
      </div>
    );
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(obj)
          .filter(([k]) => !DEDICATED_PROP_KEYS.has(k)) // editados por controles dedicados
          .map(([k, v]) => (
          <div key={k} className="field">
            <span className="field-label">{label(k)}</span>
            <FieldEditor
              fieldKey={k}
              blockType={blockType}
              tenantId={tenantId}
              value={v}
              onChange={(nv) => onChange({ ...obj, [k]: nv })}
            />
          </div>
        ))}
      </div>
    );
  }

  return <em className="muted" style={{ fontSize: 11 }}>tipo não editável</em>;
}

/* ---------- editor da página ---------- */

export function PageEditor({
  pageId,
  initialSections,
  tenantId,
  storefrontUrl,
}: {
  pageId: string;
  initialSections: SectionData[];
  tenantId: string;
  storefrontUrl: string;
}) {
  const [sections, setSections] = useState<SectionData[]>(initialSections);
  const [open, setOpen] = useState<string | null>(initialSections[0]?.id ?? null);
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(true);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  /* ---- preview ao vivo: envia seções ao iframe (debounce) ---- */
  function pushPreview() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "flora-preview", sections },
      "*"
    );
  }

  useEffect(() => {
    const t = setTimeout(pushPreview, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, preview]);

  useEffect(() => {
    function onReady(e: MessageEvent) {
      if (e.data?.type === "flora-preview-ready") pushPreview();
    }
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  /* ---- drag and drop ---- */
  function onDrop(target: number) {
    const from = dragIdx.current;
    dragIdx.current = null;
    setOverIdx(null);
    if (from === null || from === target) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    setSections(next);
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
  }

  function removeSection(id: string) {
    if (!confirm("Remover esta seção? (só vale após salvar/publicar)")) return;
    setSections(sections.filter((s) => s.id !== id));
  }

  function addSection(block: string) {
    const id = `s${Date.now().toString(36)}`;
    setSections([
      ...sections,
      { id, block, props: structuredClone(BLOCK_DEFAULTS[block] ?? {}) },
    ]);
    setOpen(id);
    setPicker(false);
  }

  function run(action: "draft" | "publish") {
    setMsg(null);
    startTransition(async () => {
      try {
        if (action === "draft") {
          const v = await saveDraft(pageId, sections);
          setMsg(`Rascunho salvo — versão ${v.version}.`);
        } else {
          const v = await saveAndPublish(pageId, sections);
          setMsg(`Publicado! Versão ${v.version} no ar — o site atualiza em até 60s.`);
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: preview ? "minmax(380px, 540px) 1fr" : "minmax(420px, 720px)",
        gap: 32,
        alignItems: "start",
      }}
    >
      {/* ============ COLUNA DO EDITOR ============ */}
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sections.map((s, idx) => {
            const isOpen = open === s.id;
            return (
              <section
                key={s.id}
                className="glass"
                onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
                onDragLeave={() => setOverIdx((o) => (o === idx ? null : o))}
                onDrop={() => onDrop(idx)}
                style={{
                  outline:
                    overIdx === idx && dragIdx.current !== null
                      ? "2px dashed var(--gold)"
                      : "none",
                  outlineOffset: 3,
                }}
              >
                <header
                  draggable
                  onDragStart={() => { dragIdx.current = idx; }}
                  onDragEnd={() => { dragIdx.current = null; setOverIdx(null); }}
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px 18px",
                    cursor: "grab",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ color: "var(--cream-dim)", fontSize: 14, cursor: "grab" }} title="Arraste para reordenar">
                      ⠿
                    </span>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(185,146,77,0.15)",
                        color: "var(--gold-light)",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <strong style={{ fontSize: 13, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {BLOCK_LABEL[s.block] ?? s.block}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); move(idx, -1); }} title="Mover para cima">↑</button>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); move(idx, 1); }} title="Mover para baixo">↓</button>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); removeSection(s.id); }} title="Remover seção" style={{ color: "#e8a0a0" }}>✕</button>
                    <span style={{ color: "var(--gold-light)", fontSize: 18, width: 16, textAlign: "center" }}>
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>
                </header>

                <div
                  style={{
                    maxHeight: isOpen ? 6000 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.5s var(--ease)",
                  }}
                >
                  <div style={{ padding: "6px 20px 22px", borderTop: "1px solid var(--glass-border)" }}>
                    <div style={{ paddingTop: 16 }}>
                      <BackgroundField
                        value={s.props.background as SectionBackground | undefined}
                        tenantId={tenantId}
                        onChange={(bg) => {
                          setSections(
                            sections.map((x) =>
                              x.id === s.id
                                ? { ...x, props: { ...x.props, background: bg } }
                                : x
                            )
                          );
                        }}
                      />
                      <TypographyEditor
                        value={s.props.typography}
                        onChange={(typography) => {
                          setSections(
                            sections.map((x) =>
                              x.id === s.id
                                ? { ...x, props: { ...x.props, typography } }
                                : x
                            )
                          );
                        }}
                      />
                      {s.block === "manifesto" ? (
                        <ImageFrameEditor
                          value={{
                            imageFit: s.props.imageFit as ImageFrameSettings["imageFit"],
                            imageX: s.props.imageX as number | undefined,
                            imageY: s.props.imageY as number | undefined,
                            imageHeight: s.props.imageHeight as string | undefined,
                          }}
                          onChange={(frame) => {
                            setSections(
                              sections.map((x) =>
                                x.id === s.id
                                  ? { ...x, props: { ...x.props, ...frame } }
                                  : x
                              )
                            );
                          }}
                        />
                      ) : null}
                      <FieldEditor
                        fieldKey={s.block}
                        blockType={s.block}
                        tenantId={tenantId}
                        value={s.props}
                        onChange={(props) => {
                          setSections(
                            sections.map((x) =>
                              x.id === s.id
                                ? { ...x, props: props as Record<string, unknown> }
                                : x
                            )
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* ---- adicionar seção ---- */}
        <div style={{ marginTop: 18 }}>
          {picker ? (
            <div className="glass rise" style={{ padding: 20 }}>
              <p className="eyebrow" style={{ marginBottom: 14 }}>Escolha o tipo de seção</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                {Object.entries(BLOCK_LABEL).map(([block, lbl]) => (
                  <button
                    key={block}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => addSection(block)}
                    style={{ padding: "12px 14px", fontSize: 10, justifyContent: "flex-start" }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="muted"
                onClick={() => setPicker(false)}
                style={{ marginTop: 14, background: "none", border: 0, fontSize: 11, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPicker(true)}
              style={{ width: "100%", padding: "16px", borderStyle: "dashed" }}
            >
              + Adicionar seção
            </button>
          )}
        </div>
      </div>

      {/* ============ COLUNA DO PREVIEW (sem moldura) ============ */}
      {preview ? (
        <div
          className="rise"
          style={{
            position: "sticky",
            top: 16,
            height: "calc(100vh - 110px)",
          }}
        >
          {/* controles flutuando sobre a página, sem barra */}
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(15, 32, 18, 0.55)",
              backdropFilter: "blur(14px) saturate(1.2)",
              WebkitBackdropFilter: "blur(14px) saturate(1.2)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#8fd486",
                boxShadow: "0 0 8px #8fd486",
              }}
            />
            <span className="eyebrow" style={{ fontSize: 9 }}>Ao vivo</span>
            <button
              onClick={() => setPreview(false)}
              title="Ocultar preview"
              style={{
                background: "none",
                border: 0,
                color: "var(--cream-soft)",
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ✕
            </button>
          </div>
          <iframe
            ref={iframeRef}
            src={`${storefrontUrl}/preview`}
            onLoad={pushPreview}
            style={{
              border: 0,
              width: "100%",
              height: "100%",
              background: "#f2ecdf",
              borderRadius: 26,
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.45)",
            }}
            title="Preview da página"
          />
        </div>
      ) : null}

      {/* ============ BARRA DE AÇÕES ============ */}
      <footer
        className="glass"
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 22,
          width: "min(720px, calc(100vw - 40px))",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "14px 22px",
          borderRadius: 999,
          background: "rgba(15, 32, 18, 0.78)",
          zIndex: 50,
        }}
      >
        <p style={{ fontSize: 11.5, margin: 0, color: "var(--cream-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {msg ?? `${sections.length} seções`}
        </p>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {!preview ? (
            <button onClick={() => setPreview(true)} className="btn btn-ghost" style={{ padding: "11px 18px" }}>
              Preview
            </button>
          ) : null}
          <button onClick={() => run("draft")} disabled={pending} className="btn btn-ghost" style={{ padding: "11px 20px" }}>
            {pending ? "…" : "Rascunho"}
          </button>
          <button onClick={() => run("publish")} disabled={pending} className="btn btn-gold" style={{ padding: "11px 24px" }}>
            {pending ? "…" : "Publicar"}
          </button>
        </div>
      </footer>
    </div>
  );
}
