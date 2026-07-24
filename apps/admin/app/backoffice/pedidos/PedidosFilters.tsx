"use client";

import { useState, useRef, useEffect, createPortal } from "react";
import { useRouter, usePathname } from "next/navigation";

// ─── Status groups ────────────────────────────────────────────────────────────

interface StatusOption {
  value: string;
  label: string;
  hint?: string;
  icon: string;
}
interface StatusGroup {
  label: string;
  color: string;
  items: StatusOption[];
}

const STATUS_GROUPS: StatusGroup[] = [
  {
    label: "Visão geral",
    color: "rgba(185,146,77,0.7)",
    items: [{ value: "", label: "Todos os pedidos", icon: "📋", hint: "Exibir todos sem filtro" }],
  },
  {
    label: "Em andamento",
    color: "#8fd486",
    items: [
      { value: "pending",    label: "Aguardando pagamento", icon: "⏳", hint: "Pedido criado mas não pago" },
      { value: "paid",       label: "Pagos",                icon: "✅", hint: "Pagamento confirmado" },
      { value: "processing", label: "Em preparação",        icon: "🏭", hint: "Sendo embalado ou fabricado" },
      { value: "shipped",    label: "Enviados",             icon: "🚚", hint: "Em trânsito com transportadora" },
    ],
  },
  {
    label: "Concluído",
    color: "rgba(185,146,77,0.9)",
    items: [
      { value: "delivered", label: "Entregues", icon: "📦", hint: "Recebidos pelo cliente" },
    ],
  },
  {
    label: "Atenção",
    color: "#e8a0a0",
    items: [
      { value: "canceled", label: "Cancelados",             icon: "🚫", hint: "Pedido cancelado" },
      { value: "refunded", label: "Devoluções / Reembolsos", icon: "↩️",  hint: "Produto devolvido ou reembolsado" },
    ],
  },
];

// ─── Glass dropdown ───────────────────────────────────────────────────────────

function StatusDropdown({
  value,
  counts,
  onChange,
}: {
  value: string;
  counts: Record<string, number>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Find selected label + icon
  let selLabel = "Todos os pedidos";
  let selIcon = "📋";
  for (const g of STATUS_GROUPS) {
    const f = g.items.find((i) => i.value === value);
    if (f) { selLabel = f.label; selIcon = f.icon; break; }
  }

  const rect = triggerRef.current?.getBoundingClientRect();

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const menu =
    open && mounted && rect
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: rect.bottom + 6,
              left: rect.left,
              width: rect.width,
              minWidth: 240,
              zIndex: 9999,
              background: "rgba(8,18,9,0.92)",
              border: "1px solid rgba(185,146,77,0.4)",
              borderRadius: 14,
              backdropFilter: "blur(28px) saturate(1.6)",
              WebkitBackdropFilter: "blur(28px) saturate(1.6)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
              padding: "6px 0 8px",
              overflow: "hidden",
            }}
          >
            {STATUS_GROUPS.map((group, gi) => (
              <div key={gi}>
                <div
                  style={{
                    padding: "10px 14px 4px",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                    color: group.color,
                    fontFamily: "inherit",
                  }}
                >
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const isSelected = item.value === value;
                  const cnt = item.value === "" ? totalCount : (counts[item.value] ?? 0);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => { onChange(item.value); setOpen(false); }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        padding: "9px 14px",
                        background: isSelected ? "rgba(185,146,77,0.14)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        gap: 10,
                        transition: "background 0.1s",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.background = "rgba(242,236,223,0.07)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected
                          ? "rgba(185,146,77,0.14)"
                          : "transparent";
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{item.icon}</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? "var(--gold-light)" : "var(--cream)",
                              fontFamily: "inherit",
                            }}
                          >
                            {item.label}
                          </span>
                          {item.hint && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--cream-dim)",
                                fontFamily: "inherit",
                              }}
                            >
                              {item.hint}
                            </span>
                          )}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: cnt > 0 ? "var(--gold-light)" : "rgba(242,236,223,0.3)",
                          background:
                            cnt > 0
                              ? "rgba(185,146,77,0.18)"
                              : "rgba(242,236,223,0.05)",
                          padding: "2px 9px",
                          borderRadius: 999,
                          fontFamily: "inherit",
                          minWidth: 30,
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        {cnt}
                      </span>
                    </button>
                  );
                })}
                {gi < STATUS_GROUPS.length - 1 && (
                  <div
                    style={{
                      height: 1,
                      background: "rgba(242,236,223,0.06)",
                      margin: "5px 12px",
                    }}
                  />
                )}
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          width: "100%",
          padding: "11px 14px",
          background: open
            ? "rgba(185,146,77,0.1)"
            : "rgba(10,22,11,0.55)",
          border: `1px solid ${open ? "rgba(185,146,77,0.55)" : "var(--glass-border)"}`,
          borderRadius: 10,
          color: "var(--cream)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          fontFamily: "inherit",
          boxShadow: open
            ? "0 0 0 1px rgba(185,146,77,0.2), 0 8px 24px rgba(0,0,0,0.3)"
            : "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>{selIcon}</span>
          <span>{selLabel}</span>
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--gold-light)",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>
      {menu}
    </>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

const WDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function CalendarWidget({
  orderDates,
  selectedDate,
  onSelect,
}: {
  orderDates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const dateSet = new Set(orderDates);

  const firstDow = new Date(year, month, 1).getDay();
  const lastDay  = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  function isoOf(d: number) { return `${year}-${pad(month + 1)}-${pad(d)}`; }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  // Count orders per day this month (for intensity dots)
  const dayCounts: Record<string, number> = {};
  for (const d of orderDates) {
    if (d.startsWith(`${year}-${pad(month + 1)}`)) {
      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    }
  }

  return (
    <div
      style={{
        background: "rgba(10,22,11,0.55)",
        border: "1px solid var(--glass-border)",
        borderRadius: 14,
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        padding: "18px 16px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          onClick={prevMonth}
          style={calNavBtn}
        >
          ‹
        </button>
        <span style={{ fontWeight: 700, fontSize: 12, color: "var(--cream)", letterSpacing: 0.3 }}>
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          style={calNavBtn}
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          marginBottom: 6,
        }}
      >
        {WDAYS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              fontSize: 9,
              fontWeight: 800,
              color: "rgba(242,236,223,0.3)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              padding: "2px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day)
            return <div key={i} style={{ height: 34 }} />;

          const iso = isoOf(day);
          const hasOrders = dateSet.has(iso);
          const cnt = dayCounts[iso] ?? 0;
          const isSelected = iso === selectedDate;
          const isToday = iso === todayIso;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(isSelected ? "" : iso)}
              title={hasOrders ? `${cnt} pedido(s)` : undefined}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 34,
                borderRadius: 8,
                border: isToday && !isSelected
                  ? "1px solid rgba(185,146,77,0.45)"
                  : "1px solid transparent",
                background: isSelected
                  ? "rgba(185,146,77,0.28)"
                  : "transparent",
                color: isSelected
                  ? "var(--gold-light)"
                  : isToday
                  ? "var(--cream)"
                  : "rgba(242,236,223,0.75)",
                fontWeight: isSelected || isToday ? 700 : 400,
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.12s",
                fontFamily: "inherit",
                padding: 0,
                boxShadow: isSelected
                  ? "0 2px 8px rgba(185,146,77,0.25)"
                  : "none",
              }}
              onMouseEnter={(e) => {
                if (!isSelected)
                  e.currentTarget.style.background = "rgba(242,236,223,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected
                  ? "rgba(185,146,77,0.28)"
                  : "transparent";
              }}
            >
              {day}
              {hasOrders && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 3,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                  }}
                >
                  {/* 1 dot = 1–2 orders, 2 dots = 3–5, 3 dots = 6+ */}
                  {Array.from({ length: Math.min(cnt > 5 ? 3 : cnt > 2 ? 2 : 1) }).map((_, di) => (
                    <div
                      key={di}
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: isSelected
                          ? "var(--gold-light)"
                          : "rgba(185,146,77,0.75)",
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(242,236,223,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          color: "var(--cream-dim)",
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "rgba(185,146,77,0.75)",
            flexShrink: 0,
          }}
        />
        pedidos neste dia
      </div>
    </div>
  );
}

const calNavBtn: React.CSSProperties = {
  background: "rgba(242,236,223,0.06)",
  border: "1px solid rgba(242,236,223,0.1)",
  borderRadius: 7,
  color: "var(--cream)",
  cursor: "pointer",
  fontSize: 15,
  lineHeight: "1",
  padding: "3px 10px",
  fontFamily: "inherit",
  transition: "background 0.12s",
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function PedidosFilters({
  counts,
  orderDates,
  currentStatus,
  currentDate,
}: {
  counts: Record<string, number>;
  orderDates: string[];
  currentStatus: string;
  currentDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(status: string, date: string) {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (date) p.set("date", date);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Dropdown */}
      <StatusDropdown
        value={currentStatus}
        counts={counts}
        onChange={(v) => navigate(v, currentDate)}
      />

      {/* Active date chip */}
      {currentDate && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: "rgba(185,146,77,0.12)",
            border: "1px solid rgba(185,146,77,0.35)",
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--gold-light)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <span style={{ fontSize: 13 }}>📅</span>
          {new Date(currentDate + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
          <button
            type="button"
            onClick={() => navigate(currentStatus, "")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(185,146,77,0.7)",
              fontSize: 15,
              lineHeight: 1,
              padding: "0 0 0 4px",
              marginLeft: "auto",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Calendar */}
      <CalendarWidget
        orderDates={orderDates}
        selectedDate={currentDate}
        onSelect={(date) => navigate(currentStatus, date)}
      />
    </div>
  );
}
