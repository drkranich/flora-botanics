"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { InboxSidebar } from "./InboxSidebar";
import { InboxList } from "./InboxList";
import { InboxDetail } from "./InboxDetail";
import { InboxContext } from "./InboxContext";
import { NewConversationForm } from "./NewConversationForm";
import type { InboxQueue } from "./inbox-actions";
import { getQueueCounts } from "./inbox-actions";

export default function InboxPage() {
  const [queue, setQueue] = useState<InboxQueue>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewConv, setShowNewConv] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [counts, setCounts] = useState<Record<InboxQueue, number>>({
    inbox: 0, mine: 0, unassigned: 0, urgent: 0,
    waiting_customer: 0, waiting_team: 0,
    resolved: 0, archived: 0, spam: 0, all: 0,
  });
  const [, startTransition] = useTransition();

  const loadCounts = useCallback(() => {
    startTransition(async () => {
      const res = await getQueueCounts();
      setCounts(res);
    });
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  function handleQueueChange(q: InboxQueue) {
    setQueue(q);
    setSelectedId(null);
  }

  function handleSelectConversation(id: string) {
    setSelectedId(id);
  }

  return (
    <div style={{
      display: "flex",
      height: "100dvh",
      width: "100%",
      overflow: "hidden",
      background: "linear-gradient(135deg, #080f09 0%, #0c1a0e 50%, #091208 100%)",
      position: "fixed",
      inset: 0,
      zIndex: 10,
    }}>
      {/* Coluna 1 — Filas (230px) */}
      <InboxSidebar
        active={queue}
        counts={counts}
        onSelect={handleQueueChange}
        onNew={() => setShowNewConv(true)}
      />

      {/* Coluna 2 — Lista de conversas (320px) */}
      <InboxList
        queue={queue}
        selectedId={selectedId}
        onSelect={handleSelectConversation}
        refreshKey={listRefreshKey}
      />

      {/* Coluna 3 — Detalhe (flex:1) */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <InboxDetail
          conversationId={selectedId}
          onStatusChange={() => { setListRefreshKey(k => k + 1); loadCounts(); }}
        />
      </div>

      {/* Coluna 4 — Contexto do contato (240px) */}
      <InboxContext
        conversationId={selectedId}
      />

      {/* Modal: nova conversa */}
      {showNewConv && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewConv(false); }}
        >
          <div style={{
            width: "min(480px, 90vw)",
            background: "rgba(12,26,14,0.97)",
            border: "1px solid rgba(242,236,223,0.1)",
            borderRadius: 18,
            padding: "28px 28px 24px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(185,146,77,0.1)",
            backdropFilter: "blur(24px)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{
                margin: 0, fontSize: 18,
                fontFamily: "Fraunces, serif",
                fontWeight: 600,
                color: "var(--cream)",
                letterSpacing: -0.4,
              }}>
                Nova conversa
              </h2>
              <button
                onClick={() => setShowNewConv(false)}
                style={{
                  background: "rgba(242,236,223,0.06)",
                  border: "1px solid rgba(242,236,223,0.1)",
                  borderRadius: 8,
                  color: "var(--cream-dim)", fontSize: 16,
                  cursor: "pointer", lineHeight: 1,
                  width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
            <NewConversationForm onSuccess={() => { setShowNewConv(false); loadCounts(); }} />
          </div>
        </div>
      )}
    </div>
  );
}
