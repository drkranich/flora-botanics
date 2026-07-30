export type FinanceMode =
  | "unit"
  | "batch"
  | "kit"
  | "combo"
  | "order"
  | "customer"
  | "channel"
  | "b2b"
  | "b2c"
  | "campaign"
  | "subscription";

export type SaleModel =
  | "retail"
  | "wholesale"
  | "b2b"
  | "b2c"
  | "consignment"
  | "marketplace"
  | "physical_store"
  | "representative"
  | "subscription"
  | "corporate";

export type FinanceComponentGroup =
  | "production"
  | "packaging"
  | "logistics"
  | "tax"
  | "commission"
  | "channel_fee"
  | "fixed_expense"
  | "variable_expense"
  | "labor"
  | "investment"
  | "custom";

export type FinanceComponentInput = {
  group: FinanceComponentGroup;
  label: string;
  amountCents: number;
};

export type FinanceLineItemInput = {
  name: string;
  sku?: string;
  kind?: "product" | "kit" | "combo" | "service" | "custom";
  quantity: number;
  unitPriceCents: number;
  discountPercent?: number;
};

export type FinanceScenarioInput = {
  title: string;
  mode: FinanceMode;
  saleModel: SaleModel;
  channel: string;
  quantity: number;
  unitPriceCents: number;
  discountPercent: number;
  desiredMarginPercent: number;
  minimumMarginPercent: number;
  items?: FinanceLineItemInput[];
  components: FinanceComponentInput[];
};

export type FinanceAlert = {
  tone: "danger" | "warning" | "info";
  message: string;
};

export type FinanceScenarioResult = {
  itemCount: number;
  totalUnits: number;
  itemsSubtotalCents: number;
  grossRevenueCents: number;
  discountCents: number;
  netRevenueCents: number;
  productionCostCents: number;
  packagingCostCents: number;
  logisticsCostCents: number;
  taxCostCents: number;
  commissionCostCents: number;
  channelFeeCents: number;
  fixedExpenseCents: number;
  variableExpenseCents: number;
  laborCostCents: number;
  investmentCostCents: number;
  otherCostCents: number;
  totalCostCents: number;
  grossProfitCents: number;
  netProfitCents: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  markupPercent: number;
  breakEvenPriceCents: number;
  minimumPriceCents: number;
  recommendedPriceCents: number;
  returnPercent: number;
  capitalNeededCents: number;
  alerts: FinanceAlert[];
};

const GROUP_KEYS: Record<FinanceComponentGroup, keyof Pick<
  FinanceScenarioResult,
  | "productionCostCents"
  | "packagingCostCents"
  | "logisticsCostCents"
  | "taxCostCents"
  | "commissionCostCents"
  | "channelFeeCents"
  | "fixedExpenseCents"
  | "variableExpenseCents"
  | "laborCostCents"
  | "investmentCostCents"
  | "otherCostCents"
>> = {
  production: "productionCostCents",
  packaging: "packagingCostCents",
  logistics: "logisticsCostCents",
  tax: "taxCostCents",
  commission: "commissionCostCents",
  channel_fee: "channelFeeCents",
  fixed_expense: "fixedExpenseCents",
  variable_expense: "variableExpenseCents",
  labor: "laborCostCents",
  investment: "investmentCostCents",
  custom: "otherCostCents",
};

