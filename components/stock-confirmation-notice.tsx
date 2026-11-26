"use client";

import { useLocale } from "@/components/locale-provider";
import type { FarmProduct } from "@/lib/types";

export function StockConfirmationNotice({ products }: { products: Array<FarmProduct | null | undefined> }) {
  const { display } = useLocale();
  if (!products.some((product) => product?.stockIsCached || product?.hasPendingInventoryUse)) return null;
  return <p role="status" className="rounded-lg border border-warning-border bg-warning-muted/60 px-3 py-2 text-xs text-warning-ink">{display("Last confirmed stock. Some product records on this device may still be waiting to sync or need review.")}</p>;
}
