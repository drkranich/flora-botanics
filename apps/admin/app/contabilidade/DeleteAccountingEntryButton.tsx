"use client";

import { useState, useTransition } from "react";
import { deleteAccountingEntry } from "./actions";

export function DeleteAccountingEntryButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className="btn-icon"
        disabled={pending}
        title="Excluir lançamento"
        style={{ color: "#e8a0a0" }}
        onClick={() => {
          if (!confirm(`Excluir o lançamento "${label}"?`)) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteAccountingEntry(id);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro ao excluir.");
            }
          });
        }}
      >
        x
      </button>
      {error ? <small style={{ color: "#e8a0a0", fontSize: 10 }}>{error}</small> : null}
    </span>
  );
}
