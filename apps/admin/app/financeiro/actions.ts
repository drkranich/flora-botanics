"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import {
  calculateFinanceScenario,
  type FinanceComponentGroup,
  type FinanceComponentInput,
  type FinanceLineItemInput,
  type FinanceMode,
  type SaleModel,
} from "@/lib/finance/engine";

const MODES = new Set<FinanceMode>(["unit", "batch", "kit", "combo", "order", "customer", "channel", "b2b", "b2c", "campaign", "subscription"]);
const SALE_MODELS = new Set<SaleModel>(["retail", "wholesale", "b2b", "b2c", "consignment", "marketplace", "physical_store", "representative", "subscription", "corporate"]);
const GROUPS = new Set<FinanceComponentGroup>(["production", "packaging", "logistics", "tax", "commission", "channel_fee", "fixed_expense", "variable_expense", "labor", "investment", "custom"]);
const PRICE_TABLE_TYPES = new Set(["retail", "wholesale", "distributor", "representative", "physical_store", "marketplace", "b2b", "special_customer", "campaign", "subscription", "region", "export"]);
const COMMERCIAL_QUOTE_STATUSES = new Set(["draft", "review", "sent", "viewed", "approved", "rejected", "expired", "cancelled"]);

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} é obrigatório.`);
  return value;
}

function decimal(formData: FormData, key: string, fallback = 0) {
  const raw = String(formData.get(key) ?? "").replace(/\./g, "").replace(",", ".").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function cents(formData: FormData, key: string) {
  return Math.round(decimal(formData, key, 0) * 100);
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseComponents(formData: FormData): FinanceComponentInput[] {
  const raw = String(formData.get("components_json") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      const row = item as { group?: string; label?: string; amountCents?: number };
      const group = GROUPS.has(row.group as FinanceComponentGroup) ? (row.group as FinanceComponentGroup) : "custom";
      return {
        group,
        label: String(row.label ?? "").trim() || "Custo sem descrição",
        amountCents: Math.max(0, Math.round(Number(row.amountCents) || 0)),
      };
    })
    .filter((item) => item.amountCents > 0);
}

function parseItems(formData: FormData): FinanceLineItemInput[] {
  const raw = String(formData.get("items_json") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      const row = item as {
        name?: string;
        sku?: string;
        kind?: string;
        quantity?: number;
        unitPriceCents?: number;
        discountPercent?: number;
      };
      const kind = ["product", "kit", "combo", "service", "custom"].includes(String(row.kind))
        ? (row.kind as FinanceLineItemInput["kind"])
        : "custom";
      return {
        name: String(row.name ?? "").trim(),
        sku: String(row.sku ?? "").trim() || undefined,
        kind,
        quantity: Math.max(0, Number(row.quantity) || 0),
        unitPriceCents: Math.max(0, Math.round(Number(row.unitPriceCents) || 0)),
        discountPercent: Math.max(0, Number(row.discountPercent) || 0),
      };
    })
    .filter((item) => item.name && item.quantity > 0);
}

async function ensureCanEdit() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");
  const tenantId = await effectiveTenantId();
  return { session, tenantId };
}

export async function saveFinanceCalculation(formData: FormData) {
  const { session, tenantId } = await ensureCanEdit();
  const title = requiredText(formData, "title", "Nome do cenário");
  const modeRaw = String(formData.get("calculation_mode") ?? "unit");
  const saleModelRaw = String(formData.get("sale_model") ?? "retail");
  const mode = MODES.has(modeRaw as FinanceMode) ? (modeRaw as FinanceMode) : "unit";
  const saleModel = SALE_MODELS.has(saleModelRaw as SaleModel) ? (saleModelRaw as SaleModel) : "retail";
  const components = parseComponents(formData);
  const items = parseItems(formData);

  const input = {
    title,
    mode,
    saleModel,
    channel: requiredText(formData, "channel", "Canal"),
    quantity: Math.max(1, decimal(formData, "quantity", 1)),
    unitPriceCents: cents(formData, "unit_price"),
    discountPercent: Math.max(0, decimal(formData, "discount_percent", 0)),
    desiredMarginPercent: Math.max(0, decimal(formData, "desired_margin_percent", 55)),
    minimumMarginPercent: Math.max(0, decimal(formData, "minimum_margin_percent", 35)),
    items,
    components,
  };
  const totals = calculateFinanceScenario(input);
  const supabase = await supabaseServer();

  const { data: calculation, error } = await supabase
    .from("finance_calculations")
    .insert({
      tenant_id: tenantId,
      title,
      calculation_mode: mode,
      sale_model: saleModel,
      channel: input.channel,
      customer_name: text(formData, "customer_name"),
      seller_name: text(formData, "seller_name"),
      quantity: input.quantity,
      currency: "BRL",
      status: "saved",
      input,
      totals,
      alerts: totals.alerts,
      notes: text(formData, "notes"),
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !calculation) throw new Error(error?.message ?? "Não foi possível salvar o cenário.");

  const componentRows = components.map((component) => ({
    tenant_id: tenantId,
    calculation_id: calculation.id,
    component_group: component.group,
    category: component.group,
    description: component.label,
    quantity: 1,
    unit: "un",
    unit_cost_cents: component.amountCents,
    total_cents: component.amountCents,
    allocation_method: "direct",
    created_by: session.userId,
  }));

  if (componentRows.length) {
    const { error: componentError } = await supabase.from("finance_cost_components").insert(componentRows);
    if (componentError) throw new Error(componentError.message);
  }

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "finance_calculation",
    entity_id: calculation.id,
    action: "created",
    after_data: { input, totals },
    created_by: session.userId,
  });

  revalidatePath("/financeiro");
  redirect(`/financeiro?calculo=${calculation.id}`);
}

export async function createCommercialQuote(formData: FormData) {
  const { session, tenantId } = await ensureCanEdit();
  const kind = String(formData.get("kind") ?? "budget");
  const allowedKind = ["quote", "budget", "proposal"].includes(kind) ? kind : "budget";
  const customerName = requiredText(formData, "customer_name", "Cliente");
  const calculationId = text(formData, "calculation_id");
  const supabase = await supabaseServer();

  let totals = {};
  let items: unknown[] = [];
  if (calculationId) {
    const { data: calculation } = await supabase
      .from("finance_calculations")
      .select("id, input, totals")
      .eq("id", calculationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (calculation) {
      totals = calculation.totals ?? {};
      items = [{ type: "scenario", calculation_id: calculation.id, input: calculation.input }];
    }
  }

  const { data: quote, error } = await supabase
    .from("commercial_quotes")
    .insert({
      tenant_id: tenantId,
      kind: allowedKind,
      status: "draft",
      customer_name: customerName,
      company_name: text(formData, "company_name"),
      document_number: text(formData, "document_number"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      address: text(formData, "address"),
      responsible_contact: text(formData, "responsible_contact"),
      seller_name: text(formData, "seller_name"),
      channel: text(formData, "channel"),
      payment_terms: text(formData, "payment_terms"),
      delivery_terms: text(formData, "delivery_terms"),
      items,
      calculation_id: calculationId,
      totals,
      terms: text(formData, "terms"),
      notes: text(formData, "notes"),
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !quote) throw new Error(error?.message ?? "Não foi possível criar o orçamento.");

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "commercial_quote",
    entity_id: quote.id,
    action: "created",
    after_data: { kind: allowedKind, customer_name: customerName, calculation_id: calculationId },
    created_by: session.userId,
  });

  revalidatePath("/financeiro");
  redirect(`/financeiro?orcamento=${quote.id}`);
}

export async function deleteFinanceCalculation(id: string) {
  const { tenantId } = await ensureCanEdit();
  const supabase = await supabaseServer();
  const { error } = await supabase.from("finance_calculations").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}

export async function updateFinanceSettings(formData: FormData) {
  const { tenantId } = await ensureCanEdit();
  const supabase = await supabaseServer();
  const payload = {
    tenant_id: tenantId,
    default_currency: "BRL",
    target_margin_percent: Math.max(0, decimal(formData, "target_margin_percent", 55)),
    minimum_margin_percent: Math.max(0, decimal(formData, "minimum_margin_percent", 35)),
    default_tax_percent: Math.max(0, decimal(formData, "default_tax_percent", 8)),
    default_payment_fee_percent: Math.max(0, decimal(formData, "default_payment_fee_percent", 3.99)),
    default_payment_fixed_cents: cents(formData, "default_payment_fixed"),
    default_logistics_percent: Math.max(0, decimal(formData, "default_logistics_percent", 6)),
    default_overhead_percent: Math.max(0, decimal(formData, "default_overhead_percent", 5)),
    rules: {
      approval_minimum_margin_percent: Math.max(0, decimal(formData, "approval_minimum_margin_percent", 25)),
      max_discount_without_approval_percent: Math.max(0, decimal(formData, "max_discount_without_approval_percent", 12)),
      logistics_warning_percent: Math.max(0, decimal(formData, "logistics_warning_percent", 18)),
    },
  };

  const { error } = await supabase.from("finance_settings").upsert(payload, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "finance_settings",
    action: "updated",
    after_data: payload,
  });

  revalidatePath("/financeiro");
}

export async function createPriceTable(formData: FormData) {
  const { session, tenantId } = await ensureCanEdit();
  const tableTypeRaw = String(formData.get("table_type") ?? "retail");
  const tableType = PRICE_TABLE_TYPES.has(tableTypeRaw) ? tableTypeRaw : "retail";
  const name = requiredText(formData, "name", "Nome da tabela");
  const supabase = await supabaseServer();

  const payload = {
    tenant_id: tenantId,
    name,
    table_type: tableType,
    channel: text(formData, "channel"),
    customer_name: text(formData, "customer_name"),
    min_quantity: Math.max(1, decimal(formData, "min_quantity", 1)),
    discount_percent: Math.max(0, decimal(formData, "discount_percent", 0)),
    commission_percent: Math.max(0, decimal(formData, "commission_percent", 0)),
    minimum_margin_percent: Math.max(0, decimal(formData, "minimum_margin_percent", 30)),
    valid_from: dateValue(formData, "valid_from"),
    valid_until: dateValue(formData, "valid_until"),
    approval_required: String(formData.get("approval_required") ?? "") === "on",
    rules: {
      payment_terms: text(formData, "payment_terms"),
      logistics_terms: text(formData, "logistics_terms"),
      notes: text(formData, "notes"),
    },
    created_by: session.userId,
  };

  const { data, error } = await supabase.from("finance_price_tables").insert(payload).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível criar a tabela de preço.");

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "finance_price_table",
    entity_id: data.id,
    action: "created",
    after_data: payload,
    created_by: session.userId,
  });

  revalidatePath("/financeiro");
}

export async function deletePriceTable(id: string) {
  const { tenantId } = await ensureCanEdit();
  const supabase = await supabaseServer();
  const { error } = await supabase.from("finance_price_tables").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}

export async function updateCommercialQuoteStatus(id: string, status: string) {
  const { session, tenantId } = await ensureCanEdit();
  if (!COMMERCIAL_QUOTE_STATUSES.has(status)) throw new Error("Status inválido.");

  const supabase = await supabaseServer();
  const payload: Record<string, string | null> = { status };
  if (status === "sent") payload.sent_at = new Date().toISOString();
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

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/documentos/${id}`);
}

