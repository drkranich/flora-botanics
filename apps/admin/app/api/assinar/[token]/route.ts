/**
 * POST /api/assinar/[token]
 *
 * Endpoint público (sem auth de sessão) que recebe a assinatura do cliente e
 * grava na tabela document_signatures via service_role (bypassa RLS).
 *
 * Body: { sigId, name, email, signatureImage (base64 PNG) }
 */
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role — necessário pois anônimo não pode fazer UPDATE via RLS
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars ausentes.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json() as {
      sigId?: string;
      name?: string;
      email?: string;
      signatureImage?: string;
    };

    const { sigId, name, email, signatureImage } = body;

    // Validações básicas
    if (!sigId || !name?.trim() || !email?.trim() || !signatureImage) {
      return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    const supabase = serviceClient();

    // Verifica se o registro existe, está pending e não expirou
    const { data: sig } = await supabase
      .from("document_signatures")
      .select("id, status, expires_at, public_token")
      .eq("id", sigId)
      .eq("public_token", token)   // dupla verificação: id + token
      .maybeSingle();

    if (!sig) {
      return NextResponse.json({ error: "Registro de assinatura não encontrado." }, { status: 404 });
    }
    if (sig.status !== "pending") {
      return NextResponse.json({ error: "Este documento já foi assinado ou rejeitado." }, { status: 409 });
    }
    if (new Date(sig.expires_at as string) < new Date()) {
      return NextResponse.json({ error: "Link de assinatura expirado." }, { status: 410 });
    }

    // Captura IP do signatário
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = request.headers.get("user-agent") ?? "";

    // Salva a imagem da assinatura no bucket 'signatures'
    let signatureImagePath: string | null = null;
    try {
      const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filePath = `signatures/${sigId}/assinatura.png`;

      const { error: uploadErr } = await supabase.storage
        .from("signatures")
        .upload(filePath, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadErr) signatureImagePath = filePath;
    } catch {
      // Falha no upload não bloqueia o registro
    }

    // Atualiza o registro com os dados da assinatura
    const { error: updateErr } = await supabase
      .from("document_signatures")
      .update({
        status: "signed",
        signer_name: name.trim(),
        signer_email: email.trim().toLowerCase(),
        signer_ip: ip,
        user_agent: userAgent,
        signed_at: new Date().toISOString(),
        method: "canvas",
        signature_image_path: signatureImagePath,
      })
      .eq("id", sigId);

    if (updateErr) {
      console.error("[assinar] update error:", updateErr);
      return NextResponse.json({ error: "Erro ao registrar assinatura." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[assinar] unexpected error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
