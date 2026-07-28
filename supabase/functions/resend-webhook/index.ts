// Edge Function: resend-webhook
//
// Recebe webhooks do Resend, valida assinatura Svix e atualiza:
// - marketing_webhook_events;
// - marketing_message_queue;
// - marketing_events;
// - marketing_customer_timeline.
//
// URL:
//   https://mbpvzhcrimdwcqkqvoqr.supabase.co/functions/v1/resend-webhook
//
// Secret necessario:
//   supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxx --project-ref mbpvzhcrimdwcqkqvoqr

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "npm:svix@1.69.0";

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

function eventType(input: string): "sent" | "delivered" | "opened" | "clicked" | "failure" {
  if (/delivered/i.test(input)) return "delivered";
  if (/opened|open/i.test(input)) return "opened";
  if (/clicked|click/i.test(input)) return "clicked";
  if (/bounced|complained|failed|delivery_delayed/i.test(input)) return "failure";
  return "sent";
}

function timestampColumn(type: ReturnType<typeof eventType>) {
  if (type === "delivered") return "delivered_at";
  if (type === "opened") return "opened_at";
  if (type === "clicked") return "clicked_at";
  if (type === "failure") return "failed_at";
  return "sent_at";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Método não permitido." }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

  if (!supabaseUrl || !serviceKey || !webhookSecret) {
    return Response.json(
      { ok: false, error: "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou RESEND_WEBHOOK_SECRET ausente." },
      { status: 500 },
    );
  }

  const raw = await req.text();
  let payload: ResendWebhookPayload;

  try {
    const wh = new Webhook(webhookSecret);
    payload = wh.verify(raw, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as ResendWebhookPayload;
  } catch {
    return Response.json({ ok: false, error: "Assinatura inválida." }, { status: 400 });
  }

  const svixId = req.headers.get("svix-id") ?? crypto.randomUUID();
  const supabase = createClient(supabaseUrl, serviceKey);
  const providerType = payload.type ?? "email.event";
  const mappedType = eventType(providerType);
  const data = payload.data ?? {};
  const emailId =
    asString(data.email_id) ??
    asString(data.emailId) ??
    asString(data.id) ??
    asString(data.message_id) ??
    asString(data.messageId);

  const { data: queue } = emailId
    ? await supabase
        .from("marketing_message_queue")
        .select("id, tenant_id, campaign_id, campaign_channel_id, customer_id, lead_id, channel, recipient")
        .eq("provider", "resend")
        .eq("external_id", emailId)
        .maybeSingle()
    : { data: null };

  const { error: webhookError } = await supabase.from("marketing_webhook_events").insert({
    tenant_id: queue?.tenant_id ?? null,
    provider: "resend",
    external_id: svixId,
    event_type: providerType,
    queue_id: queue?.id ?? null,
    campaign_id: queue?.campaign_id ?? null,
    customer_id: queue?.customer_id ?? null,
    lead_id: queue?.lead_id ?? null,
    headers: {
      svix_id: svixId,
      svix_timestamp: req.headers.get("svix-timestamp"),
    },
    payload,
    processed_at: new Date().toISOString(),
  });

  if (webhookError && !/duplicate key/i.test(webhookError.message)) {
    return Response.json({ ok: false, error: webhookError.message }, { status: 500 });
  }
  if (webhookError && /duplicate key/i.test(webhookError.message)) {
    return Response.json({ ok: true, duplicate: true });
  }

  if (queue) {
    const at = payload.created_at ?? new Date().toISOString();
    await supabase
      .from("marketing_message_queue")
      .update({
        provider_event_type: providerType,
        [timestampColumn(mappedType)]: at,
        ...(mappedType === "failure" ? { status: "failed", last_error: JSON.stringify(data).slice(0, 800) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue.id);

    await supabase.from("marketing_events").insert({
      tenant_id: queue.tenant_id,
      campaign_id: queue.campaign_id,
      campaign_channel_id: queue.campaign_channel_id,
      customer_id: queue.customer_id,
      lead_id: queue.lead_id,
      channel: queue.channel,
      event_type: mappedType,
      provider: "resend",
      external_id: emailId,
      metadata: { queue_id: queue.id, webhook_id: svixId, payload: data },
      occurred_at: at,
    });

    await supabase.from("marketing_customer_timeline").insert({
      tenant_id: queue.tenant_id,
      customer_id: queue.customer_id,
      lead_id: queue.lead_id,
      campaign_id: queue.campaign_id,
      queue_id: queue.id,
      channel: queue.channel,
      event_type: mappedType,
      title: `E-mail ${mappedType}`,
      description: queue.recipient,
      metadata: { provider: "resend", external_id: emailId, webhook_id: svixId },
      occurred_at: at,
    });
  }

  return Response.json({ ok: true, event: providerType, mapped: mappedType, queue_id: queue?.id ?? null });
});
