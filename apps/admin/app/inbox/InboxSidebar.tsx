"use client";

import Link from "next/link";
import type { InboxQueue } from "./inbox-actions";

const QUEUES: { id: InboxQueue; label: string; icon: string; dot?: string }[] = [
  { id: "inbox",            label: "Caixa de entrada",   icon: "◉",  dot: "#d9b87a" },
  { id: "mine",             label: "Meus atendimentos",  icon: "◎",  dot: "#62c99d" },
  { id: "unassigned",       label: "Não atribuídos",     icon: "◌",  dot: "#7ea8d9" },
  { id: "urgent",           label: "Urgentes",            icon: "◈",  dot: "#e07b6a" },
  { id: "waiting_customer", label: "Aguardando cliente", icon: "◷",  dot: "#f0b429" },
  { id: "waiting_team",     label: "Aguardando equipe",  icon: "◶",  dot: "#a78bfa" },
  { id: "resolved",         label: "Resolvidos",          icon: "✦",  dot: "#4ade80" },
  { id: "archived",         label: "Arquivados",          icon: "◫",  dot: "#6b7280" },
  { id: "spam",             label: "Spam",                icon: "⊘",  dot: "#ef4444" },
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
      width: 230,
      minWidth: 200,
      display: "flex",
      flexDirection: "column",
      background: "rgba(10,22,11,0.72)",
      backdropFilter: "blur(24px) saturate(1.4)",
      WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      borderRight: "1px solid rgba(242,236,223,0.08)",
      flexShrink: 0,
      overflow: "hidden",
    }}>

      {/* Logo */}
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 10,
          textDecoration: "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(185,146,77,0.3), rgba(185,146,77,0.1))",
            border: "1px solid rgba(185,146,77,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: "var(--gold-light)", fontWeight: 800,
            letterSpacing: -1, flexShrink: 0,
          }}>
            ✦
          </div>
          <div>
            <div style={{
              fontFamily: "Fraunces, serif",
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: -0.5,
              color: "var(--cream)",
              lineHeight: 1,
            }}>
              FL<span style={{ color: "var(--gold-light)" }}>•</span>RA
            </div>
            <div style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--cream-dim)",
              marginTop: 2,
            }}>
              Atendimento
            </div>
          </div>
        </Link>
      </div>

      {/* Botão nova conversa */}
      <div style={{ padding: "14px 16px 10px" }}>
        <button
          onClick={onNew}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
            border: "none",
            borderRadius: 10,
            color: "var(--forest-950)",
            cursor: "pointer",
            fontFamily: "Manrope, sans-serif",
            fontWeight: 800,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            padding: "10px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            boxShadow: "0 4px 16px rgba(185,146,77,0.3)",
            transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          Nova conversa
        </button>
      </div>

      {/* Label seção */}
      <div style={{
        padding: "8px 20px 6px",
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 2.2,
          textTransform: "uppercase",
          color: "var(--cream-dim)",
          opacity: 0.6,
        }}>
          Filas
        </span>
      </div>

      {/* Lista de filas */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
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
                gap: 10,
                width: "100%",
                padding: "8px 12px",
                marginBottom: 2,
                background: isActive
                  ? "rgba(185,146,77,0.13)"
                  : "transparent",
                border: "1px solid",
                borderColor: isActive
                  ? "rgba(185,146,77,0.28)"
                  : "transparent",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(242,236,223,0.05)";
                  e.currentTarget.style.borderColor = "rgba(242,236,223,0.08)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
            >
              {/* Dot de cor */}
              <span style={{
                width: 7, height: 7,
                borderRadius: "50%",
                background: q.dot ?? "#6b7280",
                flexShrink: 0,
                boxShadow: isActive ? `0 0 6px ${q.dot ?? "#6b7280"}88` : "none",
              }} />

              {/* Label */}
              <span style={{
                flex: 1,
                fontFamily: "Manrope, sans-serif",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--cream)" : "var(--cream-soft)",
                letterSpacing: 0.1,
              }}>
                {q.label}
              </span>

              {/* Badge */}
              {badge > 0 && (
                <span style={{
                  background: isActive
                    ? "linear-gradient(135deg, var(--gold-light), var(--gold))"
                    : "rgba(242,236,223,0.1)",
                  color: isActive ? "var(--forest-950)" : "var(--cream-dim)",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 7px",
                  minWidth: 22,
                  textAlign: "center",
                  flexShrink: 0,
                }}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div style={{
        padding: "10px 16px 14px",
        borderTop: "1px solid rgba(242,236,223,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <Link
          href="/inbox/equipe"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "var(--cream-dim)",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--gold-light)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--cream-dim)")}
        >
          <span style={{ fontSize: 11 }}>◎</span>
          Equipe
        </Link>
        <Link
          href="/inbox/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "var(--cream-dim)",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--gold-light)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--cream-dim)")}
        >
          <span style={{ fontSize: 11 }}>◈</span>
          Dashboard
        </Link>
        <Link
          href="/inbox/pipeline"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "var(--cream-dim)",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--gold-light)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--cream-dim)")}
        >
          <span style={{ fontSize: 11 }}>⬡</span>
          Pipeline CRM
        </Link>
        <Link
          href="/inbox/clientes"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "var(--cream-dim)",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--gold-light)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--cream-dim)")}
        >
          <span style={{ fontSize: 11 }}>◉</span>
          Clientes
        </Link>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "var(--cream-dim)",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--gold-light)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--cream-dim)")}
        >
          <span style={{ fontSize: 12 }}>←</span>
          Voltar ao painel
        </Link>
      </div>
    </aside>
  );
}
