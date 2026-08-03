/**
 * POST /api/inbox/upload
 *
 * Upload de arquivo para o bucket chat-attachments.
 * Usa service_role (via getCloudflareContext) para bypass de RLS —
 * mesmo padrão do storefront /api/chat/upload.
 * Autenticação garantida por currentStaff() antes do upload.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createClient } from "@supabase/supabase-js";
import { currentStaff } from "@/lib/auth";

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

type RuntimeEnv = Record<string, string | undefined>;

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as RuntimeEnv;
  } catch {
    return process.env;
  }
}

export async function POST(req: NextRequest) {
  // Autenticação — só staff pode fazer upload
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const convId   = (formData.get("conv_id") as string | null) ?? "admin";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Tipo não permitido. Use JPG, PNG, WebP, SVG ou PDF." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo 10 MB." }, { status: 400 });
    }

    // Cliente com service_role — bypassa RLS, igual ao storefront
    const env            = await getRuntimeEnv();
    const url            = env.NEXT_PUBLIC_SUPABASE_URL       ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY      ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    if (!url || !serviceRoleKey) {
      console.error("[inbox/upload] service_role ausente");
      return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
    }

    const supabase = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const path        = `${convId}/${Date.now()}_${safeName}`;
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
      console.error("[inbox/upload]", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    return NextResponse.json({
      url:  pub.publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
      path,
    });

  } catch (err) {
    console.error("[inbox/upload] erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
