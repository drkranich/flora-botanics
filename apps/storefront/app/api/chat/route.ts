import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/server-runtime";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Resolve tenant_id usando service_role (sem depender do anon client nem de RLS)
async function resolveTenantId(supabase: Awaited<ReturnType<typeof getServerSupabase>>): Promise<string> {
  const slug = process.env.TENANT_SLUG ?? "flora-botanics";
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (data) return (data as { id: string }).id;

  // Fallback: primeiro tenant ativo
  const { data: fallback } = await supabase
    .from("tenants")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fallback) return (fallback as { id: string }).id;

  throw new Error("Nenhum tenant ativo encontrado.");
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
// action: "start"   → cria conversa + mensagem de boas-vindas
// action: "message" → adiciona mensagem do visitante
//
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action:     "start" | "message";
      name?:      string;
      email?:     string;
      phone?:     string;
      topic?:     string;
      conv_id?:   string;
      text?:      string;
    };

    const supabase = await getServerSupabase();
    const tenantId = await resolveTenantId(supabase);

    if (body.action === "start") {
      const name  = (body.name  ?? "").trim();
      const email = (body.email ?? "").trim();
      const phone = (body.phone ?? "").trim();
      const topic = (body.topic ?? "Atendimento geral").trim();

      if (!name || !email || !phone) {
        return NextResponse.json({ error: "Nome, e-mail e telefone são obrigatórios." }, { status: 400, headers: CORS });
      }

      const preview = `[Chat] ${topic} — ${name}`;

      // Cria conversa
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          tenant_id:            tenantId,
          channel:              "chat",
          contact_name:         name,
          contact_handle:       email,
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

      // Mensagem de boas-vindas (direction=out)
      await supabase.from("messages").insert({
        tenant_id:       tenantId,
        conversation_id: convId,
        direction:       "out",
        sender_name:     "Flora Botanics",
        body:            `Olá, ${name}! 👋 Seja bem-vindo(a) ao atendimento Flora Botanics.\n\nAssunto: ${topic} | Tel: ${phone}\n\nEm instantes um de nossos atendentes estará com você.`,
      });

      return NextResponse.json({ conv_id: convId, name, topic }, { headers: CORS });
    }

    if (body.action === "message") {
      const convId      = (body.conv_id ?? "").trim();
      const text        = (body.text    ?? "").trim();
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];

      if (!convId || (!text && !attachments.length)) {
        return NextResponse.json({ error: "Dados incompletos." }, { status: 400, headers: CORS });
      }

      const { error } = await supabase.from("messages").insert({
        tenant_id:       tenantId,
        conversation_id: convId,
        direction:       "in",
        sender_name:     "Visitante",
        body:            text,
        attachments:     attachments.length ? attachments : null,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });

      const preview = text.slice(0, 140) || (attachments.length ? `[${attachments.length} arquivo(s)]` : "");
      await supabase.from("conversations")
        .update({ last_message_preview: preview, last_message_at: new Date().toISOString() })
        .eq("id", convId)
        .eq("tenant_id", tenantId);

      return NextResponse.json({ ok: true }, { headers: CORS });
    }

    if (body.action === "edit") {
      const convId = (body.conv_id ?? "").trim();
      const msgId  = (body.msg_id  ?? "").trim();
      const text   = (body.text    ?? "").trim();

      if (!convId || !msgId || !text) {
        return NextResponse.json({ error: "Dados incompletos." }, { status: 400, headers: CORS });
      }

      // Só permite editar mensagens "in" (do visitante) desta conversa
      const { error } = await supabase
        .from("messages")
        .update({ body: text })
        .eq("id",              msgId)
        .eq("conversation_id", convId)
        .eq("tenant_id",       tenantId)
        .eq("direction",       "in");

      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
      return NextResponse.json({ ok: true }, { headers: CORS });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400, headers: CORS });
  } catch (err) {
    console.error("[chat] erro interno:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: CORS });
  }
}

// ── GET /api/chat?conv_id=xxx&after=ISO ───────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("conv_id") ?? "";
    const after  = searchParams.get("after")   ?? new Date(0).toISOString();

    if (!convId) {
      return NextResponse.json({ error: "conv_id obrigatório." }, { status: 400, headers: CORS });
    }

    const supabase = await getServerSupabase();
    const tenantId = await resolveTenantId(supabase);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, direction, sender_name, body, attachments, created_at")
      .eq("conversation_id", convId)
      .eq("tenant_id", tenantId)
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .limit(50);

    const messages = (msgs ?? []).map((m: { id: string; direction: string; sender_name: string; body: string; attachments: unknown; created_at: string }) => ({
      id:          m.id,
      direction:   m.direction,
      sender_name: m.sender_name,
      body:        m.body,
      attachments: Array.isArray(m.attachments) ? m.attachments : [],
      created_at:  m.created_at,
    }));

    return NextResponse.json({ messages }, { headers: CORS });
  } catch (err) {
    console.error("[chat/GET] erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: CORS });
  }
}
