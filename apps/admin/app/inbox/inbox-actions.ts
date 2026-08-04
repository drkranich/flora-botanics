"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { sendEmail, textToHtml } from "@/lib/email/resend";

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type InboxQueue =
  | "inbox"
  | "mine"
  | "unassigned"
  | "urgent"
  | "waiting_customer"
  | "waiting_team"
  | "resolved"
  | "archived"
  | "spam"
  | "all"
  | "ch_whatsapp"
  | "ch_instagram"
  | "ch_email"
  | "ch_chat";

export type InboxPriority = "low" | "normal" | "high" | "urgent" | "critical";
export type InboxStatus =
  | "new" | "open" | "triaging" | "assigned" | "in_progress"
  | "waiting_customer" | "waiting_team" | "waiting_third_party"
  | "escalated" | "resolved" | "closed" | "archived" | "spam";

export interface ConversationListItem {
  id: string;
  number: number;
  channel: string;
  contact_name: string | null;
  contact_handle: string | null;
  subject: string | null;
  category: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  team: string | null;
  unread_count: number;
  message_count: number;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  has_attachments: boolean;
  tags: string[];
  order_id: string | null;
  created_at: string;
  sla_state: string | null;
  first_response_due_at: string | null;
}

export interface ConversationDetail extends ConversationListItem {
  contact_email: string | null;
  contact_phone: string | null;
  origin: string | null;
  source_url: string | null;
  sentiment: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface MessageRow {
  id: string;
  type: string;
  sender_id: string | null;
  sender_name: string;
  sender_is_contact: boolean;
  body: string;
  is_internal_note: boolean;
  event_type: string | null;
  event_payload: Record<string, unknown>;
  has_attachments: boolean;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type TimelineKind = "message" | "note" | "event";

export interface TimelineAttachment {
  url:  string;
  name: string;
  type: string;
  size: number;
}

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  // mensagem
  sender_name?: string;
  sender_is_contact?: boolean;
  body?: string;
  is_internal_note?: boolean;
  attachments?: TimelineAttachment[];
  // evento
  event_type?: string;
  event_label?: string;
  event_meta?: string;
  // media WA/IG
  media_type?: "image" | "audio" | "video" | "document" | "sticker";
  media_url?: string;
  created_at: string;
}

// ── Filas ─────────────────────────────────────────────────────────────────────

function queueFilter(queue: InboxQueue, userId: string) {
  switch (queue) {
    case "inbox":            return { status_in: ["new","open","triaging","assigned","in_progress"] };
    case "mine":             return { assignee_id: userId, status_in: ["new","open","triaging","assigned","in_progress","waiting_customer","waiting_team"] };
    case "unassigned":       return { assignee_id: null,  status_in: ["new","open","triaging","in_progress"] };
    case "urgent":           return { status_in: ["urgent"] };
    case "waiting_customer": return { status_in: ["waiting_customer"] };
    case "waiting_team":     return { status_in: ["waiting_team","waiting_third_party","waiting_payment","waiting_logistics","waiting_stock","waiting_financial","waiting_fiscal"] };
    case "resolved":         return { status_in: ["resolved","closed"] };
    case "archived":         return { status_in: ["archived"] };
    case "spam":             return { status_in: ["spam"] };
    case "ch_whatsapp":      return { channel: "whatsapp" };
    case "ch_instagram":     return { channel: "instagram" };
    case "ch_email":         return { channel: "email" };
    case "ch_chat":          return { channel: "chat" };
    default:                 return {};
  }
}

// ── Buscar lista de conversas ─────────────────────────────────────────────────

export async function getConversations(
  queue: InboxQueue = "inbox",
  search?: string,
): Promise<ConversationListItem[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const filters  = queueFilter(queue, staff.id);

  let q = supabase
    .from("helpdesk_conversations")
    .select(`
      id, number, channel, status, priority,
      contact_name, contact_email, contact_phone,
      subject, category, tags,
      assignee_id, team,
      unread_count, message_count,
      last_message_preview, last_message_at, last_message_direction,
      has_attachments, order_id,
      sla_state, first_response_due_at,
      created_at,
      helpdesk_contacts!contact_id ( name, email, phone, whatsapp )
    `)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null);

  // Filtro de canal
  if ("channel" in filters && filters.channel) {
    q = q.eq("channel", filters.channel as string);
  }

