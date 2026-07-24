"use client";

import { useTransition } from "react";
import { setConversationStatus } from "./actions";
import { CONVERSATION_STATUS_LABEL } from "./constants";
import { GlassSelect } from "@/components/GlassSelect";

export function StatusSelect({ conversationId, status }: { conversationId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <GlassSelect
      value={status}
      disabled={pending}
      onChange={(v) => startTransition(() => setConversationStatus(conversationId, v))}
      options={Object.entries(CONVERSATION_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
      ariaLabel="Status da conversa"
    />
  );
}
