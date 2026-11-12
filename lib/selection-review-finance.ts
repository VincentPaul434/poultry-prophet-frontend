import type { SelectionReviewFinance } from "./types";

export function financeCurrencyGroups(finance: SelectionReviewFinance) {
  return finance.currencyTotals ?? [];
}

export function formatReviewAmount(value: number | null, currency: string) {
  if (value == null) return "—";
  const amount = Number(value).toLocaleString();
  return currency === "PHP" ? `₱${amount}` : `${currency} ${amount}`;
}
