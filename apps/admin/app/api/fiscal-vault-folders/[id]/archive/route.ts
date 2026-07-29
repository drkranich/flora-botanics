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
    const reason = body.reason?.trim() || "Pasta arquivada no cofre fiscal.";
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: archived, error: archiveError } = await supabase
      .from("document_vault_folders")
      .update({ archived_at: now })
      .eq("id", id)
      .eq("tenant_id", staff.tenantId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (archiveError) return jsonError(`Falha ao arquivar pasta: ${archiveError.message}`, 400);
    if (!archived) return jsonError("Pasta não encontrada ou sem permissão para arquivar.", 404);

    await supabase.from("document_vault_audit_events").insert({
      tenant_id: staff.tenantId,
      folder_id: id,
      action: "folder_archived",
      reason,
      actor_id: staff.id,
    });

    revalidateFiscalVault();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao arquivar pasta.");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado.", 401);

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason?.trim() || "Pasta desarquivada no cofre fiscal.";
    const supabase = await createClient();

    const { data: restored, error: restoreError } = await supabase
      .from("document_vault_folders")
      .update({ archived_at: null })
      .eq("id", id)
      .eq("tenant_id", staff.tenantId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (restoreError) return jsonError(`Falha ao desarquivar pasta: ${restoreError.message}`, 400);
    if (!restored) return jsonError("Pasta não encontrada ou sem permissão para desarquivar.", 404);

    await supabase.from("document_vault_audit_events").insert({
      tenant_id: staff.tenantId,
      folder_id: id,
      action: "folder_unarchived",
      reason,
      actor_id: staff.id,
    });

    revalidateFiscalVault();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao desarquivar pasta.");
  }
}
