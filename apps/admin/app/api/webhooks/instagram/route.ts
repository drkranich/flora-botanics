/**
 * GET  /api/webhooks/instagram  → verificação hub.challenge do Meta
 * POST /api/webhooks/instagram  → eventos de mensagem Instagram Graph API
 *
 * Fluxo:
 *  1. GET: devolve hub.challenge para verificar endpoint no Meta Dashboard
 *  2. POST: verifica assinatura X-Hub-Signature-256
 *  3. Idempotência via helpdesk_webhook_events
 *  4. Cria/agrupa conversa por PSID (Instagram User ID) em helpdesk_conversations
 *  5. Insere mensagem em helpdesk_messages com channel_metadata (mídia, tipo)
 *
 * Variáveis de ambiente necessárias:
 *   IG_VERIFY_TOKEN   → token configurado no Meta App Dashboard
 *   IG_APP_SECRET     → App Secret do Meta App
 *
 * Configuração de helpdesk_channel_connections.config:
 *   { "ig_page_id": "...", "ig_page_access_token": "...", "ig_verify_token": "..." }
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

// ── Tipos do payload Instagram Messaging ─────────────────────────────────────

interface IGAttachment {
  type:    "image" | "video" | "audio" | "file" | "ig_reel" | "share" | "fallback";
  payload: { url?: string; title?: string };
}

interface IGMessage {
  mid:         string;
  text?:       string;
  attachments?: IGAttachment[];
  reply_to?:   { mid: string };
  is_echo?:    boolean;  // true = mensagem enviada pela página (nosso outbound)
}

interface IGMessagingEntry {
  sender:    { id: string };   // PSID do usuário IG
  recipient: { id: string };   // Page ID
  timestamp: number;
  message?:  IGMessage;
  read?:     { watermark: number };
  delivery?: { watermark: number; mids: string[] };
  postback?: { title: string; payload: string };
}

interface IGWebhookPayload {
  object: "instagram" | "page";
  entry:  Array<{
    id:        string;       // Page ID
    time:      number;
    messaging: IGMessagingEntry[];
  }>;
}

// ── GET: verificação do Meta ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const env = await getRuntimeEnv();
  const verifyToken = env.IG_VERIFY_TOKEN ?? "";

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.info("[ig/webhook] verificação de endpoint bem-sucedida");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Verifica também via banco (múltiplos canais)
  if (mode === "subscribe" && challenge) {
    const supabase = await createAdminClient();
    if (supabase) {
      const { data: channels } = await supabase
        .from("helpdesk_channel_connections")
        .select("config")
        .eq("channel", "instagram")
        .eq("active", true);

      const match = (channels ?? []).some((ch: Record<string, unknown>) => {
        const cfg = (ch.config as Record<string, unknown>) ?? {};
        return cfg.ig_verify_token === token;
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
  const appSecret = env.IG_APP_SECRET ?? "";

  if (appSecret) {
    const sig   = req.headers.get("x-hub-signature-256");
    const valid = await verifyMetaSignature(rawBody, sig, appSecret);
    if (!valid) {
      console.warn("[ig/webhook] assinatura inválida");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[ig/webhook] IG_APP_SECRET não configurado — verificação ignorada");
  }

  // 2. Parsear payload
  let payload: IGWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as IGWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "instagram" && payload.object !== "page") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = await createAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  for (const entry of payload.entry ?? []) {
    const pageId = entry.id;

    // Descobre tenant pelo page_id
    const { data: chanConn } = await supabase
      .from("helpdesk_channel_connections")
      .select("id, tenant_id, config")
      .eq("channel", "instagram")
      .eq("active", true)
      .maybeSingle();

    let tenantId: string | null = null;
    let channelId: string | null = null;
    let pageAccessToken: string | null = null;

    if (chanConn) {
      const cc = chanConn as { id: string; tenant_id: string; config: Record<string, unknown> };
      tenantId         = cc.tenant_id;
      channelId        = cc.id;
      pageAccessToken  = (cc.config.ig_page_access_token as string) ?? null;
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
      console.error("[ig/webhook] tenant não encontrado para page_id:", pageId);
      continue;
    }

    for (const ev of entry.messaging ?? []) {
      // Ignora: echoes (nossas mensagens saindo), reads, deliveries
      if (ev.message?.is_echo) continue;
      if (!ev.message && !ev.postback) continue;

      await processIGMessaging(supabase, ev, tenantId, channelId, pageId, pageAccessToken);
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Processar evento de mensagem IG ──────────────────────────────────────────

async function processIGMessaging(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>,
  ev: IGMessagingEntry,
  tenantId: string,
  channelId: string | null,
  pageId: string,
  pageAccessToken: string | null,
) {
  if (!supabase) return;

  const senderPsid = ev.sender.id;
  const msgId      = ev.message?.mid ?? `ig-${senderPsid}-${ev.timestamp}`;

  // Idempotência
  const { data: existing } = await supabase
    .from("helpdesk_webhook_events")
    .select("id, processed")
    .eq("channel", "instagram")
    .eq("external_id", msgId)
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
        channel:     "instagram",
        external_id: msgId,
        event_type:  ev.postback ? "postback" : "message",
        payload:     ev as unknown as Record<string, unknown>,
        processed:   false,
      })
      .select("id")
      .single();
    webhookEventId = (we as { id: string } | null)?.id ?? null;
  }

  // Tenta obter nome do usuário via Graph API
  let senderName = `IG User ${senderPsid}`;
  if (pageAccessToken) {
    try {
      const userRes = await fetch(
        `https://graph.facebook.com/v19.0/${senderPsid}?fields=name,profile_pic&access_token=${pageAccessToken}`,
      );
      if (userRes.ok) {
        const u = await userRes.json() as { name?: string };
        if (u.name) senderName = u.name;
      }
    } catch {
      // não bloqueia se a API falhar
    }
  }

  // Cria ou encontra contato
  let contactId: string | null = null;
  {
    const { data: existingContact } = await supabase
      .from("helpdesk_contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_id", senderPsid)
      .maybeSingle();

    if (existingContact) {
      contactId = (existingContact as { id: string }).id;
    } else {
      const { data: newContact } = await supabase
        .from("helpdesk_contacts")
        .insert({
          tenant_id:   tenantId,
          name:        senderName,
          external_id: senderPsid,
          type:        "lead",
        })
        .select("id")
        .single();
      contactId = (newContact as { id: string } | null)?.id ?? null;
    }
  }

  // Cria ou encontra conversa (agrupa por PSID como external_thread_id)
  let conversationId: string | null = null;
  {
    const { data: existingConv } = await supabase
      .from("helpdesk_conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("channel", "instagram")
      .eq("external_thread_id", senderPsid)
      .not("status", "in", '("archived","spam","resolved","closed")')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    conversationId = (existingConv as { id: string } | null)?.id ?? null;
  }

  // Extrai corpo e mídia
  const { body, mediaType, mediaUrl } = extractIGMessageContent(ev.message ?? null, ev.postback ?? null);
  const excerpt = body.slice(0, 150);
  const msgTs   = new Date(ev.timestamp).toISOString();

  if (!conversationId) {
    const { data: conv } = await supabase
      .from("helpdesk_conversations")
      .insert({
        tenant_id:              tenantId,
        channel:                "instagram",
        channel_id:             channelId,
        contact_id:             contactId,
        contact_name:           senderName,
        external_thread_id:     senderPsid,
        status:                 "open",
        last_message_preview:   excerpt || "[mídia]",
        last_message_at:        msgTs,
        last_message_direction: "inbound",
        origin:                 "instagram",
      })
      .select("id")
      .single();
    conversationId = (conv as { id: string } | null)?.id ?? null;
  } else {
    await supabase
      .from("helpdesk_conversations")
      .update({
        last_message_preview:   excerpt || "[mídia]",
        last_message_at:        msgTs,
        last_message_direction: "inbound",
        status:                 "open",
      })
      .eq("id", conversationId)
      .eq("tenant_id", tenantId);
  }

  if (!conversationId) {
    console.error("[ig/webhook] falha ao criar/encontrar conversa para PSID:", senderPsid);
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
    external_id:       msgId,
    is_internal_note:  false,
    has_attachments:   !!mediaUrl,
    channel_metadata:  {
      ig_psid:       senderPsid,
      ig_page_id:    pageId,
      ig_msg_id:     msgId,
      media_type:    mediaType ?? null,
      media_url:     mediaUrl ?? null,
    } as Record<string, unknown>,
  });

  // Marca webhook como processado
  if (webhookEventId) {
    await supabase
      .from("helpdesk_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", webhookEventId);
  }

  console.info(`[ig/webhook] msg ${msgId} de PSID ${senderPsid} → conversa ${conversationId}`);
}

// ── Extrair conteúdo de mensagem IG ──────────────────────────────────────────

function extractIGMessageContent(
  msg: IGMessage | null,
  postback: { title: string; payload: string } | null,
): { body: string; mediaType?: string; mediaUrl?: string } {
  if (postback) {
    return { body: `[Postback] ${postback.title}` };
  }

  if (!msg) return { body: "" };

  if (msg.text) return { body: msg.text };

  if (msg.attachments?.length) {
    const att = msg.attachments[0];
    const url = att.payload.url ?? undefined;
    switch (att.type) {
      case "image":    return { body: att.payload.title ?? "[Imagem]",   mediaType: "image",    mediaUrl: url };
      case "video":    return { body: att.payload.title ?? "[Vídeo]",    mediaType: "video",    mediaUrl: url };
      case "audio":    return { body: "[Áudio]",                         mediaType: "audio",    mediaUrl: url };
      case "file":     return { body: att.payload.title ?? "[Arquivo]",  mediaType: "document", mediaUrl: url };
      case "ig_reel":  return { body: att.payload.title ?? "[Reel]",     mediaType: "video",    mediaUrl: url };
      case "share":    return { body: att.payload.title ?? "[Conteúdo compartilhado]", mediaUrl: url };
      default:         return { body: att.payload.title ?? `[${att.type}]`, mediaUrl: url };
    }
  }

  return { body: "" };
}
