"use client";

import { useState, useTransition, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { GlassSelect } from "@/components/GlassSelect";
import {
  createFiscalFolder,
  renameFiscalFolder,
  deleteFiscalFolder,
  saveFiscalFile,
  deleteFiscalFile,
  getSignedUrl,
} from "../fiscal-actions";
import type { FiscalFolder, FiscalFile } from "./page";

// ── Tipos de documento ────────────────────────────────────────────────────────
const TYPES = [
  { value: "todos",            label: "Todos" },
  { value: "contrato-social",  label: "Contrato social" },
  { value: "socios",           label: "Sócios" },
  { value: "certificados",     label: "Certificados digitais" },
  { value: "procuracoes",      label: "Procurações" },
  { value: "certidoes",        label: "Certidões" },
  { value: "alvaras",          label: "Alvarás" },
  { value: "nfe",              label: "NF-e" },
  { value: "nfse",             label: "NFS-e" },
  { value: "guias",            label: "Guias fiscais" },
  { value: "dctfweb",          label: "DCTFWeb" },
  { value: "esocial",          label: "eSocial" },
  { value: "contratos",        label: "Contratos" },
  { value: "outros",           label: "Outros" },
];

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function typeLabel(v: string) { return TYPES.find(t => t.value === v)?.label ?? v; }

function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// competence: "MM/YYYY" ou "YYYY-MM"
function parseCompetence(c: string | null): { year: number; month: number } | null {
  if (!c) return null;
  const slash = c.match(/^(\d{2})\/(\d{4})$/);
  if (slash) return { month: parseInt(slash[1]), year: parseInt(slash[2]) };
  const dash = c.match(/^(\d{4})-(\d{2})$/);
  if (dash) return { year: parseInt(dash[1]), month: parseInt(dash[2]) };
  return null;
}

function compKey(year: number, month: number) { return `${year}-${String(month).padStart(2, "0")}`; }

// ── Estilos base ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--cream)", outline: "none",
};