  // Filtros de status
  if ("status_in" in filters && filters.status_in) {
    const statuses = filters.status_in as string[];
    if (statuses.length === 1) {
      q = q.eq("status", statuses[0]);
    } else {
      q = q.in("status", statuses);
    }
  }

  // Filtro de prioridade
  if ("priority_in" in filters && filters.priority_in) {
    q = q.in("priority", filters.priority_in as string[]);
  }

  // Filtro de assignee
  if ("assignee_id" in filters) {
    if (filters.assignee_id === null) {
      q = q.is("assignee_id", null);
    } else {
      q = q.eq("assignee_id", filters.assignee_id as string);
    }
  }

  // Busca textual
  if (search?.trim()) {
    const s = search.trim();
    q = q.or(`contact_name.ilike.%${s}%,contact_email.ilike.%${s}%,last_message_preview.ilike.%${s}%,subject.ilike.%${s}%`);
  }

  const { data } = await q
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(60);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const contact = (row.helpdesk_contacts as Record<string, unknown> | null);
    return {
      id:                     row.id as string,
      number:                 (row.number as number) ?? 0,
      channel:                row.channel as string,
      contact_name:           (row.contact_name as string | null) ?? (contact?.name as string | null) ?? null,
      contact_handle:         (row.contact_email as string | null) ?? (contact?.email as string | null) ?? (contact?.phone as string | null) ?? null,
      subject:                row.subject as string | null,
      category:               row.category as string | null,
      status:                 row.status as string,
      priority:               (row.priority as string) ?? "normal",
      assignee_id:            row.assignee_id as string | null,
      assignee_name:          null,
      team:                   row.team as string | null,
      unread_count:           (row.unread_count as number) ?? 0,
      message_count:          (row.message_count as number) ?? 0,
      last_message_preview:   row.last_message_preview as string | null,
      last_message_at:        row.last_message_at as string | null,
      last_message_direction: row.last_message_direction as string | null,
      has_attachments:        (row.has_attachments as boolean) ?? false,
      tags:                   (row.tags as string[]) ?? [],
      order_id:               row.order_id as string | null,
      created_at:             row.created_at as string,
      sla_state:              row.sla_state as string | null,
      first_response_due_at:  row.first_response_due_at as string | null,
    };
  });
}

// ── Buscar detalhe de uma conversa ───────────────────────────────────────────

export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("helpdesk_conversations")
    .select(`
      id, number, channel, status, priority,
      contact_name, contact_email, contact_phone,
      subject, category, tags,
      assignee_id, team,
      unread_count, message_count,
      last_message_preview, last_message_at, last_message_direction,
      has_attachments, order_id,
      sla_state, first_response_due_at,
      origin, source_url, sentiment,
      resolved_at, closed_at,
      created_at,
      helpdesk_contacts!contact_id ( name, email, phone, whatsapp )
    `)
    .eq("id", id)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  const row     = data as Record<string, unknown>;
  const contact = (row.helpdesk_contacts as Record<string, unknown> | null);

  // Marca conversa como lida
  void supabase
    .from("helpdesk_conversations")
    .update({ unread_count: 0 })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  return {
    id:                     row.id as string,
    number:                 (row.number as number) ?? 0,
    channel:                row.channel as string,
    contact_name:           (row.contact_name as string | null) ?? (contact?.name as string | null) ?? null,
    contact_handle:         (row.contact_email as string | null) ?? (contact?.email as string | null) ?? (contact?.phone as string | null) ?? null,
    contact_email:          (row.contact_email as string | null) ?? (contact?.email as string | null) ?? null,
    contact_phone:          (row.contact_phone as string | null) ?? (contact?.phone as string | null) ?? null,
    subject:                row.subject as string | null,
    category:               row.category as string | null,
    status:                 row.status as string,
    priority:               (row.priority as string) ?? "normal",
    assignee_id:            row.assignee_id as string | null,
    assignee_name:          null,
    team:                   row.team as string | null,
    unread_count:           (row.unread_count as number) ?? 0,
    message_count:          (row.message_count as number) ?? 0,
    last_message_preview:   row.last_message_preview as string | null,
    last_message_at:        row.last_message_at as string | null,
    last_message_direction: row.last_message_direction as string | null,
    has_attachments:        (row.has_attachments as boolean) ?? false,
    tags:                   (row.tags as string[]) ?? [],
    order_id:               row.order_id as string | null,
    created_at:             row.created_at as string,
    sla_state:              row.sla_state as string | null,
    first_response_due_at:  row.first_response_due_at as string | null,
    origin:                 row.origin as string | null,
    source_url:             row.source_url as string | null,
    sentiment:              row.sentiment as string | null,
    resolved_at:            row.resolved_at as string | null,
    closed_at:              row.closed_at as string | null,
  };
}

