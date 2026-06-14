"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

export async function updateCustomer(customerId: string, formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return { error: "Não autorizado." };

  const birthdayRaw = String(formData.get("birthday") ?? "").trim();
  const whatsappRaw = String(formData.get("whatsapp") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const acceptsMarketing = formData.get("accepts_marketing") === "on";

  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      birthday: birthdayRaw || null,
      whatsapp: whatsappRaw || null,
      notes: notesRaw || null,
      tags,
      accepts_marketing: acceptsMarketing,
    })
    .eq("id", customerId)
    .eq("tenant_id", staff.tenantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clientes/${customerId}`);
  return { success: true };
}
