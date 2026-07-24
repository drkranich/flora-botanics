"use client";

import { useState, useRef, useTransition, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ImageField } from "@/components/MediaPicker";
import { sendTestHtmlEmail, createTemplate, updateTemplateBody } from "./actions";

/* ─── types ─────────────────────────────────────────────────── */
export type Block =
  | { type: "image"; url: string; alt: string; link: string; width: string }
  | { type: "heading"; text: string }
  | { type: "text"; html: string }
  | { type: "cta"; label: string; url: string; color: string }
  | { type: "divider" }
  | { type: "spacer" };

export interface StudioTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
}

/* ─── email HTML renderer ─────────────────────────────────────── */
function buildEmailHtml(subject: string, blocks: Block[]): string {
  const rows = blocks
    .map((b) => {
      switch (b.type) {
        case "image":
          return `<tr><td style="padding:0 0 20px;text-align:center;">
            ${b.link ? `<a href="${b.link}" style="display:block;">` : ""}
            <img src="${b.url}" alt="${b.alt}" style="max-width:${b.width};width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;" />
            ${b.link ? `</a>` : ""}
          </td></tr>`;
        case "heading":
          return `<tr><td style="padding:0 0 14px;"><h2 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#1a2e1c;line-height:1.25;">${b.text}</h2></td></tr>`;
        case "text":
          return `<tr><td style="padding:0 0 16px;font-family:Montserrat,Arial,sans-serif;font-size:15px;line-height:1.7;color:#374937;">${b.html}</td></tr>`;
        case "cta":
          return `<tr><td style="padding:8px 0 24px;text-align:center;"><a href="${b.url}" style="display:inline-block;background:${b.color || "#2a4a2c"};color:#f2ecdf;padding:14px 32px;border-radius:999px;font-family:Montserrat,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-decoration:none;text-transform:uppercase;">${b.label}</a></td></tr>`;
        case "divider":
          return `<tr><td style="padding:8px 0;"><hr style="border:0;border-top:1px solid #ddd6c8;" /></td></tr>`;
        case "spacer":
          return `<tr><td style="padding:16px 0;"></td></tr>`;
        default:
          return "";
      }
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f0ebe0;font-family:Montserrat,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe0;padding:32px 16px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">
        <!-- header bar -->
        <tr><td style="background:#1a2e1c;padding:20px 40px;text-align:center;">
          <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;letter-spacing:3px;color:#f2ecdf;text-transform:uppercase;">Flora Botanics</span>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:36px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows}
          </table>
        </td></tr>
        <!-- footer -->
        <tr><td style="background:#f7f3ed;padding:20px 40px;text-align:center;border-top:1px solid #e8e0d4;">
          <p style="margin:0;font-size:11px;color:#8a8078;font-family:Montserrat,Arial,sans-serif;line-height:1.6;">
            © ${new Date().getFullYear()} Flora Botanics · Cosméticos Naturais<br/>
            <a href="{{unsubscribe_url}}" style="color:#8a8078;text-decoration:underline;">Cancelar inscrição</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ─── block editors ──────────────────────────────────────────── */
const inputS: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 9,
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10,22,11,0.42)",
  width: "100%",
  boxSizing: "border-box",
};

const labelS: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--cream-dim)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  display: "block",
  marginBottom: 4,
};

