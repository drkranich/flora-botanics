"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type GlassSelectOption = {
  value: string;
  label: string;
};

export function GlassSelect({
  id,
  name,
  value,
  defaultValue,
  options,
  onChange,
  disabled,
  ariaLabel,
  style,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  options: GlassSelectOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const selected = options.find((option) => option.value === currentValue) ?? options[0];

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
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

  function choose(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div ref={ref} className="glass-select" style={style}>
      {name ? <input type="hidden" name={name} value={currentValue ?? ""} /> : null}
      <button
        id={id}
        type="button"
        className="glass-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((next) => !next)}
      >
        <span>{selected?.label ?? "Selecione"}</span>
        <span className="glass-select-arrow" aria-hidden="true" />
      </button>
      {open ? (
        <div className="glass-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === currentValue}
              data-active={option.value === currentValue ? "true" : "false"}
              className="glass-select-option"
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
