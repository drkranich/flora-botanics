import { NextRequest, NextResponse } from "next/server";
import { currentTenant } from "@/lib/tenant";
import { getServerSupabase } from "@/lib/server-runtime";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
// action: "start"   → cria conversa + mensagem inicial
// action: "message" → adiciona mensagem à conversa
//
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action:     "start" | "message";
      // start
      name?:      string;
      email?:     string;
      phone?:     string;
      topic?:     string;
      // message
      conv_id?:   string;
      text?:      string;
    };

    const tenant   = await currentTenant();
    // service_role: bypassa RLS — necessário pois visitantes não estão autenticados
    const supabase = await getServerSupabase();

    if (body.action === "start") {
      const name  = (body.name  ?? "").trim();
      const email = (body.email ?? "").trim();
      const phone = (body.phone ?? "").trim();
      const topic = (body.topic ?? "Atendimento geral").trim();

      if (!name || !email || !phone) {
        return NextResponse.json({ error: "Nome, e-mail e telefone são obrigatórios." }, { status: 400, headers: CORS });
      }

      const preview = `[Chat] ${topic} — ${name}`;

      // Cria a conversa no helpdesk
      const { data: conv, error: convErr } = await supabase
        .from("helpdesk_conversations")
        .insert({
          tenant_id:            tenant.tenantId,
          channel:              "chat",
          subject:              `[Chat] ${topic}`,
          contact_name:         name,
          contact_email:        email,
          contact_phone:        phone,
          status:               "open",
          last_message_preview: preview,
          last_message_at:      new Date().toISOString(),
          tags:                 [topic],
        })
        .select("id")
        .single();

      if (convErr || !conv) {
        console.error("[chat/start] convErr:", convErr);
        return NextResponse.json({ error: "Não foi possível iniciar o chat." }, { status: 500, headers: CORS });
      }

      const convId = (conv as { id: string }).id;

      // Mensagem inicial do atendimento (type=outbound = do atendente para o cliente)
      await supabase.from("helpdesk_messages").insert({
        tenant_id:        tenant.tenantId,
        conversation_id:  convId,
        type:             "outbound",
        sender_name:      "Flora Botanics",
        sender_is_contact: false,
        body:             `Olá, ${name}! 👋 Seja bem-vindo(a) ao atendimento Flora Botanics.\n\nAssunto: ${topic}\n\nEm instantes um de nossos atendentes estará com você.`,
        is_internal_note: false,
      });

      return NextResponse.json({ conv_id: convId, name, topic }, { headers: CORS });
    }

    if (body.action === "message") {
      const convId = (body.conv_id ?? "").trim();
      const text   = (body.text   ?? "").trim();

      if (!convId || !text) {
        return NextResponse.json({ error: "Dados incompletos." }, { status: 400, headers: CORS });
      }

      const { error } = await supabase.from("helpdesk_messages").insert({
        tenant_id:         tenant.tenantId,
        conversation_id:   convId,
        type:              "inbound",
        sender_name:       "Visitante",
        sender_is_contact: true,
        body:              text,
        is_internal_note:  false,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });

      // Atualiza preview da conversa
      await supabase.from("helpdesk_conversations")
        .update({ last_message_preview: text.slice(0, 140), last_message_at: new Date().toISOString() })
        .eq("id", convId)
        .eq("tenant_id", tenant.tenantId);

      return NextResponse.json({ ok: true }, { headers: CORS });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400, headers: CORS });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: CORS });
  }
}

// ── GET /api/chat?conv_id=xxx&after=ISO ───────────────────────────────────────
// Polling: retorna novas mensagens depois de `after`
//
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("conv_id") ?? "";
    const after  = searchParams.get("after")   ?? new Date(0).toISOString();

    if (!convId) {
      return NextResponse.json({ error: "conv_id obrigatório." }, { status: 400, headers: CORS });
    }

    const tenant   = await currentTenant();
    const supabase = await getServerSupabase();

    const { data: msgs } = await supabase
      .from("helpdesk_messages")
      .select("id, type, sender_name, body, created_at")
      .eq("conversation_id", convId)
      .eq("tenant_id", tenant.tenantId)
      .eq("is_internal_note", false)
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .limit(50);

    // Mapeia type (inbound/outbound) → direction (in/out) para o ChatWidget
    const messages = (msgs ?? []).map((m: { id: string; type: string; sender_name: string; body: string; created_at: string }) => ({
      id:          m.id,
      direction:   m.type === "outbound" ? "out" : "in",
      sender_name: m.sender_name,
      body:        m.body,
      created_at:  m.created_at,
    }));

    return NextResponse.json({ messages }, { headers: CORS });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: CORS });
  }
}
