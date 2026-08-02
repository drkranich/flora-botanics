"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { InboxSidebar } from "./InboxSidebar";
import { InboxList } from "./InboxList";
import { InboxDetail } from "./InboxDetail";
import { NewConversationForm } from "./NewConversationForm";
import type { InboxQueue } from "./inbox-actions";
import { getQueueCounts } from "./inbox-actions";

export default function InboxPage() {
  const [queue, setQueue] = useState<InboxQueue>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewConv, setShowNewConv] = useState(false);
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

  return (
    <div style={{
      display: "flex",
      height: "100dvh",
      width: "100%",
      overflow: "hidden",
      background: "var(--c-bg, #0f0f11)",
      position: "fixed",
      inset: 0,
      zIndex: 10,
    }}>
      {/* Coluna 1 — Filas */}
      <InboxSidebar
        active={queue}
        counts={counts}
        onSelect={handleQueueChange}
        onNew={() => setShowNewConv(true)}
      />

      {/* Coluna 2 — Lista de conversas */}
      <InboxList
        queue={queue}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Coluna 3 — Detalhe */}
      <InboxDetail conversationId={selectedId} />

      {/* Modal: nova conversa */}
      {showNewConv && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewConv(false); }}
        >
          <div style={{
            width: "min(480px, 90vw)",
            background: "var(--c-glass, rgba(18,18,22,0.98))",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "28px 28px 24px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--c-text)" }}>
                Nova conversa
              </h2>
              <button
                onClick={() => setShowNewConv(false)}
                style={{
                  background: "transparent", border: "none",
                  color: "rgba(255,255,255,0.5)", fontSize: 20,
                  cursor: "pointer", lineHeight: 1,
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