// ── Buscar mensagens de uma conversa ─────────────────────────────────────────

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("helpdesk_messages")
    .select("id, type, sender_id, sender_name, sender_is_contact, body, is_internal_note, event_type, event_payload, has_attachments, delivered_at, read_at, created_at")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  return (data ?? []).map((m: Record<string, unknown>) => ({
    id:               m.id as string,
    type:             m.type as string,
    sender_id:        m.sender_id as string | null,
    sender_name:      (m.sender_name as string) ?? "",
    sender_is_contact: (m.sender_is_contact as boolean) ?? false,
    body:             (m.body as string) ?? "",
    is_internal_note: (m.is_internal_note as boolean) ?? false,
    event_type:       m.event_type as string | null,
    event_payload:    (m.event_payload as Record<string, unknown>) ?? {},
    has_attachments:  (m.has_attachments as boolean) ?? false,
    delivered_at:     m.delivered_at as string | null,
    read_at:          m.read_at as string | null,
    created_at:       m.created_at as string,
  }));
}

// ── Contadores por fila ───────────────────────────────────────────────────────

export async function getQueueCounts(): Promise<Record<InboxQueue, number>> {
  const staff = await currentStaff();
  const zero: Record<InboxQueue, number> = {
    inbox: 0, mine: 0, unassigned: 0, urgent: 0,
    waiting_customer: 0, waiting_team: 0,
    resolved: 0, archived: 0, spam: 0, all: 0,
    ch_whatsapp: 0, ch_instagram: 0, ch_email: 0, ch_chat: 0,
  };
  if (!staff) return zero;

  const supabase = await createClient();
  const { data } = await supabase
    .from("helpdesk_conversations")
    .select("status, priority, unread_count, assignee_id, channel")
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null);

  const rows = (data ?? []) as { status: string; priority: string; unread_count: number; assignee_id: string | null; channel: string }[];
  const counts = { ...zero };

  for (const r of rows) {
    counts.all += 1;
    if (["new","open","triaging","assigned","in_progress"].includes(r.status)) counts.inbox += 1;
    if (r.assignee_id === staff.id && ["new","open","triaging","assigned","in_progress","waiting_customer","waiting_team"].includes(r.status)) counts.mine += 1;
    if (!r.assignee_id && ["new","open","triaging","in_progress"].includes(r.status)) counts.unassigned += 1;
    if (r.status === "urgent") counts.urgent += 1;
    if (r.status === "waiting_customer") counts.waiting_customer += 1;
    if (["waiting_team","waiting_third_party","waiting_payment","waiting_logistics","waiting_stock","waiting_financial","waiting_fiscal"].includes(r.status)) counts.waiting_team += 1;
    if (["resolved","closed"].includes(r.status)) counts.resolved += 1;
    if (r.status === "archived") counts.archived += 1;
    if (r.status === "spam") counts.spam += 1;
    // Canais
    if (r.channel === "whatsapp")  counts.ch_whatsapp += 1;
    if (r.channel === "instagram") counts.ch_instagram += 1;
    if (r.channel === "email")     counts.ch_email += 1;
    if (r.channel === "chat")      counts.ch_chat += 1;
  }

  return counts;
}

// ── Meta Cloud API: enviar mensagem outbound ──────────────────────────────────

