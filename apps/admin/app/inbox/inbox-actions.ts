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
  | "all";

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
  created_at: string;
}

// ── Filas: mapeamento de status por queue ─────────────────────────────────────

function queueFilter(queue: InboxQueue, userId: string) {
  switch (queue) {
    case "inbox":         return { status_in: ["new","open","triaging","assigned","in_progress"], not_archived: true };
    case "mine":          return { assignee_id: userId,   status_in: ["new","open","triaging","assigned","in_progress","waiting_customer","waiting_team"] };
    case "unassigned":    return { assignee_id: null,   status_in: ["new","open","triaging","in_progress"] };
    case "urgent":        return { priority_in: ["urgent","critical"], status_in: ["new","open","triaging","assigned","in_progress","waiting_customer","waiting_team"] };
    case "waiting_customer": return { status_in: ["waiting_customer"] };
    case "waiting_team":  return { status_in: ["waiting_team","waiting_third_party","waiting_payment","waiting_logistics","waiting_stock","waiting_financial","waiting_fiscal"] };
    case "resolved":      return { status_in: ["resolved","closed"] };
    case "archived":      return { status_in: ["archived"] };
    case "spam":          return { status_in: ["spam"] };
    default:              return {};
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
  const filters = queueFilter(queue, staff.id);

  // Usa a tabela conversations (antiga) com fallback para helpdesk_conversations
  // Por ora lê conversations que já existe no schema
  let q = supabase
    .from("conversations")
    .select(
      "id, channel, contact_name, contact_handle, status, unread_count, last_message_preview, last_message_at, tags, created_at"
    )
    .eq("tenant_id", staff.tenantId);

  // Filtros de status
  if ("status_in" in filters && filters.status_in) {
    // Mapeamento para os status antigos da tabela conversations
    const legacyMap: Record<string, string[]> = {
      new: ["new"], open: ["open"], triaging: ["open"], assigned: ["open"],
      in_progress: ["open"], waiting_customer: ["waiting"], waiting_team: ["waiting"],
      resolved: ["resolved"], closed: ["resolved"], archived: ["resolved"],
      spam: ["resolved"],
    };
    const mapped = [...new Set((filters.status_in as string[]).flatMap((s) => legacyMap[s] ?? [s]))];
    if (mapped.length === 1) {
      q = q.eq("status", mapped[0]);
    } else if (mapped.length > 1) {
      q = q.in("status", mapped);
    }
  }

  // Filtro de assignee
  if ("assignee_id" in filters) {
    if (filters.assignee_id === null) {
      q = q.is("assignee_id" as never, null);
    } else {
      q = q.eq("assignee_id" as never, filters.assignee_id as string);
    }
  }

  // Busca textual
  if (search?.trim()) {
    q = q.or(`contact_name.ilike.%${search}%,contact_handle.ilike.%${search}%,last_message_preview.ilike.%${search}%`);
  }

  const { data } = await q
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(60);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id:                   row.id as string,
    number:               0,
    channel:              row.channel as string,
    contact_name:         row.contact_name as string | null,
    contact_handle:       row.contact_handle as string | null,
    subject:              null,
    category:             null,
    status:               row.status as string,
    priority:             "normal",
    assignee_id:          null,
    assignee_name:        null,
    team:                 null,
    unread_count:         (row.unread_count as number) ?? 0,
    message_count:        0,
    last_message_preview: row.last_message_preview as string | null,
    last_message_at:      row.last_message_at as string | null,
    last_message_direction: null,
    has_attachments:      false,
    tags:                 (row.tags as string[]) ?? [],
    order_id:             null,
    created_at:           row.created_at as string,
    sla_state:            null,
    first_response_due_at: null,
  }));
}

// ── Buscar detalhe de uma conversa ───────────────────────────────────────────

export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, channel, contact_name, contact_handle, status, tags, created_at, unread_count, last_message_preview, last_message_at")
    .eq("id", id)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!data) return null;
  const row = data as Record<string, unknown>;

  return {
    id:                   row.id as string,
    number:               0,
    channel:              row.channel as string,
    contact_name:         row.contact_name as string | null,
    contact_handle:       row.contact_handle as string | null,
    contact_email:        row.contact_handle as string | null,
    contact_phone:        null,
    subject:              null,
    category:             null,
    status:               row.status as string,
    priority:             "normal",
    assignee_id:          null,
    assignee_name:        null,
    team:                 null,
    unread_count:         (row.unread_count as number) ?? 0,
    message_count:        0,
    last_message_preview: row.last_message_preview as string | null,
    last_message_at:      row.last_message_at as string | null,
    last_message_direction: null,
    has_attachments:      false,
    tags:                 (row.tags as string[]) ?? [],
    order_id:             null,
    created_at:           row.created_at as string,
    sla_state:            null,
    first_response_due_at: null,
    origin:               null,
    source_url:           null,
    sentiment:            null,
    resolved_at:          null,
    closed_at:            null,
  };
}

