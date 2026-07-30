"use client";

/**
 * /financeiro/exportar — Tela de seleção antes do download
 *
 * Permite escolher:
 *   • Formato: CSV · XLSX · PDF
 *   • Conteúdo: Cenários, Tabelas de preço, Documentos comerciais
 *     (filtros enviados via query string para o route handler)
 */

import Link from "next/link";
import { useState } from "react";

type Format = "xlsx" | "csv" | "pdf";

const FORMAT_OPTIONS: { id: Format; label: string; icon: string; desc: string }[] = [
  { id: "xlsx", label: "XLSX",  icon: "📊", desc: "Planilha Excel — 3 abas (Cenários, Tabelas, Documentos)" },
  { id: "csv",  label: "CSV",   icon: "📋", desc: "Texto separado por vírgulas, compatível com qualquer sistema" },
  { id: "pdf",  label: "PDF",   icon: "📄", desc: "Relatório formatado para impressão e arquivamento" },
];

export default function ExportarPage() {
  const [format, setFormat]         = useState<Format>("xlsx");
  const [inclCenarios, setInclCenarios]   = useState(true);
  const [inclTabelas, setInclTabelas]     = useState(true);
  const [inclDocumentos, setInclDocumentos] = useState(true);
  const [loading, setLoading]       = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ format });
      if (!inclCenarios)   params.set("no_cenarios",   "1");
      if (!inclTabelas)    params.set("no_tabelas",    "1");
      if (!inclDocumentos) params.set("no_documentos", "1");

      const res = await fetch(`/financeiro/exportar?${params.toString()}`);
      if (!res.ok) { alert("Erro ao gerar exportação. Tente novamente."); return; }

      const blob = await res.blob();
      const ext  = format;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `flora-financeiro.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "48px 28px 80px" }}>
      <nav style={{ fontSize: 13, color: "var(--cream-dim, #a09880)", marginBottom: 20, display: "flex", gap: 8 }}>
        <Link href="/financeiro" style={{ color: "inherit", textDecoration: "none" }}>Financeiro</Link>
        <span>/</span>
        <span style={{ color: "var(--color-heading, #f1ede5)" }}>Exportar Relatórios</span>
      </nav>

      <header style={{ marginBottom: 32 }}>
        <h1 className="display" style={{ fontSize: 38 }}>Exportar Relatórios</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Selecione o formato e os módulos que deseja incluir na exportação.
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
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: "16px 16px 14px",
                borderRadius: 14,
                border: `1.5px solid ${format === opt.id ? "var(--gold, #b9924d)" : "rgba(104,75,44,0.18)"}`,
                background: format === opt.id ? "rgba(185,146,77,0.09)" : "rgba(255,248,234,0.03)",
                cursor: "pointer",
                textAlign: "left",
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

      {/* Conteúdo */}
      <section className="glass" style={{ padding: 22, borderRadius: 14, marginBottom: 28 }}>
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

      {/* Botão */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-gold"
          style={{ padding: "13px 28px", fontSize: 13 }}
          onClick={handleDownload}
          disabled={loading || (!inclCenarios && !inclTabelas && !inclDocumentos)}
        >
          {loading ? "Gerando…" : `Baixar ${format.toUpperCase()}`}
        </button>
        <Link href="/financeiro" className="btn btn-ghost" style={{ padding: "13px 22px", fontSize: 13 }}>
          Cancelar
        </Link>
      </div>
      {!inclCenarios && !inclTabelas && !inclDocumentos && (
        <p style={{ fontSize: 12, color: "#e8a0a0", marginTop: 10 }}>
          Selecione ao menos um módulo para exportar.
        </p>
      )}
    </main>
  );
}
