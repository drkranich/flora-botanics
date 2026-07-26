"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

const ENTRY_TYPES = new Set([
  "income",
  "expense",
  "tax",
  "fee",
  "product_cost",
  "shipping_cost",
  "packaging_cost",
  "operational_cost",
  "adjustment",
]);

const RECURRENCE = new Set(["monthly", "quarterly", "yearly"]);

function centsFromCurrency(input: FormDataEntryValue | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

function text(input: FormDataEntryValue | null) {
  const value = String(input ?? "").trim();
  return value || null;
}

function tags(input: FormDataEntryValue | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createAccountingEntry(formData: FormData) {
  const session = await getStaffSession();
  if (!session || session.role === "tenant_editor") throw new Error("Sem permissao.");

  const tenantId = await effectiveTenantId();
  const type = String(formData.get("type") ?? "expense");
  if (!ENTRY_TYPES.has(type)) throw new Error("Tipo de lancamento invalido.");

  const amountCents = centsFromCurrency(formData.get("amount"));
  if (amountCents <= 0) throw new Error("Informe um valor maior que zero.");

  const category = text(formData.get("category"));
  const description = text(formData.get("description"));
  if (!category || !description) throw new Error("Categoria e descricao sao obrigatorias.");

  const occurredAt = text(formData.get("occurred_at"));
  const recurring = String(formData.get("is_recurring") ?? "") === "on";
  const recurrenceInterval = text(formData.get("recurrence_interval"));

  const supabase = await supabaseServer();
  const { error } = await supabase.from("accounting_entries").insert({
    tenant_id: tenantId,
    type,
    category,
    description,
    amount_cents: amountCents,
    currency: "BRL",
    occurred_at: occurredAt ? new Date(`${occurredAt}T12:00:00`).toISOString() : new Date().toISOString(),
    period_start: text(formData.get("period_start")),
    period_end: text(formData.get("period_end")),
    vendor_name: text(formData.get("vendor_name")),
    document_number: text(formData.get("document_number")),
    payment_method: text(formData.get("payment_method")),
    cost_center: text(formData.get("cost_center")),
    source_channel: text(formData.get("source_channel")),
    source_kind: "manual",
    notes: text(formData.get("notes")),
    tags: tags(formData.get("tags")),
    is_recurring: recurring,
    recurrence_interval: recurring && recurrenceInterval && RECURRENCE.has(recurrenceInterval) ? recurrenceInterval : null,
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/contabilidade");
}

export async function deleteAccountingEntry(id: string) {
  const session = await getStaffSession();
  if (!session || session.role === "tenant_editor") throw new Error("Sem permissao.");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("accounting_entries")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath("/contabilidade");
}
