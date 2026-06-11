"use client";

import { useState, useTransition } from "react";
import { saveDraft, saveAndPublish, type SectionData } from "@/lib/cms/actions";

const BLOCK_LABEL: Record<string, string> = {
  hero: "Hero (banner principal)",
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

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  text: "Texto",
  heading: "Título da seção",
  eyebrow: "Sobretítulo",
  image: "Imagem (caminho)",
  product_image: "Imagem de produto (caminho)",
  label: "Rótulo",
  href: "Link",
  cta: "Botão (CTA)",
  items: "Itens",
  perks: "Vantagens",
  content: "Conteúdo",
  category_slug: "Categoria (slug)",
  icon: "Ícone",
};

const label = (k: string) => FIELD_LABEL[k] ?? k;

/* ---------- editor genérico de props (dirigido pelo JSON) ---------- */

function FieldEditor({
  value,
  onChange,
  fieldKey,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  fieldKey: string;
}) {
  if (typeof value === "string") {
    const long = value.length > 60;
    return long ? (
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        style={ui.input}
      />
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)} style={ui.input} />
    );
  }

  if (typeof value === "boolean") {
    return (
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    );
  }

  if (Array.isArray(value)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {value.map((item, i) => (
          <div key={i} style={ui.arrayItem}>
            <FieldEditor
              fieldKey={`${fieldKey}[${i}]`}
              value={item}
              onChange={(v) => {
                const next = [...value];
                next[i] = v;
                onChange(next);
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(obj).map(([k, v]) => (
          <div key={k}>
            <div style={ui.fieldLabel}>{label(k)}</div>
            <FieldEditor
              fieldKey={k}
              value={v}
              onChange={(nv) => onChange({ ...obj, [k]: nv })}
            />
          </div>
        ))}
      </div>
    );
  }

  return <em style={{ fontSize: 11, color: "#999" }}>tipo não editável</em>;
}

/* ---------- editor da página ---------- */

export function PageEditor({
  pageId,
  initialSections,
}: {
  pageId: string;
  initialSections: SectionData[];
}) {
  const [sections, setSections] = useState<SectionData[]>(initialSections);
  const [open, setOpen] = useState<string | null>(initialSections[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function move(idx: number, dir: -1 | 1) {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
  }

  function run(action: "draft" | "publish") {
    setMsg(null);
    startTransition(async () => {
      try {
        if (action === "draft") {
          const v = await saveDraft(pageId, sections);
          setMsg(`Rascunho salvo (versão ${v.version}).`);
        } else {
          const v = await saveAndPublish(pageId, sections);
          setMsg(`Publicado! (versão ${v.version}) — o site atualiza em até 60s.`);
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sections.map((s, idx) => (
          <section key={s.id} style={ui.card}>
            <header
              style={ui.cardHeader}
              onClick={() => setOpen(open === s.id ? null : s.id)}
            >
              <strong style={{ fontSize: 13 }}>
                {idx + 1}. {BLOCK_LABEL[s.block] ?? s.block}
              </strong>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  style={ui.miniBtn}
                  onClick={(e) => { e.stopPropagation(); move(idx, -1); }}
                  title="Mover para cima"
                >↑</button>
                <button
                  style={ui.miniBtn}
                  onClick={(e) => { e.stopPropagation(); move(idx, 1); }}
                  title="Mover para baixo"
                >↓</button>
                <span style={{ fontSize: 16, color: "#96763f" }}>
                  {open === s.id ? "−" : "+"}
                </span>
              </div>
            </header>

            {open === s.id ? (
              <div style={{ padding: "14px 18px", borderTop: "1px solid #e6ddcb" }}>
                <FieldEditor
                  fieldKey={s.block}
                  value={s.props}
                  onChange={(props) => {
                    setSections(
                      sections.map((x) =>
                        x.id === s.id ? { ...x, props: props as Record<string, unknown> } : x
                      )
                    );
                  }}
                />
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <footer style={ui.footer}>
        {msg ? <p style={{ fontSize: 12, margin: 0, color: "#21351d" }}>{msg}</p> : <span />}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => run("draft")} disabled={pending} style={ui.btnGhost}>
            {pending ? "…" : "Salvar rascunho"}
          </button>
          <button onClick={() => run("publish")} disabled={pending} style={ui.btnPrimary}>
            {pending ? "…" : "Salvar e publicar"}
          </button>
        </div>
      </footer>
    </div>
  );
}

const ui: Record<string, React.CSSProperties> = {
  card: { background: "#fff8ea", border: "1px solid #e6ddcb" },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 18px",
    cursor: "pointer",
    userSelect: "none",
  },
  miniBtn: {
    border: "1px solid #d7cdb8",
    background: "#fff",
    width: 26,
    height: 26,
    cursor: "pointer",
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6e5637",
    margin: "4px 0",
  },
  input: {
    width: "100%",
    border: "1px solid #d7cdb8",
    background: "#fff",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  arrayItem: { border: "1px dashed #d7cdb8", padding: 10 },
  footer: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginTop: 20,
    padding: "14px 0",
    background: "#f2ecdf",
    borderTop: "1px solid #e6ddcb",
  },
  btnGhost: {
    border: "1px solid #b9924d",
    background: "transparent",
    color: "#96763f",
    padding: "12px 20px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    cursor: "pointer",
  },
  btnPrimary: {
    border: 0,
    background: "#b9924d",
    color: "#fff8ea",
    padding: "12px 24px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    cursor: "pointer",
  },
};
