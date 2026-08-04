"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ConversationListItem, InboxQueue } from "./inbox-actions";
import { getConversations } from "./inbox-actions";
import { formatRelative } from "./constants";

const PRIORITY_COLOR: Record<string, string> = {
  low:      "#4ade80",
  normal:   "rgba(242,236,223,0.25)",
  high:     "#f0b429",
  urgent:   "#fb923c",
  critical: "#ef4444",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente", critical: "Crítica",
};

const CHANNEL_ICON: Record<string, string> = {
  email:     "✉",
  whatsapp:  "◎",
  chat:      "◉",
  phone:     "◈",
  instagram: "◌",
  facebook:  "◫",
  sms:       "◷",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Novo", open: "Em atendimento", waiting: "Aguardando",
  waiting_customer: "Ag. cliente", waiting_team: "Ag. equipe",
  resolved: "Resolvido", closed: "Fechado", archived: "Arquivado", spam: "Spam",
};

const STATUS_COLOR: Record<string, string> = {
  new: "#7ea8d9", open: "#62c99d", waiting: "#f0b429",
  waiting_customer: "#f0b429", waiting_team: "#a78bfa",
  resolved: "#4ade80", closed: "#6b7280", archived: "#374151", spam: "#ef4444",
};

interface Props {
  queue: InboxQueue;
  selectedId: string | null;
  onSelect: (id: string) => void;
  refreshKey?: number;
}

