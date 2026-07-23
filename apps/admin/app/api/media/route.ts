import { NextRequest, NextResponse } from "next/server";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

function canUseTenant(sessionTenantId: string, role: string, tenantId: string) {
  return role === "platform_admin" || sessionTenantId === tenantId;
}

function cleanFileName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const tenantId = req.nextUrl.searchParams.get("tenantId") ?? session.tenantId;
  if (!canUseTenant(session.tenantId, session.role, tenantId)) {
    return NextResponse.json({ error: "Tenant invalido" }, { status: 403 });
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("media")
    .select("id, storage_path, alt, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((item) => ({
    ...item,
    public_url: supabase.storage.from("media").getPublicUrl(item.storage_path).data.publicUrl,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const formData = await req.formData();
  const tenantId = String(formData.get("tenantId") ?? session.tenantId);
  const file = formData.get("file");

  if (!canUseTenant(session.tenantId, session.role, tenantId)) {
    return NextResponse.json({ error: "Tenant invalido" }, { status: 403 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const clean = cleanFileName(file.name);
  const path = `${tenantId}/${Date.now()}-${clean}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

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
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    item: {
      ...data,
      public_url: supabase.storage.from("media").getPublicUrl(data.storage_path).data.publicUrl,
    },
  });
}
