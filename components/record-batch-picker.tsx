"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bird, ChevronRight, ClipboardList, RefreshCw, Search, TriangleAlert, X } from "lucide-react";
import { useBatches } from "@/hooks/use-batches";
import type { Batch } from "@/lib/types";
import type { LoggingOrigin } from "@/lib/logging-navigation";
import { getLoggingHref } from "@/lib/logging-navigation";
import { useLocale } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function needsPopulationReview(batch: Batch) {
  return batch.populationStatus === "RECONCILIATION_REQUIRED" || batch.currentPopulation < 0;
}

function stageLabel(batch: Batch) {
  return batch.stageName.replaceAll("-", " ");
}

function BatchPickerSkeleton() {
  return <div className="space-y-2.5" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="grid min-h-[72px] grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-primary/10 bg-card px-3.5 py-3 shadow-sm">
      <div className="size-11 animate-pulse rounded-xl bg-muted" />
      <div className="min-w-0 space-y-2"><div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div>
      <div className="size-5 animate-pulse rounded bg-muted" />
    </div>)}
  </div>;
}

function PickerEmptyState({ icon: Icon, title, hint }: { icon: typeof Bird; title: string; hint?: string }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-card/70 px-5 text-center shadow-sm">
    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" aria-hidden="true" /></span>
    <p className="mt-3 text-sm font-bold">{title}</p>
    {hint && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>}
  </div>;
}

function RecordBatchOption({ batch, origin, onSelected }: { batch: Batch; origin: LoggingOrigin; onSelected: () => void }) {
  const { t } = useLocale();
  const needsReview = needsPopulationReview(batch);
  const stage = stageLabel(batch);
  const accessibleDescription = needsReview
    ? `${batch.name}. ${batch.initialPopulation} initial birds. ${t("record.countNeedsReview")}. ${stage}.`
    : `${batch.name}. ${batch.currentPopulation} of ${batch.initialPopulation} birds. ${stage}.`;

  return <SheetClose
    nativeButton={false}
    render={<Link
      href={getLoggingHref(batch.id, origin, true)}
      onClick={onSelected}
      aria-label={accessibleDescription}
      className={cn(
        "group grid min-h-[72px] grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-primary/10 bg-card px-3.5 py-3 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.99] active:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/30",
        needsReview && "border-l-4 border-warning-border",
      )}
    />}
  >
    <span className={cn("flex size-11 items-center justify-center rounded-xl", needsReview ? "bg-warning-muted text-warning-ink" : "bg-primary/10 text-primary")}>
      {needsReview ? <TriangleAlert className="size-5" aria-hidden="true" /> : <Bird className="size-5" aria-hidden="true" />}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-sm font-bold text-foreground" title={batch.name}>{batch.name}</span>
      <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {needsReview ? <span className="font-bold tabular-nums text-warning-ink">{batch.initialPopulation} initial</span> : <><span className="font-bold tabular-nums text-foreground">{batch.currentPopulation} / {batch.initialPopulation}</span><span>{t("dashboard.birdsInBatch")}</span></>}
        <span aria-hidden="true">·</span>
        <Badge variant="secondary" className="h-5 max-w-[8rem] truncate rounded-full bg-primary/10 px-2 text-[10px] font-semibold capitalize text-primary">{stage}</Badge>
        {needsReview && <Badge variant="warning" className="h-5 max-w-[8rem] truncate rounded-full px-2 text-[10px] font-semibold">{t("record.countNeedsReview")}</Badge>}
      </span>
    </span>
    <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
  </SheetClose>;
}

export function RecordBatchPicker({ open, onOpenChange, origin }: { open: boolean; onOpenChange: (open: boolean) => void; origin: LoggingOrigin }) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const { data: batches, isLoading, isError, refetch } = useBatches({ enabled: open });
  const activeBatches = useMemo(() => (batches ?? []).filter((batch) => batch.status === "ACTIVE"), [batches]);
  const filteredBatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return [...activeBatches]
      .filter((batch) => !normalized || [batch.name, batch.bloodline, batch.stageName].filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(normalized)))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }, [activeBatches, query]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setQuery("");
    onOpenChange(nextOpen);
  }

  return <Sheet open={open} onOpenChange={handleOpenChange}>
    <SheetContent
      side="bottom"
      showCloseButton={false}
      overlayClassName="bg-black/30 backdrop-blur-[2px]"
      className="h-[min(90dvh,46rem)] max-h-[calc(100dvh-0.5rem)] gap-0 overflow-hidden rounded-t-[1.75rem] border-t-0 bg-muted/30 p-0 shadow-2xl"
    >
      <SheetHeader className="relative shrink-0 overflow-hidden bg-primary px-5 pb-8 pt-5 pr-16 text-primary-foreground">
        <Bird className="pointer-events-none absolute -bottom-6 right-2 size-28 text-primary-foreground/10" aria-hidden="true" />
        <SheetClose render={<Button variant="ghost" size="icon" className="absolute right-3 top-3 z-10 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />}>
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">{t("common.close")}</span>
        </SheetClose>
        <div className="relative z-10 flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 text-primary-foreground"><ClipboardList className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><SheetTitle className="text-xl font-bold text-primary-foreground">{t("record.title")}</SheetTitle><Badge variant="warning" className="h-5 rounded-full px-2 text-[10px] font-bold">{isLoading ? "…" : activeBatches.length} {t("record.activeBatches")}</Badge></div>
            <SheetDescription className="mt-1 text-primary-foreground/75">{t("record.chooseBatch")}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {activeBatches.length > 5 && <div className="relative z-10 -mt-5 shrink-0 px-4">
        <label className="flex h-12 items-center gap-2 rounded-2xl border bg-card px-3 shadow-md focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
          <Search className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="sr-only">{t("record.searchBatches")}</span>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("record.searchBatches")} className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        </label>
      </div>}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        {isLoading && <BatchPickerSkeleton />}
        {!isLoading && isError && <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-warning-border bg-warning-muted/70 px-5 text-center text-warning-ink shadow-sm"><TriangleAlert className="size-6" aria-hidden="true" /><p className="mt-3 text-sm font-bold">{t("record.loadBatchesError")}</p><Button type="button" variant="outline" size="sm" className="mt-3 border-warning-border bg-card text-warning-ink hover:bg-warning-muted" onClick={() => void refetch()}><RefreshCw className="size-3.5" />{t("record.tryAgain")}</Button></div>}
        {!isLoading && !isError && activeBatches.length === 0 && <PickerEmptyState icon={Bird} title={t("record.noActiveBatches")} />}
        {!isLoading && !isError && activeBatches.length > 0 && filteredBatches.length === 0 && <PickerEmptyState icon={Search} title={t("record.noMatchingBatches")} />}
        {!isLoading && !isError && filteredBatches.length > 0 && <div className="space-y-2.5">{filteredBatches.map((batch) => <RecordBatchOption key={batch.id} batch={batch} origin={origin} onSelected={() => onOpenChange(false)} />)}</div>}
      </div>
    </SheetContent>
  </Sheet>;
}
