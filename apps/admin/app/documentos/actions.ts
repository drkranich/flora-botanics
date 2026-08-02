"use server";

/**
 * /documentos/actions.ts
 *
 * Server Actions do módulo /documentos.
 * Mantidas aqui (e não importadas de /financeiro) para garantir que o
 * bundler do Cloudflare Workers (OpenNext) inclua as actions no segment correto
 * e evitar UnrecognizedActionError em runtime.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

const COMMERCIAL_QUOTE_STATUSES = new Set([
  "draft", "review", "sent", "viewed", "approved", "rejected", "expired", "cancelled", "converted",
]);

async function ensureCanEdit() {
  const session = await getStaffSession();
  if (!session) throw new Error("Sessão inválida.");
  if (session.role === "tenant_editor") throw new Error("Sem permissão.");
  const tenantId = await effectiveTenantId();
  return { session, tenantId };
}

export async function updateDocumentStatus(id: string, status: string) {
  const { session, tenantId } = await ensureCanEdit();
  if (!COMMERCIAL_QUOTE_STATUSES.has(status)) throw new Error("Status inválido.");

  const supabase = await supabaseServer();
  const payload: Record<string, string | null> = { status };
  if (status === "sent")     payload.sent_at     = new Date().toISOString();
  if (status === "approved") payload.accepted_at = new Date().toISOString();

  const { data: before } = await supabase
    .from("commercial_quotes")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { error } = await supabase
    .from("commercial_quotes")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .neq("status", "converted");

  if (error) throw new Error(error.message);

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "commercial_quote",
    entity_id: id,
    action: "status_updated",
    before_data: before ?? null,
    after_data: payload,
    created_by: session.userId,
  });

  revalidatePath("/documentos");
  revalidatePath(`/documentos/${id}`);
}

export async function duplicateDocument(id: string) {
  const { session, tenantId } = await ensureCanEdit();
  const supabase = await supabaseServer();

  const { data: quote, error: quoteError } = await supabase
    .from("commercial_quotes")
    .select(
      "kind, customer_name, company_name, document_number, state_registration, phone, email, address, responsible_contact, seller_name, channel, payment_terms, delivery_terms, valid_until, items, calculation_id, totals, terms, notes"
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (quoteError || !quote) throw new Error(quoteError?.message ?? "Documento não encontrado.");

  const { data: copy, error } = await supabase
    .from("commercial_quotes")
    .insert({
      ...quote,
      tenant_id: tenantId,
      status: "draft",
      sent_at: null,
      viewed_at: null,
      accepted_at: null,
      converted_order_id: null,
      notes: quote.notes
        ? `${quote.notes}\n\nDuplicado do documento ${id}.`
        : `Duplicado do documento ${id}.`,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !copy) throw new Error(error?.message ?? "Não foi possível duplicar.");

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "commercial_quote",
    entity_id: copy.id,
    action: "duplicated",
    before_data: { source_id: id },
    after_data: { copy_id: copy.id },
    created_by: session.userId,
  });

  revalidatePath("/documentos");
  redirect(`/documentos/${copy.id}`);
}

export async function convertDocumentToOrder(id: string) {
  await ensureCanEdit();
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("convert_commercial_quote_to_order", {
    p_quote_id: id,
  });

  if (error) throw new Error(error.message);

  const result = data as { order_id?: string } | null;
  if (!result?.order_id) throw new Error("A conversão não retornou um pedido.");

  revalidatePath("/documentos");
  revalidatePath("/vendas");
  redirect(`/vendas/${result.order_id}`);
}
