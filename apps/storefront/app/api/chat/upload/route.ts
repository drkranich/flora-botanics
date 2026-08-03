import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/server-runtime";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400, headers: CORS });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido. Use JPG, PNG, SVG ou PDF." }, { status: 400, headers: CORS });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo 10 MB." }, { status: 400, headers: CORS });
    }

    const supabase = await getServerSupabase();

    // Gera nome único: conv_id (se passado) + timestamp + nome original saneado
    const convId  = (formData.get("conv_id") as string | null) ?? "anon";
    const ext     = file.name.split(".").pop() ?? "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const path    = `${convId}/${Date.now()}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8       = new Uint8Array(arrayBuffer);

    const { error: upErr } = await supabase.storage
      .from("chat-attachments")
      .upload(path, uint8, {
        contentType:  file.type,
        cacheControl: "3600",
        upsert:       false,
      });

    if (upErr) {
      console.error("[chat/upload] storage error:", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500, headers: CORS });
    }

    const { data: pub } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    return NextResponse.json({
      url:      pub.publicUrl,
      name:     file.name,
      type:     file.type,
      size:     file.size,
      path,
      ext,
    }, { headers: CORS });

  } catch (err) {
    console.error("[chat/upload] erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: CORS });
  }
}
