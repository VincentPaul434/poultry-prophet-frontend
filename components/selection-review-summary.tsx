"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { CalendarDays, ClipboardCheck, TriangleAlert } from "lucide-react";
import { useSelectionReviewPreview } from "@/hooks/use-selection-review";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { reportCostMetric } from "@/lib/selection-review-finance";
import type { Batch } from "@/lib/types";
import { PopulationPendingNotice } from "@/components/population-pending-notice";
import { EditableSexCompositionMetric } from "@/components/editable-sex-composition-metric";

function SummaryMetric({ label, value, detail, title, warning = false, className }: { label: string; value: string; detail?: string; title?: string; warning?: boolean; className?: string }) {
  return <div title={title} className={`min-w-0 bg-card px-3 py-3.5 sm:px-4 ${className ?? ""}`}><p className="break-words text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={`mt-1 break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${warning ? "text-warning-ink" : ""}`}>{value}</p>{detail && <p className={`mt-1 text-xs leading-4 ${warning ? "text-warning-ink" : "text-muted-foreground"}`}>{detail}</p>}</div>;
}

export function SelectionReviewSummary({ batch }: { batch: Batch }) {
  const { display: displayText } = useDisplayLocale();
  const { isManager } = useAuth();
  const { data, isLoading, isError } = useSelectionReviewPreview(batch.id);
  const cost = data && isManager ? reportCostMetric(data) : null;
  const expenseDetail = !isManager ? "Manager only" : cost?.warning || cost?.value === "—" ? cost?.detail : undefined;
  const fallbackPopulation = batch.populationStatus === "RECONCILIATION_REQUIRED"
    ? `— / ${batch.initialPopulation}`
    : `${batch.currentPopulation} / ${batch.initialPopulation}`;
  // The overview and dashboard both use the canonical confirmed batch count.
  // Pending work is shown separately because its acknowledgement may have been lost.
  const populationDisplay = fallbackPopulation;
  const otherChanges = data
    ? data.population.predation
      + data.population.missing
      + data.population.returned
      + data.population.transfersOut
      + data.population.transfersIn
      + data.population.sales
      + data.population.culling
      + data.population.countCorrections
    : 0;

  return <section className="space-y-3">
    <h2 className="truncate text-base font-bold">{displayText("Batch summary")}</h2>
    <PopulationPendingNotice batchId={batch.id} />
    {isLoading && <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border/70 sm:grid-cols-4"><SummaryMetric label={displayText("Population")} value={populationDisplay} />{[0, 1, 2].map((index) => <div key={index} className="min-h-24 animate-pulse bg-muted" />)}</div>}
    {isError && <div className="grid overflow-hidden rounded-2xl border bg-border/70 sm:grid-cols-4"><SummaryMetric label={displayText("Population")} value={populationDisplay} /><p className="bg-warning-muted px-4 py-3 text-xs text-warning-ink sm:col-span-3">{displayText("Review data are unavailable. Check the event log for recent records.")}</p></div>}
    {data && <>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border/70 sm:grid-cols-4">
        <SummaryMetric label={displayText("Population")} value={populationDisplay} />
        <SummaryMetric label={displayText("Total deaths")} value={String(data.population.totalDeaths)} />
        <EditableSexCompositionMetric batch={batch} fallback={data.sexComposition} readOnly={batch.status === "ARCHIVED"} />
        <SummaryMetric label={displayText("Batch expenses")} value={!cost || cost.value === "—" ? "N/A" : cost.value} detail={expenseDetail} title={cost?.title} warning={cost?.warning} />
      </div>
      {batch.populationStatus === "RECONCILIATION_REQUIRED" && <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2.5 text-xs text-warning-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>{displayText("Population records need review before the current count can be verified.")}</p></div>}
      <div className="flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5"><CalendarDays className="size-3.5 text-muted-foreground" />{formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</span><span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5"><ClipboardCheck className="size-3.5 text-muted-foreground" />{otherChanges} {displayText("other population changes")}</span></div>
    </>}
  </section>;
}
