"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

import { type CrmStage } from "./crm-constants";
export type { CrmStage };

export async function updateCrmStage(customerId: string, stage: CrmStage) {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("customers")
    .update({ crm_stage: stage })
    .eq("id", customerId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/inbox/pipeline");
}
