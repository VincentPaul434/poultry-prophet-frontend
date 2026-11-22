/** Stock can be blended after a demo purchase, so the history is only a warning. */
export function DemoStockNotice({ demoStockHistory }: { demoStockHistory: boolean | undefined }) {
  if (demoStockHistory === false) return null;
  return <p className="rounded-lg border border-warning-border bg-warning-muted/50 px-3 py-2 text-xs text-warning-ink">
    {demoStockHistory ? "Demo stock in history. Verify the physical quantity and price." : "Stock history unavailable. Verify the physical quantity before use."}
  </p>;
}
