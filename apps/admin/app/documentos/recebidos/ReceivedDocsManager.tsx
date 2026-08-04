"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { GlassSelect } from "@/components/GlassSelect";
import { GlassDateInput } from "@/components/GlassDateInput";
import {
  saveReceivedDoc,
  deleteReceivedDoc,
  updateReceivedDocStatus,
  getSignedUrl,
} from "../fiscal-actions";
import type { ReceivedDoc } from "./page";

// ── Constantes ────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "darf",      label: "DARF" },
  { value: "gnre",      label: "GNRE" },
  { value: "inss",      label: "INSS / IRRF" },
  { value: "gps",       label: "GPS" },
  { value: "fgts",      label: "FGTS" },
  { value: "iss",       label: "ISS" },
  { value: "simples",   label: "Simples Nacional" },
  { value: "irpj",      label: "IRPJ" },
  { value: "csll",      label: "CSLL" },
  { value: "cofins",    label: "COFINS" },
  { value: "pis",       label: "PIS" },
  { value: "prolabore", label: "Pró-Labore" },
  { value: "tflf",      label: "TFLF" },
  { value: "icms",      label: "ICMS" },
  { value: "outros",    label: "Outros" },
];

const DEPARTMENTS = [
  { value: "fiscal",   label: "Departamento Fiscal" },
  { value: "pessoal",  label: "Departamento Pessoal" },
  { value: "contabil", label: "Contábil" },
  { value: "juridico", label: "Jurídico" },
];

const ISSUERS = [
  "SEFAZ", "ECAC / Receita Federal", "eSocial", "Prefeitura",
  "Caixa Econômica Federal", "INSS", "Simples Nacional", "Outro",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: "Pendente",  color: "#e8a0a0", bg: "rgba(232,160,160,0.12)", dot: "#e8a0a0" },
  open:      { label: "Em aberto", color: "#b0a898", bg: "rgba(176,168,152,0.10)", dot: "#888" },
  scheduled: { label: "Agendado",  color: "#7ec8e3", bg: "rgba(126,200,227,0.12)", dot: "#7ec8e3" },
  paid:      { label: "Pago",      color: "#4ade80", bg: "rgba(74,222,128,0.12)",  dot: "#4ade80" },
  overdue:   { label: "Vencido",   color: "#e85050", bg: "rgba(232,80,80,0.12)",   dot: "#e85050" },
};

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }[]> = {
  pending:   [{ next: "open",      label: "Marcar Em aberto" }, { next: "paid", label: "✓ Marcar Pago" }],
  open:      [{ next: "paid",      label: "✓ Marcar Pago" },   { next: "scheduled", label: "Agendar" }, { next: "overdue", label: "Marcar Vencido" }],
  scheduled: [{ next: "paid",      label: "✓ Marcar Pago" },   { next: "open", label: "↩ Reverter" }],
  paid:      [{ next: "open",      label: "↩ Reverter para Em aberto" }],
  overdue:   [{ next: "paid",      label: "✓ Marcar Pago" },   { next: "open", label: "↩ Reverter" }],
};

