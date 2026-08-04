import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/server-runtime";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>
): Promise<string> {
  const slug = process.env.TENANT_SLUG ?? "flora-botanics";
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (data) return (data as { id: string }).id;

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

// POST /api/contact
// Body: { nome, email, fone, assunto, mensagem }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      nome?: string;
      email?: string;
      fone?: string;
      assunto?: string;
      mensagem?: string;
    };

    const nome     = (body.nome     ?? "").trim();
    const email    = (body.email    ?? "").trim();
    const fone     = (body.fone     ?? "").trim();
    const assunto  = (body.assunto  ?? "Contato via site").trim();
    const mensagem = (body.mensagem ?? "").trim();

    if (!nome || !email || !mensagem) {
      return NextResponse.json(
        { error: "Nome, e-mail e mensagem são obrigatórios." },
        { status: 400, headers: CORS }
      );
    }

    const supabase  = await getServerSupabase();
    const tenantId  = await resolveTenantId(supabase);
    const now       = new Date().toISOString();
    const preview   = mensagem.slice(0, 140);

    // 1. Criar conversa no helpdesk
    // Colunas reais: contact_email (não contact_handle), channel enum inclui "form"
    const { data: conv, error: convErr } = await supabase
      .from("helpdesk_conversations")
      .insert({
        tenant_id:            tenantId,
        channel:              "form",   // enum: email|whatsapp|instagram|facebook|chat|sms|form|…
        status:               "new",
        contact_name:         nome,
        contact_email:        email,    // coluna correta (não contact_handle)
        contact_phone:        fone || null,
        subject:              assunto,
        last_message_preview: preview,
        last_message_at:      now,
        tags:                 [assunto],
        origin:               "web-form",
      })
      .select("id")
      .single();

    if (convErr || !conv) {
      console.error("[contact] convErr:", convErr);
      return NextResponse.json(
        { error: "Não foi possível registrar o contato." },
        { status: 500, headers: CORS }
      );
    }

    const convId = (conv as { id: string }).id;

    // 2. Salvar mensagem do visitante
    // Colunas reais: type (enum inbound/outbound/…), sender_is_contact (bool), sem sender_type
    const { error: msgErr } = await supabase.from("helpdesk_messages").insert({
      tenant_id:        tenantId,
      conversation_id:  convId,
      type:             "inbound",       // enum helpdesk_message_type
      sender_name:      nome,
      sender_email:     email,
      sender_is_contact: true,
      body: `Assunto: ${assunto}${fone ? `\nTelefone: ${fone}` : ""}\n\n${mensagem}`,
      created_at:       now,
    });

    if (msgErr) {
      console.error("[contact] msgErr:", msgErr);
      // Conversa criada — retorna sucesso mesmo se mensagem falhar
    }

    return NextResponse.json({ ok: true, conv_id: convId }, { headers: CORS });
  } catch (err) {
    console.error("[contact] erro interno:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: CORS });
  }
}
