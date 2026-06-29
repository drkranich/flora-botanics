"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { sendEmail, textToHtml } from "@/lib/email/resend";

export type MessageActionResult = { ok: true } | { ok: false; error: string };
export type CreateConversationResult = { ok: true; id: string } | { ok: false; error: string };

const VALID_CHANNELS = ["email", "whatsapp", "instagram", "sms", "site"];
const VALID_STATUSES = ["new", "open", "waiting", "resolved"];

/**
 * Cria uma nova conversa + primeira mensagem (direction "out").
 * Se o canal for "email", também envia de fato via Resend para
 * contact_handle (precisa ser um e-mail válido).
 */
export async function createConversation(formData: FormData): Promise<CreateConversationResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const channel = String(formData.get("channel") ?? "email");
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactHandle = String(formData.get("contact_handle") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!VALID_CHANNELS.includes(channel)) return { ok: false, error: "Canal inválido." };
  if (!contactHandle) return { ok: false, error: "Informe o contato (e-mail, telefone ou @usuário)." };
  if (!body) return { ok: false, error: "Mensagem vazia." };

  const supabase = await createClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({
      tenant_id: staff.tenantId,
      channel,
      contact_name: contactName || null,
      contact_handle: contactHandle,
      status: "open",
      last_message_preview: body.slice(0, 140),
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (convError || !conversation) {
    return { ok: false, error: convError?.message ?? "Não foi possível criar a conversa." };
  }

  const { error: msgError } = await supabase.from("messages").insert({
    tenant_id: staff.tenantId,
    conversation_id: conversation.id,
    direction: "out",
    sender_name: staff.fullName ?? staff.email,
    body,
  });

  if (msgError) return { ok: false, error: msgError.message };

  if (channel === "email") {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", staff.tenantId).maybeSingle();
    const result = await sendEmail({
      to: contactHandle,
      subject: subject || `Mensagem de ${tenant?.name ?? "Flora Botanics"}`,
      html: textToHtml(body),
      text: body,
    });
    if (!result.ok) {
      // a conversa e a mensagem já foram registradas; sinaliza o erro de envio
      revalidatePath("/inbox");
      return { ok: false, error: `Conversa criada, mas o e-mail não foi enviado: ${result.error}` };
    }
  }

  revalidatePath("/inbox");
  return { ok: true, id: conversation.id };
}

/**
 * Envia uma resposta numa conversa existente (direction "out"). Para
 * conversas de e-mail, também dispara o envio real via Resend para
 * contact_handle.
 */
export async function sendMessage(conversationId: string, formData: FormData): Promise<MessageActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Mensagem vazia." };

  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, channel, contact_handle, contact_name")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!conversation) return { ok: false, error: "Conversa não encontrada." };

  const { error: msgError } = await supabase.from("messages").insert({
    tenant_id: staff.tenantId,
    conversation_id: conversationId,
    direction: "out",
    sender_name: staff.fullName ?? staff.email,
    body,
  });

  if (msgError) return { ok: false, error: msgError.message };

  await supabase
    .from("conversations")
    .update({
      last_message_preview: body.slice(0, 140),
      last_message_at: new Date().toISOString(),
      status: "open",
    })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

  if (conversation.channel === "email" && conversation.contact_handle) {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", staff.tenantId).maybeSingle();
    const result = await sendEmail({
      to: conversation.contact_handle,
      subject: `Re: conversa com ${tenant?.name ?? "Flora Botanics"}`,
      html: textToHtml(body),
      text: body,
    });
    if (!result.ok) {
      revalidatePath(`/inbox/${conversationId}`);
      return { ok: false, error: `Mensagem registrada, mas o e-mail não foi enviado: ${result.error}` };
    }
  }

  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
  return { ok: true };
}

/** Atualiza o status de uma conversa (new/open/waiting/resolved). */
export async function setConversationStatus(conversationId: string, status: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
}

export async function updateConversation(conversationId: string, formData: FormData): Promise<MessageActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactHandle = String(formData.get("contact_handle") ?? "").trim();
  const status = String(formData.get("status") ?? "open");
  const tagsRaw = String(formData.get("tags") ?? "").trim();

  if (!contactHandle) return { ok: false, error: "Informe o contato da conversa." };
  if (!VALID_STATUSES.includes(status)) return { ok: false, error: "Status inválido." };

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({
      contact_name: contactName || null,
      contact_handle: contactHandle,
      status,
      tags,
    })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function deleteConversation(conversationId: string): Promise<MessageActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/inbox");
  return { ok: true };
}