const SIDEBAR_FILTERS = [
  {
    group: "",
    items: [
      { key: "all",      label: "Todos" },
      { key: "pending",  label: "Pendentes" },
      { key: "unviewed", label: "Não visualizados" },
    ],
  },
  {
    group: "PAGAMENTOS",
    items: [
      { key: "overdue",   label: "Vencidos" },
      { key: "open",      label: "Em aberto" },
      { key: "scheduled", label: "Agendados" },
      { key: "paid",      label: "Pagos" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeLabel(v: string)  { return DOC_TYPES.find(t => t.value === v)?.label ?? v; }
function deptLabel(v: string)  { return DEPARTMENTS.find(d => d.value === v)?.label ?? v; }

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtCents(c: number | null) {
  if (c == null) return "—";
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isOverdue(doc: ReceivedDoc) {
  if (doc.status === "paid") return false;
  if (!doc.due_date) return false;
  return new Date(doc.due_date + "T00:00:00") < new Date(new Date().toDateString());
}

function daysOverdue(due: string) {
  const diff = Date.now() - new Date(due + "T00:00:00").getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

// Cálculo simples de multa/juros: 2% multa + 0,033%/dia de juros (regra SEFAZ)
function calcFine(amountCents: number, due: string) {
  const days = daysOverdue(due);
  if (days <= 0) return { fine: 0, interest: 0, total: amountCents };
  const fine     = Math.round(amountCents * 0.02);
  const interest = Math.round(amountCents * 0.00033 * days);
  return { fine, interest, total: amountCents + fine + interest };
}

// ── Estilos base ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--cream)", outline: "none",
};

// ── Modal base ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, width = 520 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div className="glass" style={{ width, maxWidth: "95vw", padding: 28, borderRadius: 14, maxHeight: "90vh", overflowY: "auto" }}>
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

// ── Badge de status ───────────────────────────────────────────────────────────

function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: size === "md" ? "5px 14px" : "3px 10px",
      borderRadius: 20, fontSize: size === "md" ? 13 : 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg, whiteSpace: "nowrap", border: `1px solid ${cfg.dot}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ── Dropdown de ações de status (com portal — escapa de overflow:hidden) ──────

function StatusActionsMenu({ doc, onUpdate, inline = false }: {
  doc: ReceivedDoc;
  onUpdate: (id: string, status: string, paid_at?: string | null) => void;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const transitions = STATUS_TRANSITIONS[doc.status] ?? [];

  useEffect(() => { setMounted(true); }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(200, rect.width);
    const left = Math.min(
      Math.max(8, rect.right - width),
      window.innerWidth - width - 8,
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuH = transitions.length * 44 + 12;
    const openUp = spaceBelow < menuH + 8 && rect.top > menuH;
    setMenuStyle({
      position: "fixed",
      zIndex: 2147483647,
      left,
      width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, top: "auto" }
        : { top: rect.bottom + 4, bottom: "auto" }),
    });
  }, [transitions.length]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (transitions.length === 0) return null;

  const menu = open && mounted ? createPortal(
    <>
      {/* backdrop invisível para fechar */}
      <div
        onClick={() => setOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 2147483646 }}
      />
      <div
        className="glass"
        style={{
          ...menuStyle,
          borderRadius: 10,
          padding: "6px 0",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {transitions.map(t => (
          <button
            key={t.next}
            onClick={() => {
              setOpen(false);
              const paid = t.next === "paid" ? new Date().toISOString().slice(0, 10) : null;
              onUpdate(doc.id, t.next, paid);
            }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 16px", background: "none", border: "none",
              cursor: "pointer", fontSize: 13,
              color: t.next === "paid"    ? "#4ade80"
                   : t.next === "overdue" ? "#e85050"
                   : t.next === "open"    ? "#b0a898"
                   : "var(--cream-dim)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <div style={{ display: inline ? "inline-block" : "block" }}>
      <button
        ref={triggerRef}
        onClick={() => { if (!open) updatePosition(); setOpen(o => !o); }}
        style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: inline ? "4px 10px" : "7px 14px", cursor: "pointer",
          fontSize: inline ? 11 : 12, color: "var(--cream-dim)", whiteSpace: "nowrap",
        }}
      >
        ⚡ {inline ? "Ações ▾" : "Alterar status ▾"}
      </button>
      {menu}
    </div>
  );
}

// ── Drawer de detalhes ────────────────────────────────────────────────────────

function DocDrawer({ doc, onClose, onUpdate, onDelete }: {
  doc: ReceivedDoc;
  onClose: () => void;
  onUpdate: (id: string, status: string, paid_at?: string | null) => void;
  onDelete: (doc: ReceivedDoc) => void;
}) {
  const effectiveStatus = isOverdue(doc) && doc.status !== "paid" ? "overdue" : doc.status;
  const overdue = effectiveStatus === "overdue";
  const days = doc.due_date ? daysOverdue(doc.due_date) : 0;
  const fine = doc.amount_cents && overdue ? calcFine(doc.amount_cents, doc.due_date!) : null;

  // Estado para "Regerar boleto"
  const [showRegen, setShowRegen] = useState(false);
  const [regenDue, setRegenDue] = useState("");
  const [regenAmount, setRegenAmount] = useState(
    fine ? (fine.total / 100).toFixed(2) : (doc.amount_cents ? (doc.amount_cents / 100).toFixed(2) : "")
  );
  const [regenNote, setRegenNote] = useState("");
  const [regenPending, startRegen] = useTransition();
  const [regenErr, setRegenErr] = useState<string | null>(null);

  // Upload de comprovante
  const [showComprovante, setShowComprovante] = useState(false);
  const [comprFile, setComprFile] = useState<File | null>(null);
  const [comprPending, startCompr] = useTransition();
  const [comprErr, setComprErr] = useState<string | null>(null);
  const comprRef = useRef<HTMLInputElement>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);

  async function loadFile() {
    if (!doc.storage_path || fileUrl) return;
    const url = await getSignedUrl(doc.storage_path);
    setFileUrl(url);
  }

  async function handleRegen(e: React.FormEvent) {
    e.preventDefault();
    setRegenErr(null);
    const fd = new FormData();
    fd.set("name", doc.name + (regenNote ? ` — ${regenNote}` : " (Renegociado)"));
    fd.set("doc_type", doc.doc_type);
    fd.set("department", doc.department);
    fd.set("competence", doc.competence ?? "");
    fd.set("due_date", regenDue);
    fd.set("amount", regenAmount);
    fd.set("issuer", doc.issuer ?? "");
    fd.set("status", "open");

    startRegen(async () => {
      const res = await saveReceivedDoc(fd);
      if (!res.ok) { setRegenErr(res.error ?? "Erro."); return; }
      setShowRegen(false);
      alert("Novo boleto criado com sucesso! Ele aparecerá na lista.");
      window.location.reload();
    });
  }

  async function handleComprUpload() {
    if (!comprFile) return;
    setComprErr(null);
    startCompr(async () => {
      try {
        const supabase = createClient();
        const safeName = comprFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `comprovantes/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from("fiscal-documents")
          .upload(path, comprFile, { contentType: comprFile.type || "application/pdf", upsert: false });
        if (error) { setComprErr(error.message); return; }
        // Atualiza o documento original com o comprovante
        const fd = new FormData();
        fd.set("name", doc.name);
        fd.set("doc_type", doc.doc_type);
        fd.set("department", doc.department);
        fd.set("competence", doc.competence ?? "");
        fd.set("due_date", doc.due_date ?? "");
        fd.set("amount", doc.amount_cents ? String(doc.amount_cents / 100) : "");
        fd.set("issuer", doc.issuer ?? "");
        fd.set("storage_path", path);
        fd.set("size_bytes", String(comprFile.size));
        fd.set("status", "paid");
        // Marca como pago ao adicionar comprovante
        await updateReceivedDocStatus(doc.id, "paid", new Date().toISOString().slice(0, 10));
        setShowComprovante(false);
        onUpdate(doc.id, "paid", new Date().toISOString().slice(0, 10));
        alert("Comprovante adicionado e documento marcado como pago.");
      } catch (ex) {
        setComprErr(ex instanceof Error ? ex.message : "Erro.");
      }
    });
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)" }}
      />

      {/* Drawer lateral */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: 480, maxWidth: "95vw",
        background: "rgba(20,28,20,0.97)",
        backdropFilter: "blur(24px)",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        overflowY: "auto",
        boxShadow: "-12px 0 60px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header do drawer */}
        <div style={{
          padding: "20px 24px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {deptLabel(doc.department)}
            </p>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--cream)", lineHeight: 1.3 }}>
              {doc.name}
            </h2>
            {doc.issuer && (
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                {doc.issuer}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {doc.storage_path && (
              <button
                onClick={async () => {
                  await loadFile();
                  if (fileUrl) window.open(fileUrl, "_blank");
                  else {
                    const url = await getSignedUrl(doc.storage_path!);
                    if (url) window.open(url, "_blank");
                  }
                }}
                title="Baixar documento"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "var(--cream-dim)", fontSize: 15 }}
              >⬇</button>
            )}
            <button
              onClick={onClose}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "var(--cream-dim)", fontSize: 18 }}
            >×</button>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: "24px", flex: 1 }}>

          {/* Status + ações */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <StatusBadge status={effectiveStatus} size="md" />
            <StatusActionsMenu
              doc={{ ...doc, status: effectiveStatus as ReceivedDoc["status"] }}
              onUpdate={(id, st, paid) => { onUpdate(id, st, paid); }}
            />
          </div>

          {/* Alerta de vencimento */}
          {overdue && (
            <div style={{
              background: "rgba(232,80,80,0.1)", border: "1px solid rgba(232,80,80,0.3)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e85050" }}>
                ⚠️ Boleto vencido há {days} dia{days !== 1 ? "s" : ""}
              </p>
              {fine && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(232,80,80,0.8)" }}>
                  Estimativa com multa e juros: <strong>{fmtCents(fine.total)}</strong>
                  {" "}(multa: {fmtCents(fine.fine)} + juros: {fmtCents(fine.interest)})
                </p>
              )}
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                * Cálculo estimado: 2% multa + 0,033%/dia de juros. Consulte o valor real junto ao emissor.
              </p>
            </div>
          )}

          {/* Grade de dados */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px",
            background: "rgba(255,255,255,0.03)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.07)", padding: "18px 20px",
            marginBottom: 20,
          }}>
            {[
              { label: "Competência",       value: doc.competence ?? "—" },
              { label: "Vencimento",        value: <span style={{ color: overdue ? "#e85050" : "var(--cream)" }}>{fmtDate(doc.due_date)}</span> },
              { label: "Valor original",    value: <strong style={{ color: "var(--cream)", fontSize: 15 }}>{fmtCents(doc.amount_cents)}</strong> },
              { label: "Pago em",           value: doc.paid_at ? fmtDate(doc.paid_at) : "—" },
              { label: "Tipo",              value: typeLabel(doc.doc_type) },
              { label: "Órgão emissor",     value: doc.issuer ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--cream-dim)" }}>{value}</p>
              </div>
            ))}

            {doc.barcode && (
              <div style={{ gridColumn: "1/-1", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Linha digitável</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)", fontFamily: "monospace", wordBreak: "break-all" }}>{doc.barcode}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(doc.barcode!); }}
                  style={{ marginTop: 6, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 10, color: "var(--cream-dim)" }}
                >
                  📋 Copiar
                </button>
              </div>
            )}

            <div style={{ gridColumn: "1/-1", padding: "10px 0 0" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Recebido em</p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{fmtDateTime(doc.created_at)}</p>
            </div>
          </div>

          {/* Ações secundárias */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Comprovante de pagamento */}
            {doc.status !== "paid" && (
              <button
                onClick={() => setShowComprovante(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.12)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(74,222,128,0.07)")}
              >
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#4ade80" }}>+ Adicionar comprovante</p>
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Marcar como pago e anexar PDF do comprovante</p>
                </div>
              </button>
            )}

            {showComprovante && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
                <input
                  ref={comprRef}
                  type="file"
                  accept=".pdf,.jpg,.png"
                  onChange={e => setComprFile(e.target.files?.[0] ?? null)}
                  style={{ ...inputStyle, marginBottom: 10 }}
                />
                {comprErr && <p style={{ fontSize: 12, color: "#e8a0a0", marginBottom: 8 }}>⚠️ {comprErr}</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowComprovante(false)} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
                  <button
                    onClick={handleComprUpload}
                    disabled={!comprFile || comprPending}
                    className="btn btn-gold"
                    style={{ fontSize: 12 }}
                  >
                    {comprPending ? "Enviando…" : "Confirmar pagamento"}
                  </button>
                </div>
              </div>
            )}

            {/* Regerar boleto — disponível para vencidos ou em aberto */}
            {(overdue || doc.status === "open" || doc.status === "pending") && (
              <button
                onClick={() => setShowRegen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(200,168,75,0.07)", border: "1px solid rgba(200,168,75,0.2)",
                  borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,168,75,0.12)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(200,168,75,0.07)")}
              >
                <span style={{ fontSize: 20 }}>🔄</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--gold-light)" }}>
                    {overdue ? "Regerar boleto (valor atualizado)" : "Criar novo boleto"}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {overdue
                      ? "Gera um novo documento com multa e juros calculados automaticamente"
                      : "Cria uma cópia deste documento com nova data de vencimento"}
                  </p>
                </div>
              </button>
            )}

            {showRegen && (
              <form onSubmit={handleRegen} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 600, color: "var(--gold-light)" }}>
                  🔄 Novo boleto com valores atualizados
                </p>

                {overdue && fine && (
                  <div style={{ background: "rgba(200,168,75,0.08)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)" }}>
                      Valor original: {fmtCents(doc.amount_cents)}<br />
                      + Multa (2%): {fmtCents(fine.fine)}<br />
                      + Juros ({days}d × 0,033%): {fmtCents(fine.interest)}<br />
                      <strong style={{ color: "var(--gold-light)" }}>= Total estimado: {fmtCents(fine.total)}</strong>
                    </p>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Novo vencimento *">
                    <GlassDateInput
                      value={regenDue}
                      onChange={setRegenDue}
                      placeholder="Selecionar data"
                    />
                  </Field>
                  <Field label="Novo valor (R$) *">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={regenAmount}
                      onChange={e => setRegenAmount(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Field label="Observação (opcional)">
                      <input
                        type="text"
                        placeholder="Ex: Valor atualizado após vencimento"
                        value={regenNote}
                        onChange={e => setRegenNote(e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                </div>

                {regenErr && <p style={{ fontSize: 12, color: "#e8a0a0", marginBottom: 8 }}>⚠️ {regenErr}</p>}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={() => setShowRegen(false)} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
                  <button type="submit" disabled={regenPending} className="btn btn-gold" style={{ fontSize: 12 }}>
                    {regenPending ? "Criando…" : "Criar novo boleto"}
                  </button>
                </div>
              </form>
            )}

            {/* Excluir */}
            <button
              onClick={() => { if (confirm(`Excluir "${doc.name}"?`)) { onDelete(doc); onClose(); } }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(232,80,80,0.05)", border: "1px solid rgba(232,80,80,0.15)",
                borderRadius: 10, padding: "10px 16px", cursor: "pointer", textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(232,80,80,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(232,80,80,0.05)")}
            >
              <span style={{ fontSize: 16, opacity: 0.7 }}>🗑</span>
              <p style={{ margin: 0, fontSize: 12, color: "#e85050" }}>Excluir documento</p>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Modal Upload ──────────────────────────────────────────────────────────────

function UploadModal({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Campos controlados para GlassSelect / GlassDateInput
  const [docType,    setDocType]    = useState("outros");
  const [department, setDepartment] = useState("fiscal");
  const [dueDate,    setDueDate]    = useState("");
  const [status,     setStatus]     = useState("open");
  const [issuer,     setIssuer]     = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    // Injeta valores dos componentes glass (que usam hidden inputs via name)
    fd.set("doc_type",   docType);
    fd.set("department", department);
    fd.set("due_date",   dueDate);
    fd.set("status",     status);
    fd.set("issuer",     issuer);

    const file = fileRef.current?.files?.[0];

    start(async () => {
      try {
        let storagePath = "";
        if (file) {
          setProgress("Enviando arquivo…");
          const supabase = createClient();
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `received/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("fiscal-documents")
            .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
          if (upErr) { setErr(`Upload falhou: ${upErr.message}`); setProgress(null); return; }
          storagePath = path;
          fd.set("size_bytes", String(file.size));
        }

        fd.set("storage_path", storagePath);
        if (!(fd.get("name") as string)?.trim() && file)
          fd.set("name", file.name.replace(/\.[^.]+$/, ""));

        setProgress("Registrando…");
        const res = await saveReceivedDoc(fd);
        if (!res.ok) {
          if (storagePath) {
            const supabase = createClient();
            await supabase.storage.from("fiscal-documents").remove([storagePath]);
          }
          setErr(res.error ?? "Erro."); setProgress(null); return;
        }
        onClose();
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : "Erro inesperado."); setProgress(null);
      }
    });
  }

  return (
    <Modal title="Adicionar documento recebido" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Nome do documento *">
              <input name="name" required style={inputStyle} placeholder="Ex: Guia INSS Sobre Folha" />
            </Field>
          </div>

          <Field label="Tipo de documento">
            <GlassSelect
              value={docType}
              onChange={setDocType}
              options={DOC_TYPES.map(t => ({ value: t.value, label: t.label }))}
            />
          </Field>

          <Field label="Departamento">
            <GlassSelect
              value={department}
              onChange={setDepartment}
              options={DEPARTMENTS.map(d => ({ value: d.value, label: d.label }))}
            />
          </Field>

          <Field label="Competência (MM/AAAA)">
            <input name="competence" style={inputStyle} placeholder="07/2026" />
          </Field>

          <Field label="Vencimento">
            <GlassDateInput
              value={dueDate}
              onChange={setDueDate}
              placeholder="Selecionar data"
            />
          </Field>

          <Field label="Valor (R$)">
            <input name="amount" type="number" step="0.01" min="0" style={inputStyle} placeholder="182,42" />
          </Field>

          <Field label="Status inicial">
            <GlassSelect
              value={status}
              onChange={setStatus}
              options={[
                { value: "pending",   label: "Pendente" },
                { value: "open",      label: "Em aberto" },
                { value: "scheduled", label: "Agendado" },
                { value: "paid",      label: "Pago" },
                { value: "overdue",   label: "Vencido" },
              ]}
            />
          </Field>

          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Órgão emissor">
              <GlassSelect
                value={issuer}
                onChange={setIssuer}
                options={[
                  { value: "", label: "— Selecione —" },
                  ...ISSUERS.map(i => ({ value: i, label: i })),
                ]}
              />
            </Field>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Linha digitável / código de barras">
              <input name="barcode" style={inputStyle} placeholder="00000.00000 …" />
            </Field>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Arquivo (PDF, XML — opcional)">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.xml,.txt"
                style={{ ...inputStyle, paddingTop: 8, paddingBottom: 8 }}
              />
            </Field>
          </div>
        </div>

        {progress && <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 10 }}>⏳ {progress}</p>}
        {err && <p style={{ fontSize: 12, color: "#e8a0a0", marginBottom: 10 }}>⚠️ {err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
          <button type="submit" disabled={pending} className="btn btn-gold" style={{ fontSize: 12 }}>
            {pending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ReceivedDocsManager({ docs: initDocs }: { docs: ReceivedDoc[] }) {
  const [docs, setDocs] = useState(initDocs);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ReceivedDoc | null>(null);
  const [, startDelete] = useTransition();

  const counts = {
    all:       docs.length,
    pending:   docs.filter(d => d.status === "pending").length,
    unviewed:  docs.filter(d => !d.viewed_at).length,
    overdue:   docs.filter(d => isOverdue(d)).length,
    open:      docs.filter(d => d.status === "open" && !isOverdue(d)).length,
    scheduled: docs.filter(d => d.status === "scheduled").length,
    paid:      docs.filter(d => d.status === "paid").length,
  };

  const visible = docs.filter(doc => {
    const es = isOverdue(doc) && doc.status !== "paid" ? "overdue" : doc.status;
    const statusOk =
      filter === "all"      ? true :
      filter === "unviewed" ? !doc.viewed_at :
      filter === "overdue"  ? isOverdue(doc) :
      es === filter;
    const q = search.toLowerCase();
    const searchOk = !q
      || doc.name.toLowerCase().includes(q)
      || (doc.issuer ?? "").toLowerCase().includes(q)
      || (doc.competence ?? "").toLowerCase().includes(q)
      || typeLabel(doc.doc_type).toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  function handleStatusUpdate(id: string, status: string, paid_at?: string | null) {
    setDocs(prev => prev.map(d =>
      d.id === id
        ? { ...d, status: status as ReceivedDoc["status"], paid_at: paid_at ?? d.paid_at }
        : d
    ));
    // Atualiza o drawer se estiver aberto para esse doc
    setSelectedDoc(prev => prev?.id === id
      ? { ...prev, status: status as ReceivedDoc["status"], paid_at: paid_at ?? prev.paid_at }
      : prev
    );
    updateReceivedDocStatus(id, status, paid_at);
  }

  function handleDelete(doc: ReceivedDoc) {
    startDelete(async () => {
      await deleteReceivedDoc(doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
    });
  }

  function reload() { window.location.reload(); }

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "80vh" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside style={{ width: 210, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", paddingBottom: 40 }}>
        {SIDEBAR_FILTERS.map(section => (
          <div key={section.group || "main"} style={{ marginBottom: 8 }}>
            {section.group
              ? <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "16px 20px 6px", margin: 0 }}>{section.group}</p>
              : <div style={{ paddingTop: 16 }} />
            }
            {section.items.map(item => {
              const count = counts[item.key as keyof typeof counts] ?? 0;
              const active = filter === item.key;
              const isRed = item.key === "overdue" || item.key === "pending";
              return (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  style={{
                    display: "flex", alignItems: "center", width: "100%",
                    padding: "9px 20px", border: "none", cursor: "pointer",
                    background: active ? "rgba(200,168,75,0.1)" : "transparent",
                    borderLeft: `2px solid ${active ? "var(--gold-light, #d4b05a)" : "transparent"}`,
                    color: active ? "var(--gold-light, #d4b05a)" : "var(--cream-dim, #b0a898)",
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    transition: "all 0.12s", gap: 8,
                  }}
                >
                  {isRed && count > 0 && !active && (
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e85050", flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize: 10, color: isRed ? "#e85050" : "rgba(255,255,255,0.3)", fontWeight: isRed ? 700 : 400 }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* ── Área principal ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, padding: "0 0 0 28px", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--cream)" }}>Documentos recebidos</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
              {visible.length} documento{visible.length !== 1 ? "s" : ""}
              {filter !== "all" && ` · ${SIDEBAR_FILTERS.flatMap(s => s.items).find(i => i.key === filter)?.label}`}
            </p>
          </div>
          <input
            type="search"
            placeholder="Buscar nome, órgão, competência…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 250, padding: "8px 12px" }}
          />
          <button onClick={() => setShowUpload(true)} className="btn btn-gold" style={{ fontSize: 13, padding: "9px 20px", fontWeight: 700, flexShrink: 0 }}>
            + Adicionar
          </button>
        </div>

        {/* Aviso de integração */}
        <div className="glass" style={{ padding: "12px 18px", borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(200,168,75,0.2)" }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--gold-light)" }}>Integração automática em breve</p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 11 }}>Conexão com SEFAZ, ECAC, eSocial e Receita Federal via certificado digital A1. Por enquanto, adicione os documentos manualmente.</p>
          </div>
        </div>

        {/* Tabela */}
        <div className="glass" style={{ borderRadius: 14, overflowX: "auto", padding: 0 }}>
          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px" }}>
              <p style={{ fontSize: 36, marginBottom: 10 }}>📭</p>
              <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
                {search ? "Nenhum resultado." : "Nenhum documento nesta categoria."}
              </p>
              <button onClick={() => setShowUpload(true)} className="btn btn-gold" style={{ fontSize: 13 }}>+ Adicionar documento</button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Documento", "Competência", "Vencimento", "Valor", "Pagamento", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(doc => {
                  const es = isOverdue(doc) && doc.status !== "paid" ? "overdue" : doc.status;
                  const isSelected = selectedDoc?.id === doc.id;
                  return (
                    <tr
                      key={doc.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.1s", background: isSelected ? "rgba(200,168,75,0.06)" : "transparent", cursor: "pointer" }}
                      onClick={() => setSelectedDoc(isSelected ? null : doc)}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Documento */}
                      <td style={{ padding: "13px 14px", maxWidth: 260 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ fontSize: 16, opacity: doc.storage_path ? 0.8 : 0.3, flexShrink: 0 }}>
                            {doc.storage_path ? "📄" : "📋"}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--cream)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {doc.name}
                            </p>
                            <p className="muted" style={{ margin: "2px 0 0", fontSize: 11 }}>
                              {deptLabel(doc.department)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "13px 14px", fontSize: 13, color: "var(--cream-dim)", whiteSpace: "nowrap" }}>{doc.competence ?? "—"}</td>

                      <td style={{ padding: "13px 14px", fontSize: 13, whiteSpace: "nowrap" }}>
                        <span style={{ color: es === "overdue" ? "#e85050" : "var(--cream-dim)" }}>
                          {fmtDate(doc.due_date)}
                        </span>
                        {es === "overdue" && (
                          <p style={{ margin: "1px 0 0", fontSize: 10, color: "#e85050" }}>
                            {daysOverdue(doc.due_date!)}d atraso
                          </p>
                        )}
                      </td>

                      <td style={{ padding: "13px 14px", fontSize: 13, color: "var(--cream)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {fmtCents(doc.amount_cents)}
                      </td>

                      <td style={{ padding: "13px 14px", whiteSpace: "nowrap" }}>
                        <StatusBadge status={es} />
                      </td>

                      {/* Seta de abrir drawer */}
                      <td style={{ padding: "13px 14px", textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <StatusActionsMenu
                            doc={{ ...doc, status: es as ReceivedDoc["status"] }}
                            onUpdate={handleStatusUpdate}
                            inline
                          />
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedDoc(isSelected ? null : doc); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 18, padding: "4px 6px" }}
                            title="Ver detalhes"
                          >›</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Totais */}
        {visible.length > 0 && (() => {
          const totalAberto = visible.filter(d => d.status !== "paid").reduce((s, d) => s + (d.amount_cents ?? 0), 0);
          const totalPago   = visible.filter(d => d.status === "paid").reduce((s, d) => s + (d.amount_cents ?? 0), 0);
          return (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, gap: 24 }}>
              {totalPago   > 0 && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Pago: <strong style={{ color: "#4ade80" }}>{fmtCents(totalPago)}</strong></p>}
              {totalAberto > 0 && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Em aberto: <strong style={{ color: "#e8a0a0" }}>{fmtCents(totalAberto)}</strong></p>}
            </div>
          );
        })()}
      </div>

      {/* Drawer de detalhes */}
      {selectedDoc && (
        <DocDrawer
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onUpdate={handleStatusUpdate}
          onDelete={handleDelete}
        />
      )}

      {showUpload && <UploadModal onClose={() => { setShowUpload(false); reload(); }} />}
    </div>
  );
}
