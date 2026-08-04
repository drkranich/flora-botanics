"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

function revalidate() {
  revalidatePath("/documentos/fiscais");
}

// ── PASTAS ──────────────────────────────────────────────────────────────────

export async function createFiscalFolder(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const name = (formData.get("name") as string)?.trim();
  const category = (formData.get("category") as string) || "outros";
  const parent_id = (formData.get("parent_id") as string) || null;
  if (!name) return { ok: false, error: "Nome obrigatório." };
  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_folders").insert({
    tenant_id: staff.tenantId,
    name,
    category,
    parent_id: parent_id || null,
    created_by: staff.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function renameFiscalFolder(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!id || !name) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("fiscal_folders")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteFiscalFolder(id: string) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  // Move arquivos da pasta para sem pasta antes de excluir
  await supabase.from("fiscal_files").update({ folder_id: null }).eq("folder_id", id).eq("tenant_id", staff.tenantId);
  const { error } = await supabase.from("fiscal_folders").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ── ARQUIVOS ─────────────────────────────────────────────────────────────────

export async function saveFiscalFile(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const name = (formData.get("name") as string)?.trim();
  const storage_path = (formData.get("storage_path") as string)?.trim();
  const folder_id = (formData.get("folder_id") as string) || null;
  const category = (formData.get("category") as string) || "outros";
  const description = (formData.get("description") as string)?.trim() || null;
  const competence = (formData.get("competence") as string)?.trim() || null;
  const size_bytes = parseInt(formData.get("size_bytes") as string) || 0;
  if (!name || !storage_path) return { ok: false, error: "Nome e caminho obrigatórios." };
  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_files").insert({
    tenant_id: staff.tenantId,
    folder_id: folder_id || null,
    name,
    description,
    category,
    storage_path,
    size_bytes,
    competence,
    created_by: staff.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteFiscalFile(id: string) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };
  const supabase = await createClient();
  // Busca o path para remover do storage
  const { data: file } = await supabase.from("fiscal_files").select("storage_path").eq("id", id).eq("tenant_id", staff.tenantId).single();
  if (file?.storage_path) {
    await supabase.storage.from("fiscal-documents").remove([file.storage_path]);
  }
  const { error } = await supabase.from("fiscal_files").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const staff = await currentStaff();
  if (!staff) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("fiscal-documents").createSignedUrl(storagePath, 300); // 5 min
  return data?.signedUrl ?? null;
}

// ── DOCUMENTOS RECEBIDOS ─────────────────────────────────────────────────────

function revalidateReceived() {
  revalidatePath("/documentos/recebidos");
}

export async function saveReceivedDoc(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const name        = (formData.get("name") as string)?.trim();
  const doc_type    = (formData.get("doc_type") as string) || "outros";
  const department  = (formData.get("department") as string) || "fiscal";
  const competence  = (formData.get("competence") as string)?.trim() || null;
  const due_date    = (formData.get("due_date") as string) || null;
  const amount_raw  = (formData.get("amount") as string)?.replace(",", ".");
  const amount_cents = amount_raw ? Math.round(parseFloat(amount_raw) * 100) : null;
  const issuer      = (formData.get("issuer") as string)?.trim() || null;
  const barcode     = (formData.get("barcode") as string)?.trim() || null;
  const storage_path = (formData.get("storage_path") as string)?.trim() || null;
  const size_bytes  = parseInt(formData.get("size_bytes") as string) || 0;
  const status      = (formData.get("status") as string) || "open";

  if (!name) return { ok: false, error: "Nome obrigatório." };

  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_received_docs").insert({
    tenant_id: staff.tenantId,
    name,
    doc_type,
    department,
    competence,
    due_date: due_date || null,
    amount_cents,
    issuer,
    barcode,
    storage_path,
    size_bytes,
    status,
    created_by: staff.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidateReceived();
  return { ok: true };
}

export async function updateReceivedDocStatus(id: string, status: string, paid_at?: string | null) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiscal_received_docs")
    .update({ status, paid_at: paid_at ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidateReceived();
  return { ok: true };
}

export async function markReceivedDocViewed(id: string) {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase
    .from("fiscal_received_docs")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", staff.tenantId)
    .is("viewed_at", null);
}

export async function deleteReceivedDoc(id: string) {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("fiscal_received_docs")
    .select("storage_path")
    .eq("id", id)
    .eq("tenant_id", staff.tenantId)
    .single();

  if (doc?.storage_path) {
    await supabase.storage.from("fiscal-documents").remove([doc.storage_path]);
  }

  const { error } = await supabase
    .from("fiscal_received_docs")
    .delete()
    .eq("id", id)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };
  revalidateReceived();
  return { ok: true };
}
