"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConversation } from "./actions";
import { CHANNEL_LABEL } from "./constants";
import { GlassSelect } from "@/components/GlassSelect";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10, 22, 11, 0.45)",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--cream-dim)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const fieldGroup: React.CSSProperties = {
  display: "grid",
  gap: 4,
  flex: 1,
  minWidth: 160,
};

const CHANNELS = ["email", "whatsapp", "instagram", "sms", "site"];

export function NewConversationForm() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-gold" style={{ padding: "10px 20px", fontSize: 10 }}>
        + Nova conversa
      </button>
    );
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createConversation(formData);
      if (res.ok) {
        router.push(`/inbox/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form action={submit} style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="new-channel">Canal</label>
          <GlassSelect
            id="new-channel"
            name="channel"
            value={channel}
            onChange={(v) => setChannel(v)}
            options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] ?? c }))}
            ariaLabel="Canal"
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="new-contact-name">Nome do contato</label>
          <input id="new-contact-name" name="contact_name" type="text" placeholder="Ana Beatriz" style={inputStyle} />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="new-contact-handle">
            {channel === "email" ? "E-mail" : channel === "whatsapp" || channel === "sms" ? "Telefone" : "Contato"}
          </label>
          <input
            id="new-contact-handle"
            name="contact_handle"
            type={channel === "email" ? "email" : "text"}
            required
            placeholder={channel === "email" ? "cliente@email.com" : "@usuario ou telefone"}
            style={inputStyle}
          />
        </div>
      </div>

      {channel === "email" ? (
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="new-subject">Assunto</label>
          <input id="new-subject" name="subject" type="text" placeholder="Assunto do e-mail" style={inputStyle} />
        </div>
      ) : null}

      <div style={fieldGroup}>
        <label style={labelStyle} htmlFor="new-body">Mensagem</label>
        <textarea id="new-body" name="body" required rows={3} placeholder="Escreva a mensagem..." style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {channel !== "email" ? (
        <p className="muted" style={{ fontSize: 11, margin: 0 }}>
          Este canal ainda não está conectado — a conversa fica registrada na Inbox, mas o envio
          real será habilitado quando o canal for integrado (ver{" "}
          <Link href="/canais" style={{ color: "var(--gold-light)" }}>Canais</Link>).
        </p>
      ) : null}

      {error ? <p style={{ fontSize: 12, color: "#e8a0a0", margin: 0 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "10px 20px", fontSize: 10 }}>
          {pending ? "Criando…" : "Criar conversa"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ padding: "10px 20px", fontSize: 10 }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
