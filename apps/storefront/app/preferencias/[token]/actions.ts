"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/tenant";

function checked(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "on";
}

function interests(formData: FormData) {
  return String(formData.get("interests") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function updateMarketingPreferences(token: string, formData: FormData) {
  const client = db();
  const { error } = await client.rpc("update_marketing_preferences", {
    preference_token: token,
    email_marketing_value: checked(formData, "email_marketing"),
    sms_marketing_value: checked(formData, "sms_marketing"),
    whatsapp_marketing_value: checked(formData, "whatsapp_marketing"),
    ads_personalization_value: checked(formData, "ads_personalization"),
    remarketing_value: checked(formData, "remarketing"),
    transactional_messages_value: checked(formData, "transactional_messages"),
    frequency_value: String(formData.get("frequency") ?? "normal"),
    interests_value: interests(formData),
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/preferencias/${token}`);
}
