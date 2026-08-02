"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ConversationListItem, InboxQueue } from "./inbox-actions";
import { getConversations } from "./inbox-actions";
import { CHANNEL_LABEL, CONVERSATION_STATUS_LABEL, formatRelative } from "./constants";

const PRIORITY_DOT: Record<string, string> = {
  low: "#6b7280",
  normal: "#6b7280",
  high: "#f59e0b",
  urgent: "#ef4444",
  critical: "#dc2626",
};

const CHANNEL_ICONS: Record<string, string> = {
  email: "✉️",
  whatsapp: "💬",
  chat: "🌐",
  phone: "📞",
  instagram: "📷",
  facebook: "👥",
  sms: "📱",
};

interface Props {
  queue: InboxQueue;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function InboxList({ queue, selectedId, onSelect }: Props) {
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

  // Recarrega ao trocar fila
  useEffect(() => {
    setSearch("");
    load(queue);
  }, [queue]);

  // Debounce de busca
  useEffect(() => {
    const timer = setTimeout(() => load(queue, search || undefined), 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      width: 300,
      minWidth: 260,
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.015)",
      flexShrink: 0,
    }}>
      {/* Busca */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conversa…"
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "var(--c-text)",
            fontSize: 13,
            padding: "6px 10px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isPending && items.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            Carregando…
          </div>
        )}
        {!isPending && items.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            Nenhuma conversa.
          </div>
        )}
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const channelIcon = CHANNEL_ICONS[item.channel] ?? "💬";
          const priorityColor = PRIORITY_DOT[item.priority] ?? "#6b7280";
          const hasUnread = item.unread_count > 0;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                width: "100%",
                padding: "10px 14px",
                background: isSelected
                  ? "rgba(var(--c-gold-rgb,212,175,55),0.1)"
                  : hasUnread
                  ? "rgba(255,255,255,0.035)"
                  : "transparent",
                borderLeft: isSelected ? "3px solid var(--c-gold)" : "3px solid transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s",
              }}
            >
              {/* Linha 1: nome + horário */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{
                  width: 7, height: 7,
                  borderRadius: "50%",
                  background: priorityColor,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, opacity: 0.5 }}>{channelIcon}</span>
                <span style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: hasUnread ? 700 : 500,
                  color: "var(--c-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {item.contact_name || item.contact_handle || "Desconhecido"}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                  {item.last_message_at ? formatRelative(item.last_message_at) : ""}
                </span>
              </div>

              {/* Linha 2: assunto ou preview */}
              {(item.subject || item.last_message_preview) && (
                <span style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  paddingLeft: 12,
                }}>
                  {item.subject || item.last_message_preview}
                </span>
              )}

              {/* Linha 3: status + tags + badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 12 }}>
                <span style={{
                  fontSize: 10.5,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  color: "rgba(255,255,255,0.5)",
                }}>
                  {CONVERSATION_STATUS_LABEL[item.status as keyof typeof CONVERSATION_STATUS_LABEL] ?? item.status}
                </span>
                {item.tags?.slice(0, 2).map((tag) => (
                  <span key={tag} style={{
                    fontSize: 10.5,
                    background: "rgba(212,175,55,0.12)",
                    color: "var(--c-gold)",
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}>
                    {tag}
                  </span>
                ))}
                {hasUnread && (
                  <span style={{
                    marginLeft: "auto",
                    background: "var(--c-gold)",
                    color: "#000",
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    minWidth: 18,
                    textAlign: "center",
                  }}>
                    {item.unread_count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
