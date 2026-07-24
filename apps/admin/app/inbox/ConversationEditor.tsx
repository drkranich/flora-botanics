"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteConversation, updateConversation } from "./actions";
import { CONVERSATION_STATUS_LABEL } from "./constants";
import { GlassSelect } from "@/components/GlassSelect";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10, 22, 11, 0.45)",
  width: "100%",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--cream-dim)",
};

export function ConversationEditor({
  conversation,
}: {
  conversation: {
    id: string;
    contact_name: string | null;
    contact_handle: string | null;
    status: string;
    tags: string[];
  };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateConversation(conversation.id, formData);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove() {
    if (!confirm("Excluir esta conversa e todas as mensagens vinculadas?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteConversation(conversation.id);
      if (res.ok) {
        router.push("/inbox");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen((v) => !v)} style={{ padding: "8px 14px", fontSize: 10 }}>
          {open ? "Fechar edição" : "Editar conversa"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={remove}
          style={{ padding: "8px 14px", fontSize: 10, color: "#e8a0a0", borderColor: "rgba(232,160,160,0.35)" }}
        >
          Excluir
        </button>
      </div>

      {open ? (
        <form
          action={submit}
          className="glass"
          style={{
            width: "min(460px, 100%)",
            padding: 16,
            display: "grid",
            gap: 12,
            background: "rgba(255, 248, 234, 0.05)",
          }}
        >
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="conversation-name">Nome</label>
            <input id="conversation-name" name="contact_name" defaultValue={conversation.contact_name ?? ""} style={inputStyle} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="conversation-handle">Contato</label>
            <input id="conversation-handle" name="contact_handle" required defaultValue={conversation.contact_handle ?? ""} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="conversation-status">Status</label>
              <GlassSelect
                id="conversation-status"
                name="status"
                defaultValue={conversation.status}
                options={Object.entries(CONVERSATION_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
                ariaLabel="Status"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="conversation-tags">Tags</label>
              <input id="conversation-tags" name="tags" defaultValue={conversation.tags.join(", ")} placeholder="vip, troca" style={inputStyle} />
            </div>
          </div>

          {error ? <p style={{ margin: 0, fontSize: 12, color: "#e8a0a0" }}>{error}</p> : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} style={{ padding: "9px 14px", fontSize: 10 }}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "9px 16px", fontSize: 10 }}>
              {pending ? "Salvando..." : "Salvar conversa"}
            </button>
          </div>
        </form>
      ) : error ? (
        <p style={{ margin: 0, fontSize: 12, color: "#e8a0a0" }}>{error}</p>
      ) : null}
    </div>
  );
}
