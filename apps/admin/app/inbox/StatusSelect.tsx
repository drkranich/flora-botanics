"use client";

import { useTransition } from "react";
import { setConversationStatus } from "./actions";
import { CONVERSATION_STATUS_LABEL } from "./constants";

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 11,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10, 22, 11, 0.45)",
};

export function StatusSelect({ conversationId, status }: { conversationId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => setConversationStatus(conversationId, e.target.value))}
      style={selectStyle}
    >
      {Object.entries(CONVERSATION_STATUS_LABEL).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
