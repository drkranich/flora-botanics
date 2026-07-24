"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { STATUS_EVENT_LABEL } from "./tracking-constants";

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

  const customer = order.customers as { full_name: string | null; phone: string | null } | null;
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