// ── Buscar mensagens de uma conversa ─────────────────────────────────────────

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, direction, sender_name, body, created_at")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((m: Record<string, unknown>) => ({
    id:              m.id as string,
    type:            m.direction as string,
    sender_id:       null,
    sender_name:     (m.sender_name as string) ?? "",
    sender_is_contact: m.direction === "in",
    body:            m.body as string,
    is_internal_note: m.direction === "note",
    event_type:      null,
    event_payload:   {},
    has_attachments: false,
    delivered_at:    null,
    read_at:         null,
    created_at:      m.created_at as string,
  }));
}

// ── Contadores por fila ───────────────────────────────────────────────────────

export async function getQueueCounts(): Promise<Record<InboxQueue, number>> {
  const staff = await currentStaff();
  const zero: Record<InboxQueue, number> = {
    inbox: 0, mine: 0, unassigned: 0, urgent: 0,
    waiting_customer: 0, waiting_team: 0,
    resolved: 0, archived: 0, spam: 0, all: 0,
  };
  if (!staff) return zero;

  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("status, unread_count")
    .eq("tenant_id", staff.tenantId);

  const rows = (data ?? []) as { status: string; unread_count: number }[];

  const counts = { ...zero };
  for (const r of rows) {
    counts.all += 1;
    if (["new","open","waiting"].includes(r.status)) counts.inbox += 1;
    if (r.status === "waiting") counts.waiting_customer += 1;
    if (r.status === "resolved") counts.resolved += 1;
  }
  // Não lidos no inbox = urgentes aproximados
  counts.urgent = rows.filter((r) => r.unread_count > 0 && ["new","open"].includes(r.status)).length;
  counts.unassigned = rows.filter((r) => ["new","open"].includes(r.status)).length;

  return counts;
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
    .from("conversations")
    .select("channel, contact_handle, contact_name")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!conv) return { ok: false, error: "Conversa não encontrada." };

  await supabase.from("messages").insert({
    tenant_id:       staff.tenantId,
    conversation_id: conversationId,
    direction:       isNote ? "note" : "out",
    sender_name:     staff.fullName ?? staff.email,
    body,
    ...(attachments?.length ? { attachments } : {}),
  });

  if (!isNote) {
    await supabase.from("conversations").update({
      last_message_preview: body.slice(0, 140),
      last_message_at:      new Date().toISOString(),
      status:               "open",
    }).eq("id", conversationId).eq("tenant_id", staff.tenantId);

    const row = conv as Record<string, unknown>;
    if (row.channel === "email" && row.contact_handle) {
      const { data: tenant } = await supabase.from("tenants").select("name").eq("id", staff.tenantId).maybeSingle();
      const t = tenant as { name?: string } | null;
      await sendEmail({
        to:      row.contact_handle as string,
        subject: `Re: atendimento Flora Botanics${t?.name ? ` — ${t.name}` : ""}`,
        html:    textToHtml(body),
        text:    body,
      });
    }
  }

  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

// ── Alterar status ───────────────────────────────────────────────────────────

// ── Editar mensagem (admin pode editar qualquer, lead só "in") ────────────────

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
    .from("messages")
    .update({ body: newBody.trim() })
    .eq("id",              messageId)
    .eq("conversation_id", conversationId)
    .eq("tenant_id",       staff.tenantId);

  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, staff.tenantId, conversationId, staff.id,
    staff.fullName ?? staff.email ?? "", "message_edited", { message_id: messageId });

  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

// ── Gerar PDF da conversa ─────────────────────────────────────────────────────

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

export async function setStatus(
  conversationId: string,
  status: string,
): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  // Mapeamento para status da tabela conversations existente
  const mapped =
    status === "resolved" || status === "closed" ? "resolved"
    : status === "waiting_customer" || status === "waiting_team" ? "waiting"
    : status === "archived" || status === "spam" ? "resolved"
    : "open";

  await supabase.from("conversations")
    .update({ status: mapped })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

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

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      tenant_id:            staff.tenantId,
      channel,
      contact_name:         contactName || null,
      contact_handle:       contactHandle,
      status:               "open",
      last_message_preview: body.slice(0, 140),
      last_message_at:      new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !conv) return { ok: false, error: error?.message ?? "Erro ao criar conversa." };

  await supabase.from("messages").insert({
    tenant_id:       staff.tenantId,
    conversation_id: (conv as { id: string }).id,
    direction:       "out",
    sender_name:     staff.fullName ?? staff.email,
    body,
  });

  if (channel === "email" && contactHandle.includes("@")) {
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
  return { ok: true, data: (conv as { id: string }).id };
}

// ── Contexto do contato vinculado a uma conversa ──────────────────────────────

export interface ContactContext {
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
  const empty: ContactContext = { customer: null, orders: [], stats: { total_orders: 0, total_spent_cents: 0, last_order_at: null, avg_ticket_cents: 0 } };

  const staff = await currentStaff();
  if (!staff) return empty;

  const supabase = await createClient();

