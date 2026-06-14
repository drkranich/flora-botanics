"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/mensagens", label: "Mensagens" },
  { href: "/marketplaces", label: "Marketplaces" },
  { href: "/notas-fiscais", label: "Notas Fiscais" },
  { href: "/logs", label: "Logs" },
  { href: "/config", label: "Configurações" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 16,
        borderRight: "1px solid #e6ddc9",
        minHeight: "100vh",
      }}
    >
      <div style={{ fontWeight: 900, letterSpacing: -1, padding: "8px 12px 16px" }}>
        FLORA · ADMIN
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              textDecoration: "none",
              color: "#28251d",
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              background: active ? "#e6ddc9" : "transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
