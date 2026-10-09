"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, FileText, TriangleAlert } from "lucide-react";
import { useSelectionReviewPreview } from "@/hooks/use-selection-review";
import { useSexComposition } from "@/hooks/use-operations";
import { formatDate } from "@/lib/format";
import type { SelectionReviewProductUse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function SummaryCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <Card className="min-w-0 shadow-none"><CardContent className="space-y-0.5 p-2.5 sm:p-3"><p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl">{value}</p>{note && <p className="truncate text-[10px] text-muted-foreground">{note}</p>}</CardContent></Card>;
}

function groupedProducts(items: SelectionReviewProductUse[]) {
  const groups = new Map<string, { label: string; type: string; count: number; quantity: number | null; unit: string | null; purpose: string | null; unitCost: number | null; cost: number | null }>();
  for (const item of items) {
    const key = `${item.productType}:${item.brandName}:${item.unit ?? ""}`;
    const current = groups.get(key) ?? { label: item.brandName, type: item.productType, count: 0, quantity: item.quantity == null ? null : 0, unit: item.unit, purpose: item.purpose, unitCost: item.unitCost == null ? null : item.unitCost, cost: item.calculatedCost == null ? null : 0 };
    current.count += 1;
    if (current.quantity != null && item.quantity != null) current.quantity += item.quantity;
    else current.quantity = null;
    if (current.cost != null && item.calculatedCost != null) current.cost += item.calculatedCost;
    else current.cost = null;
    if (current.unitCost != null && item.unitCost != null && Math.abs(current.unitCost - item.unitCost) > 0.000001) current.unitCost = null;
    else if (item.unitCost == null) current.unitCost = null;
    if (!current.purpose && item.purpose) current.purpose = item.purpose;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 4);
}

