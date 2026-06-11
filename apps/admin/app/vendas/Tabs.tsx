"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/vendas", label: "Pedidos" },
  { href: "/vendas/clientes", label: "Clientes" },
  { href: "/vendas/cupons", label: "Cupons" },
];

export function SalesTabs() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", gap: 8, marginBottom: 26 }}>
      {TABS.map((t) => {
        const active =
          t.href === "/vendas" ? path === "/vendas" || /^\/vendas\/[0-9a-f-]{36}/.test(path) : path.startsWith(t.href);
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

export const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em separação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

export function StatusChip({ status }: { status: string }) {
  const live = ["paid", "processing", "shipped", "delivered"].includes(status);
  return (
    <span className={`chip ${live ? "chip-live" : "chip-draft"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}
