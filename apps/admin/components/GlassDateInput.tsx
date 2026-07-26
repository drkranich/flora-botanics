"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function parseValue(value?: string) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const date = new Date(`${datePart}T${timePart ?? "00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function daysForMonth(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let day = 1; day <= last; day++) days.push(new Date(year, month, day));
  return days;
}

function displayValue(value: string, withTime: boolean) {
  const date = parseValue(value);
  if (!date) return "";
  const base = date.toLocaleDateString("pt-BR");
  if (!withTime) return base;
  return `${base} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function GlassDateInput({
  name,
  value,
  onChange,
  defaultValue,
  placeholder = "Selecionar data",
  withTime = false,
}: {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
  withTime?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [internal, setInternal] = useState(defaultValue ?? "");
  const currentValue = value ?? internal;
  const selected = parseValue(currentValue);
  const [view, setView] = useState(() => selected ?? new Date());
  const [time, setTime] = useState(() => currentValue.split("T")[1]?.slice(0, 5) ?? "09:00");
  const days = useMemo(() => daysForMonth(view.getFullYear(), view.getMonth()), [view]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!triggerRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function setNext(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  function openPicker() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        position: "fixed",
        zIndex: 99999,
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 286),
      });
    }
    setOpen((v) => !v);
  }

  function pick(day: Date) {
    const next = withTime ? `${isoDate(day)}T${time}` : isoDate(day);
    setNext(next);
    if (!withTime) setOpen(false);
  }

  function applyTime() {
    const date = selected ?? view;
    setNext(`${isoDate(date)}T${time}`);
    setOpen(false);
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <button ref={triggerRef} type="button" className="glass-date-trigger" onClick={openPicker}>
        <span>{displayValue(currentValue, withTime) || placeholder}</span>
        <span className="glass-date-icon">▦</span>
      </button>
      {open && mounted
        ? createPortal(
            <div ref={popoverRef} className="glass-date-popover" style={position}>
              <div className="glass-date-head">
                <button type="button" className="btn-icon" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>‹</button>
                <strong>{MONTHS[view.getMonth()]} {view.getFullYear()}</strong>
                <button type="button" className="btn-icon" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>›</button>
              </div>
              <div className="glass-date-grid glass-date-weekdays">
                {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
              </div>
              <div className="glass-date-grid">
                {days.map((day, index) => {
                  const active = !!day && selected?.toDateString() === day.toDateString();
                  return day ? (
                    <button
                      key={day.toISOString()}
                      type="button"
                      className={active ? "glass-date-day is-active" : "glass-date-day"}
                      onClick={() => pick(day)}
                    >
                      {day.getDate()}
                    </button>
                  ) : (
                    <span key={`empty-${index}`} />
                  );
                })}
              </div>
              {withTime ? (
                <div className="glass-date-time">
                  <input className="input" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                  <button type="button" className="btn btn-gold" onClick={applyTime}>Aplicar</button>
                </div>
              ) : null}
              <button type="button" className="glass-date-clear" onClick={() => { setNext(""); setOpen(false); }}>Limpar</button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
