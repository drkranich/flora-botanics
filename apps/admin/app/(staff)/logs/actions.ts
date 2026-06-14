"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

export async function setLogResolved(logId: string, resolved: boolean) {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("system_logs")
    .update({ resolved })
    .eq("id", logId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/logs");
}
