"use client";

import { useEffect, useRef, useState } from "react";

export type GlassSelectOption = {
  value: string;
  label: string;
};

export function GlassSelect({
  value,
  defaultValue,
  options,
  onChange,
  disabled,
  ariaLabel,
  className,
}: {
  value?: string;
  defaultValue?: string;
  options: GlassSelectOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const selected = options.find((o) => o.value === currentValue) ?? options[0];

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function choose(v: string) {
    if (!controlled) setInternalValue(v);
    onChange?.(v);
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      className={`sf-glass-select${className ? ` ${className}` : ""}`}
      aria-disabled={disabled}
    >
      <button
        type="button"
        className="sf-glass-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.label ?? "Selecione"}</span>
        <svg
          className="sf-glass-select-arrow"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="sf-glass-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === currentValue}
              className={`sf-glass-select-option${opt.value === currentValue ? " is-active" : ""}`}
              onClick={() => choose(opt.value)}
            >
              {opt.value === currentValue && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