async function sendToMeta(
  channel: string,
  config: Record<string, unknown>,
  recipientId: string,
  body: string,
  attachments?: TimelineAttachment[],
): Promise<{ ok: boolean; external_id?: string; error?: string }> {
  if (channel === "whatsapp") {
    const phoneNumberId = config.wa_phone_number_id as string;
    const accessToken   = config.wa_access_token as string;
    if (!phoneNumberId || !accessToken) return { ok: false, error: "Credenciais WhatsApp não configuradas." };

    let messageBody: Record<string, unknown>;
    if (attachments?.length) {
      const att = attachments[0];
      const isImage = att.type.startsWith("image/");
      const isAudio = att.type.startsWith("audio/");
      const isVideo = att.type.startsWith("video/");
      const mediaType = isImage ? "image" : isAudio ? "audio" : isVideo ? "video" : "document";
      messageBody = {
        messaging_product: "whatsapp",
        to: recipientId,
        type: mediaType,
        [mediaType]: {
          link: att.url,
          ...(body ? { caption: body } : {}),
          ...(mediaType === "document" ? { filename: att.name } : {}),
        },
      };
    } else {
      messageBody = {
        messaging_product: "whatsapp",
        to: recipientId,
        type: "text",
        text: { body, preview_url: false },
      };
    }

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify(messageBody),
      }
    );
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: ((json as Record<string, Record<string, unknown>>).error?.message as string) ?? "Erro WhatsApp API" };
    const msgId = ((json.messages as Record<string, unknown>[])?.[0]?.id as string) ?? undefined;
    return { ok: true, external_id: msgId };
  }

  if (channel === "instagram") {
    const pageAccessToken = config.ig_page_access_token as string;
    if (!pageAccessToken) return { ok: false, error: "Credenciais Instagram não configuradas." };

    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pageAccessToken}` },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: attachments?.length
            ? { attachment: { type: "image", payload: { url: attachments[0].url, is_reusable: true } } }
            : { text: body },
        }),
      }
    );
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: ((json as Record<string, Record<string, unknown>>).error?.message as string) ?? "Erro Instagram API" };
    return { ok: true, external_id: json.message_id as string | undefined };
  }

  return { ok: false, error: `Canal ${channel} não suporta envio direto.` };
}

// ── Enviar mensagem / nota interna ───────────────────────────────────────────

export async function sendReply(
  conversationId: string,
  body: string,
  isNote: boolean,
  attachments?: TimelineAttachment[],
): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!body.trim() && !attachments?.length) return { ok: false, error: "Mensagem vazia." };

  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("helpdesk_conversations")
    .select("channel, channel_id, contact_email, contact_phone, contact_name, external_thread_id, contact_id")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!conv) return { ok: false, error: "Conversa não encontrada." };
  const row = conv as {
    channel: string;
    channel_id: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    contact_name: string | null;
    external_thread_id: string | null;
    contact_id: string | null;
  };

  let externalId: string | undefined;
  const hasAttachments = (attachments?.length ?? 0) > 0;

  // Canais social: enviar via Meta API
  if (!isNote && (row.channel === "whatsapp" || row.channel === "instagram") && row.channel_id) {
    const { data: chanConn } = await supabase
      .from("helpdesk_channel_connections")
      .select("config")
      .eq("id", row.channel_id)
      .maybeSingle();

    if (chanConn) {
      const config = (chanConn as { config: Record<string, unknown> }).config ?? {};
      const recipientId = row.channel === "instagram"
        ? (row.external_thread_id ?? row.contact_phone ?? "")
        : (row.contact_phone ?? "");

      if (recipientId) {
        const metaResult = await sendToMeta(row.channel, config, recipientId, body, attachments);
        if (!metaResult.ok) return { ok: false, error: `Erro ao enviar pelo ${row.channel}: ${metaResult.error}` };
        externalId = metaResult.external_id;
      }
    }
  }

  // Registra mensagem
  const { error: msgErr } = await supabase.from("helpdesk_messages").insert({
    tenant_id:         staff.tenantId,
    conversation_id:   conversationId,
    type:              isNote ? "note" : "outbound",
    sender_id:         staff.id,
    sender_name:       staff.fullName ?? staff.email ?? "",
    sender_is_contact: false,
    body:              body.trim(),
    is_internal_note:  isNote,
    has_attachments:   hasAttachments,
    external_id:       externalId ?? null,
    ...(attachments?.length ? { channel_metadata: { attachments } } : {}),
  });

  if (msgErr) return { ok: false, error: msgErr.message };

  // Registra attachments
  if (hasAttachments && attachments) {
    for (const att of attachments) {
      await supabase.from("helpdesk_attachments").insert({
        tenant_id:       staff.tenantId,
        conversation_id: conversationId,
        filename:        att.name,
        content_type:    att.type,
        size_bytes:      att.size,
        storage_path:    att.url,
        public_url:      att.url,
        uploaded_by:     staff.id,
      });
    }
  }

  // Atualiza conversa
  if (!isNote) {
    await supabase.from("helpdesk_conversations").update({
      last_message_preview:   body.slice(0, 150),
      last_message_at:        new Date().toISOString(),
      last_message_direction: "outbound",
      status:                 "open",
    }).eq("id", conversationId).eq("tenant_id", staff.tenantId);
  }

  // Canal email: envia via Resend
  if (!isNote && row.channel === "email" && row.contact_email) {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", staff.tenantId).maybeSingle();
    const t = tenant as { name?: string } | null;
    await sendEmail({
      to:      row.contact_email,
      subject: `Re: atendimento Flora Botanics${t?.name ? ` — ${t.name}` : ""}`,
      html:    textToHtml(body),
      text:    body,
    });
  }

  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

// ── Alterar status ───────────────────────────────────────────────────────────

export async function setStatus(
  conversationId: string,
  status: string,
): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  await supabase
    .from("helpdesk_conversations")
    .update({ status })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

export async function setStatusWithAudit(
  conversationId: string,
  status: string,
): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_conversations")
    .update({ status })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, staff.tenantId, conversationId, staff.id,
    staff.fullName ?? staff.email ?? "", "status_changed", { to: status });
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

// ── Criar nova conversa ───────────────────────────────────────────────────────

export async function createConversation(
  channel: string,
  contactName: string,
  contactHandle: string,
  subject: string,
  body: string,
  priority: InboxPriority = "normal",
): Promise<ActionResult<string>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!contactHandle.trim()) return { ok: false, error: "Informe o contato." };
  if (!body.trim()) return { ok: false, error: "Mensagem vazia." };

  const supabase = await createClient();
  const isEmail = contactHandle.includes("@");

  // Cria ou encontra contato
  let contactId: string | null = null;
  {
    const { data: existing } = await supabase
      .from("helpdesk_contacts")
      .select("id")
      .eq("tenant_id", staff.tenantId)
      .eq(isEmail ? "email" : "phone", contactHandle)
      .maybeSingle();

    if (existing) {
      contactId = (existing as { id: string }).id;
    } else {
      const { data: newContact } = await supabase
        .from("helpdesk_contacts")
        .insert({
          tenant_id: staff.tenantId,
          name:      contactName || contactHandle,
          email:     isEmail ? contactHandle : null,
          phone:     !isEmail ? contactHandle : null,
          type:      "lead",
        })
        .select("id")
        .single();
      if (newContact) contactId = (newContact as { id: string }).id;
    }
  }

  const { data: conv, error } = await supabase
    .from("helpdesk_conversations")
    .insert({
      tenant_id:              staff.tenantId,
      channel,
      contact_id:             contactId,
      contact_name:           contactName || null,
      contact_email:          isEmail ? contactHandle : null,
      contact_phone:          !isEmail ? contactHandle : null,
      subject:                subject || null,
      priority,
      status:                 "open",
      last_message_preview:   body.slice(0, 150),
      last_message_at:        new Date().toISOString(),
      last_message_direction: "outbound",
      origin:                 "manual",
    })
    .select("id")
    .single();

  if (error || !conv) return { ok: false, error: error?.message ?? "Erro ao criar conversa." };
  const convId = (conv as { id: string }).id;

  await supabase.from("helpdesk_messages").insert({
    tenant_id:         staff.tenantId,
    conversation_id:   convId,
    type:              "outbound",
    sender_id:         staff.id,
    sender_name:       staff.fullName ?? staff.email ?? "",
    sender_is_contact: false,
    body,
  });

  if (channel === "email" && isEmail) {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", staff.tenantId).maybeSingle();
    const t = tenant as { name?: string } | null;
    await sendEmail({
      to:      contactHandle,
      subject: subject || `Atendimento Flora Botanics${t?.name ? ` — ${t.name}` : ""}`,
      html:    textToHtml(body),
      text:    body,
    });
  }

  revalidatePath("/inbox");
  return { ok: true, data: convId };
}

// ── Contexto do contato ───────────────────────────────────────────────────────

export interface ContactContext {
  priority: InboxPriority;
  convTags: string[];
  customer: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    tags: string[];
    notes: string | null;
    accepts_marketing: boolean;
    created_at: string;
  } | null;
  orders: {
    id: string;
    number: string;
    status: string;
    payment_status: string | null;
    total_cents: number;
    currency: string;
    created_at: string;
  }[];
  stats: {
    total_orders: number;
    total_spent_cents: number;
    last_order_at: string | null;
    avg_ticket_cents: number;
  };
}

export async function getContactContext(conversationId: string): Promise<ContactContext> {
  const empty: ContactContext = { priority: "normal", convTags: [], customer: null, orders: [], stats: { total_orders: 0, total_spent_cents: 0, last_order_at: null, avg_ticket_cents: 0 } };
  const staff = await currentStaff();
  if (!staff) return empty;

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("helpdesk_conversations")
    .select("contact_id, contact_email, contact_phone, priority, tags")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!conv) return empty;
  const row = conv as { contact_id: string | null; contact_email: string | null; contact_phone: string | null; priority: string | null; tags: string[] | null };

  let handle = row.contact_email?.trim() ?? row.contact_phone?.trim() ?? "";
  if (!handle && row.contact_id) {
    const { data: hdContact } = await supabase
      .from("helpdesk_contacts")
      .select("email, phone")
      .eq("id", row.contact_id)
      .maybeSingle();
    if (hdContact) {
      const hc = hdContact as { email?: string; phone?: string };
      handle = hc.email?.trim() ?? hc.phone?.trim() ?? "";
    }
  }

  if (!handle) return { ...empty, priority: (row.priority as InboxPriority | null) ?? "normal", convTags: row.tags ?? [] };

  const isEmail = handle.includes("@");
  const customerQuery = supabase
    .from("customers")
    .select("id, full_name, email, phone, whatsapp, tags, notes, accepts_marketing, created_at")
    .eq("tenant_id", staff.tenantId)
    .is("archived_at", null);

  const { data: customers } = isEmail
    ? await customerQuery.eq("email", handle)
    : await customerQuery.ilike("phone", `%${handle.replace(/\D/g, "").slice(-9)}%`);

  const customer = (customers ?? [])[0] as ContactContext["customer"] ?? null;

  let orders: ContactContext["orders"] = [];
  if (customer) {
    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, number, status, payment_status, total_cents, currency, created_at")
      .eq("tenant_id", staff.tenantId)
      .eq("customer_id", customer.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    orders = (orderRows ?? []) as ContactContext["orders"];
  }

  const paid = orders.filter(o => ["paid","delivered","shipped","processing"].includes(o.status));
  const totalSpent = paid.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const lastOrderAt = orders[0]?.created_at ?? null;
  const avgTicket = paid.length ? Math.round(totalSpent / paid.length) : 0;

  return {
    priority: (row.priority as InboxPriority | null) ?? "normal",
    convTags: row.tags ?? [],
    customer,
    orders,
    stats: { total_orders: orders.length, total_spent_cents: totalSpent, last_order_at: lastOrderAt, avg_ticket_cents: avgTicket },
  };
}

// ── Atribuir responsável / prioridade ─────────────────────────────────────────

export async function assignConversation(
  conversationId: string,
  assigneeId: string | null,
): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_conversations")
    .update({ assignee_id: assigneeId })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, staff.tenantId, conversationId, staff.id,
    staff.fullName ?? staff.email ?? "", "assigned", { to: assigneeId ?? "" });
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

export async function setPriority(
  conversationId: string,
  priority: InboxPriority,
): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_conversations")
    .update({ priority })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

export async function addTag(
  conversationId: string,
  tag: string,
): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("helpdesk_conversations")
    .select("tags")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();
  const current = ((conv as { tags?: string[] } | null)?.tags ?? []);
  if (current.includes(tag)) return { ok: true, data: undefined };
  const updated = [...current, tag];
  const { error } = await supabase
    .from("helpdesk_conversations")
    .update({ tags: updated })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

export async function removeTag(
  conversationId: string,
  tag: string,
): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("helpdesk_conversations")
    .select("tags")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();
  const updated = ((conv as { tags?: string[] } | null)?.tags ?? []).filter(t => t !== tag);
  const { error } = await supabase
    .from("helpdesk_conversations")
    .update({ tags: updated })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

// ── Linha do tempo ────────────────────────────────────────────────────────────

function eventLabel(type: string, meta: Record<string, unknown>): { label: string; meta?: string } {
  const by   = (meta.by_name as string) ?? "";
  const to   = (meta.to     as string) ?? "";
  const from = (meta.from   as string) ?? "";
  switch (type) {
    case "status_changed":   return { label: `Status alterado para "${to}"`,    meta: by ? `por ${by}` : undefined };
    case "assigned":         return { label: `Atribuído a ${to}`,               meta: by ? `por ${by}` : undefined };
    case "unassigned":       return { label: "Responsável removido",            meta: by ? `por ${by}` : undefined };
    case "priority_changed": return { label: `Prioridade → "${to}"`,            meta: by ? `por ${by}` : undefined };
    case "tag_added":        return { label: `Tag adicionada: "${to}"`,         meta: by ? `por ${by}` : undefined };
    case "tag_removed":      return { label: `Tag removida: "${from}"`,         meta: by ? `por ${by}` : undefined };
    case "reopened":         return { label: "Conversa reaberta",               meta: by ? `por ${by}` : undefined };
    case "sla_breach":       return { label: "⚠ SLA violado",                  meta: undefined };
    case "order_linked":     return { label: `Pedido #${to} vinculado`,        meta: by ? `por ${by}` : undefined };
    case "email_bounced":    return { label: "E-mail retornou (bounce)",        meta: undefined };
    case "message_edited":   return { label: "Mensagem editada",               meta: by ? `por ${by}` : undefined };
    case "lead_triaged":     return { label: "Lead enviado para pipeline",      meta: by ? `por ${by}` : undefined };
    default:                 return { label: type.replace(/_/g, " "),           meta: undefined };
  }
}

