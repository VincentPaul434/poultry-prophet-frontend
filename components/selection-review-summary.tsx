"use client";

import { CalendarDays, ClipboardCheck, TriangleAlert } from "lucide-react";
import { useSelectionReviewPreview } from "@/hooks/use-selection-review";
import { formatDate } from "@/lib/format";
import type { Batch } from "@/lib/types";
import { EditableSexCompositionMetric } from "@/components/editable-sex-composition-metric";

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-card px-3 py-3.5 sm:px-4"><p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 truncate text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p></div>;
}

export function SelectionReviewSummary({ batch }: { batch: Batch }) {
  const { data, isLoading, isError } = useSelectionReviewPreview(batch.id);
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
    <div className="min-w-0"><h2 className="truncate text-base font-bold">Batch review</h2><p className="mt-0.5 text-xs text-muted-foreground">Population, mortality, composition, and records.</p></div>
    {isLoading && <div className="grid grid-cols-2 gap-3"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-24 animate-pulse rounded-xl bg-muted" /></div>}
    {isError && <p className="rounded-xl border border-warning-border bg-warning-muted px-4 py-3 text-xs text-warning-ink">Review unavailable. The event log is still available.</p>}
    {data && <>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border/70 sm:grid-cols-4">
        <SummaryMetric label="Population" value={data.batch.currentPopulationDisplay} />
        <SummaryMetric label="Total deaths" value={String(data.population.totalDeaths)} />
        <EditableSexCompositionMetric batch={batch} fallback={data.sexComposition} readOnly={batch.status === "ARCHIVED"} />
        <SummaryMetric label="Products used" value={String(data.productUse.length)} />
      </div>
      {data.population.reconciliationRequired && <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2.5 text-xs text-warning-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>Population records need review. The impossible negative total has been replaced with a safe recorded count.</p></div>}
      <div className="flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5"><CalendarDays className="size-3.5 text-muted-foreground" />{formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</span><span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5"><ClipboardCheck className="size-3.5 text-muted-foreground" />{otherChanges} other population changes</span></div>
    </>}
  </section>;
}
