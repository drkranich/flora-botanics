"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const [mounted, setMounted] = useState(false);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const selected = options.find((o) => o.value === currentValue) ?? options[0];

  // Mesmo quando a tela pede inlineMenu, o menu usa portal para escapar de cards,
  // tabelas, drawers e painéis com backdrop-filter/overflow.
  void inlineMenu;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (
        !triggerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
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

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const menuHeight = Math.min(260, options.length * 38 + 12);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 10 && rect.top > menuHeight;
    const width = Math.max(180, rect.width);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding
    );

    setMenuStyle({
      position: "fixed",
      zIndex: 2147483646,
      left,
      width,
      ...(openUp
        ? { top: "auto", bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4, bottom: "auto" }),
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  function toggle() {
    if (!open) updateMenuPosition();
    setOpen((visible) => !visible);
  }

  function choose(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  const menuContent = open ? (
    <div
      ref={menuRef}
      className="glass-select-menu"
      role="listbox"
      aria-label={ariaLabel}
      style={menuStyle}
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

  const menu = open && mounted && menuContent ? createPortal(menuContent, document.body) : null;

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
      </div>
      {menu}
    </>
  );
}
