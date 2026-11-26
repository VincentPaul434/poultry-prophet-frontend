"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import Link from "next/link";
import type { BatchDashboardItem } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useFarmProducts } from "@/hooks/use-operations";

type ChartRow = {
  id: number;
  name: string;
  value: number | null;
  display: string;
  detail?: string;
};

type FarmBatchChartsProps = {
  items: BatchDashboardItem[];
  isLoading: boolean;
  isError: boolean;
};

const number = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const pesos = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });

function rank(rows: ChartRow[]) {
  return rows.sort((a, b) => {
    if (a.value == null && b.value != null) return 1;
    if (a.value != null && b.value == null) return -1;
    return (b.value ?? 0) - (a.value ?? 0) || a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id - b.id;
  });
}

export function FarmBatchCharts({ items, isLoading, isError }: FarmBatchChartsProps) {
  const { display: displayText } = useDisplayLocale();
  const { isManager } = useAuth();
  const stockHistory = useFarmProducts(true, isManager);
  const products = Array.isArray(stockHistory.data) ? stockHistory.data : undefined;
  const demoStockExists = products?.some((product) => product.demoStockHistory === true) ?? false;
  const stockStatusUnknown = stockHistory.isError || (products != null && products.some((product) => product.demoStockHistory === undefined)) || (!stockHistory.isLoading && !products);
  const batches = items.filter(({ batch }) => batch.status !== "ARCHIVED");
  const needsReview = batches.filter(({ batch }) => batch.populationStatus === "RECONCILIATION_REQUIRED" || batch.currentPopulation < 0);
  const top = batches.filter(({ batch }) => batch.populationStatus !== "RECONCILIATION_REQUIRED" && batch.currentPopulation >= 0)
    .sort((a, b) => b.batch.currentPopulation - a.batch.currentPopulation || a.batch.name.localeCompare(b.batch.name, undefined, { numeric: true }) || a.batch.id - b.batch.id)
    .slice(0, 10);

  const population = top.map(({ batch }) => ({
    id: batch.id, name: batch.name, value: batch.currentPopulation,
    display: `${number.format(batch.currentPopulation)} birds`,
  }));
  const expenses = rank(top.map(({ batch, summary }) => {
    const finance = summary.finance;
    let reason: string | undefined;
    if (batch.currentPopulation === 0) reason = "No current birds";
    else if (!finance || !finance.hasCostRecords) reason = "No recorded cost";
    else if (!finance.productCostComplete) reason = "Cost incomplete";
    else if (!finance.currency) reason = "Mixed currencies";
    else if (finance.currency !== "PHP") reason = `Currency: ${finance.currency}`;
    else if (finance.recordedBatchCost == null) reason = "Cost unavailable";
    const value = reason ? null : finance!.recordedBatchCost! / batch.currentPopulation;
    return {
      id: batch.id, name: batch.name, value,
      display: value == null ? reason! : `${pesos.format(value)} / bird`,
      detail: value == null ? undefined : `${pesos.format(finance!.recordedBatchCost!)} / ${number.format(batch.currentPopulation)} birds`,
    };
  }));
  const deaths = rank(top.map(({ batch, summary }) => {
    const value = batch.initialPopulation > 0 ? summary.totalDeaths / batch.initialPopulation * 100 : null;
    return {
      id: batch.id, name: batch.name, value,
      display: value == null ? "Starting count unavailable" : `${percent.format(value)}%`,
      detail: value == null ? undefined : `${number.format(summary.totalDeaths)} / ${number.format(batch.initialPopulation)} starting birds`,
    };
  }));

  return <section aria-labelledby="batch-charts-heading" className="space-y-5 border-t border-border pt-7">
    <div className="space-y-1.5">
      <h2 id="batch-charts-heading" className="ledger-card-title text-2xl sm:text-3xl">{displayText("Batch charts")}</h2>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{displayText("Up to 10 non-archived batches with the most current birds. Figures cover recorded batch history and are independent of the Snapshot review dates. Cached offline figures may lag.")}</p>
    </div>
    {isLoading && <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">{displayText("Loading batch charts…")}</p>}
    {isError && <p role="alert" className="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive">{displayText("Batch charts could not be loaded. Refresh the page to try again.")}</p>}
    {isManager && stockHistory.isLoading && <p role="status" className="text-xs text-muted-foreground">{displayText("Checking demo stock history…")}</p>}
    {isManager && demoStockExists && <p className="rounded-xl bg-warning-muted px-4 py-3 text-sm text-warning-ink">{displayText("Demo stock is in farm history; cost rankings may be affected. Check each batch report before relying on costs.")}</p>}
    {isManager && !demoStockExists && !stockHistory.isLoading && stockStatusUnknown && <p role="status" className="rounded-xl bg-warning-muted px-4 py-3 text-sm text-warning-ink">{displayText("Demo stock history could not be checked. Verify batch costs before using these rankings.")}</p>}
    {!isLoading && !isError && top.length === 0 && <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{displayText("No batches with a valid current bird count are available.")}</p>}
    {!isLoading && !isError && needsReview.length > 0 && <p className="rounded-xl bg-warning-muted px-4 py-3 text-sm text-warning-ink">{number.format(needsReview.length)} {displayText("batch")}{needsReview.length === 1 ? " has" : "es have"} {displayText("population records that need review and")}{" "}{needsReview.length === 1 ? "is" : "are"} {displayText("excluded from these charts.")}</p>}
    {!isLoading && !isError && top.length > 0 && <div className="grid items-start gap-4 xl:grid-cols-3">
      <RankedChart title={displayText("Recorded cost per current bird")} description={displayText("Recorded batch cost divided by current birds. Only PHP costs with valued product usage are ranked; no currency conversion is applied.")} rows={expenses} color="bg-[#b17618]" />
      <RankedChart title={displayText("Recorded death rate")} description={displayText("Health-related and accidental deaths as a share of starting birds. Transfers can affect this comparison; other losses are excluded.")} rows={deaths} color="bg-[#b8493f]" />
      <RankedChart title={displayText("Current birds")} description={displayText("Batches ranked by birds currently in each batch.")} rows={population} color="bg-primary" />
    </div>}
  </section>;
}

function RankedChart({ title, description, rows, color }: { title: string; description: string; rows: ChartRow[]; color: string }) {
  const maximum = Math.max(0, ...rows.map((row) => row.value ?? 0));
  return <section aria-label={title} className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{description}</p>
    <ol className="mt-4 space-y-4">
      {rows.map((row) => <li key={row.id} className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <Link href={`/batches/${row.id}/selection`} className="min-w-0 break-words font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.name}</Link>
          <span className="text-right font-semibold tabular-nums">{row.display}</span>
        </div>
        {row.value != null && <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className={`h-full rounded-full ${color}`} style={{ width: `${maximum > 0 ? row.value / maximum * 100 : 0}%` }} /></div>}
        {row.detail && <p className="text-xs leading-4 text-muted-foreground">{row.detail}</p>}
      </li>)}
    </ol>
  </section>;
}