export function SelectionReviewSummary({ batchId }: { batchId: number | string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useSelectionReviewPreview(batchId);
  const { data: currentSexComposition } = useSexComposition(Number(batchId));
  const productGroups = useMemo(() => groupedProducts(data?.productUse ?? []), [data?.productUse]);
  const otherChanges = data ? data.population.predation + data.population.missing + data.population.returned + data.population.transfersOut + data.population.transfersIn + data.population.sales + data.population.culling + data.population.countCorrections : 0;

  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-bold uppercase tracking-wider text-muted-foreground">Batch review</h2><p className="mt-0.5 text-xs text-muted-foreground">Recorded facts for manager review</p></div><Button variant="outline" size="sm" className="h-9 shrink-0 text-xs" onClick={() => setOpen(true)}><FileText className="size-3.5" /> Review report</Button></div>
    {isLoading && <div className="grid grid-cols-2 gap-3"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-24 animate-pulse rounded-xl bg-muted" /></div>}
    {isError && <p className="rounded-xl border border-warning-border bg-warning-muted px-4 py-3 text-xs text-warning-ink">Review unavailable. The event log is still available.</p>}
    {data && <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"><SummaryCard label="Population" value={data.batch.currentPopulationDisplay} note={data.population.reconciliationRequired ? "Records need review" : `${data.batch.stageName.replace("-", " ")} · Day ${data.batch.ageDays}`} /><SummaryCard label="Total deaths" value={String(data.population.totalDeaths)} note={`${data.population.healthRelatedDeaths} health · ${data.population.accidentalDeaths} accidental`} /><SummaryCard label="Male / female" value={currentSexComposition ? `${currentSexComposition.maleCount} / ${currentSexComposition.femaleCount}` : data.sexComposition ? `${data.sexComposition.maleCount} / ${data.sexComposition.femaleCount}` : "—"} note={currentSexComposition ? `${currentSexComposition.unclassifiedCount} unclassified · ${currentSexComposition.pendingSync ? "Pending sync" : formatDate(currentSexComposition.observedOn)}` : data.sexComposition ? `${data.sexComposition.unclassifiedCount} unclassified · ${formatDate(data.sexComposition.observedOn)}` : "Not recorded"} /><SummaryCard label="Products used" value={String(data.productUse.length)} note={`${data.healthEvents.length} health event${data.healthEvents.length === 1 ? "" : "s"}`} /></div>
      {data.population.reconciliationRequired && <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2.5 text-xs text-warning-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>Population records need review. The impossible negative total has been replaced with a safe recorded count.</p></div>}
      <div className="flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5"><CalendarDays className="size-3.5 text-muted-foreground" />{formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</span><span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5"><ClipboardCheck className="size-3.5 text-muted-foreground" />{otherChanges} other population changes</span></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-none max-w-lg gap-3 overflow-visible p-3 sm:gap-4 sm:p-4"><DialogHeader className="min-w-0 gap-1.5"><DialogTitle>Current batch review</DialogTitle><DialogDescription className="min-w-0 break-words">{data.batch.batchName} · {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</DialogDescription></DialogHeader>
        <div className="grid min-w-0 grid-cols-2 gap-2"><SummaryCard label="Population" value={data.batch.currentPopulationDisplay} note={data.population.reconciliationRequired ? "Records need review" : `Day ${data.batch.ageDays} · ${data.batch.stageName.replace("-", " ")}`} /><SummaryCard label="Total deaths" value={String(data.population.totalDeaths)} note={`${data.population.healthRelatedDeaths} health · ${data.population.accidentalDeaths} accidental`} /><SummaryCard label="Health events" value={String(data.healthEvents.length)} /><SummaryCard label="Male / female" value={data.sexComposition ? `${data.sexComposition.maleCount} / ${data.sexComposition.femaleCount}` : "—"} note={data.sexComposition ? `${data.sexComposition.unclassifiedCount} unclassified` : "Not recorded"} /></div>
        {data.population.reconciliationRequired && <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2.5 text-xs text-warning-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>{data.population.reconciliationMessage ?? "Population records need review."}</p></div>}
        <div className="min-w-0 space-y-1.5 rounded-xl border p-2.5 sm:p-3"><div className="flex min-w-0 items-center justify-between gap-2"><p className="text-sm font-semibold">Products used</p><span className="shrink-0 text-xs text-muted-foreground">{data.productUse.length} record{data.productUse.length === 1 ? "" : "s"}</span></div>{productGroups.length === 0 ? <p className="text-xs text-muted-foreground">No product records in this period.</p> : productGroups.map((item) => <div key={`${item.type}:${item.label}:${item.unit}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm"><span className="min-w-0 truncate">{item.label}<span className="ml-1 text-xs text-muted-foreground">· {item.type}</span></span><span className="shrink-0 text-right text-xs font-medium">{item.quantity == null ? `${item.count} record${item.count === 1 ? "" : "s"}` : item.cost != null ? `${item.quantity} ${item.unit ?? "unit"} × ₱${(item.unitCost ?? (item.cost / item.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ₱${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${item.quantity} ${item.unit ?? "unit"} · cost unavailable`}</span></div>)}</div>
        {data.finance && <div className="grid min-w-0 grid-cols-2 gap-1.5 rounded-xl border bg-muted/20 p-2.5 sm:grid-cols-5 sm:gap-2 sm:p-3"><div className="min-w-0"><p className="text-[11px] text-muted-foreground">Income</p><p className="truncate text-sm font-semibold">₱{Number(data.finance.recordedIncome).toLocaleString()}</p></div><div className="min-w-0"><p className="text-[11px] text-muted-foreground">Cash expense</p><p className="truncate text-sm font-semibold">₱{Number(data.finance.recordedExpense).toLocaleString()}</p></div><div className="min-w-0"><p className="text-[11px] text-muted-foreground">Products used</p><p className="truncate text-sm font-semibold">₱{Number(data.finance.productsConsumedCost).toLocaleString()}</p></div><div className="min-w-0"><p className="text-[11px] text-muted-foreground">Batch cost</p><p className="truncate text-sm font-semibold">₱{Number(data.finance.totalRecordedBatchCost).toLocaleString()}</p></div><div className="min-w-0"><p className="text-[11px] text-muted-foreground">Contribution</p><p className="truncate text-sm font-semibold">₱{Number(data.finance.recordedContribution).toLocaleString()}</p></div></div>}
        <p className="text-[11px] leading-tight text-muted-foreground">Recorded data only · Use with the handler&apos;s visual assessment.</p>
        <DialogFooter className="-mx-3 -mb-3 p-3 sm:-mx-4 sm:-mb-4 sm:p-4"><Button className="h-9" variant="outline" onClick={() => setOpen(false)}>Close</Button><Button className="h-9" render={<Link href={`/batches/${batchId}/selection`} />}>Open full report</Button></DialogFooter>
      </DialogContent></Dialog>
    </>}
  </section>;
}
