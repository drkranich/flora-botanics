export type CostResponsibility = "flora" | "buyer" | "marketplace" | "importer";

export interface LandedCostInput {
  productValueCents: number;
  productionCostCents: number;
  brazilianExportCostCents: number;
  internationalFreightCents: number;
  insuranceCents: number;
  packagingCents: number;
  customsDutyPercent: number;
  destinationTaxPercent: number;
  salesTaxPercent: number;
  commissionPercent: number;
  paymentFeePercent: number;
  complianceCents: number;
  contingencyPercent: number;
  targetMarginPercent: number;
  taxResponsibility: CostResponsibility;
  exchangeRate: number;
  currency: string;
  destinationCurrency: string;
}

export interface LandedCostComponent {
  groupKey: string;
  name: string;
  amountCents: number;
  payer: CostResponsibility;
  confidenceStatus: string;
  notes?: string;
}

export interface LandedCostResult {
  productValueCents: number;
  brazilianCostCents: number;
  exportCostCents: number;
  fobCents: number;
  cifCents: number;
  customsValueCents: number;
  importDutyCents: number;
  destinationTaxCents: number;
  salesTaxCents: number;
  logisticsCents: number;
  commissionCents: number;
  paymentFeeCents: number;
  complianceCents: number;
  contingencyCents: number;
  totalLandedCostCents: number;
  revenueGrossCents: number;
  revenueNetCents: number;
  profitGrossCents: number;
  profitNetCents: number;
  marginGrossPercent: number;
  marginNetPercent: number;
  markupPercent: number;
  breakEvenCents: number;
  minimumPriceCents: number;
  recommendedPriceCents: number;
  customerPriceCents: number;
  taxesPaidByFloraCents: number;
  taxesPaidByBuyerCents: number;
  components: LandedCostComponent[];
  warnings: string[];
  memory: Record<string, unknown>;
}