export async function getTimeline(conversationId: string): Promise<TimelineEvent[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();

  // 1. Mensagens
  const { data: msgs } = await supabase
    .from("helpdesk_messages")
    .select("id, type, sender_name, sender_is_contact, body, is_internal_note, event_type, event_payload, has_attachments, channel_metadata, created_at")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  const msgEvents: TimelineEvent[] = (msgs ?? []).map((m: Record<string, unknown>) => {
    const msgType = (m.type as string) ?? "inbound";
    const isNote  = (m.is_internal_note as boolean) ?? false;
    const isSysEv = msgType === "event" || msgType === "system";
    const meta    = (m.channel_metadata as Record<string, unknown>) ?? {};
    const attsRaw = (meta.attachments as TimelineAttachment[]) ?? [];
    const mediaType = meta.media_type as TimelineEvent["media_type"] | undefined;
    const mediaUrl  = meta.media_url as string | undefined;

    if (isSysEv) {
      const evPayload = (m.event_payload as Record<string, unknown>) ?? {};
      const { label, meta: evMeta } = eventLabel((m.event_type as string) ?? "", evPayload);
      return {
        id:          m.id as string,
        kind:        "event" as TimelineKind,
        event_type:  m.event_type as string,
        event_label: label,
        event_meta:  evMeta,
        created_at:  m.created_at as string,
      };
    }

    return {
      id:                m.id as string,
      kind:              (isNote ? "note" : "message") as TimelineKind,
      sender_name:       (m.sender_name as string) ?? "?",
      sender_is_contact: (m.sender_is_contact as boolean) ?? false,
      body:              (m.body as string) ?? "",
      is_internal_note:  isNote,
      attachments:       attsRaw,
      media_type:        mediaType,
      media_url:         mediaUrl,
      created_at:        m.created_at as string,
    };
  });

  // 2. Auditoria
  let auditEvents: TimelineEvent[] = [];
  const { data: audits } = await supabase
    .from("helpdesk_audit_logs")
    .select("id, action, metadata, created_at")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (audits) {
    auditEvents = (audits as Record<string, unknown>[]).map(a => {
      const payload = (a.metadata as Record<string, unknown>) ?? {};
      const { label, meta } = eventLabel(a.action as string, payload);
      return {
        id:          `audit-${a.id as string}`,
        kind:        "event" as TimelineKind,
        event_type:  a.action as string,
        event_label: label,
        event_meta:  meta,
        created_at:  a.created_at as string,
      };
    });
  }

  const all = [...msgEvents, ...auditEvents];
  all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return all;
}

