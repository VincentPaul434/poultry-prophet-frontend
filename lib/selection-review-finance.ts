import type { SelectionReviewFinance, SelectionReviewPayload } from "./types";

export function financeCurrencyGroups(finance: SelectionReviewFinance) {
  return finance.currencyTotals ?? [];
}

export function formatReviewAmount(value: number | null, currency: string) {
  if (value == null) return "—";
  const amount = Number(value).toLocaleString();
  return currency === "PHP" ? `₱${amount}` : `${currency} ${amount}`;
}

export function reportCostMetric(payload: SelectionReviewPayload) {
  const finance = payload.finance;
  const groups = finance ? financeCurrencyGroups(finance) : [];
  const hasProductUsage = payload.productUse.length > 0;
  const missingProductCosts = missingProductCostCount(payload);
  const noRecordedCost = { value: "—", detail: "No record", title: "No batch cost is recorded.", warning: false };

  if (!finance) return noRecordedCost;
  if (finance.currencyTotals == null || (groups.length === 0 && (finance.postedTransactionCount > 0 || hasProductUsage || Number(finance.recordedExpense ?? 0) !== 0 || Number(finance.totalRecordedBatchCost ?? 0) !== 0))) {
    return { value: "—", detail: "Currency unavailable", title: "This report does not identify the currencies for its recorded costs.", warning: true };
  }
  if (groups.length > 1) {
    const hasCost = hasProductUsage || groups.some((group) => Number(group.recordedExpense) !== 0 || Number(group.totalRecordedBatchCost) !== 0);
    if (!hasCost) return noRecordedCost;
    const incomplete = missingProductCosts > 0 || groups.some((group) => group.recordsMayBeIncomplete);
    return {
      value: "Mixed",
      detail: incomplete ? "Partial cost" : "See finance",
      title: incomplete
        ? "Batch costs use multiple currencies and some product usage is unvalued. See Batch finance for the known costs."
        : "Batch costs use multiple currencies. See Batch finance for each currency total.",
      warning: incomplete,
    };
  }

  const group = groups[0];
  const currency = group?.currency ?? "PHP";
  const total = group?.totalRecordedBatchCost ?? finance.totalRecordedBatchCost;
  const expense = group?.recordedExpense ?? finance.recordedExpense ?? 0;
  const incomplete = missingProductCosts > 0 || (group?.recordsMayBeIncomplete ?? finance.recordsMayBeIncomplete);
  const hasManualExpense = Number(expense) !== 0;
  const hasCost = hasManualExpense || hasProductUsage || Number(total) !== 0;
  if (!hasCost) return noRecordedCost;
  if (total == null || (incomplete && Number(total) <= 0)) {
    return {
      value: "—",
      detail: "Partial cost",
      title: "Some product usage is unvalued, so a complete batch cost is not available.",
      warning: true,
    };
  }

  const value = formatReviewAmount(total, currency);
  return {
    value: incomplete ? `${value}*` : value,
    detail: incomplete ? "Partial cost" : "Recorded cost",
    title: incomplete
      ? `${value} is the known recorded batch cost. Some product usage is unvalued.`
      : `${value} is the recorded batch cost.`,
    warning: Boolean(incomplete),
  };
}

// Older snapshots can have an incorrect completeness flag. Their own saved product
// records still tell us when the saved subtotal cannot represent all recorded use.
export function missingProductCostCount(payload: SelectionReviewPayload) {
  const missingInProducts = payload.productUse.filter((item) => item.quantity == null || item.calculatedCost == null).length;
  return Math.max(payload.finance?.unvaluedUsageCount ?? 0, missingInProducts);
}
