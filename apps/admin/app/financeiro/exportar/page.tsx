"use client";

/**
 * /financeiro/exportar — Exportação avançada com filtros de data, tipo e status
 */

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

type Format = "xlsx" | "csv" | "pdf";

const FORMAT_OPTIONS: { id: Format; label: string; icon: string; desc: string }[] = [
  { id: "xlsx", label: "XLSX", icon: "📊", desc: "Planilha Excel — 3 abas (Cenários, Tabelas, Documentos)" },
  { id: "csv",  label: "CSV",  icon: "📋", desc: "Texto separado por vírgulas, compatível com qualquer sistema" },
  { id: "pdf",  label: "PDF",  icon: "📄", desc: "Relatório formatado para impressão e arquivamento" },
];

const KINDS = [
  { key: "",         label: "Todos os tipos" },
  { key: "budget",   label: "Orçamentos" },
  { key: "quote",    label: "Cotações" },
  { key: "proposal", label: "Propostas" },
];

const STATUSES = [
  { key: "",          label: "Todos os status" },
  { key: "draft",     label: "Rascunho" },
  { key: "sent",      label: "Enviado" },
  { key: "approved",  label: "Aprovado" },
  { key: "rejected",  label: "Rejeitado" },
  { key: "converted", label: "Convertido" },
  { key: "cancelled", label: "Cancelado" },
];

