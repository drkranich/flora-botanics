/**
 * GET  /api/webhooks/whatsapp  → verificação hub.challenge do Meta
 * POST /api/webhooks/whatsapp  → eventos de mensagem WhatsApp Cloud API
 *
 * Fluxo:
 *  1. GET: devolve hub.challenge para verificar endpoint no Meta Dashboard
 *  2. POST: verifica assinatura X-Hub-Signature-256
 *  3. Idempotência via helpdesk_webhook_events (external_id = wamid)
 *  4. Cria/agrupa conversa em helpdesk_conversations por external_thread_id
 *  5. Insere mensagem em helpdesk_messages com channel_metadata (mídia, tipo)
 *  6. Cria/encontra contato em helpdesk_contacts
 *
 * Variáveis de ambiente necessárias:
 *   WA_VERIFY_TOKEN        → token de verificação configurado no Meta App Dashboard
 *   WA_APP_SECRET          → App Secret do Meta App (para verificação HMAC-SHA256)
 *
 * Formato de channel_connections.config esperado:
 *   { "wa_phone_number_id": "...", "wa_access_token": "...", "wa_verify_token": "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Ambiente ──────────────────────────────────────────────────────────────────

type RuntimeEnv = Record<string, string | undefined>;

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as RuntimeEnv;
  } catch {
    return process.env;
  }
}

// ── Verificação HMAC-SHA256 ───────────────────────────────────────────────────

async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice(7);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === expected;
}

// ── Tipos do payload WhatsApp Cloud API ──────────────────────────────────────

interface WAMessage {
  id:        string;       // wamid
  from:      string;       // phone number E.164
  timestamp: string;
  type:      "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contacts" | "reaction";
  text?:     { body: string };
  image?:    { id: string; mime_type: string; caption?: string; sha256: string };
  audio?:    { id: string; mime_type: string };
  video?:    { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  sticker?:  { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  reaction?: { message_id: string; emoji: string };
}

interface WAContact {
  profile: { name: string };
  wa_id: string;
}

interface WAWebhookPayload {
  object: "whatsapp_business_account";
  entry: Array<{
    id: string;            // WhatsApp Business Account ID
    changes: Array<{
      value: {
        messaging_product: "whatsapp";
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: WAContact[];
        messages?: WAMessage[];
        statuses?: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>;
      };
      field: string;
    }>;
  }>;
}

// ── GET: verificação do Meta ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const env = await getRuntimeEnv();
  const verifyToken = env.WA_VERIFY_TOKEN ?? "";

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.info("[wa/webhook] verificação de endpoint bem-sucedida");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Também aceita verify_token do banco (múltiplos canais)
  if (mode === "subscribe" && challenge) {
    const supabase = await createAdminClient();
    if (supabase) {
      const { data: channels } = await supabase
        .from("helpdesk_channel_connections")
        .select("config")
        .eq("channel", "whatsapp")
        .eq("active", true);

      const match = (channels ?? []).some((ch: Record<string, unknown>) => {
        const cfg = (ch.config as Record<string, unknown>) ?? {};
        return cfg.wa_verify_token === token;
      });

      if (match) {
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
    }
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST: receber mensagens ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // 1. Verificar assinatura
  const env       = await getRuntimeEnv();
  const appSecret = env.WA_APP_SECRET ?? "";

  if (appSecret) {
    const sig   = req.headers.get("x-hub-signature-256");
    const valid = await verifyMetaSignature(rawBody, sig, appSecret);
    if (!valid) {
      console.warn("[wa/webhook] assinatura inválida");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[wa/webhook] WA_APP_SECRET não configurado — verificação ignorada");
  }

  // 2. Parsear payload
  let payload: WAWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WAWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = await createAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // 3. Processar cada entrada
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const val = change.value;

      // Ignorar apenas status updates (não são mensagens)
      if (!val.messages?.length) continue;

      const phoneNumberId = val.metadata.phone_number_id;

      // Descobre tenant e canal pelo phone_number_id
      const { data: chanConn } = await supabase
        .from("helpdesk_channel_connections")
        .select("id, tenant_id, config")
        .eq("channel", "whatsapp")
        .eq("active", true)
        .maybeSingle();

      // Fallback: primeiro tenant ativo
      let tenantId: string | null = null;
      let channelId: string | null = null;

      if (chanConn) {
        const cc = chanConn as { id: string; tenant_id: string; config: Record<string, unknown> };
        tenantId  = cc.tenant_id;
        channelId = cc.id;
      } else {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        tenantId = (tenant as { id: string } | null)?.id ?? null;
      }

      if (!tenantId) {
        console.error("[wa/webhook] tenant não encontrado para phone_number_id:", phoneNumberId);
        continue;
      }

      for (const msg of val.messages) {
        await processWAMessage(supabase, msg, val.contacts ?? [], tenantId, channelId, phoneNumberId);
      }
    }
  }

  // Meta exige 200 em até 20s
  return NextResponse.json({ ok: true });
}

// ── Processar mensagem individual ─────────────────────────────────────────────

async function processWAMessage(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>,
  msg: WAMessage,
  contacts: WAContact[],
  tenantId: string,
  channelId: string | null,
  phoneNumberId: string,
) {
  if (!supabase) return;

  // Idempotência
  const { data: existing } = await supabase
    .from("helpdesk_webhook_events")
    .select("id, processed")
    .eq("channel", "whatsapp")
    .eq("external_id", msg.id)
    .maybeSingle();

  if (existing?.processed) return;

  // Registra evento
  let webhookEventId: string | null = existing?.id ?? null;
  if (!existing) {
    const { data: we } = await supabase
      .from("helpdesk_webhook_events")
      .insert({
        tenant_id:   tenantId,
        channel_id:  channelId,
        channel:     "whatsapp",
        external_id: msg.id,
        event_type:  `message.${msg.type}`,
        payload:     msg as unknown as Record<string, unknown>,
        processed:   false,
      })
      .select("id")
      .single();
    webhookEventId = (we as { id: string } | null)?.id ?? null;
  }

  // Extrai dados do remetente
  const waContact = contacts.find(c => c.wa_id === msg.from);
  const senderName = waContact?.profile.name ?? msg.from;
  const senderPhone = msg.from; // E.164

  // Cria ou encontra contato
  let contactId: string | null = null;
  {
    const { data: existingContact } = await supabase
      .from("helpdesk_contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phone", senderPhone)
      .maybeSingle();

    if (existingContact) {
      contactId = (existingContact as { id: string }).id;
      // Atualiza nome se não tinha
      if (senderName && senderName !== senderPhone) {
        await supabase
          .from("helpdesk_contacts")
          .update({ name: senderName, whatsapp: senderPhone })
          .eq("id", contactId);
      }
    } else {
      const { data: newContact } = await supabase
        .from("helpdesk_contacts")
        .insert({
          tenant_id: tenantId,
          name:      senderName,
          phone:     senderPhone,
          whatsapp:  senderPhone,
          type:      "lead",
        })
        .select("id")
        .single();
      contactId = (newContact as { id: string } | null)?.id ?? null;
    }
  }

  // Cria ou encontra conversa (agrupa por telefone do contato)
  let conversationId: string | null = null;
  {
    const { data: existingConv } = await supabase
      .from("helpdesk_conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("channel", "whatsapp")
      .eq("contact_phone", senderPhone)
      .not("status", "in", '("archived","spam","resolved","closed")')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    conversationId = (existingConv as { id: string } | null)?.id ?? null;
  }

  // Extrai corpo e metadata da mensagem
  const { body, mediaType, mediaId, mediaCaption, mediaFilename } = extractWAMessageContent(msg);
  const excerpt = body.slice(0, 150);

  if (!conversationId) {
    const { data: conv } = await supabase
      .from("helpdesk_conversations")
      .insert({
        tenant_id:              tenantId,
        channel:                "whatsapp",
        channel_id:             channelId,
        contact_id:             contactId,
        contact_name:           senderName,
        contact_phone:          senderPhone,
        external_thread_id:     senderPhone,  // agrupa pelo telefone
        status:                 "open",
        last_message_preview:   excerpt || `[${msg.type}]`,
        last_message_at:        new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        last_message_direction: "inbound",
        origin:                 "whatsapp",
      })
      .select("id")
      .single();
    conversationId = (conv as { id: string } | null)?.id ?? null;
  } else {
    await supabase
      .from("helpdesk_conversations")
      .update({
        last_message_preview:   excerpt || `[${msg.type}]`,
        last_message_at:        new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        last_message_direction: "inbound",
        status:                 "open",
      })
      .eq("id", conversationId)
      .eq("tenant_id", tenantId);
  }

  if (!conversationId) {
    console.error("[wa/webhook] falha ao criar/encontrar conversa para", senderPhone);
    return;
  }

  // Insere mensagem
  await supabase.from("helpdesk_messages").insert({
    tenant_id:         tenantId,
    conversation_id:   conversationId,
    type:              "inbound",
    sender_name:       senderName,
    sender_is_contact: true,
    body:              body,
    excerpt:           excerpt || null,
    external_id:       msg.id,
    is_internal_note:  false,
    has_attachments:   !!mediaId,
    channel_metadata:  {
      wa_message_type:  msg.type,
      wa_phone_number_id: phoneNumberId,
      wa_from:          senderPhone,
      media_type:       mediaType ?? null,
      media_id:         mediaId ?? null,
      media_url:        null,  // preenchido ao baixar a mídia
      media_caption:    mediaCaption ?? null,
      media_filename:   mediaFilename ?? null,
    } as Record<string, unknown>,
  });

  // Marca webhook como processado
  if (webhookEventId) {
    await supabase
      .from("helpdesk_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", webhookEventId);
  }

  console.info(`[wa/webhook] msg ${msg.id} (${msg.type}) de ${senderPhone} → conversa ${conversationId}`);
}

// ── Extrair conteúdo de mensagem WA ──────────────────────────────────────────

function extractWAMessageContent(msg: WAMessage): {
  body: string;
  mediaType?: "image" | "audio" | "video" | "document" | "sticker";
  mediaId?: string;
  mediaCaption?: string;
  mediaFilename?: string;
} {
  switch (msg.type) {
    case "text":
      return { body: msg.text?.body ?? "" };
    case "image":
      return { body: msg.image?.caption ?? "", mediaType: "image", mediaId: msg.image?.id, mediaCaption: msg.image?.caption };
    case "audio":
      return { body: "[Áudio]", mediaType: "audio", mediaId: msg.audio?.id };
    case "video":
      return { body: msg.video?.caption ?? "[Vídeo]", mediaType: "video", mediaId: msg.video?.id, mediaCaption: msg.video?.caption };
    case "document":
      return { body: msg.document?.caption ?? msg.document?.filename ?? "[Documento]", mediaType: "document", mediaId: msg.document?.id, mediaFilename: msg.document?.filename, mediaCaption: msg.document?.caption };
    case "sticker":
      return { body: "[Sticker]", mediaType: "sticker", mediaId: msg.sticker?.id };
    case "location":
      return { body: msg.location ? `📍 ${msg.location.name ?? "Localização"} (${msg.location.latitude}, ${msg.location.longitude})` : "[Localização]" };
    case "reaction":
      return { body: msg.reaction ? `${msg.reaction.emoji} (reação)` : "[Reação]" };
    default:
      return { body: `[${msg.type}]` };
  }
}
