"use client";

import Link from "next/link";
import type { InboxQueue } from "./inbox-actions";

const QUEUES: { id: InboxQueue; label: string; icon: string }[] = [
  { id: "inbox",           label: "Caixa de entrada",    icon: "📥" },
  { id: "mine",            label: "Meus atendimentos",   icon: "👤" },
  { id: "unassigned",      label: "Não atribuídos",      icon: "🔵" },
  { id: "urgent",          label: "Urgentes",             icon: "🔴" },
  { id: "waiting_customer",label: "Aguardando cliente",  icon: "⏳" },
  { id: "waiting_team",    label: "Aguardando equipe",   icon: "🕐" },
  { id: "resolved",        label: "Resolvidos",           icon: "✅" },
  { id: "archived",        label: "Arquivados",           icon: "📦" },
  { id: "spam",            label: "Spam",                 icon: "🚫" },
];

interface Props {
  active: InboxQueue;
  counts: Record<InboxQueue, number>;
  onSelect: (q: InboxQueue) => void;
  onNew: () => void;
}

export function InboxSidebar({ active, counts, onSelect, onNew }: Props) {
  return (
    <aside style={{
      width: 220,
      minWidth: 180,
      borderRight: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      padding: "16px 0",
      background: "rgba(255,255,255,0.02)",
      flexShrink: 0,
    }}>
      {/* Logo / Voltar */}
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          <span>←</span>
          <span style={{ fontWeight: 700, letterSpacing: -1, fontSize: 16, color: "var(--c-text)" }}>
            FL<span style={{ color: "var(--c-gold, var(--gold-light))" }}>•</span>RA
          </span>
        </Link>
      </div>

      {/* Header */}
      <div style={{ padding: "10px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", letterSpacing: 0.3, textTransform: "uppercase", opacity: 0.7 }}>
          Atendimento
        </span>
        <button
          onClick={onNew}
          title="Nova conversa"
          style={{
            background: "var(--c-gold)",
            border: "none",
            borderRadius: 6,
            color: "#000",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 16,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>

      {/* Filas */}
      <nav style={{ flex: 1, overflowY: "auto" }}>
        {QUEUES.map((q) => {
          const isActive = active === q.id;
          const badge = counts[q.id] ?? 0;
          return (
            <button
              key={q.id}
              onClick={() => onSelect(q.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 16px",
                background: isActive ? "rgba(var(--c-gold-rgb,212,175,55),0.12)" : "transparent",
                borderLeft: isActive ? "3px solid var(--c-gold)" : "3px solid transparent",
                border: "none",
                borderRadius: 0,
                cursor: "pointer",
                textAlign: "left",
                color: isActive ? "var(--c-gold)" : "var(--c-text)",
                fontWeight: isActive ? 600 : 400,
                fontSize: 13.5,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 14 }}>{q.icon}</span>
              <span style={{ flex: 1 }}>{q.label}</span>
              {badge > 0 && (
                <span style={{
                  background: isActive ? "var(--c-gold)" : "rgba(255,255,255,0.15)",
                  color: isActive ? "#000" : "var(--c-text)",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 6px",
                  minWidth: 20,
                  textAlign: "center",
                }}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
