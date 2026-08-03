/**
 * POST /api/webhooks/resend
 *
 * Recebe eventos do Resend (email.received) e transforma em conversas
 * do helpdesk. Usa verificação HMAC-SHA256 nativa (sem dependência svix).
 *
 * Fluxo:
 *  1. Verifica assinatura Svix (svix-id + svix-timestamp + svix-signature)
 *  2. Registra em helpdesk_webhook_events (idempotência por svix-id)
 *  3. Para email.received: cria ou agrupa em conversa existente pelo In-Reply-To
 *  4. Insere a mensagem em helpdesk_messages
 *  5. Marca webhook_event como processado
 *
 * Variável de ambiente necessária:
 *   RESEND_WEBHOOK_SECRET  → Signing Secret do endpoint no painel do Resend
 *                            (começa com "whsec_...")
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Helpers de ambiente ───────────────────────────────────────────────────────

type RuntimeEnv = Record<string, string | undefined>;

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as RuntimeEnv;
  } catch {
    return process.env;
  }
}

// ── Verificação de assinatura Svix (Resend usa Svix internamente) ─────────────
// Spec: https://docs.svix.com/receiving/verifying-payloads/how-manual

async function verifyResendSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const msgId        = headers.get("svix-id")        ?? "";
  const msgTimestamp = headers.get("svix-timestamp")  ?? "";
  const msgSignature = headers.get("svix-signature")  ?? "";

  if (!msgId || !msgTimestamp || !msgSignature) return false;

  // Rejeita timestamps com mais de 5 min de diferença
  const ts = parseInt(msgTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // A chave vem como "whsec_<base64>"; precisa decodificar
  const secretBytes = base64Decode(secret.replace(/^whsec_/, ""));

  // Payload assinado: "<msgId>.<msgTimestamp>.<rawBody>"
  const toSign = `${msgId}.${msgTimestamp}.${rawBody}`;

  const key = await crypto.subtle.importKey(
    "raw", secretBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // msgSignature pode ter múltiplas assinaturas separadas por espaço: "v1,<b64> v1,<b64>"
  const candidates = msgSignature.split(" ").map(s => s.split(",")[1] ?? "");
  return candidates.some(c => c === computedB64);
}

function base64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

// ── Tipos do payload Resend ───────────────────────────────────────────────────

interface ResendEmailReceived {
  type: "email.received";
  data: {
    email_id:   string;
    from:       string;          // "Nome <email@dominio.com>"
    to:         string[];
    subject:    string;
    html?:      string;
    text?:      string;
    headers?:   Record<string, string>;
    // Resend inclui message_id e in_reply_to nos headers
  };
}

// ── Extrai nome e e-mail de strings como "Nome <email>" ──────────────────────

function parseAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^([^<]*)<([^>]+)>/);
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // 1. Verificar assinatura
  const env    = await getRuntimeEnv();
  const secret = env.RESEND_INBOUND_WEBHOOK_SECRET ?? "";

  if (secret) {
    const valid = await verifyResendSignature(rawBody, req.headers, secret);
    if (!valid) {
      console.warn("[resend/webhook] assinatura inválida");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // Em dev, avisa mas não bloqueia
    console.warn("[resend/webhook] RESEND_WEBHOOK_SECRET não configurado — verificação ignorada");
  }

  // 2. Parsear payload
  let payload: ResendEmailReceived;
  try {
    payload = JSON.parse(rawBody) as ResendEmailReceived;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Só processa email.received por ora
  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const svixId = req.headers.get("svix-id") ?? `resend-${Date.now()}`;

  const supabase = await createAdminClient();
  if (!supabase) {
    console.error("[resend/webhook] falha ao criar cliente admin Supabase");
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  // 3. Idempotência — pula se já foi processado
  const { data: existing } = await supabase
    .from("helpdesk_webhook_events")
    .select("id, processed")
    .eq("channel", "email")
    .eq("external_id", svixId)
    .maybeSingle();

  if (existing?.processed) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 4. Descobrir tenant pelo e-mail de destino (to[0])
  const toEmail = (payload.data.to?.[0] ?? "").toLowerCase();
  let tenantId: string | null = null;
  let channelId: string | null = null;

  if (toEmail) {
    const { data: channel } = await supabase
      .from("helpdesk_channel_connections")
      .select("id, tenant_id")
      .eq("channel", "email")
      .ilike("identifier", toEmail)
      .eq("active", true)
      .maybeSingle();

    if (channel) {
      tenantId  = (channel as { id: string; tenant_id: string }).tenant_id;
      channelId = (channel as { id: string; tenant_id: string }).id;
    }
  }

  // Fallback: pega o primeiro tenant ativo (single-tenant)
  if (!tenantId) {
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
    console.error("[resend/webhook] tenant não encontrado para", toEmail);
    return NextResponse.json({ error: "Tenant not found" }, { status: 422 });
  }

  // 5. Registrar webhook_event
  let webhookEventId: string | null = existing?.id ?? null;
  if (!existing) {
    const { data: we } = await supabase
      .from("helpdesk_webhook_events")
      .insert({
        tenant_id:   tenantId,
        channel_id:  channelId,
        channel:     "email",
        external_id: svixId,
        event_type:  payload.type,
        payload:     payload.data as unknown as Record<string, unknown>,
        processed:   false,
      })
      .select("id")
      .single();
    webhookEventId = (we as { id: string } | null)?.id ?? null;
  }

  // 6. Criar ou achar conversa existente pelo In-Reply-To / References
  const headers     = payload.data.headers ?? {};
  const inReplyTo   = headers["In-Reply-To"] ?? headers["in-reply-to"] ?? null;
  const messageId   = headers["Message-ID"]  ?? headers["message-id"]  ?? payload.data.email_id;
  const from        = parseAddress(payload.data.from);
  const subject     = payload.data.subject ?? "(sem assunto)";
  const bodyHtml    = payload.data.html   ?? null;
  const bodyText    = payload.data.text   ?? "";
  const excerpt     = bodyText.slice(0, 150).replace(/\s+/g, " ").trim();

  let conversationId: string | null = null;

  // Tentar encontrar conversa pelo external_thread_id = inReplyTo (ou messageId de resposta)
  if (inReplyTo) {
    const { data: existing_conv } = await supabase
      .from("helpdesk_conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_thread_id", inReplyTo)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    conversationId = (existing_conv as { id: string } | null)?.id ?? null;
  }

  // Se não achou por inReplyTo, cria nova conversa
  if (!conversationId) {
    const { data: conv, error: convErr } = await supabase
      .from("helpdesk_conversations")
      .insert({
        tenant_id:            tenantId,
        channel:              "email",
        channel_id:           channelId,
        external_thread_id:   messageId,    // para agrupar respostas futuras
        subject,
        contact_name:         from.name || from.email,
        contact_email:        from.email,
        status:               "open",
        last_message_preview: excerpt,
        last_message_at:      new Date().toISOString(),
        last_message_direction: "inbound",
      })
      .select("id")
      .single();

    if (convErr || !conv) {
      console.error("[resend/webhook] erro ao criar conversa:", convErr);
      await supabase
        .from("helpdesk_webhook_events")
        .update({ error: convErr?.message ?? "falha ao criar conversa", retry_count: 1 })
        .eq("id", webhookEventId);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    conversationId = (conv as { id: string }).id;
  } else {
    // Atualiza preview da conversa existente
    await supabase
      .from("helpdesk_conversations")
      .update({
        last_message_preview: excerpt,
        last_message_at:      new Date().toISOString(),
        last_message_direction: "inbound",
        status:               "open",  // reabre se estava resolvida
      })
      .eq("id", conversationId)
      .eq("tenant_id", tenantId);
  }

  // 7. Inserir mensagem
  await supabase.from("helpdesk_messages").insert({
    tenant_id:         tenantId,
    conversation_id:   conversationId,
    type:              "inbound",
    sender_name:       from.name || from.email,
    sender_email:      from.email,
    sender_is_contact: true,
    subject,
    body:              bodyText,
    body_html:         bodyHtml,
    excerpt,
    external_id:       messageId,
    is_internal_note:  false,
    channel_metadata:  { headers, raw_email_id: payload.data.email_id } as unknown as Record<string, unknown>,
  });

  // 8. Marcar webhook como processado
  if (webhookEventId) {
    await supabase
      .from("helpdesk_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", webhookEventId);
  }

  console.info(`[resend/webhook] conversa ${conversationId} atualizada — ${subject}`);
  return NextResponse.json({ ok: true, conversation_id: conversationId });
}

// Resend verifica o endpoint com GET
export async function GET() {
  return NextResponse.json({ ok: true, service: "resend-webhook" });
}
