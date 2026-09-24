"use client";

import Link from "next/link";
import { AlertCircle, CalendarDays, ClipboardCheck, FileText } from "lucide-react";
import { useSelectionReviewPreview } from "@/hooks/use-selection-review";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs leading-snug text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function SelectionReviewSummary({ batchId }: { batchId: number | string }) {
  const { data, isLoading, isError } = useSelectionReviewPreview(batchId);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Selection review summary</h2>
          <p className="mt-1 text-xs text-muted-foreground">Recorded facts for manager review—not a health score or automatic selection.</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" render={<Link href={`/batches/${batchId}/selection`} />}>
          <FileText className="size-4" /> Review report
        </Button>
      </div>

      {isLoading && <div className="grid grid-cols-2 gap-3"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}
      {isError && <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">The review summary is temporarily unavailable. The underlying event log is still available.</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Population" value={data.batch.currentPopulationDisplay} detail={`${data.batch.stageName.replace("-", " ")} · ${data.batch.ageDays} days old`} />
            <SummaryCard label="Health-related deaths" value={String(data.population.healthRelatedDeaths)} detail={data.population.healthRelatedLossPercentage == null ? "Rate unavailable" : `${data.population.healthRelatedLossPercentage}% of initial population`} />
            <SummaryCard label="Other population changes" value={String(data.population.accidentalDeaths + data.population.predation + data.population.missing + data.population.returned + data.population.transfersOut + data.population.transfersIn + data.population.sales + data.population.culling + data.population.countCorrections)} detail="Accidents, predation, missing, moves, sales, culling, and corrections" />
            <SummaryCard label="Recorded health events" value={String(data.healthEvents.length)} detail="Observations and health-related records" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border bg-card p-3 text-xs">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div><p className="font-semibold">Report period</p><p className="text-muted-foreground">{formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</p></div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-card p-3 text-xs">
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div><p className="font-semibold">Product-use records</p><p className="text-muted-foreground">{data.productUse.length} recorded intervention/product entries</p></div>
            </div>
          </div>
          {data.finance && <div className="rounded-xl border bg-card p-3 text-xs"><p className="font-semibold">Recorded net cash flow</p><p className="mt-1 text-lg font-bold">₱{Number(data.finance.recordedNetCashFlow).toLocaleString()}</p><p className="text-muted-foreground">Recorded income minus recorded expenses · may be incomplete</p></div>}
          {data.population.legacyMortalityRecords > 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{data.population.legacyMortalityRecords} legacy mortality record(s) are kept separate because their cause was not classified.</span></div>}
          <div className="flex flex-wrap gap-2">
            {data.dataAvailability.map((item) => <span key={item.section} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "NO_RECORDS" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "bg-muted text-muted-foreground"}`}>{item.section}: {item.status.replace("_", " ")}</span>)}
          </div>
        </>
      )}
    </section>
  );
}