export async function duplicateCommercialQuote(id: string) {
  const { session, tenantId } = await ensureCanEdit();
  const supabase = await supabaseServer();
  const { data: quote, error: quoteError } = await supabase
    .from("commercial_quotes")
    .select("kind, customer_name, company_name, document_number, state_registration, phone, email, address, responsible_contact, seller_name, channel, payment_terms, delivery_terms, valid_until, items, calculation_id, totals, terms, notes")
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
      notes: quote.notes ? `${quote.notes}\n\nDuplicado do documento ${id}.` : `Duplicado do documento ${id}.`,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !copy) throw new Error(error?.message ?? "Não foi possível duplicar o documento.");

  await supabase.from("finance_audit_events").insert({
    tenant_id: tenantId,
    entity_type: "commercial_quote",
    entity_id: copy.id,
    action: "duplicated",
    before_data: { source_id: id },
    after_data: { copy_id: copy.id },
    created_by: session.userId,
  });

  revalidatePath("/financeiro");
  redirect(`/financeiro/documentos/${copy.id}`);
}

export async function convertCommercialQuoteToOrder(id: string) {
  await ensureCanEdit();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("convert_commercial_quote_to_order", { p_quote_id: id });
  if (error) throw new Error(error.message);

  const result = data as { order_id?: string } | null;
  if (!result?.order_id) throw new Error("A conversão não retornou um pedido.");

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/documentos/${id}`);
  revalidatePath("/vendas");
  redirect(`/vendas/${result.order_id}`);
}