// ── Editar mensagem ────────────────────────────────────────────────────────────

export async function editMessage(
  conversationId: string,
  messageId: string,
  newBody: string,
): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!newBody.trim()) return { ok: false, error: "Conteúdo não pode ser vazio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_messages")
    .update({ body: newBody.trim() })
    .eq("id",              messageId)
    .eq("conversation_id", conversationId)
    .eq("tenant_id",       staff.tenantId)
    .in("type",            ["outbound", "note"]);

  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, staff.tenantId, conversationId, staff.id,
    staff.fullName ?? staff.email ?? "", "message_edited", { message_id: messageId });

  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function getConversationPdfData(conversationId: string): Promise<{
  conv: ConversationDetail | null;
  timeline: TimelineEvent[];
}> {
  const [conv, timeline] = await Promise.all([
    getConversationDetail(conversationId),
    getTimeline(conversationId),
  ]);
  return { conv, timeline };
}

// ── Auditoria ─────────────────────────────────────────────────────────────────

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  conversationId: string,
  staffId: string,
  staffName: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from("helpdesk_audit_logs").insert({
    tenant_id:       tenantId,
    conversation_id: conversationId,
    actor_id:        staffId,
    actor_name:      staffName,
    actor_type:      "user",
    action,
    metadata:        { by_name: staffName, ...metadata },
  });
}

