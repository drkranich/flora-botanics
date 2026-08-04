"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { STATUS_EVENT_LABEL } from "./tracking-constants";

// ── Tipos da resposta da API de tracking do Melhor Envio ────────────────────

interface METrackingEvent {
  status: string;
  message: string;
  created_at: string; // ISO 8601
  location?: {
    address?: string;
    city?: string;
    state_abbr?: string; // ex: "SP"
    country?: string;
  };
}

interface METrackingResponse {
  // O ME retorna um objeto indexado pelo tracking_code
  [code: string]: {
    tracking: METrackingEvent[];
  };
}

/** Mapeia status do ME para nosso sistema de status interno */
function mapMEStatus(meStatus: string): string {
  const s = meStatus.toLowerCase();
  if (s.includes("entregue") || s.includes("delivered")) return "delivered";
  if (s.includes("saiu") || s.includes("out for delivery") || s.includes("saída")) return "out_for_delivery";
  if (s.includes("em trânsito") || s.includes("trânsito") || s.includes("transit") || s.includes("encaminhado")) return "in_transit";
  if (s.includes("postado") || s.includes("enviado") || s.includes("coletado") || s.includes("dispatched")) return "dispatched";
  if (s.includes("ocorrência") || s.includes("exception") || s.includes("problema") || s.includes("tentativa")) return "exception";
  return "in_transit";
}

export type ShippingEvent = {
  id: string;
  status: string;
  city: string | null;
  state: string | null;
  description: string | null;
  carrier: string | null;
  tracking_code: string | null;
  whatsapp_sent: boolean;
  whatsapp_sent_at: string | null;
  whatsapp_phone: string | null;
  created_at: string;
};


export async function getShippingEvents(orderId: string): Promise<ShippingEvent[]> {
  const staff = await currentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("shipping_events")
    .select("id, status, city, state, description, carrier, tracking_code, whatsapp_sent, whatsapp_sent_at, whatsapp_phone, created_at")
    .eq("order_id", orderId)
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: true });

  return (data ?? []) as ShippingEvent[];
}

