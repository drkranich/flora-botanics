"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createConversation } from "./inbox-actions";
import { CHANNEL_LABEL } from "./constants";
import { GlassSelect } from "@/components/GlassSelect";

const inputStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--c-text, var(--cream))",
  background: "rgba(255,255,255,0.06)",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.5)",
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

interface Props {
  /** Chamado após criação bem-sucedida (modo modal — sem botão próprio de abertura) */
  onSuccess?: () => void;
}

export function NewConversationForm({ onSuccess }: Props = {}) {
  // Se onSuccess não foi passado, o form abre/fecha a si mesmo (modo legado)
  const [openSelf, setOpenSelf] = useState(false);
  const isModal = typeof onSuccess === "function";
  const isVisible = isModal || openSelf;

  const [channel, setChannel] = useState("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Modo legado: botão próprio de abertura
  if (!isVisible) {
    return (
      <button type="button" onClick={() => setOpenSelf(true)} className="btn btn-gold" style={{ padding: "10px 20px", fontSize: 10 }}>
        + Nova conversa
      </button>
    );
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createConversation(
        formData.get("channel") as string,
        formData.get("contact_name") as string ?? "",
        formData.get("contact_handle") as string ?? "",
        formData.get("subject") as string ?? "",
        formData.get("body") as string ?? "",
      );
      if (res.ok) {
        if (onSuccess) {
          onSuccess();
        } else {
          setOpenSelf(false);
        }
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form action={submit} style={{ display: "grid", gap: 12 }}>
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
          <input id="new-contact-name" name="contact_name" type="text" placeholder="Ex: Ana Beatriz" style={inputStyle} />
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

      {channel === "email" && (
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="new-subject">Assunto</label>
          <input id="new-subject" name="subject" type="text" placeholder="Assunto do e-mail" style={inputStyle} />
        </div>
      )}

      <div style={fieldGroup}>
        <label style={labelStyle} htmlFor="new-body">Mensagem</label>
        <textarea
          id="new-body"
          name="body"
          required
          rows={4}
          placeholder="Digite a mensagem…"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      {channel !== "email" && (
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          Este canal ainda não está conectado — a conversa fica registrada na Inbox, mas o envio
          real será habilitado quando o canal for integrado (ver{" "}
          <Link href="/canais" style={{ color: "var(--c-gold, var(--gold-light))" }}>Canais</Link>).
        </p>
      )}

      {error && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "10px 20px", fontSize: 12 }}>
          {pending ? "Criando…" : "Criar conversa"}
        </button>
        <button
          type="button"
          onClick={() => isModal ? onSuccess?.() : setOpenSelf(false)}
          className="btn btn-ghost"
          style={{ padding: "10px 20px", fontSize: 12 }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