  // Busca a conversa para obter o contact_handle (email/phone)
  const { data: conv } = await supabase
    .from("conversations")
    .select("contact_handle, contact_name")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!conv) return empty;
  const row = conv as { contact_handle: string | null; contact_name: string | null };
  const handle = row.contact_handle?.trim();

  if (!handle) return empty;

  // Tenta encontrar o cliente pelo email ou pelo nome
  const isEmail = handle.includes("@");
  const customerQuery = supabase
    .from("customers")
    .select("id, full_name, email, phone, whatsapp, tags, notes, accepts_marketing, created_at")
    .eq("tenant_id", staff.tenantId)
    .is("archived_at", null);

  const { data: customers } = isEmail
    ? await customerQuery.eq("email", handle)
    : await customerQuery.ilike("full_name", `%${handle}%`);

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
    customer,
    orders,
    stats: {
      total_orders: orders.length,
      total_spent_cents: totalSpent,
      last_order_at: lastOrderAt,
      avg_ticket_cents: avgTicket,
    },
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
    .from("conversations")
    .update({ assignee_id: assigneeId } as never)
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
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
    .from("conversations")
    .update({ priority } as never)
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
  // Busca tags atuais
  const { data: conv } = await supabase
    .from("conversations")
    .select("tags")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  const current = ((conv as { tags?: string[] } | null)?.tags ?? []);
  if (current.includes(tag)) return { ok: true, data: undefined };
  const updated = [...current, tag];

  const { error } = await supabase
    .from("conversations")
    .update({ tags: updated } as never)
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
    .from("conversations")
    .select("tags")
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  const updated = ((conv as { tags?: string[] } | null)?.tags ?? []).filter(t => t !== tag);

  const { error } = await supabase
    .from("conversations")
    .update({ tags: updated } as never)
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}

// ── Linha do tempo: mensagens + eventos de sistema intercalados ───────────────

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
    default:                 return { label: type.replace(/_/g, " "),           meta: undefined };
  }
}

export async function getTimeline(conversationId: string): Promise<TimelineEvent[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();

  // 1. Mensagens — schema real: id, direction, sender_name, body, attachments, created_at
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, direction, sender_name, body, attachments, created_at")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: true })
    .limit(200);

  const msgEvents: TimelineEvent[] = (msgs ?? []).map((m: Record<string, unknown>) => {
    const dir    = (m.direction as string) ?? "out";
    const isNote = dir === "note";
    return {
      id:                m.id as string,
      kind:              (isNote ? "note" : "message") as TimelineKind,
      sender_name:       (m.sender_name as string) ?? "?",
      sender_is_contact: dir === "in",
      body:              m.body as string,
      is_internal_note:  isNote,
      attachments:       Array.isArray(m.attachments) ? (m.attachments as TimelineAttachment[]) : [],
      created_at:        m.created_at as string,
    };
  });

  // 2. Eventos de auditoria (tabela helpdesk_audit_log — silencia se não existir)
  let auditEvents: TimelineEvent[] = [];
  const { data: audits } = await supabase
    .from("helpdesk_audit_log")
    .select("id, event_type, payload, created_at")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (audits) {
    auditEvents = (audits as Record<string, unknown>[]).map(a => {
      const payload = (a.payload as Record<string, unknown>) ?? {};
      const { label, meta } = eventLabel(a.event_type as string, payload);
      return {
        id:          `audit-${a.id as string}`,
        kind:        "event" as TimelineKind,
        event_type:  a.event_type as string,
        event_label: label,
        event_meta:  meta,
        created_at:  a.created_at as string,
      };
    });
  }

  // 3. Intercala e ordena cronologicamente
  const all = [...msgEvents, ...auditEvents];
  all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return all;
}

// ── Registrar evento de auditoria ─────────────────────────────────────────────

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  conversationId: string,
  staffId: string,
  staffName: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await supabase.from("helpdesk_audit_log").insert({
    tenant_id:       tenantId,
    conversation_id: conversationId,
    actor_id:        staffId,
    event_type:      eventType,
    payload:         { by_name: staffName, ...payload },
  });
}

// ── Macros / Templates de resposta rápida ────────────────────────────────────

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
  const action: MacroAction = {
    type: isNote ? "send_note" : "send_reply",
    params: { body },
  };

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
  await supabase.rpc("increment_macro_use", { macro_id: macroId }).then(() => {});
  // fallback manual se rpc não existir
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

export async function setStatusWithAudit(
  conversationId: string,
  status: string,
): Promise<ActionResult<void>> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const statusMap: Record<string, string> = {
    open: "open", waiting_customer: "waiting", waiting_team: "waiting",
    resolved: "resolved", archived: "resolved", spam: "resolved",
  };
  const mapped = statusMap[status] ?? status;

  const { error } = await supabase
    .from("conversations")
    .update({ status: mapped })
    .eq("id", conversationId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, staff.tenantId, conversationId, staff.id,
    staff.fullName ?? staff.email ?? "", "status_changed", { to: status });

  revalidatePath("/inbox");
  return { ok: true, data: undefined };
}
