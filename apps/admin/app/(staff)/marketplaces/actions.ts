"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

export async function setListingStatus(listingId: string, status: "active" | "paused") {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("marketplace_listings")
    .update({ status })
    .eq("id", listingId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/marketplaces");
}