export async function addShippingEvent(
  orderId: string,
  payload: {
    status: string;
    city?: string;
    state?: string;
    description?: string;
    carrier?: string;
    tracking_code?: string;
    sendWhatsapp: boolean;
    phone?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();

  // Busca o pedido para obter dados do cliente
  const { data: order } = await supabase
    .from("orders")
    .select("id, number, customers(full_name, phone)")
    .eq("id", orderId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pedido não encontrado." };

  const customerRaw = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const customer = customerRaw as { full_name: string | null; phone: string | null } | null;
  const phone = payload.phone || customer?.phone || null;

  // Monta mensagem WhatsApp
  let whatsappSent = false;
  let whatsappSentAt: string | null = null;

  if (payload.sendWhatsapp && phone) {
    const message = buildWhatsappMessage({
      orderNumber: (order as { number: string | number }).number,
      status: payload.status,
      city: payload.city,
      state: payload.state,
      description: payload.description,
      customerName: customer?.full_name,
    });

    // Envia via API WhatsApp (requer WHATSAPP_API_URL e WHATSAPP_API_TOKEN no ambiente)
    const result = await sendWhatsappMessage(phone, message);
    if (result.ok) {
      whatsappSent = true;
      whatsappSentAt = new Date().toISOString();
    }
  }

  const { error } = await supabase.from("shipping_events").insert({
    tenant_id: staff.tenantId,
    order_id: orderId,
    status: payload.status,
    city: payload.city || null,
    state: payload.state || null,
    description: payload.description || null,
    carrier: payload.carrier || null,
    tracking_code: payload.tracking_code || null,
    whatsapp_sent: whatsappSent,
    whatsapp_sent_at: whatsappSentAt,
    whatsapp_phone: whatsappSent ? phone : null,
    created_by: staff.id,
  });

  if (error) return { ok: false, error: error.message };

  // Se foi entregue, atualizar status do pedido
  if (payload.status === "delivered") {
    await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", orderId)
      .eq("tenant_id", staff.tenantId);
  }

  revalidatePath(`/vendas/${orderId}`);
  return { ok: true };
}

/**
 * Busca rastreamento real via API Melhor Envio e importa os eventos novos para o banco.
 * Retorna { ok, imported, error }.
 */
export async function importMETrackingEvents(
  orderId: string,
  trackingCode: string,
  carrier: string | null
): Promise<{ ok: boolean; imported: number; error?: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, imported: 0, error: "Sessão inválida." };

  // Chama o Melhor Envio diretamente (token lido do env do Worker)
  let meData: METrackingResponse | null = null;
  try {
    const token = process.env.MELHOR_ENVIO_TOKEN;
    if (!token) {
      return { ok: false, imported: 0, error: "MELHOR_ENVIO_TOKEN não configurado no ambiente do admin." };
    }

    const res = await fetch(
      `https://melhorenvio.com.br/api/v2/me/shipment/tracking/${encodeURIComponent(trackingCode)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "Flora Botanics Admin (contato@florabotanics.com.br)",
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let errMsg = `Erro ${res.status} da API Melhor Envio.`;
      try {
        const j = JSON.parse(text);
        errMsg = j?.message ?? j?.error ?? errMsg;
      } catch { /* usa genérico */ }
      return { ok: false, imported: 0, error: errMsg };
    }

    const raw = await res.text();
    try {
      meData = JSON.parse(raw) as METrackingResponse;
    } catch {
      return { ok: false, imported: 0, error: `Resposta inválida do Melhor Envio: ${raw.slice(0, 100)}` };
    }
  } catch (e) {
    return { ok: false, imported: 0, error: e instanceof Error ? e.message : "Falha de rede ao consultar ME." };
  }

  // O ME retorna { [tracking_code]: { tracking: [...] } }
  const payload = meData?.[trackingCode] ?? Object.values(meData ?? {})[0];
  const rawEvents: METrackingEvent[] = payload?.tracking ?? [];

  if (rawEvents.length === 0) {
    return { ok: true, imported: 0 };
  }

  const supabase = await createClient();

  // Busca eventos já existentes para não duplicar (compara por description + created_at)
  const { data: existing } = await supabase
    .from("shipping_events")
    .select("description, created_at")
    .eq("order_id", orderId)
    .eq("tenant_id", staff.tenantId);

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.description}|${e.created_at}`)
  );

  const toInsert = rawEvents
    .map((ev) => {
      const city = ev.location?.city ?? null;
      const state = ev.location?.state_abbr ?? null;
      const description = ev.message?.trim() || null;
      const created_at = ev.created_at;
      const key = `${description}|${created_at}`;

      if (existingKeys.has(key)) return null;

      return {
        tenant_id: staff.tenantId,
        order_id: orderId,
        status: mapMEStatus(ev.status),
        city,
        state,
        description,
        carrier: carrier ?? null,
        tracking_code: trackingCode,
        whatsapp_sent: false,
        whatsapp_sent_at: null,
        whatsapp_phone: null,
        created_by: staff.id,
        created_at,
      };
    })
    .filter(Boolean);

  if (toInsert.length === 0) {
    return { ok: true, imported: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("shipping_events").insert(toInsert as any[]);
  if (error) return { ok: false, imported: 0, error: error.message };

  revalidatePath(`/vendas/${orderId}`);
  return { ok: true, imported: toInsert.length };
}

export async function deleteShippingEvent(eventId: string, orderId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("shipping_events")
    .delete()
    .eq("id", eventId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath(`/vendas/${orderId}`);
}

/* ── WhatsApp helper ─────────────────────────────────────── */

function buildWhatsappMessage({
  orderNumber,
  status,
  city,
  state,
  description,
  customerName,
}: {
  orderNumber: string | number;
  status: string;
  city?: string;
  state?: string;
  description?: string;
  customerName?: string | null;
}): string {
  const name = customerName?.split(" ")[0] ?? "cliente";
  const location = city ? `${city}${state ? `/${state}` : ""}` : null;

  const statusMessages: Record<string, string> = {
    preparing:
      `Olá, ${name}! 🌿 Seu pedido *#${orderNumber}* da Flora Botanics está sendo preparado com carinho. ` +
      `Em breve será enviado!`,
    dispatched:
      `Boa notícia, ${name}! 🚚 Seu pedido *#${orderNumber}* foi enviado!` +
      (location ? ` Partiu de ${location}.` : ""),
    in_transit:
      `${name}, seu pedido *#${orderNumber}* está a caminho! 📍` +
      (location ? ` Localização atual: *${location}*.` : " Em trânsito."),
    out_for_delivery:
      `${name}, prepare-se! 🛵 Seu pedido *#${orderNumber}* saiu para entrega` +
      (location ? ` em *${location}*` : "") +
      `. Fique de olho!`,
    delivered:
      `${name}, seu pedido *#${orderNumber}* foi entregue! ✅🌸 ` +
      `Esperamos que você aproveite muito. Qualquer dúvida, estamos aqui. 💚 Flora Botanics`,
    exception:
      `${name}, temos uma atualização sobre seu pedido *#${orderNumber}* ⚠️: ` +
      (description ?? "ocorreu uma ocorrência. Nossa equipe já está verificando.") +
      " Entraremos em contato em breve.",
  };

  let msg = statusMessages[status] ?? `Atualização do pedido #${orderNumber}: ${STATUS_EVENT_LABEL[status] ?? status}`;
  if (description && status !== "exception") msg += `\n\n📝 ${description}`;
  msg += "\n\n_Flora Botanics — Cosméticos Naturais_";
  return msg;
}

async function sendWhatsappMessage(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  // Se não configurado, retorna erro silencioso (evento é salvo, mas sem envio)
  if (!apiUrl || !apiToken) {
    console.warn("[WhatsApp] WHATSAPP_API_URL ou WHATSAPP_API_TOKEN não configurados.");
    return { ok: false, error: "WhatsApp não configurado." };
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}
