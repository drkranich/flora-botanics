"use client";

import { useMemo, useState } from "react";

type CatalogDropdownOption = {
  value: string;
  label: string;
};

export function CatalogDropdown({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options: ReadonlyArray<CatalogDropdownOption>;
}) {
  const [selected, setSelected] = useState(value);
  const [open, setOpen] = useState(false);

  const current = useMemo(
    () => options.find((option) => option.value === selected) ?? options[0],
    [options, selected]
  );

  return (
    <div
      className="catalog-dropdown"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setOpen(false);
        }
      }}
    >
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        className="catalog-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span>{current?.label ?? "Selecionar"}</span>
        <i aria-hidden />
      </button>

      {open ? (
        <div className="catalog-dropdown-menu" role="listbox" tabIndex={-1}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected === option.value}
              className={selected === option.value ? "is-selected" : undefined}
              onClick={() => {
                setSelected(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
