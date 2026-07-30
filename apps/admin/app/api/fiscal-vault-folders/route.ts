import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/fiscal-vault-folders?parent_id= */
export async function GET(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado.", 401);

    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parent_id");

    const supabase = await createClient();

    let query = supabase
      .from("document_vault_folders")
      .select("id, name, description, color, icon, parent_id, archived_at, created_at, updated_at")
      .eq("tenant_id", staff.tenantId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (parentId) {
      query = query.eq("parent_id", parentId);
    } else {
      query = query.is("parent_id", null);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 400);

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao listar pastas do cofre.");
  }
}

/** POST /api/fiscal-vault-folders — cria uma pasta */
export async function POST(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado.", 401);
    if (staff.role === "tenant_editor") return jsonError("Sem permissão.", 403);

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      parent_id?: string;
    };

    if (!body.name?.trim()) return jsonError("Campo obrigatório: name.", 400);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("document_vault_folders")
      .insert({
        tenant_id: staff.tenantId,
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        color: body.color ?? null,
        icon: body.icon ?? null,
        parent_id: body.parent_id ?? null,
        created_by: staff.id,
      })
      .select("id")
      .single();

    if (error) return jsonError(error.message, 400);

    revalidatePath("/backoffice/notas-fiscais/cofre");
    revalidatePath("/backoffice/documentos");
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao criar pasta no cofre.");
  }
}