// ── Macros ────────────────────────────────────────────────────────────────────

export interface MacroAction {
  type: "send_reply" | "send_note" | "set_status" | "set_priority" | "add_tag" | "create_task";
  params: Record<string, unknown>;
}

export interface Macro {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  actions: MacroAction[];
  use_count: number;
  created_at: string;
}

export async function getMacros(): Promise<Macro[]> {
  const staff = await currentStaff();
  if (!staff) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("helpdesk_macros")
    .select("id, name, description, visibility, actions, use_count, created_at")
    .eq("tenant_id", staff.tenantId)
    .eq("active", true)
    .order("use_count", { ascending: false })
    .limit(50);
  return (data ?? []) as Macro[];
}

export async function createMacro(
  name: string,
  description: string,
  body: string,
  isNote: boolean,
): Promise<ActionResult<string>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  if (!name.trim()) return { ok: false, error: "Nome obrigatório." };
  if (!body.trim()) return { ok: false, error: "Corpo do template obrigatório." };

  const supabase = await createClient();
  const action: MacroAction = { type: isNote ? "send_note" : "send_reply", params: { body } };
  const { data, error } = await supabase
    .from("helpdesk_macros")
    .insert({
      tenant_id:   staff.tenantId,
      created_by:  staff.id,
      name:        name.trim(),
      description: description.trim() || null,
      actions:     [action],
      visibility:  "all",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao criar template." };
  revalidatePath("/inbox");
  return { ok: true, data: (data as { id: string }).id };
}

export async function deleteMacro(macroId: string): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("helpdesk_macros")
    .update({ active: false })
    .eq("id", macroId)
    .eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

export async function incrementMacroUse(macroId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("helpdesk_macros")
    .select("use_count")
    .eq("id", macroId)
    .maybeSingle();
  if (m) {
    await supabase
      .from("helpdesk_macros")
      .update({ use_count: ((m as { use_count: number }).use_count ?? 0) + 1 })
      .eq("id", macroId);
  }
}

// ── Triagem para Pipeline CRM ─────────────────────────────────────────────────

export async function triageLeadToPipeline(
  conversationId: string,
  pipelineId: string,
  stageId: string,
  notes?: string,
): Promise<ActionResult<string>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("helpdesk_conversations")
    .select("contact_id, contact_name, contact_email, contact_phone, channel")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!conv) return { ok: false, error: "Conversa não encontrada." };
  const row = conv as { contact_id: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null; channel: string };

  const { data: deal, error: dealErr } = await supabase
    .from("pipeline_deals")
    .insert({
      tenant_id:    staff.tenantId,
      pipeline_id:  pipelineId,
      stage_id:     stageId,
      title:        row.contact_name ?? row.contact_email ?? row.contact_phone ?? "Lead sem nome",
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      source:       row.channel,
      notes:        notes ?? null,
      assignee_id:  staff.id,
      status:       "open",
      created_by:   staff.id,
    })
    .select("id")
    .single();

  if (dealErr || !deal) return { ok: false, error: dealErr?.message ?? "Erro ao criar deal no pipeline." };

  await addTag(conversationId, "pipeline");
  await logAudit(supabase, staff.tenantId, conversationId, staff.id,
    staff.fullName ?? staff.email ?? "", "lead_triaged", { deal_id: (deal as { id: string }).id, pipeline_id: pipelineId });

  revalidatePath("/inbox");
  return { ok: true, data: (deal as { id: string }).id };
}

export interface PipelineOption {
  id: string;
  name: string;
  stages: { id: string; name: string; sort_order: number }[];
}

export async function getPipelineOptions(): Promise<PipelineOption[]> {
  const staff = await currentStaff();
  if (!staff) return [];
  const supabase = await createClient();
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name")
    .eq("tenant_id", staff.tenantId)
    .eq("active", true)
    .order("name");

  if (!pipelines?.length) return [];

  const results: PipelineOption[] = [];
  for (const p of pipelines as { id: string; name: string }[]) {
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, name, sort_order")
      .eq("pipeline_id", p.id)
      .order("sort_order");
    results.push({
      id: p.id,
      name: p.name,
      stages: (stages ?? []) as { id: string; name: string; sort_order: number }[],
    });
  }
  return results;
}
