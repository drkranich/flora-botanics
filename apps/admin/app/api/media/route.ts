import { NextRequest, NextResponse } from "next/server";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

function canUseTenant(sessionTenantId: string, role: string, tenantId: string) {
  return role === "platform_admin" || sessionTenantId === tenantId;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "type" in value &&
    "size" in value &&
    "arrayBuffer" in value &&
    typeof (value as File).arrayBuffer === "function"
  );
}

function cleanFileName(name: string) {
  const cleaned = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `imagem-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) return jsonError("Nao autorizado", 401);

    const tenantId = req.nextUrl.searchParams.get("tenantId") ?? session.tenantId;
    if (!tenantId) return jsonError("Tenant nao informado", 400);
    if (!canUseTenant(session.tenantId, session.role, tenantId)) {
      return jsonError("Tenant invalido", 403);
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("media")
      .select("id, storage_path, alt, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) return jsonError(error.message);

    const items = (data ?? []).map((item) => ({
      ...item,
      public_url: supabase.storage.from("media").getPublicUrl(item.storage_path).data.publicUrl,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao carregar biblioteca.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) return jsonError("Nao autorizado", 401);

    const formData = await req.formData();
    const tenantId = String(formData.get("tenantId") ?? session.tenantId).trim();
    const file = formData.get("file");

    if (!tenantId) return jsonError("Tenant nao informado", 400);
    if (!canUseTenant(session.tenantId, session.role, tenantId)) {
      return jsonError("Tenant invalido", 403);
    }

    if (!isUploadFile(file)) return jsonError("Arquivo obrigatorio", 400);
    if (!file.type.startsWith("image/")) return jsonError("Envie apenas arquivos de imagem.", 400);
    if (file.size > 10 * 1024 * 1024) return jsonError("Imagem acima do limite de 10 MB.", 413);

    const supabase = await supabaseServer();
    const clean = cleanFileName(file.name);
    const path = `${tenantId}/${Date.now()}-${clean}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, bytes, { cacheControl: "31536000", upsert: false, contentType: file.type });

    if (uploadError) return jsonError(uploadError.message);

    const { data, error: insertError } = await supabase
      .from("media")
      .insert({
        tenant_id: tenantId,
        storage_path: path,
        provider: "supabase",
        mime: file.type,
        byte_size: file.size,
        alt: file.name.replace(/\.[^.]+$/, ""),
      })
      .select("id, storage_path, alt, created_at")
      .single();

    if (insertError) {
      await supabase.storage.from("media").remove([path]).catch(() => undefined);
      return jsonError(insertError.message);
    }

    return NextResponse.json({
      item: {
        ...data,
        public_url: supabase.storage.from("media").getPublicUrl(data.storage_path).data.publicUrl,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha no upload.");
  }
}
