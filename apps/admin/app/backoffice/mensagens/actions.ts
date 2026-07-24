"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { sendEmail, renderTemplate, textToHtml } from "@/lib/email/resend";
import { TEMPLATE_PRESETS } from "./template-presets";

export type SendTestResult = { ok: true } | { ok: false; error: string };

/**
 * Envia um template de e-mail para um endereço de teste, via Resend.
 * Substitui variáveis {{nome}} por valores de exemplo (o próprio nome
 * da variável, entre colchetes) para facilitar a revisão visual.
 */
export async function sendTestEmail(templateId: string, formData: FormData): Promise<SendTestResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  const to = String(formData.get("to") ?? "").trim();
  if (!to) return { ok: false, error: "Informe um e-mail de destino." };

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("message_templates")
    .select("id, name, channel, subject, body, variables")
    .eq("id", templateId)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!template) return { ok: false, error: "Template não encontrado." };
  if (template.channel !== "email") return { ok: false, error: "Este template não é de e-mail." };

  const variableNames = Array.isArray(template.variables) ? (template.variables as string[]) : [];
  const sampleVars: Record<string, string> = {};
  for (const name of variableNames) {
    sampleVars[name] = `[${name}]`;
  }

  const subject = renderTemplate(template.subject || `Teste — ${template.name}`, sampleVars);
  const body = renderTemplate(template.body, sampleVars);

  const result = await sendEmail({
    to,
    subject,
    html: textToHtml(body),
    text: body,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

function parseJson(input: string, fallback: unknown) {
  if (!input.trim()) return fallback;
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

export async function createTemplateFromPreset(presetId: string) {
  const staff = await currentStaff();
  if (!staff) return;

  const preset = TEMPLATE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;

  const supabase = await createClient();
  await supabase.from("message_templates").upsert(
    {
      tenant_id: staff.tenantId,
      name: preset.template.name,
      channel: preset.template.channel,
      subject: preset.template.subject,
      body: preset.template.body,
      variables: preset.template.variables,
    },
    { onConflict: "tenant_id,name", ignoreDuplicates: true }
  );

  revalidatePath("/backoffice/mensagens");
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

  revalidatePath("/backoffice/mensagens");
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

  revalidatePath("/backoffice/mensagens");
}

export async function updateTemplateBody(
  templateId: string,
  data: { name?: string; subject?: string; body?: string }
) {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  await supabase
    .from("message_templates")
    .update({
      ...(data.name ? { name: data.name } : {}),
      ...(data.subject !== undefined ? { subject: data.subject || null } : {}),
      ...(data.body ? { body: data.body } : {}),
    })
    .eq("id", templateId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/backoffice/mensagens");
}

/**
 * Envia HTML renderizado diretamente — usado pelo compositor visual,
 * que já tem o HTML final em memória sem precisar recarregar do banco.
 */
export async function sendTestHtmlEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendTestResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Sessão inválida." };

  if (!to || !html) return { ok: false, error: "Informe destinatário e corpo do e-mail." };

  const result = await sendEmail({
    to,
    subject: subject || "Teste — Flora Botanics",
    html,
    text: "Abra este e-mail em um cliente compatível com HTML para visualizá-lo.",
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function createAutomation(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) return;

  const name = String(formData.get("name") ?? "").trim();
  const trigger = String(formData.get("trigger") ?? "manual");
  const templateId = String(formData.get("template_id") ?? "").trim();
  const delayHours = Number(formData.get("delay_hours") ?? 0) || 0;
  const conditionsRaw = String(formData.get("conditions") ?? "");

  if (!name) return;

  // Monta a ação de e-mail se um template foi selecionado
  const actions = templateId
    ? [{ type: "send_email", template_id: templateId, delay_hours: delayHours }]
    : [];

  const supabase = await createClient();
  await supabase.from("automations").insert({
    tenant_id: staff.tenantId,
    name,
    trigger,
    conditions: parseJson(conditionsRaw, {}),
    actions,
    status: "draft",
  });

  revalidatePath("/backoffice/mensagens");
}

export async function updateAutomationAction(
  automationId: string,
  templateId: string,
  delayHours: number
) {
  const staff = await currentStaff();
  if (!staff) return;

  const actions = templateId
    ? [{ type: "send_email", template_id: templateId, delay_hours: delayHours }]
    : [];

  const supabase = await createClient();
  await supabase
    .from("automations")
    .update({ actions })
    .eq("id", automationId)
    .eq("tenant_id", staff.tenantId);

  revalidatePath("/backoffice/mensagens");
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

  revalidatePath("/backoffice/mensagens");
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

  revalidatePath("/backoffice/mensagens");
}
