"use client";

import { useState, useCallback, useTransition } from "react";
import { getPDVReport, getPDVSalesForDay, type PDVDaySummary, type PDVReportResult } from "./pdv-report-actions";
import { buildFloraKraftPDF, openAndPrint } from "@/lib/pdf/template";
import { getPdfConfig } from "@/lib/pdf/actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function monthEnd(year: number, month: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  // 0 = domingo
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEK_DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

type View = "month" | "custom";

// ── Componente ────────────────────────────────────────────────────────────────

export function PDVReportPanel() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [view, setView] = useState<View>("month");
  const [customFrom, setCustomFrom] = useState(monthStart(today.getFullYear(), today.getMonth()));
  const [customTo, setCustomTo] = useState(todayStr());

  const [report, setReport] = useState<PDVReportResult | null>(null);
  const [selectedDay, setSelectedDay] = useState<PDVDaySummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pdfPending, setPdfPending] = useState(false);

  // dayMap para lookup rápido
  const dayMap = new Map<string, PDVDaySummary>(
    (report?.days ?? []).map((d) => [d.date, d])
  );

  // Máximo de vendas no período — para colorir o calendário proporcionalmente
  const maxSales = Math.max(1, ...(report?.days.map((d) => d.total_cents) ?? [1]));

  function load(from: string, to: string) {
    startTransition(async () => {
      const result = await getPDVReport(from, to);
      setReport(result);
      setSelectedDay(null);
    });
  }

  function handleMonthNav(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
    setView("month");
    load(monthStart(y, m), monthEnd(y, m));
  }

  function handleLoadMonth() {
    setView("month");
    load(monthStart(viewYear, viewMonth), monthEnd(viewYear, viewMonth));
  }

  function handleLoadCustom() {
    if (!customFrom || !customTo) return;
    setView("custom");
    load(customFrom, customTo);
  }

  function handleDayClick(dateStr: string) {
    const day = dayMap.get(dateStr);
    if (day) setSelectedDay(day === selectedDay ? null : day);
  }

  const handlePdf = useCallback(async () => {
    if (!report) return;
    setPdfPending(true);
    try {
      const config = await getPdfConfig();
      const from = view === "month" ? monthStart(viewYear, viewMonth) : customFrom;
      const to   = view === "month" ? monthEnd(viewYear, viewMonth)   : customTo;

      // Busca detalhes do dia selecionado (ou resumo do período)
      let detailRows = "";
      if (selectedDay) {
        const sales = await getPDVSalesForDay(selectedDay.date);
        detailRows = sales.map((s) => {
          const method = (s.payment_summary as Record<string,unknown> | null)?.method as string ?? "—";
          return `<tr>
            <td>#${s.number}</td>
            <td>${new Date(s.placed_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</td>
            <td>${method}</td>
            <td style="text-align:right;font-weight:700">${fmt(s.total_cents)}</td>
          </tr>`;
        }).join("");
      }

      const calTable = report.days.map((d) => `<tr>
        <td>${new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
        <td style="text-align:center">${d.sales}</td>
        <td style="text-align:right;font-weight:700">${fmt(d.total_cents)}</td>
      </tr>`).join("");

      const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px">
          <div style="background:rgba(42,74,44,0.08);border:1px solid rgba(42,74,44,0.2);border-radius:10px;padding:14px 18px;text-align:center">
            <div style="font-size:11px;color:#6b5c4a;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Vendas</div>
            <div style="font-size:26px;font-weight:800;color:#2a4a2c">${report.period_sales}</div>
          </div>
          <div style="background:rgba(42,74,44,0.08);border:1px solid rgba(42,74,44,0.2);border-radius:10px;padding:14px 18px;text-align:center">
            <div style="font-size:11px;color:#6b5c4a;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Total</div>
            <div style="font-size:26px;font-weight:800;color:#2a4a2c">${fmt(report.period_total_cents)}</div>
          </div>
          <div style="background:rgba(42,74,44,0.08);border:1px solid rgba(42,74,44,0.2);border-radius:10px;padding:14px 18px;text-align:center">
            <div style="font-size:11px;color:#6b5c4a;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Ticket médio</div>
            <div style="font-size:26px;font-weight:800;color:#2a4a2c">${fmt(report.avg_ticket_cents)}</div>
          </div>
        </div>

        ${selectedDay ? `
          <h3 style="font-size:13px;font-weight:800;color:#5a3e2b;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px">
            Vendas em ${new Date(selectedDay.date + "T12:00:00").toLocaleDateString("pt-BR")}
          </h3>
          <table>
            <thead><tr><th>Pedido</th><th>Hora</th><th>Pagamento</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>${detailRows}</tbody>
          </table>
          <div style="height:20px"></div>
        ` : ""}

        <h3 style="font-size:13px;font-weight:800;color:#5a3e2b;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px">
          Resumo por dia
        </h3>
        <table>
          <thead><tr><th>Data</th><th style="text-align:center">Vendas</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${calTable}</tbody>
        </table>
      `;

      const periodLabel = view === "month"
        ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
        : `${new Date(from + "T12:00:00").toLocaleDateString("pt-BR")} – ${new Date(to + "T12:00:00").toLocaleDateString("pt-BR")}`;

      const html = buildFloraKraftPDF({
        title: `Relatório PDV — ${periodLabel}`,
        subtitle: `${report.period_sales} venda(s) · Total ${fmt(report.period_total_cents)} · Ticket médio ${fmt(report.avg_ticket_cents)}`,
        category: "relatorio_pdv",
        department: "PDV / Caixa",
        config,
        body,
      });

      openAndPrint(html);
    } finally {
      setPdfPending(false);
    }
  }, [report, selectedDay, view, viewYear, viewMonth, customFrom, customTo]);

  // ── Renderização do calendário ──────────────────────────────────────────────

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startOffset = firstWeekday(viewYear, viewMonth);

  return (
    <div style={S.root}>

      {/* Controles de período */}
      <div style={S.controls}>
        {/* Navegação mês */}
        <div style={S.row}>
          <button style={S.navBtn} onClick={() => handleMonthNav(-1)}>‹</button>
          <span style={S.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button style={S.navBtn} onClick={() => handleMonthNav(1)}>›</button>
          <button
            style={{ ...S.loadBtn, opacity: isPending ? 0.6 : 1 }}
            onClick={handleLoadMonth}
            disabled={isPending}
          >
            {isPending && view === "month" ? "Carregando…" : "Ver mês"}
          </button>
        </div>

        {/* Período personalizado */}
        <div style={S.row}>
          <span style={S.periodLabel}>Período:</span>
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
            style={S.dateInput}
          />
          <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>até</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={todayStr()}
            onChange={(e) => setCustomTo(e.target.value)}
            style={S.dateInput}
          />
          <button
            style={{ ...S.loadBtn, opacity: isPending ? 0.6 : 1 }}
            onClick={handleLoadCustom}
            disabled={isPending}
          >
            {isPending && view === "custom" ? "Carregando…" : "Buscar"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {report && (
        <div style={S.kpiRow}>
          <div style={S.kpi}>
            <span style={S.kpiLabel}>Vendas</span>
            <span style={S.kpiVal}>{report.period_sales}</span>
          </div>
          <div style={S.kpi}>
            <span style={S.kpiLabel}>Total</span>
            <span style={{ ...S.kpiVal, color: "#4ade80" }}>{fmt(report.period_total_cents)}</span>
          </div>
          <div style={S.kpi}>
            <span style={S.kpiLabel}>Ticket médio</span>
            <span style={S.kpiVal}>{fmt(report.avg_ticket_cents)}</span>
          </div>
          <button
            style={{ ...S.pdfBtn, opacity: pdfPending ? 0.6 : 1 }}
            onClick={() => void handlePdf()}
            disabled={pdfPending || !report}
            title="Gerar relatório PDF"
          >
            {pdfPending ? "Gerando…" : "📄 PDF"}
          </button>
        </div>
      )}

      {/* Calendário — só exibe para view mensal */}
      {report && view === "month" && (
        <div style={S.calendar}>
          {/* Cabeçalho dias da semana */}
          {WEEK_DAYS.map((d) => (
            <div key={d} style={S.weekDay}>{d}</div>
          ))}

          {/* Células vazias antes do dia 1 */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} style={S.emptyCell} />
          ))}

          {/* Dias do mês */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const data = dayMap.get(dateStr);
            const intensity = data ? data.total_cents / maxSales : 0;
            const isToday = dateStr === todayStr();
            const isSelected = selectedDay?.date === dateStr;

            return (
              <div
                key={day}
                style={{
                  ...S.dayCell,
                  background: data
                    ? `rgba(74,222,128,${0.08 + intensity * 0.35})`
                    : "rgba(255,255,255,0.03)",
                  border: isSelected
                    ? "2px solid #4ade80"
                    : isToday
                      ? "1px solid rgba(185,146,77,0.6)"
                      : "1px solid rgba(255,255,255,0.06)",
                  cursor: data ? "pointer" : "default",
                }}
                onClick={() => data && handleDayClick(dateStr)}
                title={data ? `${fmt(data.total_cents)} · ${data.sales} venda(s)` : undefined}
              >
                <span style={{
                  fontSize: 11,
                  fontWeight: isToday ? 800 : 500,
                  color: isToday ? "var(--gold-light)" : "var(--cream-dim)",
                }}>
                  {day}
                </span>
                {data && (
                  <span style={S.daySales}>{data.sales}v</span>
                )}
                {data && (
                  <span style={S.dayTotal}>{fmt(data.total_cents)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de dias para período personalizado */}
      {report && view === "custom" && report.days.length > 0 && (
        <div style={S.dayList}>
          {report.days.map((d) => (
            <div
              key={d.date}
              style={{
                ...S.dayListRow,
                background: selectedDay?.date === d.date
                  ? "rgba(74,222,128,0.1)"
                  : "rgba(255,255,255,0.03)",
                borderColor: selectedDay?.date === d.date
                  ? "rgba(74,222,128,0.4)"
                  : "rgba(255,255,255,0.07)",
                cursor: "pointer",
              }}
              onClick={() => setSelectedDay(d === selectedDay ? null : d)}
            >
              <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>
                {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
              </span>
              <span style={{ fontSize: 11, color: "var(--cream-dim)", opacity: 0.6 }}>{d.sales} venda(s)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>{fmt(d.total_cents)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Detalhe do dia selecionado */}
      {selectedDay && (
        <div style={S.dayDetail}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gold-light)", margin: "0 0 8px" }}>
            📅 {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <div style={{ display: "flex", gap: 20 }}>
            <span className="muted" style={{ fontSize: 12 }}>{selectedDay.sales} venda(s)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>{fmt(selectedDay.total_cents)}</span>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Clique em "📄 PDF" para incluir detalhes deste dia no relatório.</p>
        </div>
      )}

      {report && report.days.length === 0 && (
        <p className="muted" style={{ fontSize: 12, textAlign: "center", padding: "20px 0" }}>
          Nenhuma venda PDV encontrada neste período.
        </p>
      )}

      {!report && (
        <p className="muted" style={{ fontSize: 12, textAlign: "center", padding: "20px 0", opacity: 0.6 }}>
          Selecione um período e clique em "Ver mês" ou "Buscar".
        </p>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "18px 20px",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  navBtn: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "var(--cream-dim)",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: "4px 10px",
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--gold-light)",
    minWidth: 160,
    textAlign: "center" as const,
  },
  periodLabel: {
    fontSize: 11,
    color: "var(--cream-dim)",
    opacity: 0.7,
  },
  loadBtn: {
    background: "rgba(185,146,77,0.15)",
    border: "1px solid rgba(185,146,77,0.3)",
    borderRadius: 8,
    color: "var(--gold-light)",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    padding: "6px 14px",
    letterSpacing: 0.3,
  },
  dateInput: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 7,
    color: "var(--cream-dim)",
    fontSize: 12,
    padding: "5px 10px",
    colorScheme: "dark",
  },
  kpiRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
  },
  kpi: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    flex: 1,
    minWidth: 80,
  },
  kpiLabel: {
    fontSize: 9,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "var(--cream-dim)",
    opacity: 0.6,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--cream-dim)",
    lineHeight: 1.2,
  },
  pdfBtn: {
    background: "rgba(42,74,44,0.25)",
    border: "1px solid rgba(42,74,44,0.5)",
    borderRadius: 10,
    color: "#4ade80",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "10px 18px",
    flexShrink: 0,
    letterSpacing: 0.3,
  },
  calendar: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
  },
  weekDay: {
    fontSize: 9,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    color: "var(--cream-dim)",
    opacity: 0.5,
    textAlign: "center" as const,
    padding: "4px 0",
  },
  emptyCell: {
    height: 60,
  },
  dayCell: {
    borderRadius: 8,
    padding: "6px 6px 5px",
    minHeight: 60,
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    transition: "all 0.15s",
    userSelect: "none" as const,
  },
  daySales: {
    fontSize: 9,
    color: "#4ade80",
    opacity: 0.7,
    fontWeight: 600,
  },
  dayTotal: {
    fontSize: 9,
    color: "#4ade80",
    fontWeight: 700,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  dayList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  dayListRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    gap: 12,
    flexWrap: "wrap",
  },
  dayDetail: {
    padding: "12px 16px",
    background: "rgba(74,222,128,0.05)",
    border: "1px solid rgba(74,222,128,0.2)",
    borderRadius: 10,
  },
};
