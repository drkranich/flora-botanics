"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/catalogo", label: "Produtos" },
  { href: "/catalogo/categorias", label: "Categorias" },
];

export function CatalogTabs() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", gap: 8, marginBottom: 26 }}>
      {TABS.map((t) => {
        const active = t.href === "/catalogo" ? path === "/catalogo" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={active ? "btn btn-gold" : "btn btn-ghost"}
            style={{ padding: "9px 20px", fontSize: 10 }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
