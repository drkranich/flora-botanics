"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/backoffice", label: "Dashboard" },
  { href: "/backoffice/crm", label: "Pipeline CRM" },
  { href: "/backoffice/clientes", label: "Clientes" },
  { href: "/backoffice/pedidos", label: "Pedidos" },
  { href: "/backoffice/notas-fiscais", label: "Notas Fiscais" },
  { href: "/backoffice/marketplaces", label: "Marketplaces" },
  { href: "/backoffice/mensagens", label: "Mensagens" },
  { href: "/backoffice/logs", label: "Logs" },
  { href: "/backoffice/config", label: "Config fiscal" },
];

export function BackofficeTabs() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 28px 0" }}>
      {TABS.map((t) => {
        const active = t.href === "/backoffice" ? path === "/backoffice" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={active ? "btn btn-gold" : "btn btn-ghost"}
            style={{ padding: "9px 18px", fontSize: 10 }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
