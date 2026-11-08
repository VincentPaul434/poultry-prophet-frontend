"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Egg, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocale } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, todayIso } from "@/lib/format";
import type { CompleteIncubationRequest, IncubationCycle } from "@/lib/types";
import { cn } from "@/lib/utils";

type HatchDraft = { actualHatchDate: string; hatchedCount: number | ""; unhatchedCount: number | ""; removedDamagedCount: number | ""; notes: string };

function statusLabel(status: IncubationCycle["status"], t: ReturnType<typeof useLocale>["t"]) {
  return ({ LOADED: t("incubation.loaded"), INCUBATING: t("incubation.incubating"), HATCHING: t("incubation.hatching"), COMPLETED: t("incubation.completed"), CANCELLED: t("incubation.cancelled") })[status];
}

function statusClass(status: IncubationCycle["status"]) {
  if (status === "COMPLETED") return "bg-success-muted text-success";
  if (status === "CANCELLED") return "bg-destructive/10 text-destructive";
  return "bg-warning-muted text-warning-ink";
}

export function IncubationCyclePanel({ cycle, isManager, open, onOpenChange, completePending, createBatchPending, onComplete, onCreateBatch }: { cycle: IncubationCycle | null; isManager: boolean; open: boolean; onOpenChange: (open: boolean) => void; completePending: boolean; createBatchPending: boolean; onComplete: (id: number, body: CompleteIncubationRequest) => Promise<void>; onCreateBatch: (id: number, farmEntryDate: string) => Promise<void> }) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [hatch, setHatch] = useState<HatchDraft>(() => ({ actualHatchDate: cycle?.actualHatchDate ?? todayIso(), hatchedCount: "", unhatchedCount: "", removedDamagedCount: "", notes: cycle?.notes ?? "" }));
  const [farmEntryDate, setFarmEntryDate] = useState(cycle?.actualHatchDate ?? todayIso());

  const active = Boolean(cycle && cycle.status !== "COMPLETED" && cycle.status !== "CANCELLED");
  const resultTotal = Number(hatch.hatchedCount || 0) + Number(hatch.unhatchedCount || 0) + Number(hatch.removedDamagedCount || 0);
  const hasAllResults = hatch.hatchedCount !== "" && hatch.unhatchedCount !== "" && hatch.removedDamagedCount !== "";
  const reconciles = Boolean(cycle && hasAllResults && resultTotal === cycle.eggsLoaded);
  const liveRate = cycle && hatch.hatchedCount !== "" ? Math.round((Number(hatch.hatchedCount) * 1000) / cycle.eggsLoaded) / 10 : null;
  const context = useMemo(() => cycle ? [cycle.incubatorCode, cycle.bloodline].filter(Boolean).join(" · ") : "", [cycle]);

  if (!cycle) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[92dvh] rounded-t-3xl p-0" : "w-[min(92vw,34rem)] p-0 sm:max-w-xl"}>
        <SheetHeader className="border-b px-5 py-5 pr-14">
          <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Egg className="size-5" aria-hidden="true" /></span><div className="min-w-0"><SheetTitle className="truncate">{cycle.cycleName}</SheetTitle><SheetDescription className="truncate">{context || t("incubation.title")} · {formatDate(cycle.loadedDate)}</SheetDescription></div><Badge className={cn("shrink-0 rounded-full border-0", statusClass(cycle.status))}>{statusLabel(cycle.status, t)}</Badge></div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">{t("incubation.eggs")}</p><p className="mt-1 text-lg font-bold tabular-nums">{cycle.eggsLoaded}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("incubation.expected")}</p><p className="mt-1 font-semibold">{formatDate(cycle.expectedHatchDate)}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("incubation.eggSource")}</p><p className="mt-1 truncate font-semibold">{cycle.eggSource || "—"}</p></div>
            </div>
            {active && cycle.expectedHatchDate && cycle.expectedHatchDate <= todayIso() && <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted/60 px-3 py-2 text-sm text-warning-ink"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{t("incubation.dueForReview")}</p>}
            {cycle.status === "COMPLETED" && <div className="space-y-3"><div className="grid grid-cols-3 divide-x border-y py-3 text-center"><div className="px-2"><p className="text-xl font-bold tabular-nums">{cycle.hatchedCount ?? "—"}/{cycle.eggsLoaded}</p><p className="text-xs text-muted-foreground">{t("incubation.hatched")}</p></div><div className="px-2"><p className="text-xl font-bold tabular-nums">{cycle.hatchRatePercent == null ? "—" : `${cycle.hatchRatePercent}%`}</p><p className="text-xs text-muted-foreground">{t("incubation.hatchRate")}</p></div><div className="px-2"><p className="text-xl font-bold tabular-nums">{cycle.durationDays == null ? "—" : `${cycle.durationDays}d`}</p><p className="text-xs text-muted-foreground">{t("incubation.day")}</p></div></div><p className="text-xs text-muted-foreground">{t("incubation.hatchNote")}</p></div>}
            {cycle.status === "CANCELLED" && cycle.notes && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">{cycle.notes}</div>}
            {isManager && active && <form id={`hatch-form-${cycle.id}`} onSubmit={(event) => { event.preventDefault(); if (!reconciles) return; void onComplete(cycle.id, { ...hatch, notes: hatch.notes || null, hatchedCount: Number(hatch.hatchedCount), unhatchedCount: Number(hatch.unhatchedCount), removedDamagedCount: Number(hatch.removedDamagedCount) }); }} className="space-y-4 border-t pt-5"><div><h2 className="font-semibold">{t("incubation.hatchResult")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("incubation.resultHint")}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor={`hatch-date-${cycle.id}`}>{t("incubation.actualDate")}</Label><Input id={`hatch-date-${cycle.id}`} type="date" min={cycle.loadedDate} max={todayIso()} value={hatch.actualHatchDate} onChange={(event) => setHatch((current) => ({ ...current, actualHatchDate: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor={`hatched-${cycle.id}`}>{t("incubation.hatched")}</Label><Input id={`hatched-${cycle.id}`} type="number" min="0" step="1" value={hatch.hatchedCount} onChange={(event) => setHatch((current) => ({ ...current, hatchedCount: event.target.value === "" ? "" : Number(event.target.value) }))} /></div><div className="space-y-2"><Label htmlFor={`unhatched-${cycle.id}`}>{t("incubation.unhatched")}</Label><Input id={`unhatched-${cycle.id}`} type="number" min="0" step="1" value={hatch.unhatchedCount} onChange={(event) => setHatch((current) => ({ ...current, unhatchedCount: event.target.value === "" ? "" : Number(event.target.value) }))} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor={`removed-${cycle.id}`}>{t("incubation.removed")}</Label><Input id={`removed-${cycle.id}`} type="number" min="0" step="1" value={hatch.removedDamagedCount} onChange={(event) => setHatch((current) => ({ ...current, removedDamagedCount: event.target.value === "" ? "" : Number(event.target.value) }))} /></div></div><div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3 text-sm"><div><p className="text-xs text-muted-foreground">{t("incubation.eggsAccounted")}</p><p className="mt-1 font-semibold tabular-nums">{resultTotal} / {cycle.eggsLoaded}</p></div><div><p className="text-xs text-muted-foreground">{t("incubation.calculatedRate")}</p><p className="mt-1 font-semibold tabular-nums">{liveRate == null ? "—" : `${liveRate}%`}</p></div></div>{hasAllResults && <p className={cn("rounded-xl border px-3 py-2 text-sm font-semibold", reconciles ? "border-success-border bg-success-muted text-success" : "border-destructive/30 bg-destructive/5 text-destructive")}>{resultTotal} / {cycle.eggsLoaded} {reconciles ? <><Check className="inline size-4" aria-hidden="true" /> {t("incubation.eggsAccounted")}</> : t("incubation.checkCounts")}</p>}</form>}
            {isManager && cycle.status === "COMPLETED" && !cycle.createdBatchId && <div className="space-y-3 border-t pt-5"><div><h2 className="font-semibold">{t("incubation.createBatch")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("incubation.farmEntryHint")}</p></div><div className="space-y-2"><Label htmlFor={`farm-entry-date-${cycle.id}`}>{t("incubation.farmEntryDate")}</Label><Input id={`farm-entry-date-${cycle.id}`} type="date" min={cycle.actualHatchDate ?? undefined} max={todayIso()} value={farmEntryDate} onChange={(event) => setFarmEntryDate(event.target.value)} /></div><Button type="button" disabled={createBatchPending} className="min-h-11 w-full" onClick={() => void onCreateBatch(cycle.id, farmEntryDate)}>{createBatchPending ? <Loader2 className="animate-spin" /> : null}{t("incubation.createBatch")}</Button></div>}
            {cycle.createdBatchId && <p className="rounded-xl border border-success-border bg-success-muted px-3 py-2 text-sm font-semibold text-success">{t("incubation.batchCreated")}</p>}
          </div>
        </div>
        <SheetFooter className="border-t bg-popover/95 px-5 py-4"><div className="flex w-full gap-2"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>{isManager && active && <Button type="submit" form={`hatch-form-${cycle.id}`} disabled={completePending || !reconciles} className="min-h-11 flex-1">{completePending ? <Loader2 className="animate-spin" /> : null}{t("incubation.saveResults")}</Button>}</div></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