function cents(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function percentOf(base: number, percent: number) {
  return cents((base * (Number.isFinite(percent) ? percent : 0)) / 100);
}

function ratio(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const productValueCents = cents(input.productValueCents);
  const productionCostCents = cents(input.productionCostCents);
  const packagingCents = cents(input.packagingCents);
  const brazilianExportCostCents = cents(input.brazilianExportCostCents);
  const internationalFreightCents = cents(input.internationalFreightCents);
  const insuranceCents = cents(input.insuranceCents);
  const complianceCents = cents(input.complianceCents);

  const brazilianCostCents = productionCostCents + packagingCents;
  const exportCostCents = brazilianExportCostCents + internationalFreightCents + insuranceCents;
  const fobCents = productValueCents + brazilianExportCostCents;
  const cifCents = fobCents + internationalFreightCents + insuranceCents;
  const customsValueCents = cifCents;
  const importDutyCents = percentOf(customsValueCents, input.customsDutyPercent);
  const destinationTaxCents = percentOf(customsValueCents + importDutyCents, input.destinationTaxPercent);
  const salesTaxCents = percentOf(productValueCents, input.salesTaxPercent);
  const commissionCents = percentOf(productValueCents, input.commissionPercent);
  const paymentFeeCents = percentOf(productValueCents, input.paymentFeePercent);
  const contingencyBase = brazilianCostCents + exportCostCents + importDutyCents + destinationTaxCents + salesTaxCents;
  const contingencyCents = percentOf(contingencyBase, input.contingencyPercent);
  const taxesTotal = importDutyCents + destinationTaxCents + salesTaxCents;
  const taxesPaidByFloraCents = input.taxResponsibility === "flora" ? taxesTotal : 0;
  const taxesPaidByBuyerCents = input.taxResponsibility === "buyer" ? taxesTotal : 0;

  const totalLandedCostCents =
    brazilianCostCents +
    exportCostCents +
    taxesPaidByFloraCents +
    commissionCents +
    paymentFeeCents +
    complianceCents +
    contingencyCents;

  const minimumPriceCents = totalLandedCostCents;
  const marginDivisor = Math.max(0.01, 1 - Math.max(0, input.targetMarginPercent) / 100);
  const recommendedPriceCents = cents(totalLandedCostCents / marginDivisor);
  const customerPriceCents = input.taxResponsibility === "buyer" ? recommendedPriceCents : recommendedPriceCents;
  const revenueGrossCents = customerPriceCents;
  const revenueNetCents = revenueGrossCents - commissionCents - paymentFeeCents;
  const profitGrossCents = revenueGrossCents - brazilianCostCents;
  const profitNetCents = revenueNetCents - totalLandedCostCents;

  const warnings: string[] = [];
  if (!input.exchangeRate || input.exchangeRate <= 0) warnings.push("Câmbio ausente ou inválido.");
  if (input.taxResponsibility === "flora" && taxesTotal === 0) warnings.push("DDP sem imposto de destino calculado exige revisão.");
  if (input.customsDutyPercent === 0) warnings.push("Tarifa aduaneira zerada tratada como simulação, não como regra definitiva.");
  if (input.destinationTaxPercent === 0) warnings.push("VAT, GST ou imposto equivalente ausente para o destino.");
  if (profitNetCents < 0) warnings.push("Margem líquida negativa neste cenário.");

  const components: LandedCostComponent[] = [
    { groupKey: "produto", name: "Custo de produção", amountCents: productionCostCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "embalagem", name: "Embalagem internacional", amountCents: packagingCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "exportacao", name: "Custos brasileiros de exportação", amountCents: brazilianExportCostCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "frete", name: "Frete internacional", amountCents: internationalFreightCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "seguro", name: "Seguro internacional", amountCents: insuranceCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "aduana", name: "Tarifa de importação", amountCents: importDutyCents, payer: input.taxResponsibility, confidenceStatus: "simulation" },
    { groupKey: "tributo_destino", name: "VAT, GST ou imposto equivalente", amountCents: destinationTaxCents, payer: input.taxResponsibility, confidenceStatus: "simulation" },
    { groupKey: "sales_tax", name: "Sales Tax local", amountCents: salesTaxCents, payer: input.taxResponsibility, confidenceStatus: "simulation" },
    { groupKey: "comissao", name: "Comissões comerciais", amountCents: commissionCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "pagamento", name: "Gateway e conversão de pagamento", amountCents: paymentFeeCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "compliance", name: "Conformidade e registros", amountCents: complianceCents, payer: "flora", confidenceStatus: "simulation" },
    { groupKey: "risco", name: "Margem de risco e contingência", amountCents: contingencyCents, payer: "flora", confidenceStatus: "simulation" },
  ];

  return {
    productValueCents,
    brazilianCostCents,
    exportCostCents,
    fobCents,
    cifCents,
    customsValueCents,
    importDutyCents,
    destinationTaxCents,
    salesTaxCents,
    logisticsCents: internationalFreightCents + insuranceCents,
    commissionCents,
    paymentFeeCents,
    complianceCents,
    contingencyCents,
    totalLandedCostCents,
    revenueGrossCents,
    revenueNetCents,
    profitGrossCents,
    profitNetCents,
    marginGrossPercent: ratio(profitGrossCents, revenueGrossCents),
    marginNetPercent: ratio(profitNetCents, revenueGrossCents),
    markupPercent: ratio(recommendedPriceCents - totalLandedCostCents, totalLandedCostCents),
    breakEvenCents: totalLandedCostCents,
    minimumPriceCents,
    recommendedPriceCents,
    customerPriceCents,
    taxesPaidByFloraCents,
    taxesPaidByBuyerCents,
    components,
    warnings,
    memory: {
      formula:
        "landed_cost = produção + embalagem + custos de exportação + frete + seguro + tributos assumidos + comissões + gateway + compliance + contingência",
      responsibility: input.taxResponsibility,
      exchange_rate: input.exchangeRate,
      currency: input.currency,
      destination_currency: input.destinationCurrency,
      generated_at: new Date().toISOString(),
      disclaimer:
        "Simulação gerencial. Valores fiscais internacionais exigem regra vigente, fonte oficial e validação especializada antes de operação definitiva.",
    },
  };
}