export function InboxList({ queue, selectedId, onSelect, refreshKey }: Props) {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef(search);
  searchRef.current = search;

  function load(q: InboxQueue, s?: string) {
    startTransition(async () => {
      const res = await getConversations(q, s);
      setItems(res);
    });
  }

  useEffect(() => { setSearch(""); load(queue); }, [queue]);
  useEffect(() => { if (refreshKey) load(queue, searchRef.current || undefined); }, [refreshKey]); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => load(queue, search || undefined), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const queueLabels: Record<InboxQueue, string> = {
    inbox: "Caixa de entrada", mine: "Meus atendimentos",
    unassigned: "Não atribuídos", urgent: "Urgentes",
    waiting_customer: "Aguardando cliente", waiting_team: "Aguardando equipe",
    resolved: "Resolvidos", archived: "Arquivados", spam: "Spam", all: "Todos",
    ch_whatsapp: "WhatsApp", ch_instagram: "Instagram",
    ch_email: "E-mail", ch_chat: "Chat",
  };

  return (
    <div style={{
      width: 320,
      minWidth: 280,
      display: "flex",
      flexDirection: "column",
      background: "rgba(15,32,18,0.55)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRight: "1px solid rgba(242,236,223,0.07)",
      flexShrink: 0,
    }}>

      {/* Header da lista */}
      <div style={{
        padding: "18px 18px 12px",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
      }}>
        <div style={{
          fontFamily: "Fraunces, serif",
          fontSize: 17,
          fontWeight: 500,
          color: "var(--cream)",
          letterSpacing: -0.3,
          marginBottom: 10,
        }}>
          {queueLabels[queue]}
        </div>

        {/* Busca */}
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
            fontSize: 12, color: "var(--cream-dim)", pointerEvents: "none",
          }}>
            ⌕
          </span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa…"
            style={{
              width: "100%",
              background: "rgba(10,22,11,0.6)",
              border: "1px solid rgba(242,236,223,0.1)",
              borderRadius: 9,
              color: "var(--cream)",
              fontSize: 12.5,
              padding: "7px 11px 7px 30px",
              outline: "none",
              fontFamily: "Manrope, sans-serif",
              transition: "border-color 0.2s",
              boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(185,146,77,0.45)")}
            onBlur={e => (e.target.style.borderColor = "rgba(242,236,223,0.1)")}
          />
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isPending && items.length === 0 && (
          <div style={{
            padding: "48px 24px",
            textAlign: "center",
            color: "var(--cream-dim)",
            fontSize: 12.5,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>◌</div>
            Carregando…
          </div>
        )}

        {!isPending && items.length === 0 && (
          <div style={{
            padding: "48px 24px",
            textAlign: "center",
          }}>
            <div style={{
              fontSize: 32,
              marginBottom: 14,
              color: "var(--gold-light)",
              opacity: 0.35,
              fontFamily: "Fraunces, serif",
            }}>
              ✦
            </div>
            <p style={{
              fontSize: 13,
              color: "var(--cream-soft)",
              fontFamily: "Fraunces, serif",
              fontStyle: "italic",
              marginBottom: 6,
            }}>
              Nenhum atendimento aqui
            </p>
            <p style={{ fontSize: 11, color: "var(--cream-dim)" }}>
              Esta fila está vazia no momento.
            </p>
          </div>
        )}

        {items.map(item => {
          const isSelected = item.id === selectedId;
          const hasUnread  = item.unread_count > 0;
          const pColor     = PRIORITY_COLOR[item.priority] ?? PRIORITY_COLOR.normal;
          const sColor     = STATUS_COLOR[item.status] ?? "#6b7280";
          const chIcon     = CHANNEL_ICON[item.channel] ?? "◉";
          const initials   = (item.contact_name ?? item.contact_handle ?? "?")
            .split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase();

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                display: "block",
                width: "100%",
                padding: "13px 16px",
                background: isSelected
                  ? "rgba(185,146,77,0.1)"
                  : hasUnread
                  ? "rgba(242,236,223,0.03)"
                  : "transparent",
                borderLeft: `3px solid ${isSelected ? "var(--gold)" : "transparent"}`,
                borderTop: "none",
                borderRight: "none",
                borderBottom: "1px solid rgba(242,236,223,0.05)",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = "rgba(242,236,223,0.04)";
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.background = hasUnread ? "rgba(242,236,223,0.03)" : "transparent";
              }}
            >
              {/* Linha 1: avatar + nome + horário */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34,
                  borderRadius: 10,
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(185,146,77,0.3), rgba(185,146,77,0.1))"
                    : "rgba(242,236,223,0.07)",
                  border: `1px solid ${isSelected ? "rgba(185,146,77,0.3)" : "rgba(242,236,223,0.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  color: isSelected ? "var(--gold-light)" : "var(--cream-dim)",
                  flexShrink: 0,
                  fontFamily: "Manrope, sans-serif",
                }}>
                  {initials || chIcon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Nome */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: hasUnread ? 700 : 600,
                      color: "var(--cream)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "Manrope, sans-serif",
                    }}>
                      {item.contact_name || item.contact_handle || "Desconhecido"}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: "var(--cream-dim)",
                      flexShrink: 0,
                      fontFamily: "Manrope, sans-serif",
                    }}>
                      {item.last_message_at ? formatRelative(item.last_message_at) : ""}
                    </span>
                  </div>

                  {/* Preview */}
                  {item.last_message_preview && (
                    <div style={{
                      fontSize: 11.5,
                      color: "var(--cream-dim)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginTop: 2,
                      fontFamily: "Manrope, sans-serif",
                    }}>
                      {item.last_message_preview}
                    </div>
                  )}
                </div>
              </div>

              {/* Linha 2: canal + status + prioridade + badge */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 8,
                paddingLeft: 44,
              }}>
                {/* Canal */}
                <span style={{
                  fontSize: 9.5,
                  background: "rgba(242,236,223,0.07)",
                  border: "1px solid rgba(242,236,223,0.1)",
                  borderRadius: 5,
                  padding: "2px 6px",
                  color: "var(--cream-dim)",
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}>
                  {chIcon} {item.channel}
                </span>

                {/* Status */}
                <span style={{
                  fontSize: 9.5,
                  background: `${sColor}18`,
                  border: `1px solid ${sColor}35`,
                  borderRadius: 5,
                  padding: "2px 6px",
                  color: sColor,
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: 600,
                }}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>

                {/* Prioridade — só se não for normal */}
                {item.priority !== "normal" && (
                  <span style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 9.5,
                    color: pColor,
                    fontFamily: "Manrope, sans-serif",
                    fontWeight: 700,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: pColor,
                      boxShadow: `0 0 5px ${pColor}`,
                    }} />
                    {PRIORITY_LABEL[item.priority]}
                  </span>
                )}

                {/* Spacer */}
                <span style={{ flex: 1 }} />

                {/* Badge não lidos */}
                {hasUnread && (
                  <span style={{
                    background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
                    color: "var(--forest-950)",
                    borderRadius: 6,
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "2px 6px",
                    minWidth: 20,
                    textAlign: "center",
                    fontFamily: "Manrope, sans-serif",
                  }}>
                    {item.unread_count}
                  </span>
                )}

                {/* Tags */}
                {item.tags?.slice(0, 1).map(tag => (
                  <span key={tag} style={{
                    fontSize: 9,
                    background: "rgba(185,146,77,0.12)",
                    border: "1px solid rgba(185,146,77,0.25)",
                    color: "var(--gold-light)",
                    borderRadius: 5,
                    padding: "2px 6px",
                    fontWeight: 600,
                    fontFamily: "Manrope, sans-serif",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
