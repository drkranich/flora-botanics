"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Macro } from "./inbox-actions";
import { getMacros, createMacro, deleteMacro, incrementMacroUse } from "./inbox-actions";

// Variáveis suportadas para substituição
const VARIABLES = ["{{nome}}", "{{email}}", "{{pedido}}", "{{loja}}", "{{data}}"];

function applyVars(body: string, ctx: { nome?: string; email?: string; pedido?: string; loja?: string }) {
  const today = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  return body
    .replace(/\{\{nome\}\}/g, ctx.nome ?? "{{nome}}")
    .replace(/\{\{email\}\}/g, ctx.email ?? "{{email}}")
    .replace(/\{\{pedido\}\}/g, ctx.pedido ?? "{{pedido}}")
    .replace(/\{\{loja\}\}/g, ctx.loja ?? "Flora Botanics")
    .replace(/\{\{data\}\}/g, today);
}

interface Props {
  /** Contexto opcional para substituição de variáveis */
  contactName?: string | null;
  contactEmail?: string | null;
  lastOrderNumber?: string | null;
  /** Callback: retorna o corpo do template pronto para inserir no editor */
  onApply: (body: string, isNote: boolean) => void;
  onClose: () => void;
}

export function MacroPicker({ contactName, contactEmail, lastOrderNumber, onApply, onClose }: Props) {
  const [macros, setMacros]       = useState<Macro[]>([]);
  const [search, setSearch]       = useState("");
  const [view, setView]           = useState<"list" | "new">("list");
  const [isPending, start]        = useTransition();

  // Form novo template
  const [newName, setNewName]     = useState("");
  const [newDesc, setNewDesc]     = useState("");
  const [newBody, setNewBody]     = useState("");
  const [newIsNote, setNewIsNote] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    start(async () => {
      const list = await getMacros();
      setMacros(list);
    });
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function handleApply(macro: Macro) {
    const action = macro.actions.find(a => a.type === "send_reply" || a.type === "send_note");
    if (!action) return;
    const raw = (action.params.body as string) ?? "";
    const body = applyVars(raw, {
      nome:   contactName  ?? undefined,
      email:  contactEmail ?? undefined,
      pedido: lastOrderNumber ?? undefined,
    });
    onApply(body, action.type === "send_note");
    start(async () => { await incrementMacroUse(macro.id); });
    onClose();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    start(async () => {
      await deleteMacro(id);
      setMacros(prev => prev.filter(m => m.id !== id));
    });
  }

  async function handleCreate() {
    setFormError(null);
    if (!newName.trim()) { setFormError("Nome obrigatório."); return; }
    if (!newBody.trim()) { setFormError("Corpo do template obrigatório."); return; }
    start(async () => {
      const res = await createMacro(newName, newDesc, newBody, newIsNote);
      if (!res.ok) { setFormError(res.error); return; }
      const updated = await getMacros();
      setMacros(updated);
      setView("list");
      setNewName(""); setNewDesc(""); setNewBody(""); setNewIsNote(false);
    });
  }

  const filtered = macros.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Preview de uma macro ──────────────────────────────────────────────────
  function previewBody(macro: Macro) {
    const action = macro.actions.find(a => a.type === "send_reply" || a.type === "send_note");
    if (!action) return "";
    return (action.params.body as string ?? "").slice(0, 90);
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: 0,
        width: "min(400px, 90vw)",
        background: "rgba(10,22,11,0.97)",
        border: "1px solid rgba(242,236,223,0.12)",
        borderRadius: 14,
        boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(185,146,77,0.08)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        zIndex: 500,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: "60vh",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px 10px",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {view === "new" && (
            <button
              onClick={() => setView("list")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--cream-dim)", fontSize: 14, padding: 0, lineHeight: 1,
              }}
            >
              ←
            </button>
          )}
          <span style={{
            fontFamily: "Fraunces, serif", fontSize: 14, fontWeight: 500,
            color: "var(--cream)", letterSpacing: -0.2,
          }}>
            {view === "new" ? "Novo template" : "Templates de resposta"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {view === "list" && (
            <button
              onClick={() => setView("new")}
              style={{
                background: "rgba(185,146,77,0.12)",
                border: "1px solid rgba(185,146,77,0.25)",
                borderRadius: 7, padding: "4px 10px",
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
                color: "var(--gold-light)", cursor: "pointer",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              + Novo
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: "rgba(242,236,223,0.06)",
              border: "1px solid rgba(242,236,223,0.1)",
              borderRadius: 7, width: 26, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--cream-dim)", fontSize: 13,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      {view === "list" && (
        <>
          {/* Busca */}
          <div style={{ padding: "10px 14px 6px", flexShrink: 0 }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar template…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(10,22,11,0.6)",
                border: "1px solid rgba(242,236,223,0.1)",
                borderRadius: 8, padding: "7px 11px",
                color: "var(--cream)", fontSize: 12.5,
                fontFamily: "Manrope, sans-serif", outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
            />
          </div>

          {/* Dica de variáveis */}
          <div style={{
            padding: "4px 14px 8px",
            display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0,
          }}>
            {VARIABLES.map(v => (
              <span key={v} style={{
                fontSize: 9.5, color: "var(--gold-light)",
                background: "rgba(185,146,77,0.1)",
                border: "1px solid rgba(185,146,77,0.2)",
                borderRadius: 4, padding: "1px 6px",
                fontFamily: "Manrope, sans-serif", fontWeight: 600,
              }}>
                {v}
              </span>
            ))}
          </div>

          {/* Lista de templates */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {isPending && macros.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--cream-dim)", fontSize: 12 }}>
                Carregando…
              </div>
            )}
            {!isPending && filtered.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <div style={{ fontSize: 22, color: "var(--gold-light)", opacity: 0.2, marginBottom: 8, fontFamily: "Fraunces, serif" }}>✦</div>
                <p style={{ fontSize: 12, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>
                  {search ? "Nenhum template encontrado" : "Nenhum template criado ainda"}
                </p>
                {!search && (
                  <button
                    onClick={() => setView("new")}
                    style={{
                      marginTop: 10,
                      background: "rgba(185,146,77,0.12)",
                      border: "1px solid rgba(185,146,77,0.25)",
                      borderRadius: 8, padding: "7px 14px",
                      fontSize: 11, color: "var(--gold-light)",
                      cursor: "pointer", fontFamily: "Manrope, sans-serif", fontWeight: 600,
                    }}
                  >
                    + Criar primeiro template
                  </button>
                )}
              </div>
            )}

            {filtered.map(macro => {
              const action = macro.actions.find(a => a.type === "send_reply" || a.type === "send_note");
              const isNote = action?.type === "send_note";
              return (
                <button
                  key={macro.id}
                  onClick={() => handleApply(macro)}
                  style={{
                    display: "block", width: "100%",
                    padding: "11px 14px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(242,236,223,0.05)",
                    cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(185,146,77,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: "var(--cream)", fontFamily: "Manrope, sans-serif",
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {macro.name}
                    </span>
                    {isNote && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1,
                        color: "#f0b429",
                        background: "rgba(240,180,41,0.1)",
                        border: "1px solid rgba(240,180,41,0.22)",
                        borderRadius: 4, padding: "1px 5px",
                        fontFamily: "Manrope, sans-serif",
                      }}>
                        NOTA
                      </span>
                    )}
                    {macro.use_count > 0 && (
                      <span style={{
                        fontSize: 9.5, color: "var(--cream-dim)",
                        fontFamily: "Manrope, sans-serif",
                      }}>
                        {macro.use_count}×
                      </span>
                    )}
                    <button
                      onClick={e => handleDelete(macro.id, e)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "rgba(242,236,223,0.2)", fontSize: 12, padding: "0 2px",
                        lineHeight: 1, flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,236,223,0.2)")}
                      title="Excluir template"
                    >
                      ✕
                    </button>
                  </div>
                  {previewBody(macro) && (
                    <div style={{
                      fontSize: 11, color: "var(--cream-dim)",
                      fontFamily: "Manrope, sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {previewBody(macro)}{(action?.params.body as string ?? "").length > 90 ? "…" : ""}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Formulário de criação ─────────────────────────────────────────── */}
      {view === "new" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Nome */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>
              Nome do template *
            </label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="ex: Saudação inicial, Pedido em processamento…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(10,22,11,0.6)",
                border: "1px solid rgba(242,236,223,0.1)",
                borderRadius: 8, padding: "8px 11px",
                color: "var(--cream)", fontSize: 12.5,
                fontFamily: "Manrope, sans-serif", outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
            />
          </div>

          {/* Descrição */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>
              Descrição (opcional)
            </label>
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Breve descrição para facilitar a busca"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(10,22,11,0.6)",
                border: "1px solid rgba(242,236,223,0.1)",
                borderRadius: 8, padding: "8px 11px",
                color: "var(--cream)", fontSize: 12.5,
                fontFamily: "Manrope, sans-serif", outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
            />
          </div>

          {/* Tipo */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { v: false, label: "↩ Resposta" },
              { v: true,  label: "✦ Nota interna" },
            ].map(opt => (
              <button
                key={String(opt.v)}
                onClick={() => setNewIsNote(opt.v)}
                style={{
                  flex: 1, padding: "7px",
                  background: newIsNote === opt.v
                    ? opt.v ? "rgba(240,180,41,0.12)" : "rgba(185,146,77,0.12)"
                    : "rgba(242,236,223,0.04)",
                  border: `1px solid ${newIsNote === opt.v
                    ? opt.v ? "rgba(240,180,41,0.3)" : "rgba(185,146,77,0.3)"
                    : "rgba(242,236,223,0.08)"}`,
                  borderRadius: 8,
                  color: newIsNote === opt.v
                    ? opt.v ? "#f0b429" : "var(--gold-light)"
                    : "var(--cream-dim)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11, fontWeight: newIsNote === opt.v ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Corpo */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>
              Texto do template *{" "}
              <span style={{ fontWeight: 400, opacity: 0.6 }}>
                (use {"{{"+"nome}}"}, {"{{"+"pedido}}"}, {"{{"+"loja}}"}, {"{{"+"data}}"})
              </span>
            </label>
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              rows={5}
              placeholder={"Olá {{nome}},\n\nSeu pedido #{{pedido}} está sendo processado..."}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(10,22,11,0.6)",
                border: "1px solid rgba(242,236,223,0.1)",
                borderRadius: 8, padding: "9px 11px",
                color: "var(--cream)", fontSize: 12.5,
                fontFamily: "Manrope, sans-serif", outline: "none",
                resize: "vertical", lineHeight: 1.55,
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
            />
          </div>

          {formError && (
            <p style={{ fontSize: 11.5, color: "#ef4444", fontFamily: "Manrope, sans-serif", margin: 0 }}>
              {formError}
            </p>
          )}

          <button
            onClick={handleCreate}
            disabled={isPending}
            style={{
              background: isPending
                ? "rgba(185,146,77,0.3)"
                : "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
              border: "none", borderRadius: 9,
              color: "var(--forest-950)",
              fontFamily: "Manrope, sans-serif",
              fontSize: 11, fontWeight: 800,
              letterSpacing: 1.2, textTransform: "uppercase",
              padding: "10px",
              cursor: isPending ? "default" : "pointer",
              boxShadow: isPending ? "none" : "0 4px 14px rgba(185,146,77,0.3)",
              transition: "all 0.2s",
            }}
          >
            {isPending ? "Salvando…" : "Salvar template"}
          </button>
        </div>
      )}
    </div>
  );
}
