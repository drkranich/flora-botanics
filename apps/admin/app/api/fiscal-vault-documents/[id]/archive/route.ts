import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const FISCAL_REVALIDATE_PATHS = [
  "/backoffice/notas-fiscais",
  "/backoffice/notas-fiscais/cofre",
  "/backoffice/notas-fiscais/auditoria",
];

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function revalidateFiscalVault() {
  for (const path of FISCAL_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado.", 401);

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason?.trim() || "Arquivamento solicitado no cofre fiscal.";
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: archived, error: archiveError } = await supabase
      .from("fiscal_vault_documents")
      .update({ archived_at: now, archived_by: staff.id, status: "archived" })
      .eq("id", id)
      .eq("tenant_id", staff.tenantId)
      .select("id")
      .maybeSingle();

    if (archiveError) return jsonError(`Falha ao arquivar documento: ${archiveError.message}`, 400);
    if (!archived) return jsonError("Documento não encontrado ou sem permissão para arquivar.", 404);

    await supabase.from("document_vault_audit_events").insert({
      tenant_id: staff.tenantId,
      vault_document_id: id,
      action: "archived",
      reason,
      actor_id: staff.id,
    });

    await supabase.from("fiscal_audit_events").insert({
      tenant_id: staff.tenantId,
      actor_id: staff.id,
      action: "archived_vault_document",
      entity_type: "fiscal_vault_document",
      entity_id: id,
      after_data: { archived_at: now, status: "archived" },
      justification: reason,
    });

    revalidateFiscalVault();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao arquivar documento.");
  }
}
