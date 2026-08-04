"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { calculateLandedCost, type CostResponsibility } from "@/lib/international/landed-cost";

const FISCAL_PATH = "/backoffice/notas-fiscais";
const INTERNATIONAL_PATH = `${FISCAL_PATH}/comercio-exterior`;

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} é obrigatório.`);
  return value;
}

function decimal(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(/\./g, "").replace(",", ".").trim();
  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

function cents(formData: FormData, key: string) {
  return Math.round(decimal(formData, key) * 100);
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function list(value: string[]) {
  return value;
}

async function audit(
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    operationId?: string | null;
    nextValue?: Record<string, unknown>;
    result?: string;
  }
) {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("export_audit_logs").insert({
    tenant_id: staff.tenantId,
    actor_id: staff.id,
    operation_id: input.operationId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    next_value: input.nextValue ?? {},
    result: input.result ?? "success",
    source: "cms_comercio_exterior",
  });
}

export async function seedInternationalTradeCenter(): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  const packages = [
    {
      code: "BR",
      name: "Brasil",
      scope: "country",
      country_code: "BR",
      currency: "BRL",
      language: "pt-BR",
      tax_system: "NF-e de exportação, CFOP, NCM, DU-E, LPCO e Portal Único Siscomex.",
      package_status: "operational",
      confidence_status: "official_imported",
      official_sources: list(["SEFAZ", "Portal Único Siscomex", "Receita Federal"]),
      documents: { brasil: ["NF-e de exportação", "DU-E", "LPCO quando aplicável", "DANFE", "XML"] },
      obligations: { exports: ["CFOP iniciado por 7 quando aplicável", "unidade estatística compatível com NCM"] },
      alerts: ["Não transmitir sem certificado e integração oficial."],
    },
    {
      code: "EU",
      name: "União Europeia",
      scope: "bloc",
      bloc: "EU",
      currency: "EUR",
      language: "multi",
      tax_system: "VAT, IOSS, OSS, EORI, TARIC, import VAT e customs duty.",
      package_status: "needs_review",
      confidence_status: "simulation",
      official_sources: list(["Comissão Europeia", "TARIC", "autoridades fiscais nacionais"]),
      documents: { commercial: ["Commercial Invoice", "Packing List", "comprovante IOSS quando aplicável"] },
      obligations: { warning: "IOSS é regime específico para vendas à distância dentro do limite aplicável." },
      alerts: ["Não usar alíquota única para todos os países europeus."],
    },
    {
      code: "GB",
      name: "Reino Unido",
      scope: "country",
      country_code: "GB",
      currency: "GBP",
      language: "en-GB",
      tax_system: "UK VAT, UK EORI, customs duty, import VAT e HMRC.",
      package_status: "needs_review",
      confidence_status: "simulation",
      official_sources: list(["HMRC", "UK Global Tariff"]),
      documents: { commercial: ["Commercial Invoice", "Packing List", "UK EORI quando aplicável"] },
      obligations: { registration: "Pode exigir registro de VAT conforme venda direta, marketplace, valor e localização dos bens." },
      alerts: ["Separar Reino Unido da União Europeia."],
    },
    {
      code: "US",
      name: "Estados Unidos",
      scope: "country",
      country_code: "US",
      currency: "USD",
      language: "en-US",
      tax_system: "HTS, customs duty, MPF, HMF quando aplicável, Sales Tax estadual/local e nexus.",
      package_status: "needs_review",
      confidence_status: "simulation",
      official_sources: list(["CBP", "HTS", "autoridades estaduais de Sales Tax"]),
      documents: { commercial: ["Commercial Invoice", "Packing List", "documentos do importador"] },
      obligations: { sales_tax: "Sales Tax não é imposto federal; avaliar nexus, marketplace facilitator e registros locais." },
      alerts: ["Não ignorar tarifas federais de importação nem mudanças de de minimis."],
    },
    {
      code: "CA",
      name: "Canadá",
      scope: "country",
      country_code: "CA",
      currency: "CAD",
      language: "en-CA/fr-CA",
      tax_system: "GST, HST, PST, QST, tarifas e CBSA.",
      package_status: "draft",
      confidence_status: "simulation",
      official_sources: list(["CBSA", "CRA", "províncias"]),
      documents: { commercial: ["Commercial Invoice", "Packing List", "documentos CBSA"] },
      obligations: { taxes: "Separar GST/HST/PST/QST por província." },
      alerts: ["Pacote estrutural: validar fontes antes de operação."],
    },
  ];

  const { error: packagesError } = await supabase.from("jurisdictions").upsert(
    packages.map((pkg) => ({
      tenant_id: staff.tenantId,
      ...pkg,
      version: "1.0",
      created_by: staff.id,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "tenant_id,code" }
  );
  if (packagesError) throw new Error(`Falha ao instalar pacotes de jurisdição: ${packagesError.message}`);

  const incoterms = [
    ["EXW", "Ex Works", "Comprador assume coleta, exportação, frete, seguro e importação."],
    ["FCA", "Free Carrier", "Vendedor entrega ao transportador indicado; riscos mudam no ponto acordado."],
    ["CPT", "Carriage Paid To", "Vendedor paga transporte principal, risco transfere antes."],
    ["CIP", "Carriage and Insurance Paid To", "Vendedor paga transporte e seguro."],
    ["DAP", "Delivered at Place", "Vendedor entrega no local; comprador assume importação e tributos."],
    ["DPU", "Delivered at Place Unloaded", "Vendedor entrega descarregado no destino."],
    ["DDP", "Delivered Duty Paid", "Vendedor assume entrega, desembaraço e tributos no destino."],
    ["FAS", "Free Alongside Ship", "Uso marítimo; vendedor entrega ao lado do navio."],
    ["FOB", "Free on Board", "Uso marítimo; risco muda quando mercadoria embarca."],
    ["CFR", "Cost and Freight", "Uso marítimo; vendedor paga frete, comprador assume risco no embarque."],
    ["CIF", "Cost, Insurance and Freight", "Uso marítimo; vendedor paga frete e seguro."],
  ];

  const { error: incotermsError } = await supabase.from("incoterms").upsert(
    incoterms.map(([code, name, warning]) => ({
      tenant_id: staff.tenantId,
      code,
      name,
      review_warning: warning,
      seller_responsibilities: ["Validar responsabilidades no contrato antes da venda."],
      buyer_responsibilities: ["Confirmar importador, documentos e tributos no destino."],
      required_documents: ["Commercial Invoice", "Packing List", "documentos de transporte"],
      created_by: staff.id,
    })),
    { onConflict: "tenant_id,code" }
  );
  if (incotermsError) throw new Error(`Falha ao instalar Incoterms: ${incotermsError.message}`);

  await audit({
    action: "seeded_international_trade_center",
    entityType: "jurisdiction_packages",
    nextValue: { packages: packages.map((pkg) => pkg.code), incoterms: incoterms.map(([code]) => code) },
  });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
}

export async function reviewJurisdictionPackage(
  jurisdictionId: string,
  intent: "review" | "validate" | "draft"
): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;

  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + 90);

  const statusByIntent = {
    review: {
      package_status: "needs_review",
      confidence_status: "waiting_review",
      validated_by: null,
    },
    validate: {
      package_status: "operational",
      confidence_status: "specialist_validated",
      validated_by: staff.id,
    },
    draft: {
      package_status: "draft",
      confidence_status: "simulation",
      validated_by: null,
    },
  } satisfies Record<string, Record<string, string | null>>;

  const payload = {
    ...statusByIntent[intent],
    last_reviewed_at: now.toISOString(),
    next_review_at: nextReview.toISOString(),
    updated_at: now.toISOString(),
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jurisdictions")
    .update(payload)
    .eq("id", jurisdictionId)
    .eq("tenant_id", staff.tenantId)
    .select("id, code, name")
    .maybeSingle();

  if (error) throw new Error(`Falha ao atualizar jurisdição: ${error.message}`);
  if (!data) throw new Error("Pacote de jurisdição não encontrado.");

  await audit({
    action: `reviewed_jurisdiction_${intent}`,
    entityType: "jurisdiction",
    entityId: data.id,
    nextValue: {
      code: data.code,
      name: data.name,
      ...payload,
    },
  });

  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
}

export async function runInternationalProviderAction(
  providerKey: string,
  intent: "configure" | "sync"
): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const action = intent === "configure" ? "configured_international_provider" : "synced_international_provider";
  const title =
    intent === "configure"
      ? `Provider ${providerKey} marcado para configuração`
      : `Sincronização solicitada para ${providerKey}`;

  await supabase.from("export_alerts").insert({
    tenant_id: staff.tenantId,
    severity: intent === "sync" ? "info" : "warning",
    title,
    description:
      intent === "sync"
        ? "Solicitação registrada no centro de comércio exterior. A execução real depende das credenciais e do adapter oficial do provider."
        : "Cadastro operacional registrado. Vincule credenciais seguras e ambiente antes de habilitar transmissão automática.",
    entity_type: "international_provider",
    entity_id: null,
    status: "open",
    created_by: staff.id,
  });

  await audit({
    action,
    entityType: "international_provider",
    entityId: null,
    nextValue: {
      providerKey,
      intent,
      requestedAt: now,
      source: "cms_comercio_exterior",
    },
  });

  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
  revalidatePath(`${INTERNATIONAL_PATH}/integracoes`);
}

export async function createInternationalTaxRule(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    jurisdiction_id: requiredText(formData, "jurisdiction_id", "Jurisdição"),
    tax_name: requiredText(formData, "tax_name", "Imposto"),
    tax_kind: requiredText(formData, "tax_kind", "Tipo"),
    product_scope: text(formData, "product_scope"),
    ncm: text(formData, "ncm"),
    hs_code: text(formData, "hs_code"),
    local_tariff_code: text(formData, "local_tariff_code"),
    customer_type: text(formData, "customer_type"),
    sale_channel: text(formData, "sale_channel"),
    operation_type: text(formData, "operation_type"),
    incoterm: text(formData, "incoterm"),
    responsibility: requiredText(formData, "responsibility", "Responsável"),
    base_kind: requiredText(formData, "base_kind", "Base"),
    rate_percent: decimal(formData, "rate_percent"),
    fixed_amount_cents: cents(formData, "fixed_amount"),
    threshold_cents: cents(formData, "threshold"),
    currency: requiredText(formData, "currency", "Moeda"),
    rule_status: requiredText(formData, "rule_status", "Status"),
    official_source: text(formData, "official_source"),
    source_url: text(formData, "source_url"),
    effective_from: dateValue(formData, "effective_from"),
    effective_until: dateValue(formData, "effective_until"),
    version: text(formData, "version") ?? "1.0",
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data } = await supabase.from("international_tax_rules").insert(payload).select("id").single();
  await audit({ action: "created_international_tax_rule", entityType: "international_tax_rule", entityId: data?.id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createExportOperation(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const now = Date.now().toString().slice(-6);
  const destinationJurisdictionId = requiredText(formData, "destination_jurisdiction_id", "Destino");
  const operationNumber = text(formData, "operation_number") ?? `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${now}`;
  const taxResponsibility = requiredText(formData, "tax_responsibility", "Responsabilidade") as CostResponsibility;

  const operationPayload = {
    tenant_id: staff.tenantId,
    operation_number: operationNumber,
    title: requiredText(formData, "title", "Título"),
    status: requiredText(formData, "status", "Status"),
    sale_type: requiredText(formData, "sale_type", "Tipo de venda"),
    sale_channel: requiredText(formData, "sale_channel", "Canal"),
    destination_jurisdiction_id: destinationJurisdictionId,
    destination_country: requiredText(formData, "destination_country", "País de destino"),
    destination_region: text(formData, "destination_region"),
    destination_city: text(formData, "destination_city"),
    destination_postal_code: text(formData, "destination_postal_code"),
    buyer_name: text(formData, "buyer_name"),
    consignee_name: text(formData, "consignee_name"),
    importer_of_record: text(formData, "importer_of_record"),
    carrier_name: text(formData, "carrier_name"),
    marketplace_name: text(formData, "marketplace_name"),
    fiscal_representative: text(formData, "fiscal_representative"),
    incoterm: requiredText(formData, "incoterm", "Incoterm"),
    tax_responsibility: taxResponsibility,
    currency: requiredText(formData, "currency", "Moeda"),
    destination_currency: requiredText(formData, "destination_currency", "Moeda do destino"),
    exchange_rate: decimal(formData, "exchange_rate") || 1,
    exchange_source: text(formData, "exchange_source"),
    exchange_date: dateValue(formData, "exchange_date"),
    payment_terms: text(formData, "payment_terms"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };

  const { data: operation, error } = await supabase
    .from("export_operations")
    .insert(operationPayload)
    .select("id")
    .single();
  if (error || !operation) return;

  await supabase.from("export_operation_items").insert({
    tenant_id: staff.tenantId,
    operation_id: operation.id,
    item_type: requiredText(formData, "item_type", "Tipo do item"),
    description: requiredText(formData, "item_description", "Descrição do item"),
    sku: text(formData, "sku"),
    ncm: text(formData, "ncm"),
    hs_code: text(formData, "hs_code"),
    local_tariff_code: text(formData, "local_tariff_code"),
    origin_country: text(formData, "origin_country") ?? "BR",
    quantity: decimal(formData, "quantity") || 1,
    unit: text(formData, "unit") ?? "un",
    net_weight_kg: decimal(formData, "net_weight_kg"),
    gross_weight_kg: decimal(formData, "gross_weight_kg"),
    volume_m3: decimal(formData, "volume_m3"),
    unit_price_cents: cents(formData, "unit_price"),
    discount_cents: cents(formData, "discount"),
    customs_value_cents: cents(formData, "customs_value"),
    material: text(formData, "material"),
    purpose: text(formData, "purpose"),
    brand: text(formData, "brand"),
    batch: text(formData, "batch"),
    expires_at: dateValue(formData, "expires_at"),
    manufactured_in: text(formData, "manufactured_in") ?? "BR",
  });

  const result = calculateLandedCost({
    productValueCents: cents(formData, "product_value"),
    productionCostCents: cents(formData, "production_cost"),
    brazilianExportCostCents: cents(formData, "brazilian_export_cost"),
    internationalFreightCents: cents(formData, "international_freight"),
    insuranceCents: cents(formData, "insurance"),
    packagingCents: cents(formData, "packaging"),
    customsDutyPercent: decimal(formData, "customs_duty_percent"),
    destinationTaxPercent: decimal(formData, "destination_tax_percent"),
    salesTaxPercent: decimal(formData, "sales_tax_percent"),
    commissionPercent: decimal(formData, "commission_percent"),
    paymentFeePercent: decimal(formData, "payment_fee_percent"),
    complianceCents: cents(formData, "compliance_cost"),
    contingencyPercent: decimal(formData, "contingency_percent"),
    targetMarginPercent: decimal(formData, "target_margin_percent") || 35,
    taxResponsibility,
    exchangeRate: operationPayload.exchange_rate,
    currency: operationPayload.currency,
    destinationCurrency: operationPayload.destination_currency,
  });

  const { data: calculation } = await supabase
    .from("landed_cost_calculations")
    .insert({
      tenant_id: staff.tenantId,
      operation_id: operation.id,
      scenario_name: text(formData, "scenario_name") ?? "Cenário principal",
      status: "draft",
      product_value_cents: result.productValueCents,
      brazilian_cost_cents: result.brazilianCostCents,
      export_cost_cents: result.exportCostCents,
      fob_cents: result.fobCents,
      cif_cents: result.cifCents,
      customs_value_cents: result.customsValueCents,
      import_duty_cents: result.importDutyCents,
      destination_tax_cents: result.destinationTaxCents,
      sales_tax_cents: result.salesTaxCents,
      logistics_cents: result.logisticsCents,
      commission_cents: result.commissionCents,
      payment_fee_cents: result.paymentFeeCents,
      compliance_cents: result.complianceCents,
      contingency_cents: result.contingencyCents,
      total_landed_cost_cents: result.totalLandedCostCents,
      revenue_gross_cents: result.revenueGrossCents,
      revenue_net_cents: result.revenueNetCents,
      profit_gross_cents: result.profitGrossCents,
      profit_net_cents: result.profitNetCents,
      margin_gross_percent: result.marginGrossPercent,
      margin_net_percent: result.marginNetPercent,
      markup_percent: result.markupPercent,
      break_even_cents: result.breakEvenCents,
      minimum_price_cents: result.minimumPriceCents,
      recommended_price_cents: result.recommendedPriceCents,
      customer_price_cents: result.customerPriceCents,
      taxes_paid_by_flora_cents: result.taxesPaidByFloraCents,
      taxes_paid_by_buyer_cents: result.taxesPaidByBuyerCents,
      currency: operationPayload.currency,
      destination_currency: operationPayload.destination_currency,
      exchange_rate: operationPayload.exchange_rate,
      memory: result.memory,
      warnings: result.warnings,
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (calculation) {
    await supabase.from("landed_cost_components").insert(
      result.components.map((component) => ({
        tenant_id: staff.tenantId,
        calculation_id: calculation.id,
        group_key: component.groupKey,
        name: component.name,
        amount_cents: component.amountCents,
        currency: operationPayload.currency,
        payer: component.payer,
        confidence_status: component.confidenceStatus,
        notes: component.notes,
      }))
    );
  }

  if (result.warnings.length) {
    await supabase.from("export_alerts").insert(
      result.warnings.map((warning) => ({
        tenant_id: staff.tenantId,
        operation_id: operation.id,
        severity: "warning",
        title: warning,
        description: "Alerta gerado automaticamente pela memória de cálculo internacional.",
        entity_type: "landed_cost_calculation",
        entity_id: calculation?.id ?? null,
        created_by: staff.id,
      }))
    );
  }

  await audit({ action: "created_export_operation", entityType: "export_operation", entityId: operation.id, operationId: operation.id, nextValue: { operation: operationPayload, calculation: result.memory } });
  revalidatePath(FISCAL_PATH);
}

export async function createInternationalDocument(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    operation_id: text(formData, "operation_id"),
    document_scope: requiredText(formData, "document_scope", "Escopo"),
    document_type: requiredText(formData, "document_type", "Tipo"),
    title: requiredText(formData, "title", "Título"),
    document_number: text(formData, "document_number"),
    country_code: text(formData, "country_code"),
    status: requiredText(formData, "status", "Status"),
    requirement_status: requiredText(formData, "requirement_status", "Obrigatoriedade"),
    language: text(formData, "language") ?? "pt-BR",
    storage_path: text(formData, "storage_path"),
    expires_at: dateValue(formData, "expires_at"),
    issued_at: dateValue(formData, "issued_at"),
    payload: {
      exporter: text(formData, "exporter"),
      consignee: text(formData, "consignee"),
      currency: text(formData, "currency"),
      incoterm: text(formData, "incoterm"),
      declaration: text(formData, "declaration"),
    },
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data } = await supabase.from("international_documents").insert(payload).select("id").single();
  await audit({ action: "created_international_document", entityType: "international_document", entityId: data?.id, operationId: payload.operation_id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createInternationalShippingQuote(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    operation_id: text(formData, "operation_id"),
    provider_key: requiredText(formData, "provider_key", "Provedor"),
    service_name: requiredText(formData, "service_name", "Serviço"),
    transport_mode: requiredText(formData, "transport_mode", "Modal"),
    origin_country: text(formData, "origin_country") ?? "BR",
    destination_country: requiredText(formData, "destination_country", "Destino"),
    real_weight_kg: decimal(formData, "real_weight_kg"),
    volumetric_weight_kg: decimal(formData, "volumetric_weight_kg"),
    packages_count: Math.max(1, Math.round(decimal(formData, "packages_count") || 1)),
    freight_cents: cents(formData, "freight"),
    insurance_cents: cents(formData, "insurance"),
    fuel_surcharge_cents: cents(formData, "fuel_surcharge"),
    handling_cents: cents(formData, "handling"),
    taxes_prepaid_cents: cents(formData, "taxes_prepaid"),
    delivery_cents: cents(formData, "delivery"),
    currency: requiredText(formData, "currency", "Moeda"),
    estimated_days: Math.round(decimal(formData, "estimated_days") || 0),
    incoterm: text(formData, "incoterm"),
    tracking_code: text(formData, "tracking_code"),
    tracking_url: text(formData, "tracking_url"),
    status: requiredText(formData, "status", "Status"),
    risk_score: Math.round(decimal(formData, "risk_score") || 0),
    created_by: staff.id,
  };
  const { data } = await supabase.from("international_shipping_quotes").insert(payload).select("id").single();
  await audit({ action: "created_international_shipping_quote", entityType: "international_shipping_quote", entityId: data?.id, operationId: payload.operation_id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
}

export async function createExchangeRate(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    base_currency: requiredText(formData, "base_currency", "Moeda base"),
    quote_currency: requiredText(formData, "quote_currency", "Moeda cotada"),
    rate: decimal(formData, "rate") || 1,
    commercial_rate: decimal(formData, "commercial_rate") || null,
    spread_percent: decimal(formData, "spread_percent"),
    fee_cents: cents(formData, "fee"),
    source: text(formData, "source"),
    rate_date: dateValue(formData, "rate_date") ?? new Date().toISOString().slice(0, 10),
    scenario: text(formData, "scenario") ?? "current",
    locked_until: dateValue(formData, "locked_until"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  await supabase.from("exchange_rates").upsert(payload, { onConflict: "tenant_id,base_currency,quote_currency,rate_date,scenario" });
  await audit({ action: "created_exchange_rate", entityType: "exchange_rate", nextValue: payload });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
  revalidatePath(`${INTERNATIONAL_PATH}/cambio`);
}

export async function createFiscalRegistration(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    jurisdiction_id: text(formData, "jurisdiction_id"),
    registration_kind: requiredText(formData, "registration_kind", "Tipo de registro"),
    registration_number: text(formData, "registration_number"),
    authority: text(formData, "authority"),
    responsible_party: text(formData, "responsible_party"),
    status: requiredText(formData, "status", "Status"),
    effective_from: dateValue(formData, "effective_from"),
    effective_until: dateValue(formData, "effective_until"),
    renewal_due_at: dateValue(formData, "renewal_due_at"),
    credentials_ref: text(formData, "credentials_ref"),
    notes: text(formData, "notes"),
    created_by: staff.id,
  };
  const { data } = await supabase.from("fiscal_registrations").insert(payload).select("id").single();
  await audit({ action: "created_fiscal_registration", entityType: "fiscal_registration", entityId: data?.id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
  revalidatePath(`${INTERNATIONAL_PATH}/registros-fiscais`);
}

export async function createExportComplianceCheck(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id: staff.tenantId,
    operation_id: text(formData, "operation_id"),
    jurisdiction_id: text(formData, "jurisdiction_id"),
    check_type: requiredText(formData, "check_type", "Tipo"),
    status: requiredText(formData, "status", "Status"),
    severity: requiredText(formData, "severity", "Severidade"),
    title: requiredText(formData, "title", "Título"),
    details: text(formData, "details"),
    required_documents: String(formData.get("required_documents") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    due_date: dateValue(formData, "due_date"),
    created_by: staff.id,
  };
  const { data } = await supabase.from("export_compliance_checks").insert(payload).select("id").single();
  await audit({ action: "created_export_compliance_check", entityType: "export_compliance_check", entityId: data?.id, operationId: payload.operation_id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
}

// ── Jurisdições ────────────────────────────────────────────────────────────────

export async function createJurisdiction(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();

  function splitList(key: string) {
    return String(formData.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }

  const payload = {
    tenant_id:         staff.tenantId,
    code:              requiredText(formData, "code", "Código"),
    name:              requiredText(formData, "name", "Nome"),
    scope:             requiredText(formData, "scope", "Escopo"),
    currency:          requiredText(formData, "currency", "Moeda"),
    language:          text(formData, "language") ?? "pt",
    tax_system:        text(formData, "tax_system"),
    package_status:    text(formData, "package_status") ?? "draft",
    confidence_status: text(formData, "confidence_status") ?? "simulation",
    official_sources:  splitList("official_sources"),
    obligations:       [] as string[],
    documents:         [] as string[],
    alerts:            splitList("alerts"),
    version:           text(formData, "version") ?? "1.0",
    notes:             text(formData, "notes"),
    effective_from:    dateValue(formData, "effective_from"),
    effective_until:   dateValue(formData, "effective_until"),
    created_by:        staff.id,
  };

  const { data, error } = await supabase.from("jurisdictions").insert(payload).select("id").single();
  if (error) throw new Error(`Falha ao criar jurisdição: ${error.message}`);
  await audit({ action: "created_jurisdiction", entityType: "jurisdiction", entityId: data?.id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
}

export async function updateJurisdiction(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const id = requiredText(formData, "id", "ID");

  function splitList(key: string) {
    return String(formData.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }

  const payload = {
    code:             requiredText(formData, "code", "Código"),
    name:             requiredText(formData, "name", "Nome"),
    scope:            requiredText(formData, "scope", "Escopo"),
    currency:         requiredText(formData, "currency", "Moeda"),
    language:         text(formData, "language") ?? "pt",
    tax_system:       text(formData, "tax_system"),
    official_sources: splitList("official_sources"),
    alerts:           splitList("alerts"),
    version:          text(formData, "version") ?? "1.0",
    notes:            text(formData, "notes"),
    effective_from:   dateValue(formData, "effective_from"),
    effective_until:  dateValue(formData, "effective_until"),
    updated_at:       new Date().toISOString(),
  };

  const { error } = await supabase.from("jurisdictions").update(payload).eq("id", id).eq("tenant_id", staff.tenantId);
  if (error) throw new Error(`Falha ao atualizar jurisdição: ${error.message}`);
  await audit({ action: "updated_jurisdiction", entityType: "jurisdiction", entityId: id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
}

// ── Fechar / resolver alerta ────────────────────────────────────────────────────

export async function closeExportAlert(alertId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("export_alerts")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("tenant_id", staff.tenantId);
  if (error) throw new Error(`Falha ao fechar alerta: ${error.message}`);
  await audit({ action: "closed_export_alert", entityType: "export_alert", entityId: alertId });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
}

// ── Delete de regras, documentos, cotações, registros, compliance ──────────────

export async function deleteInternationalTaxRule(id: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("international_tax_rules").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  await audit({ action: "deleted_international_tax_rule", entityType: "international_tax_rule", entityId: id });
  revalidatePath(FISCAL_PATH);
}

export async function deleteInternationalDocument(id: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("international_documents").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  await audit({ action: "deleted_international_document", entityType: "international_document", entityId: id });
  revalidatePath(FISCAL_PATH);
}

export async function deleteInternationalShippingQuote(id: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("international_shipping_quotes").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  await audit({ action: "deleted_international_shipping_quote", entityType: "international_shipping_quote", entityId: id });
  revalidatePath(FISCAL_PATH);
}

export async function deleteFiscalRegistration(id: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("fiscal_registrations").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  await audit({ action: "deleted_fiscal_registration", entityType: "fiscal_registration", entityId: id });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
}

export async function deleteExportComplianceCheck(id: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("export_compliance_checks").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  await audit({ action: "deleted_export_compliance_check", entityType: "export_compliance_check", entityId: id });
  revalidatePath(FISCAL_PATH);
}

export async function deleteExchangeRate(id: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("exchange_rates").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  await audit({ action: "deleted_exchange_rate", entityType: "exchange_rate", entityId: id });
  revalidatePath(FISCAL_PATH);
  revalidatePath(INTERNATIONAL_PATH);
}

// ── Classificações aduaneiras (NCM / HS Code por produto) ──────────────────────

export async function createCustomsClassification(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id:            staff.tenantId,
    jurisdiction_id:      text(formData, "jurisdiction_id"),
    classification_system: requiredText(formData, "classification_system", "Sistema"),
    code:                 requiredText(formData, "code", "Código"),
    description:          requiredText(formData, "description", "Descrição"),
    source:               text(formData, "source"),
    status:               text(formData, "status") ?? "suggested",
    confidence_status:    text(formData, "confidence_status") ?? "needs_review",
    justification:        text(formData, "justification"),
    created_by:           staff.id,
  };
  const { data, error } = await supabase.from("customs_classifications").insert(payload).select("id").single();
  if (error) throw new Error(`Falha ao criar classificação: ${error.message}`);
  await audit({ action: "created_customs_classification", entityType: "customs_classification", entityId: data?.id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
  revalidatePath(`${INTERNATIONAL_PATH}/classificacao-fiscal`);
  revalidatePath(`${INTERNATIONAL_PATH}/ncm-hs-code-e-codigos-locais`);
}

export async function deleteCustomsClassification(id: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  await supabase.from("customs_classifications").delete().eq("id", id).eq("tenant_id", staff.tenantId);
  await audit({ action: "deleted_customs_classification", entityType: "customs_classification", entityId: id });
  revalidatePath(FISCAL_PATH);
  revalidatePath(`${INTERNATIONAL_PATH}/classificacao-fiscal`);
}

// ── Exportar relatório CSV ──────────────────────────────────────────────────────

export async function exportReportCsv(reportType: string): Promise<{ csv: string; filename: string }> {
  const staff = await currentStaff();
  if (!staff) return { csv: "", filename: "relatorio.csv" };
  const supabase = await createClient();

  const now = new Date().toISOString().slice(0, 10);

  if (reportType === "landed_cost") {
    const { data } = await supabase
      .from("landed_cost_calculations")
      .select("scenario_name, total_landed_cost_cents, recommended_price_cents, profit_net_cents, margin_net_percent, taxes_paid_by_flora_cents, taxes_paid_by_buyer_cents, currency, created_at")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const headers = ["Cenário", "Landed Cost", "Preço Recomendado", "Lucro Líquido", "Margem %", "Tributos Flora", "Tributos Comprador", "Moeda", "Data"];
    const lines = rows.map((r) => [
      r.scenario_name,
      ((r.total_landed_cost_cents as number) / 100).toFixed(2),
      ((r.recommended_price_cents as number) / 100).toFixed(2),
      ((r.profit_net_cents as number) / 100).toFixed(2),
      (r.margin_net_percent as number).toFixed(2),
      ((r.taxes_paid_by_flora_cents as number) / 100).toFixed(2),
      ((r.taxes_paid_by_buyer_cents as number) / 100).toFixed(2),
      r.currency,
      String(r.created_at).slice(0, 10),
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

    return { csv: [headers.join(","), ...lines].join("\n"), filename: `relatorio-landed-cost-${now}.csv` };
  }

  if (reportType === "operations") {
    const { data } = await supabase
      .from("export_operations")
      .select("operation_number, title, status, sale_type, destination_country, incoterm, currency, created_at")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const headers = ["Número", "Título", "Status", "Tipo", "País destino", "Incoterm", "Moeda", "Data"];
    const lines = rows.map((r) => [
      r.operation_number, r.title, r.status, r.sale_type,
      r.destination_country, r.incoterm, r.currency,
      String(r.created_at).slice(0, 10),
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

    return { csv: [headers.join(","), ...lines].join("\n"), filename: `relatorio-operacoes-${now}.csv` };
  }

  if (reportType === "tax_rules") {
    const { data } = await supabase
      .from("international_tax_rules")
      .select("tax_name, tax_kind, rate_percent, responsibility, rule_status, currency, official_source, effective_from, effective_until")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const headers = ["Imposto", "Tipo", "Alíquota %", "Responsável", "Status", "Moeda", "Fonte", "Vigência de", "Vigência até"];
    const lines = rows.map((r) => [
      r.tax_name, r.tax_kind, r.rate_percent, r.responsibility,
      r.rule_status, r.currency, r.official_source,
      r.effective_from, r.effective_until,
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

    return { csv: [headers.join(","), ...lines].join("\n"), filename: `relatorio-regras-tributarias-${now}.csv` };
  }

  return { csv: "", filename: "relatorio.csv" };
}

// ── NF-e de exportação: registrar dados de preparação ──────────────────────────

export async function createNfeExportRecord(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id:         staff.tenantId,
    operation_id:      text(formData, "operation_id"),
    document_scope:    "brazil",
    document_type:     "nfe_export",
    title:             text(formData, "title") ?? "NF-e de exportação",
    document_number:   text(formData, "nfe_key"),
    country_code:      "BR",
    status:            text(formData, "status") ?? "draft",
    requirement_status: "required",
    language:          "pt-BR",
    notes:             text(formData, "notes"),
    payload: {
      cfop:          text(formData, "cfop"),
      ncm:           text(formData, "ncm"),
      natureza_operacao: text(formData, "natureza_operacao"),
      chave_acesso:  text(formData, "chave_acesso"),
      protocolo:     text(formData, "protocolo"),
      serie:         text(formData, "serie"),
      numero:        text(formData, "numero"),
    },
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("international_documents").insert(payload).select("id").single();
  if (error) throw new Error(`Falha ao registrar NF-e: ${error.message}`);
  await audit({ action: "created_nfe_export_record", entityType: "international_document", entityId: data?.id, operationId: payload.operation_id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
  revalidatePath(`${INTERNATIONAL_PATH}/nfe-de-exportacao`);
}

// ── DU-E: registrar dados de preparação ────────────────────────────────────────

export async function createDueRecord(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const supabase = await createClient();
  const payload = {
    tenant_id:         staff.tenantId,
    operation_id:      text(formData, "operation_id"),
    document_scope:    "brazil",
    document_type:     "due",
    title:             text(formData, "title") ?? "DU-E",
    document_number:   text(formData, "due_number"),
    country_code:      "BR",
    status:            text(formData, "status") ?? "draft",
    requirement_status: "required",
    language:          "pt-BR",
    notes:             text(formData, "notes"),
    payload: {
      due_number:        text(formData, "due_number"),
      protocolo:         text(formData, "protocolo"),
      recinto:           text(formData, "recinto"),
      modal:             text(formData, "modal"),
      lpco:              text(formData, "lpco"),
      ruc:               text(formData, "ruc"),
      canal:             text(formData, "canal"),
      situacao:          text(formData, "situacao"),
    },
    created_by: staff.id,
  };
  const { data, error } = await supabase.from("international_documents").insert(payload).select("id").single();
  if (error) throw new Error(`Falha ao registrar DU-E: ${error.message}`);
  await audit({ action: "created_due_record", entityType: "international_document", entityId: data?.id, operationId: payload.operation_id, nextValue: payload });
  revalidatePath(FISCAL_PATH);
  revalidatePath(`${INTERNATIONAL_PATH}/du-e`);
}
