"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

/* ─── constantes ────────────────────────────────────────────── */
export const PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "7d",    label: "7 dias" },
  { key: "30d",   label: "30 dias" },
  { key: "month", label: "Mês" },
  { key: "year",  label: "Ano" },
] as const;

const MONTH_NAMES = [
  "Jan","Fev","Mar","Abr","Mai","Jun",
  "Jul","Ago","Set","Out","Nov","Dez",
];
const DAY_NAMES = ["D","S","T","Q","Q","S","S"];

/* ─── helpers ───────────────────────────────────────────────── */
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function parseIso(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}
function between(d: Date, a: Date, b: Date) {
  const t = d.getTime();
  return t > a.getTime() && t < b.getTime();
}
function calendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let d = 1; d <= last; d++) days.push(new Date(year, month, d));
  return days;
}
function fmtDisplay(d: Date) {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

/* ─── mini calendar ─────────────────────────────────────────── */
function MiniCalendar({
  onSelect,
}: {
  onSelect: (from: string, to: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [hovering, setHovering] = useState<Date | null>(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function clickDay(d: Date) {
    if (!start || (start && end)) {
      setStart(d); setEnd(null);
    } else {
      if (d < start) { setEnd(start); setStart(d); }
      else setEnd(d);
    }
  }

  function apply() {
    if (start && end) onSelect(isoDate(start), isoDate(end));
    else if (start) onSelect(isoDate(start), isoDate(start));
  }

  const rangeEnd = end ?? hovering;
  const days = calendarDays(viewYear, viewMonth);

  const cell = (d: Date | null, i: number) => {
    if (!d) return <div key={`e${i}`} />;
    const isStart  = start && sameDay(d, start);
    const isEnd    = rangeEnd && sameDay(d, rangeEnd);
    const inRange  = start && rangeEnd && between(d, start < rangeEnd ? start : rangeEnd, start < rangeEnd ? rangeEnd : start);
    const isToday  = sameDay(d, today);

    return (
      <button
        key={d.toISOString()}
        type="button"
        onClick={() => clickDay(d)}
        onMouseEnter={() => setHovering(d)}
        onMouseLeave={() => setHovering(null)}
        style={{
          width: 32, height: 32,
          borderRadius: isStart || isEnd ? "50%" : 4,
          border: isToday && !isStart && !isEnd ? "1px solid rgba(185,146,77,0.5)" : "none",
          background: isStart || isEnd
            ? "var(--gold)"
            : inRange
            ? "rgba(185,146,77,0.15)"
            : "transparent",
          color: isStart || isEnd ? "var(--forest-950)" : "var(--cream)",
          fontWeight: isStart || isEnd || isToday ? 700 : 400,
          fontSize: 12,
          cursor: "pointer",
          transition: "background 0.1s",
        }}
      >
        {d.getDate()}
      </button>
    );
  };

  return (
    <div
      style={{
        background: "rgba(9,20,10,0.96)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--glass-border-hover)",
        borderRadius: 16,
        padding: 18,
        minWidth: 260,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* header do mês */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" onClick={prevMonth}
          style={{ background: "none", border: "none", color: "var(--cream-dim)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          style={{ background: "none", border: "none", color: "var(--cream-dim)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>›</button>
      </div>

      {/* nomes dos dias */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: 2, marginBottom: 4 }}>
        {DAY_NAMES.map((n, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--cream-dim)", height: 24, lineHeight: "24px" }}>
            {n}
          </div>
        ))}
      </div>

      {/* dias */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: 2 }}>
        {days.map((d, i) => cell(d, i))}
      </div>

      {/* seleção atual */}
      {start && (
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--cream-dim)", textAlign: "center" }}>
          {fmtDisplay(start)}{end ? ` → ${fmtDisplay(end)}` : " (selecione a data final)"}
        </div>
      )}

      {/* botão aplicar */}
      <button
        type="button"
        onClick={apply}
        disabled={!start}
        className="btn btn-gold"
        style={{ width: "100%", marginTop: 12, padding: "9px 0", fontSize: 11 }}
      >
        Aplicar período
      </button>
    </div>
  );
}

/* ─── componente exportado ───────────────────────────────────── */
export function PeriodFilter({
  current,
  from,
  to,
}: {
  current: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!calRef.current?.contains(e.target as Node)) setCalOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function go(period: string) {
    router.push(`/?period=${period}`);
  }

  function goCustom(f: string, t: string) {
    setCalOpen(false);
    router.push(`/?period=custom&from=${f}&to=${t}`);
  }

  const isCustom = current === "custom";
  const fromD = from ? parseIso(from) : null;
  const toD = to ? parseIso(to) : null;

  const btnStyle = (active: boolean) => ({
    padding: "5px 12px",
    border: "1px solid",
    borderColor: active ? "var(--gold-light)" : "var(--glass-border)",
    background: active ? "rgba(218,183,116,0.16)" : "rgba(242,236,223,0.04)",
    color: active ? "var(--gold-light)" : "var(--cream-dim)",
    fontSize: 10,
    fontWeight: 700 as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    borderRadius: 5,
    cursor: "pointer",
    transition: "all 0.18s ease",
    fontFamily: "inherit",
  });

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", position: "relative" }}>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => go(p.key)}
          style={btnStyle(current === p.key)}
        >
          {p.label}
        </button>
      ))}

      {/* botão personalizado */}
      <div ref={calRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setCalOpen(v => !v)}
          style={{
            ...btnStyle(isCustom),
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {isCustom && fromD && toD
            ? `${fmtDisplay(fromD)} – ${fmtDisplay(toD)}`
            : "Período"}
        </button>

        {calOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              zIndex: 200,
            }}
          >
            <MiniCalendar onSelect={goCustom} />
          </div>
        )}
      </div>
    </div>
  );
}