function BlockEditor({
  block,
  onChange,
  onRemove,
  tenantId,
}: {
  block: Block;
  onChange: (b: Block) => void;
  onRemove: () => void;
  tenantId: string;
}) {
  const headerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  };

  function field(
    fieldLabel: string,
    key: string,
    extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>
  ) {
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={labelS}>{fieldLabel}</label>
        <input
          style={inputS}
          value={(block as Record<string, unknown>)[key] as string ?? ""}
          onChange={(e) => onChange({ ...block, [key]: e.target.value } as Block)}
          {...extra}
        />
      </div>
    );
  }

  return (
    <div
      className="glass"
      style={{ padding: 14, borderRadius: 12, background: "rgba(255,248,234,0.04)" }}
    >
      <div style={headerStyle}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            color: "var(--gold-light)",
          }}
        >
          {block.type === "image" && "📷 Imagem"}
          {block.type === "heading" && "📝 Título"}
          {block.type === "text" && "✏️ Texto"}
          {block.type === "cta" && "🔘 Botão CTA"}
          {block.type === "divider" && "— Divisor"}
          {block.type === "spacer" && "↕ Espaço"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          style={{ background: "none", border: "none", color: "#e8a0a0", cursor: "pointer", fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {block.type === "image" && (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={labelS}>Imagem</label>
            <ImageField
              value={block.url}
              tenantId={tenantId}
              onChange={(v) => onChange({ ...block, url: v as string })}
            />
          </div>
          {field("Texto alternativo (alt)", "alt")}
          {field("Link ao clicar", "link")}
          {field("Largura máxima (ex: 560px)", "width")}
        </>
      )}
      {block.type === "heading" && field("Texto do título", "text")}
      {block.type === "text" && (
        <div>
          <label style={labelS}>Conteúdo (HTML)</label>
          <TextEditor
            value={block.html}
            onChange={(html) => onChange({ ...block, html })}
          />
        </div>
      )}
      {block.type === "cta" && (
        <>
          {field("Rótulo do botão", "label")}
          {field("URL destino", "url")}
          {field("Cor de fundo (hex)", "color", { placeholder: "#2a4a2c" })}
        </>
      )}
    </div>
  );
}

function TextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cmd(c: string) {
    ref.current?.focus();
    document.execCommand(c, false, undefined);
    onChange(ref.current?.innerHTML ?? "");
  }

  const btnS: CSSProperties = {
    width: 30,
    height: 30,
    border: "1px solid var(--glass-border)",
    borderRadius: 7,
    background: "rgba(255,248,234,0.06)",
    color: "var(--cream)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button type="button" style={btnS} onClick={() => cmd("bold")}>B</button>
        <button type="button" style={{ ...btnS, fontStyle: "italic" }} onClick={() => cmd("italic")}>I</button>
        <button type="button" style={{ ...btnS, textDecoration: "underline" }} onClick={() => cmd("underline")}>U</button>
        <button type="button" style={btnS} onClick={() => cmd("insertUnorderedList")}>•</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        style={{
          minHeight: 100,
          border: "1px solid var(--glass-border)",
          borderRadius: 10,
          padding: 12,
          background: "rgba(10,22,11,0.48)",
          color: "var(--cream)",
          lineHeight: 1.7,
          outline: "none",
          fontSize: 13,
        }}
      />
    </div>
  );
}

