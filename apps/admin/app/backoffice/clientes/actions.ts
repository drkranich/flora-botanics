"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Edita todos os campos do cliente (nome, e-mail, telefone, CRM). */
export async function updateCustomerFull(
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Não autorizado." };

  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const birthday = String(formData.get("birthday") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const accepts_marketing = formData.get("accepts_marketing") === "on";

  if (!email) return { ok: false, error: "E-mail é obrigatório." };

  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ full_name, email, phone, whatsapp, birthday, notes, tags, accepts_marketing })
    .eq("id", customerId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/backoffice/clientes");
  return { ok: true };
}

/** Arquiva o cliente (soft-delete via archived_at). */
export async function archiveCustomer(customerId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Não autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/backoffice/clientes");
  return { ok: true };
}

/** Restaura um cliente arquivado. */
export async function unarchiveCustomer(customerId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Não autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ archived_at: null })
    .eq("id", customerId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/backoffice/clientes");
  return { ok: true };
}

/** Exclui permanentemente o cliente. Redireciona para a lista. */
export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Não autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("tenant_id", staff.tenantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/backoffice/clientes");
  redirect("/backoffice/clientes");
}
