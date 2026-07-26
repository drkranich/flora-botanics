"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function nullableText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function textList(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function cents(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(",", ".").trim();
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : null;
}

function datetime(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? new Date(value).toISOString() : null;
}

async function ensureCanEdit() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");
  return effectiveTenantId();
}

function campaignPayload(formData: FormData, fallbackTitle?: string) {
  const title = String(formData.get("title") ?? fallbackTitle ?? "").trim();
  if (!title) throw new Error("Informe o nome da campanha.");

  return {
    title,
    slug: slugify(String(formData.get("slug") ?? "") || title),
    subtitle: nullableText(formData, "subtitle"),
    status: String(formData.get("status") ?? "draft"),
    channel: nullableText(formData, "channel"),
    target_cities: textList(formData, "target_cities"),
    target_regions: textList(formData, "target_regions"),
    starts_at: datetime(formData, "starts_at"),
    ends_at: datetime(formData, "ends_at"),
    budget_cents: cents(formData, "budget"),
    body: nullableText(formData, "body"),
    cta_label: nullableText(formData, "cta_label"),
    cta_url: nullableText(formData, "cta_url"),
    utm_source: nullableText(formData, "utm_source"),
    utm_medium: nullableText(formData, "utm_medium"),
    utm_campaign: nullableText(formData, "utm_campaign"),
  };
}

export async function createCampaign(formData: FormData) {
  const tenantId = await ensureCanEdit();
  const supabase = await supabaseServer();
  const payload = campaignPayload(formData);

  const { error } = await supabase.from("campaigns").insert({
    ...payload,
    tenant_id: tenantId,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/vendas/campanhas");
  redirect("/vendas/campanhas");
}

export async function updateCampaign(id: string, formData: FormData) {
  const tenantId = await ensureCanEdit();
  const supabase = await supabaseServer();
  const payload = campaignPayload(formData);

  const { error } = await supabase
    .from("campaigns")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);

  revalidatePath("/vendas/campanhas");
  revalidatePath(`/vendas/campanhas/${id}`);
  redirect("/vendas/campanhas");
}

export async function deleteCampaign(id: string) {
  const tenantId = await ensureCanEdit();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);

  revalidatePath("/vendas/campanhas");
  redirect("/vendas/campanhas");
}
