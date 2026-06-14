"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

function parseJson(input: string, fallback: unknown) {
  if (!input.trim()) return fallback;
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

export async function createTemplate(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return;

  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "email");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const variablesRaw = String(formData.get("variables") ?? "");

  if (!name || !body) return;

  const supabase = await createClient();
  await supabase.from("message_templates").insert({
    tenant_id: staff.tenantId,
    name,
    channel,
    subject: subject || null,
    body,
    variables: parseJson(variablesRaw, []),
  });

  revalidatePath("/mensagens");
}

export async function deleteTemplate(templateId: string) {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("message_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/mensagens");
}

export async function createAutomation(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return;

  const name = String(formData.get("name") ?? "").trim();
  const trigger = String(formData.get("trigger") ?? "manual");
  const conditionsRaw = String(formData.get("conditions") ?? "");
  const actionsRaw = String(formData.get("actions") ?? "");

  if (!name) return;

  const supabase = await createClient();
  await supabase.from("automations").insert({
    tenant_id: staff.tenantId,
    name,
    trigger,
    conditions: parseJson(conditionsRaw, {}),
    actions: parseJson(actionsRaw, []),
    status: "draft",
  });

  revalidatePath("/mensagens");
}

export async function setAutomationStatus(automationId: string, status: "draft" | "active" | "paused") {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("automations")
    .update({ status })
    .eq("id", automationId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/mensagens");
}

export async function deleteAutomation(automationId: string) {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("automations")
    .delete()
    .eq("id", automationId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/mensagens");
}
