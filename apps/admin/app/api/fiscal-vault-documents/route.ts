import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/fiscal-vault-documents?folder_id=&status=&page=&limit= */
export async function GET(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado.", 401);

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folder_id");
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    let query = supabase
      .from("fiscal_vault_documents")
      .select(
        "id, name, document_type, category, competence, due_date, value_cents, status, verification_status, origin, created_at, updated_at",
        { count: "exact" }
      )
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (folderId) query = query.eq("folder_id" as never, folderId);
    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) return jsonError(error.message, 400);

    return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao listar documentos do cofre.");
  }
}

/** POST /api/fiscal-vault-documents — cria um documento manual no cofre */
export async function POST(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado.", 401);
    if (staff.role === "tenant_editor") return jsonError("Sem permissão.", 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const {
      name,
      document_type,
      category,
      competence,
      due_date,
      value_cents,
      notes,
      tags,
      origin = "manual",
    } = body as {
      name?: string;
      document_type?: string;
      category?: string;
      competence?: string;
      due_date?: string;
      value_cents?: number;
      notes?: string;
      tags?: string[];
      origin?: string;
    };

    if (!name || !document_type) {
      return jsonError("Campos obrigatórios: name, document_type.", 400);
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("fiscal_vault_documents")
      .insert({
        tenant_id: staff.tenantId,
        name,
        document_type,
        category: category ?? null,
        competence: competence ?? null,
        due_date: due_date ?? null,
        value_cents: value_cents ?? 0,
        notes: notes ?? null,
        tags: tags ?? [],
        origin,
        status: "received",
        created_by: staff.id,
      })
      .select("id")
      .single();

    if (error) return jsonError(error.message, 400);

    revalidatePath("/backoffice/notas-fiscais/cofre");
    revalidatePath("/backoffice/documentos");
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao criar documento no cofre.");
  }
}