/* ── Calendário glassmorphism ──────────────────────────────────────────── */

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function GlassCalendar({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const today = new Date();
  const init = value ? new Date(`${value}T12:00:00`) : today;
  const [view, setView] = useState({ year: init.getFullYear(), month: init.getMonth() });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    setView((v) => {
      const d = new Date(v.year, v.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function nextMonth() {
    setView((v) => {
      const d = new Date(v.year, v.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function selectDay(day: number) {
    const d = new Date(view.year, view.month, day);
    onChange(isoDate(d));
    setOpen(false);
  }

  const selected = value ? new Date(`${value}T12:00:00`) : null;
  const selectedKey = selected ? isoDate(selected) : "";

  return (
    <div>
      {/* Label + campo */}
      <div style={{ fontSize: 11, color: "var(--color-muted, #8a9580)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 8,
            border: `1px solid ${open ? "rgba(200,168,75,0.5)" : "rgba(255,255,255,0.15)"}`,
            background: "rgba(255,255,255,0.04)",
            color: value ? "var(--color-text, #e8e3d9)" : "var(--color-muted, #8a9580)",
            fontSize: 13, cursor: "pointer", textAlign: "left",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <span>{value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Selecionar data"}</span>
          <span style={{ opacity: 0.5, fontSize: 14 }}>📅</span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "var(--color-muted, #8a9580)", cursor: "pointer",
              fontSize: 16, width: 34, flexShrink: 0,
            }}
            title="Limpar"
          >
            ×
          </button>
        )}
      </div>

      {/* Calendário inline — empurra o conteúdo abaixo, sem flutuar */}
      {open && (
        <div style={{
          marginTop: 8,
          background: "rgba(18,30,18,0.97)",
          border: "1px solid rgba(200,168,75,0.3)",
          borderRadius: 14,
          padding: "14px 12px 12px",
        }}>
          {/* Nav de mês */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={navBtn}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gold, #c8a84b)" }}>
              {MONTHS[view.month]} {view.year}
            </span>
            <button type="button" onClick={nextMonth} style={navBtn}>›</button>
          </div>
          {/* Cabeçalho dias */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--color-muted, #8a9580)", fontWeight: 600, padding: "2px 0" }}>
                {d}
              </div>
            ))}
          </div>
          {/* Grid dias */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const cellDate = isoDate(new Date(view.year, view.month, day));
              const isSelected = cellDate === selectedKey;
              const isToday = cellDate === isoDate(today);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  style={{
                    textAlign: "center", padding: "6px 2px", borderRadius: 6,
                    fontSize: 12, cursor: "pointer", border: "none",
                    background: isSelected ? "var(--color-gold, #c8a84b)" : isToday ? "rgba(200,168,75,0.15)" : "transparent",
                    color: isSelected ? "#1a2e1a" : isToday ? "var(--color-gold, #c8a84b)" : "var(--color-text, #e8e3d9)",
                    fontWeight: isSelected || isToday ? 700 : 400,
                    outline: isToday && !isSelected ? "1px solid rgba(200,168,75,0.4)" : "none",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6, color: "var(--color-text, #e8e3d9)", cursor: "pointer",
  fontSize: 16, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
};

/* ── Chip selector ────────────────────────────────────────────────────── */
function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: `1px solid ${active ? "var(--color-gold, #c8a84b)" : "rgba(255,255,255,0.1)"}`,
              background: active ? "rgba(200,168,75,0.15)" : "rgba(255,255,255,0.03)",
              color: active ? "var(--color-gold, #c8a84b)" : "var(--color-text, #e8e3d9)",
              fontWeight: active ? 700 : 400,
              transition: "all .15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Página principal ─────────────────────────────────────────────────── */
export default function ExportarPage() {
  const [format, setFormat]         = useState<Format>("xlsx");
  const [inclCenarios, setInclCenarios]     = useState(true);
  const [inclTabelas, setInclTabelas]       = useState(true);
  const [inclDocumentos, setInclDocumentos] = useState(true);
  const [kindFilter, setKindFilter]         = useState("");
  const [statusFilter, setStatusFilter]     = useState("");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");

  async function handleDownload() {
    if (!inclCenarios && !inclTabelas && !inclDocumentos) {
      setError("Selecione ao menos um módulo para exportar.");
      return;
    }
    setError("");

    const params = new URLSearchParams({ format });
    if (!inclCenarios)   params.set("no_cenarios",   "1");
    if (!inclTabelas)    params.set("no_tabelas",    "1");
    if (!inclDocumentos) params.set("no_documentos", "1");
    if (kindFilter)      params.set("kind",          kindFilter);
    if (statusFilter)    params.set("status",        statusFilter);
    if (dateFrom)        params.set("date_from",     dateFrom);
    if (dateTo)          params.set("date_to",       dateTo);

    const base = window.location.origin;
    const url  = `${base}/admin/financeiro/exportar/download?${params.toString()}`;

    // PDF: abre nova aba (retorna HTML kraft para imprimir/salvar)
    if (format === "pdf") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    // XLSX / CSV: download direto
    setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let msg = "Erro ao gerar exportação. Tente novamente.";
        try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
        setError(msg);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href     = blobUrl;
      a.download = `flora-financeiro.${format}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError("Erro de rede. Verifique sua conexão e tente novamente.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 28px 80px" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: "var(--cream-dim, #a09880)", marginBottom: 20, display: "flex", gap: 8 }}>
        <Link href="/financeiro" style={{ color: "inherit", textDecoration: "none" }}>Financeiro</Link>
        <span>/</span>
        <span style={{ color: "var(--color-heading, #f1ede5)" }}>Exportar Relatórios</span>
      </nav>

      <header style={{ marginBottom: 32 }}>
        <h1 className="display" style={{ fontSize: 32 }}>Exportar Relatórios</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Escolha o formato, filtre os dados e baixe o arquivo.
        </p>
      </header>

      {/* Formato */}
      <section style={{ marginBottom: 28 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Formato do arquivo</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFormat(opt.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                gap: 8, padding: "16px 16px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                border: `1.5px solid ${format === opt.id ? "var(--gold, #b9924d)" : "rgba(104,75,44,0.18)"}`,
                background: format === opt.id ? "rgba(185,146,77,0.09)" : "rgba(255,248,234,0.03)",
                transition: "border-color .15s, background .15s",
              }}
            >
              <span style={{ fontSize: 24 }}>{opt.icon}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "var(--color-heading, #f1ede5)", margin: "0 0 4px" }}>{opt.label}</p>
                <p className="muted" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Conteúdo a incluir */}
      <section className="glass" style={{ padding: 22, borderRadius: 14, marginBottom: 20 }}>
        <p className="eyebrow" style={{ marginBottom: 16 }}>Conteúdo a incluir</p>
        <div style={{ display: "grid", gap: 14 }}>
          {[
            { checked: inclCenarios,   setter: setInclCenarios,   label: "Cenários de precificação",   desc: "Simulações salvas com receita, custo, lucro e margem" },
            { checked: inclTabelas,    setter: setInclTabelas,    label: "Tabelas de preço",            desc: "Regras por canal, cliente e volume (atacado, B2B etc.)" },
            { checked: inclDocumentos, setter: setInclDocumentos, label: "Documentos comerciais",       desc: "Orçamentos, cotações e propostas com status" },
          ].map(({ checked, setter, label, desc }) => (
            <label key={label} style={{ display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setter(e.target.checked)}
                style={{ marginTop: 3, accentColor: "var(--gold, #b9924d)", width: 16, height: 16, flexShrink: 0 }}
              />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-heading, #f1ede5)", margin: "0 0 2px" }}>{label}</p>
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Filtros de documentos (só aparecem quando Documentos está marcado) */}
      {inclDocumentos && (
        <section className="glass" style={{ padding: 22, borderRadius: 14, marginBottom: 20 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Filtros — Documentos comerciais</p>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "var(--color-muted, #8a9580)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tipo
            </p>
            <ChipSelect options={KINDS} value={kindFilter} onChange={setKindFilter} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "var(--color-muted, #8a9580)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Status
            </p>
            <ChipSelect options={STATUSES} value={statusFilter} onChange={setStatusFilter} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
            <GlassCalendar label="Data inicial" value={dateFrom} onChange={setDateFrom} />
            <GlassCalendar label="Data final"   value={dateTo}   onChange={setDateTo}   />
          </div>
          {dateFrom && dateTo && dateFrom > dateTo && (
            <p style={{ fontSize: 11, color: "#e8a0a0", marginTop: 8 }}>
              Data inicial deve ser anterior à data final.
            </p>
          )}
        </section>
      )}

      {/* Erro */}
      {error && (
        <div style={{
          background: "rgba(232,100,100,0.1)", border: "1px solid rgba(232,100,100,0.3)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#e87070",
        }}>
          {error}
        </div>
      )}

      {/* Ações */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-gold"
          style={{ padding: "13px 28px", fontSize: 13 }}
          onClick={handleDownload}
          disabled={loading || (!inclCenarios && !inclTabelas && !inclDocumentos) || (!!dateFrom && !!dateTo && dateFrom > dateTo)}
        >
          {loading ? "Gerando…" : `Baixar ${format.toUpperCase()}`}
        </button>
        <Link href="/financeiro" className="btn btn-ghost" style={{ padding: "13px 22px", fontSize: 13 }}>
          Cancelar
        </Link>
      </div>
    </main>
  );
}
