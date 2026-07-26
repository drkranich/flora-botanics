"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

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
  inlineMenu = false,
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
  inlineMenu?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const [mounted, setMounted] = useState(false);
  const controlled   = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const selected     = options.find((o) => o.value === currentValue) ?? options[0];

  // Portal só existe no cliente
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (
        !triggerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) setOpen(false);
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

  function toggle() {
    if (!inlineMenu && !open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      // abre abaixo do trigger; se não couber na tela, abre acima
      const spaceBelow = window.innerHeight - r.bottom;
      const menuH = Math.min(260, options.length * 38 + 12);
      const openUp = spaceBelow < menuH + 10 && r.top > menuH;
      setMenuStyle({
        position: "fixed",
        zIndex: 9999,
        left: r.left,
        width: r.width,
        ...(openUp
          ? { bottom: window.innerHeight - r.top + 4 }
          : { top: r.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  }

  function choose(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  const menuContent = open ? (
    <div
      ref={menuRef}
      className={inlineMenu ? "glass-select-menu glass-select-menu-inline" : "glass-select-menu"}
      role="listbox"
      aria-label={ariaLabel}
      style={inlineMenu ? undefined : menuStyle}
    >
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
  ) : null;

  const menu = inlineMenu ? menuContent : open && mounted && menuContent ? createPortal(menuContent, document.body) : null;

  return (
    <>
      <div className="glass-select" style={style}>
        {name ? <input type="hidden" name={name} value={currentValue ?? ""} /> : null}
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className="glass-select-trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={toggle}
        >
          <span>{selected?.label ?? "Selecione"}</span>
          <span className="glass-select-arrow" aria-hidden="true" />
        </button>
        {inlineMenu ? menu : null}
      </div>
      {inlineMenu ? null : menu}
    </>
  );
}