function pct(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function priceForMargin(costCents: number, marginPercent: number) {
  const margin = Math.min(Math.max(marginPercent, 0), 95) / 100;
  if (margin >= 0.95) return costCents;
  return Math.ceil(costCents / (1 - margin));
}

export function calculateFinanceScenario(input: FinanceScenarioInput): FinanceScenarioResult {
  const fallbackQuantity = Math.max(1, Number(input.quantity) || 1);
  const unitPriceCents = Math.max(0, Math.round(input.unitPriceCents || 0));
  const validItems = (input.items ?? [])
    .map((item) => ({
      ...item,
      quantity: Math.max(0, Number(item.quantity) || 0),
      unitPriceCents: Math.max(0, Math.round(item.unitPriceCents || 0)),
      discountPercent: Math.max(0, Number(item.discountPercent) || 0),
    }))
    .filter((item) => item.name.trim() && item.quantity > 0);

  const fallbackGross = unitPriceCents * fallbackQuantity;
  const itemsSubtotalCents = validItems.length
    ? validItems.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0)
    : fallbackGross;
  const itemDiscountCents = validItems.length
    ? validItems.reduce((sum, item) => {
        const subtotal = Math.round(item.quantity * item.unitPriceCents);
        return sum + Math.round(subtotal * (item.discountPercent ?? 0) / 100);
      }, 0)
    : Math.round(fallbackGross * Math.max(0, input.discountPercent || 0) / 100);
  const grossRevenueCents = itemsSubtotalCents;
  const discountCents = itemDiscountCents;
  const netRevenueCents = Math.max(0, grossRevenueCents - discountCents);
  const totalUnits = validItems.length
    ? validItems.reduce((sum, item) => sum + item.quantity, 0)
    : fallbackQuantity;

  const totals = {
    productionCostCents: 0,
    packagingCostCents: 0,
    logisticsCostCents: 0,
    taxCostCents: 0,
    commissionCostCents: 0,
    channelFeeCents: 0,
    fixedExpenseCents: 0,
    variableExpenseCents: 0,
    laborCostCents: 0,
    investmentCostCents: 0,
    otherCostCents: 0,
  };

  for (const component of input.components) {
    const key = GROUP_KEYS[component.group] ?? "otherCostCents";
    totals[key] += Math.max(0, Math.round(component.amountCents || 0));
  }

  const totalCostCents = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const grossCostCents =
    totals.productionCostCents +
    totals.packagingCostCents +
    totals.logisticsCostCents +
    totals.laborCostCents;
  const grossProfitCents = netRevenueCents - grossCostCents;
  const netProfitCents = netRevenueCents - totalCostCents;
  const unitDivisor = Math.max(1, totalUnits);
  const breakEvenPriceCents = Math.ceil(totalCostCents / unitDivisor);
  const minimumPriceCents = priceForMargin(Math.ceil(totalCostCents / unitDivisor), input.minimumMarginPercent);
  const recommendedPriceCents = priceForMargin(Math.ceil(totalCostCents / unitDivisor), input.desiredMarginPercent);

  const alerts: FinanceAlert[] = [];
  if (netRevenueCents < totalCostCents) alerts.push({ tone: "danger", message: "Preço abaixo do custo total." });
  if (pct(netProfitCents, netRevenueCents) < input.minimumMarginPercent) {
    alerts.push({ tone: "warning", message: "Margem abaixo do mínimo definido." });
  }
  if (pct(totals.logisticsCostCents, netRevenueCents) > 18) {
    alerts.push({ tone: "warning", message: "Logística consumindo margem excessiva." });
  }
  if (pct(totals.commissionCostCents + totals.channelFeeCents, netRevenueCents) > 25) {
    alerts.push({ tone: "warning", message: "Comissões e taxas de canal altas para este cenário." });
  }
  if (totals.taxCostCents === 0) alerts.push({ tone: "info", message: "Impostos não configurados neste cenário." });

  return {
    itemCount: validItems.length || 1,
    totalUnits,
    itemsSubtotalCents,
    grossRevenueCents,
    discountCents,
    netRevenueCents,
    ...totals,
    totalCostCents,
    grossProfitCents,
    netProfitCents,
    grossMarginPercent: pct(grossProfitCents, netRevenueCents),
    netMarginPercent: pct(netProfitCents, netRevenueCents),
    markupPercent: totalCostCents ? pct(netRevenueCents - totalCostCents, totalCostCents) : 0,
    breakEvenPriceCents,
    minimumPriceCents,
    recommendedPriceCents,
    returnPercent: pct(netProfitCents, totalCostCents),
    capitalNeededCents: totalCostCents,
    alerts,
  };
}