// ── Modal base ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div className="glass" style={{ width: 460, maxWidth: "94vw", padding: 28, borderRadius: 14, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--cream)" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--cream-dim)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--cream-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Modal Upload ──────────────────────────────────────────────────────────────
function UploadModal({ folders, defaultType, defaultCompetence, onClose }: {
  folders: FiscalFolder[];
  defaultType?: string;
  defaultCompetence?: string;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selCategory, setSelCategory] = useState(defaultType ?? "outros");
  const [selFolder, setSelFolder] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Selecione um arquivo."); return; }

    start(async () => {
      try {
        setProgress("Enviando arquivo…");
        const supabase = supabaseBrowser();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `fiscal/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("fiscal-documents")
          .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
        if (upErr) { setErr(`Upload falhou: ${upErr.message}`); setProgress(null); return; }

        setProgress("Registrando…");
        fd.set("storage_path", path);
        fd.set("size_bytes", String(file.size));
        if (!(fd.get("name") as string)?.trim()) fd.set("name", file.name.replace(/\.[^.]+$/, ""));

        const res = await saveFiscalFile(fd);
        if (!res.ok) {
          await supabase.storage.from("fiscal-documents").remove([path]);
          setErr(res.error ?? "Erro."); setProgress(null); return;
        }
        onClose();
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : "Erro inesperado."); setProgress(null);
      }
    });
  }

  return (
    <Modal title="Adicionar documento" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Arquivo">
          <input ref={fileRef} type="file" accept=".pdf,.pfx,.txt,.xml,.p12,.xlsx,.csv" required
            style={{ ...inputStyle, paddingTop: 8, paddingBottom: 8 }} />
        </Field>
        <Field label="Nome do documento">
          <input name="name" style={inputStyle} placeholder="Ex: Contrato Social 2024" />
        </Field>
        <Field label="Tipo de documento">
          <GlassSelect
            name="category"
            value={selCategory}
            onChange={setSelCategory}
            options={TYPES.filter(t => t.value !== "todos").map(t => ({ value: t.value, label: t.label }))}
          />
        </Field>
        <Field label="Competência (MM/AAAA)">
          <input name="competence" style={inputStyle} placeholder="08/2026" defaultValue={defaultCompetence ?? ""} />
        </Field>
        <Field label="Pasta (opcional)">
          <GlassSelect
            name="folder_id"
            value={selFolder}
            onChange={setSelFolder}
            options={[
              { value: "", label: "— Sem pasta —" },
              ...folders.map(f => ({ value: f.id, label: f.name })),
            ]}
          />
        </Field>

        {progress && <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 10 }}>⏳ {progress}</p>}
        {err && <p style={{ fontSize: 12, color: "#e8a0a0", marginBottom: 10 }}>⚠️ {err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
          <button type="submit" disabled={pending} className="btn btn-gold" style={{ fontSize: 12 }}>
            {pending ? "Enviando…" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal Nova pasta ──────────────────────────────────────────────────────────
function NewFolderModal({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createFiscalFolder(fd);
      if (!res.ok) { setErr(res.error ?? "Erro"); return; }
      onClose();
    });
  }

  return (
    <Modal title="Nova pasta" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Nome da pasta">
          <input name="name" required style={inputStyle} placeholder="Ex: NF-e 2026" />
        </Field>
        <input type="hidden" name="category" value="outros" />
        {err && <p style={{ fontSize: 12, color: "#e8a0a0", marginBottom: 10 }}>⚠️ {err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
          <button type="submit" disabled={pending} className="btn btn-gold" style={{ fontSize: 12 }}>
            {pending ? "Criando…" : "Criar pasta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal Renomear pasta ──────────────────────────────────────────────────────
function RenameFolderModal({ folder, onClose }: { folder: FiscalFolder; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", folder.id);
    start(async () => {
      const res = await renameFiscalFolder(fd);
      if (!res.ok) { setErr(res.error ?? "Erro"); return; }
      onClose();
    });
  }

  return (
    <Modal title="Renomear pasta" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Nome">
          <input name="name" required style={inputStyle} defaultValue={folder.name} />
        </Field>
        {err && <p style={{ fontSize: 12, color: "#e8a0a0", marginBottom: 10 }}>⚠️ {err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
          <button type="submit" disabled={pending} className="btn btn-gold" style={{ fontSize: 12 }}>
            {pending ? "Salvando…" : "Renomear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Calendário de competências ────────────────────────────────────────────────
function CompetenceCalendar({ files, selectedKey, onSelect }: {
  files: FiscalFile[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  // Anos presentes nos arquivos + ano atual
  const currentYear = new Date().getFullYear();
  const years = Array.from(new Set([
    currentYear,
    currentYear - 1,
    ...files.map(f => parseCompetence(f.competence)?.year).filter(Boolean) as number[],
  ])).sort((a, b) => a - b);

  // Conta arquivos por chave competência
  const countMap: Record<string, number> = {};
  for (const f of files) {
    const p = parseCompetence(f.competence);
    if (p) {
      const k = compKey(p.year, p.month);
      countMap[k] = (countMap[k] ?? 0) + 1;
    }
  }

  return (
    <div className="glass" style={{ padding: "18px 20px", borderRadius: 14, marginBottom: 20, overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Documentos por competência</p>
        <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e8a0a0", display: "inline-block" }} /> Pendente
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--gold)", display: "inline-block" }} /> Em andamento
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} /> Concluído
          </span>
        </div>
      </div>

      <table style={{ borderCollapse: "collapse", minWidth: 700, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ width: 64, padding: "6px 8px" }} />
            {MONTHS.map(m => (
              <th key={m} style={{ padding: "6px 8px", fontSize: 11, color: "var(--cream-dim)", fontWeight: 600, textAlign: "center", width: 56 }}>
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map(year => (
            <tr key={year}>
              <td style={{ padding: "8px", fontSize: 12, fontWeight: 700, color: "var(--cream)", textAlign: "right", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                {year}
              </td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                const key = compKey(year, month);
                const count = countMap[key] ?? 0;
                const isSelected = selectedKey === key;
                const isFuture = year > currentYear || (year === currentYear && month > new Date().getMonth() + 1);
                const color = count === 0 ? null : count >= 3 ? "#4ade80" : count >= 1 ? "var(--gold)" : "#e8a0a0";

                return (
                  <td key={month} style={{ padding: "6px 4px", textAlign: "center" }}>
                    {isFuture || count === 0 ? (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>—</span>
                    ) : (
                      <button
                        onClick={() => onSelect(isSelected ? null : key)}
                        title={`${count} doc${count !== 1 ? "s" : ""} · ${MONTHS[month - 1]}/${year}`}
                        style={{
                          width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
                          background: isSelected ? color : "transparent",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                          outline: isSelected ? `2px solid ${color}` : "none",
                          outlineOffset: 2,
                        }}
                      >
                        {count > 1 ? (
                          <span style={{
                            width: 22, height: 22, borderRadius: "50%", background: color ?? "#4ade80",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700, color: "#1a2e1a",
                          }}>{count}</span>
                        ) : (
                          <span style={{ fontSize: 18 }}>✅</span>
                        )}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selectedKey && (
        <button
          onClick={() => onSelect(null)}
          className="btn btn-ghost"
          style={{ marginTop: 12, fontSize: 11, padding: "5px 12px" }}
        >
          × Limpar filtro de competência
        </button>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function FiscalFileManager({ folders: initFolders, files: initFiles }: {
  folders: FiscalFolder[];
  files: FiscalFile[];
}) {
  const [activeType, setActiveType] = useState("todos");
  const [selectedCompKey, setSelectedCompKey] = useState<string | null>(null);
  const [folders, setFolders] = useState(initFolders);
  const [files, setFiles] = useState(initFiles);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FiscalFolder | null>(null);
  const [deletingFile, startDeleteFile] = useTransition();
  const [deletingFolder, startDeleteFolder] = useTransition();

  // Filtro: tipo + competência
  const visibleFiles = files.filter(f => {
    const typeOk = activeType === "todos" || f.category === activeType;
    if (!typeOk) return false;
    if (!selectedCompKey) return true;
    const p = parseCompetence(f.competence);
    if (!p) return false;
    return compKey(p.year, p.month) === selectedCompKey;
  });

  // Label da competência selecionada para o cabeçalho
  const selectedCompLabel = selectedCompKey ? (() => {
    const [y, m] = selectedCompKey.split("-");
    return `${MONTHS[parseInt(m) - 1]} / ${y}`;
  })() : null;

  function handleDeleteFile(file: FiscalFile) {
    if (!confirm(`Excluir "${file.name}"?`)) return;
    startDeleteFile(async () => {
      await deleteFiscalFile(file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
    });
  }

  function handleDeleteFolder(folder: FiscalFolder) {
    if (!confirm(`Excluir a pasta "${folder.name}"?`)) return;
    startDeleteFolder(async () => {
      await deleteFiscalFolder(folder.id);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
    });
  }

  async function handleOpenFile(file: FiscalFile) {
    const url = await getSignedUrl(file.storage_path);
    if (url) window.open(url, "_blank");
    else alert("Não foi possível gerar o link.");
  }

  function reload() { window.location.reload(); }

  const defaultCompetenceForUpload = selectedCompKey ? (() => {
    const [y, m] = selectedCompKey.split("-");
    return `${m}/${y}`;
  })() : undefined;

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "80vh" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside style={{
        width: 210, flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.07)",
        paddingBottom: 40,
      }}>
        <p style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)", padding: "20px 20px 8px",
        }}>Tipos de documento</p>

        {TYPES.map(t => {
          const count = t.value === "todos" ? files.length : files.filter(f => f.category === t.value).length;
          const active = activeType === t.value;
          return (
            <button key={t.value} onClick={() => setActiveType(t.value)} style={{
              display: "flex", alignItems: "center", width: "100%",
              padding: "9px 20px", border: "none", cursor: "pointer",
              background: active ? "rgba(200,168,75,0.1)" : "transparent",
              borderLeft: `2px solid ${active ? "var(--gold-light, #d4b05a)" : "transparent"}`,
              color: active ? "var(--gold-light, #d4b05a)" : "var(--cream-dim, #b0a898)",
              fontSize: 13, fontWeight: active ? 600 : 400,
              transition: "all 0.12s", gap: 8,
            }}>
              <span style={{ flex: 1, textAlign: "left" }}>{t.label}</span>
              {count > 0 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{count}</span>}
            </button>
          );
        })}

        {/* Pastas */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "16px 0 0", padding: "14px 20px 0" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
            Pastas
          </p>
          {folders.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>Nenhuma pasta</p>
          ) : folders.map(folder => (
            <div key={folder.id} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 12, color: "var(--cream-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📁 {folder.name}
              </span>
              <button onClick={() => setRenameTarget(folder)} title="Renomear"
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 12, padding: "2px 3px", flexShrink: 0 }}>✏</button>
              <button onClick={() => handleDeleteFolder(folder)} disabled={deletingFolder} title="Excluir"
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(232,160,160,0.4)", fontSize: 12, padding: "2px 3px", flexShrink: 0 }}>🗑</button>
            </div>
          ))}
          <button onClick={() => setShowNewFolder(true)} style={{
            display: "block", width: "100%", textAlign: "left",
            padding: "7px 0", background: "none", border: "none",
            cursor: "pointer", fontSize: 12, color: "rgba(200,168,75,0.7)", marginTop: 6,
          }}>+ Nova pasta</button>
        </div>
      </aside>

      {/* ── Área principal ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, padding: "0 0 0 28px", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--cream)" }}>
              {activeType === "todos" ? "Todos os documentos" : typeLabel(activeType)}
              {selectedCompLabel && <span style={{ fontSize: 14, fontWeight: 400, color: "var(--gold)", marginLeft: 10 }}>· {selectedCompLabel}</span>}
            </h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
              {visibleFiles.length} documento{visibleFiles.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={() => setShowUpload(true)} className="btn btn-gold" style={{ fontSize: 13, padding: "9px 20px", fontWeight: 700 }}>
            + Adicionar documento
          </button>
        </div>

        {/* Calendário */}
        <CompetenceCalendar files={files} selectedKey={selectedCompKey} onSelect={setSelectedCompKey} />

        {/* Tabela */}
        <div className="glass" style={{ borderRadius: 14, overflowX: "auto", padding: 0 }}>
          {visibleFiles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px" }}>
              <p style={{ fontSize: 36, marginBottom: 10 }}>📭</p>
              <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
                {selectedCompLabel
                  ? `Nenhum documento em ${selectedCompLabel}.`
                  : "Nenhum documento nesta categoria."}
              </p>
              <button onClick={() => setShowUpload(true)} className="btn btn-gold" style={{ fontSize: 13 }}>
                + Adicionar documento
              </button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Documento", "Tipo", "Referência", "Atualizado em", ""].map(h => (
                    <th key={h} style={{
                      textAlign: "left", padding: "11px 16px", fontSize: 10, fontWeight: 700,
                      color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleFiles.map(file => (
                  <tr key={file.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Nome (clicável) */}
                    <td style={{ padding: "13px 16px" }}>
                      <button onClick={() => handleOpenFile(file)} style={{
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                        color: "var(--gold-light, #d4b05a)", fontSize: 13,
                        display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                        textDecoration: "underline", textDecorationColor: "rgba(212,176,90,0.3)",
                      }}>
                        <span style={{ fontSize: 15, opacity: 0.6 }}>📄</span>
                        {file.name}
                      </button>
                      {file.description && (
                        <p className="muted" style={{ margin: "3px 0 0 23px", fontSize: 11 }}>{file.description}</p>
                      )}
                    </td>

                    {/* Tipo */}
                    <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--cream-dim)" }}>
                      {typeLabel(file.category)}
                    </td>

                    {/* Referência */}
                    <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--cream-dim)", whiteSpace: "nowrap" }}>
                      {file.competence ?? "—"}
                    </td>

                    {/* Data */}
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "rgba(255,255,255,0.38)", whiteSpace: "nowrap" }}>
                      {fmtDateTime(file.created_at)}
                    </td>

                    {/* Excluir */}
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => handleDeleteFile(file)}
                        disabled={deletingFile}
                        title="Excluir"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(232,160,160,0.45)", fontSize: 16, padding: "4px 6px", transition: "color 0.15s" }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "#e8a0a0")}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(232,160,160,0.45)")}
                      >🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modais */}
      {showUpload && (
        <UploadModal folders={folders} defaultType={activeType !== "todos" ? activeType : undefined}
          defaultCompetence={defaultCompetenceForUpload}
          onClose={() => { setShowUpload(false); reload(); }} />
      )}
      {showNewFolder && <NewFolderModal onClose={() => { setShowNewFolder(false); reload(); }} />}
      {renameTarget && <RenameFolderModal folder={renameTarget} onClose={() => { setRenameTarget(null); reload(); }} />}
    </div>
  );
}