/* ─── main studio ────────────────────────────────────────────── */
export function TemplateStudio({
  templates,
  tenantId,
  resendOk,
}: {
  templates: StudioTemplate[];
  tenantId: string;
  resendOk: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<StudioTemplate | null>(templates[0] ?? null);
  const [tab, setTab] = useState<"editor" | "preview" | "send">("preview");
  const [name, setName] = useState(selected?.name ?? "");
  const [subject, setSubject] = useState(selected?.subject ?? "");
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(selected?.body));
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function parseBlocks(body: string | null | undefined): Block[] {
    if (!body) return defaultBlocks();
    try {
      const parsed = JSON.parse(body);
      // format: { blocks: Block[], html: string }
      if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.blocks)) {
        return parsed.blocks as Block[];
      }
      // legacy: plain array
      if (Array.isArray(parsed)) return parsed as Block[];
    } catch {
      // plain text or HTML — wrap as text block
    }
    return [{ type: "text", html: body }];
  }

  function defaultBlocks(): Block[] {
    return [
      { type: "heading", text: "Olá, {{nome}}!" },
      { type: "text", html: "<p>Escreva sua mensagem aqui.</p>" },
      { type: "cta", label: "Acesse agora", url: "https://florabotanics.com.br", color: "#2a4a2c" },
    ];
  }

  function selectTemplate(t: StudioTemplate) {
    setSelected(t);
    setName(t.name);
    setSubject(t.subject ?? "");
    setBlocks(parseBlocks(t.body));
    setMsg(null);
    setTab("preview");
  }

  function addBlock(type: Block["type"]) {
    const defaults: Record<Block["type"], Block> = {
      image: { type: "image", url: "", alt: "", link: "", width: "560px" },
      heading: { type: "heading", text: "Novo título" },
      text: { type: "text", html: "<p>Escreva aqui...</p>" },
      cta: { type: "cta", label: "Saiba mais", url: "https://florabotanics.com.br", color: "#2a4a2c" },
      divider: { type: "divider" },
      spacer: { type: "spacer" },
    };
    setBlocks((prev) => [...prev, defaults[type]]);
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const next = [...blocks];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setBlocks(next);
  }

  const html = buildEmailHtml(subject || "Mensagem Flora Botanics", blocks);

  function handleSave() {
    if (!selected) return;
    // store blocks + rendered HTML together so the body is always sendable
    const body = JSON.stringify({ blocks, html });
    startTransition(async () => {
      try {
        await updateTemplateBody(selected.id, { name, subject, body });
        setMsg("✓ Template salvo.");
      } catch {
        setMsg("Erro ao salvar.");
      }
    });
  }

  function handleSend() {
    if (!sendTo) return;
    startTransition(async () => {
      const result = await sendTestHtmlEmail(sendTo, subject || "Teste — Flora Botanics", html);
      setMsg(result.ok ? "✓ E-mail enviado!" : `Erro: ${result.error}`);
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const fd = new FormData();
    fd.set("name", newName.trim());
    fd.set("channel", "email");
    fd.set("subject", `Mensagem de ${newName.trim()}`);
    fd.set("body", JSON.stringify(defaultBlocks()));
    startTransition(async () => {
      await createTemplate(fd);
      setCreating(false);
      setNewName("");
      router.refresh();
    });
  }

  const tabBtnS = (active: boolean): CSSProperties => ({
    padding: "7px 16px",
    borderRadius: 999,
    border: "none",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 0.5,
    background: active ? "var(--gold)" : "rgba(255,248,234,0.08)",
    color: active ? "var(--forest-950)" : "var(--cream-dim)",
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, minHeight: "70vh" }}>
      {/* ── sidebar: template list ── */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span className="eyebrow">Templates</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCreating((v) => !v)}
            style={{ padding: "5px 12px", fontSize: 10 }}
          >
            + Novo
          </button>
        </div>

        {creating && (
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 6 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do template"
              style={{ ...inputS, fontSize: 12 }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" className="btn btn-gold" style={{ padding: "6px 14px", fontSize: 10, flex: 1 }}>Criar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)} style={{ padding: "6px 12px", fontSize: 10 }}>Cancelar</button>
            </div>
          </form>
        )}

        {templates.map((t) => {
          const active = selected?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTemplate(t)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 12,
                border: active ? "1px solid var(--gold)" : "1px solid var(--glass-border)",
                background: active ? "rgba(185,146,77,0.12)" : "rgba(10,22,11,0.35)",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "all 0.15s",
              }}
            >
              {/* mini email preview */}
              <div
                style={{
                  background: "#f7f3ed",
                  borderRadius: 6,
                  padding: "6px 8px",
                  marginBottom: 8,
                  height: 56,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div style={{ background: "#1a2e1c", height: 10, borderRadius: "4px 4px 0 0", marginBottom: 4 }} />
                <div style={{ height: 5, background: "#d4cdc3", borderRadius: 2, marginBottom: 3, width: "80%" }} />
                <div style={{ height: 4, background: "#e8e0d4", borderRadius: 2, marginBottom: 2, width: "95%" }} />
                <div style={{ height: 4, background: "#e8e0d4", borderRadius: 2, width: "70%" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 60%, #f7f3ed)" }} />
              </div>
              <strong style={{ fontSize: 12, display: "block", color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.name}
              </strong>
              {t.subject && (
                <span style={{ fontSize: 11, color: "var(--cream-dim)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.subject}
                </span>
              )}
            </button>
          );
        })}

        {templates.length === 0 && !creating && (
          <p style={{ fontSize: 12, color: "var(--cream-dim)", margin: 0 }}>
            Nenhum template. Clique em "+ Novo" para criar.
          </p>
        )}
      </aside>

      {/* ── main editor area ── */}
      {selected ? (
        <div style={{ display: "grid", gap: 14 }}>
          {/* toolbar */}
          <div
            className="glass"
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {(["editor", "preview", "send"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} style={tabBtnS(tab === t)}>
                  {t === "editor" ? "✏️ Editar" : t === "preview" ? "👁 Prévia" : "📤 Enviar"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {msg && <span style={{ fontSize: 12, color: msg.startsWith("✓") ? "#8fd486" : "#e8a0a0" }}>{msg}</span>}
              <button type="button" className="btn btn-ghost" onClick={handleSave} style={{ padding: "7px 18px", fontSize: 11 }}>
                Salvar
              </button>
            </div>
          </div>

          {tab === "editor" && (
            <div style={{ display: "grid", gap: 12 }}>
              {/* meta fields */}
              <div className="glass" style={{ padding: 16, borderRadius: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelS}>Nome do template</label>
                    <input style={inputS} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelS}>Assunto do e-mail</label>
                    <input
                      style={inputS}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Olá {{nome}}, temos algo especial para você!"
                    />
                  </div>
                </div>
              </div>

              {/* blocks */}
              <div style={{ display: "grid", gap: 10 }}>
                {blocks.map((block, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8 }}>
                    {/* reorder */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 14 }}>
                      <button type="button" className="btn-icon" onClick={() => moveBlock(idx, -1)} style={{ fontSize: 10 }}>↑</button>
                      <button type="button" className="btn-icon" onClick={() => moveBlock(idx, 1)} style={{ fontSize: 10 }}>↓</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <BlockEditor
                        block={block}
                        onChange={(b) => setBlocks((prev) => prev.map((x, i) => (i === idx ? b : x)))}
                        onRemove={() => setBlocks((prev) => prev.filter((_, i) => i !== idx))}
                        tenantId={tenantId}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* add block */}
              <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
                <p className="eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>Inserir bloco</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["image", "heading", "text", "cta", "divider", "spacer"] as Block["type"][]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => addBlock(type)}
                      style={{ padding: "7px 14px", fontSize: 10 }}
                    >
                      {type === "image" && "📷 Imagem"}
                      {type === "heading" && "📝 Título"}
                      {type === "text" && "✏️ Texto"}
                      {type === "cta" && "🔘 CTA"}
                      {type === "divider" && "— Divisor"}
                      {type === "spacer" && "↕ Espaço"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && (
            <div
              style={{
                background: "rgba(255,248,234,0.04)",
                border: "1px solid var(--glass-border)",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              }}
            >
              {/* email client chrome */}
              <div
                style={{
                  background: "rgba(8,18,9,0.70)",
                  backdropFilter: "blur(20px)",
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderBottom: "1px solid rgba(255,248,234,0.09)",
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  {["#ff5f57", "rgba(255,248,234,0.15)", "#28c840"].map((bg, i) => (
                    <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: bg, display: "inline-block" }} />
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--cream-dim)", fontFamily: "monospace" }}>
                    Para: cliente@exemplo.com.br · <strong style={{ color: "var(--cream)" }}>{subject || "(sem assunto)"}</strong>
                  </div>
                </div>
              </div>
              <iframe
                srcDoc={html}
                style={{ width: "100%", minHeight: 600, border: 0, display: "block", background: "#f0ebe0" }}
                title="Prévia do e-mail"
                sandbox="allow-same-origin"
              />
            </div>
          )}

          {tab === "send" && (
            <div className="glass" style={{ padding: 28, borderRadius: 16, maxWidth: 540 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Enviar e-mail de teste</h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--cream-dim)" }}>
                Envia o template atual (com variáveis de exemplo) para o endereço informado.
              </p>

              {!resendOk && (
                <div
                  style={{
                    background: "rgba(185,146,77,0.12)",
                    border: "1px solid rgba(185,146,77,0.3)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 12,
                    marginBottom: 20,
                    color: "var(--cream-dim)",
                  }}
                >
                  Resend não configurado. Configure <code>RESEND_API_KEY</code> e <code>RESEND_FROM_EMAIL</code> nas variáveis do Worker.
                </div>
              )}

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={labelS}>Endereço de destino</label>
                  <input
                    type="email"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    placeholder="teste@exemplo.com"
                    style={inputS}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={!resendOk || !sendTo}
                  onClick={handleSend}
                  style={{ padding: "12px 24px", alignSelf: "flex-start" }}
                >
                  Enviar teste
                </button>
                {msg && (
                  <p style={{ margin: 0, fontSize: 13, color: msg.startsWith("✓") ? "#8fd486" : "#e8a0a0" }}>
                    {msg}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className="glass"
          style={{ borderRadius: 16, display: "grid", placeItems: "center", minHeight: 300, textAlign: "center" }}
        >
          <div>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
            <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
              Selecione um template à esquerda ou crie um novo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
