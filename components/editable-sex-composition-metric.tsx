"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRecordSexComposition, useSexComposition, useSexCompositionContext } from "@/hooks/use-operations";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import type { Batch, SexComposition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SexCompositionFallback = Pick<SexComposition, "observedOn" | "populationAsOfObservation" | "maleCount" | "femaleCount" | "unclassifiedCount"> & {
  pendingSync?: boolean;
  projectedMaleCount?: number | null;
  projectedFemaleCount?: number | null;
  projectedUnclassifiedCount?: number | null;
  recordedMaleCount?: number | null;
  recordedFemaleCount?: number | null;
  recordedUnclassifiedCount?: number | null;
};

function CountInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min="0" step="1" inputMode="numeric" className="h-11 rounded-lg text-base tabular-nums" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

export function EditableSexCompositionMetric({ batch, fallback, readOnly = false }: { batch: Batch; fallback?: SexCompositionFallback | null; readOnly?: boolean }) {
  const { t } = useLocale();
  const { data: current, isLoading, refetch: refetchCurrent } = useSexComposition(batch.id);
  const save = useRecordSexComposition();
  const { snapshot: syncSnapshot } = useOfflineSync();
  const displayed = current ?? fallback ?? null;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [male, setMale] = useState("");
  const [female, setFemale] = useState("");
  const [unknown, setUnknown] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const context = useSexCompositionContext(batch.id, date, open);
  const fallbackPopulation = useMemo(() => {
    if (current && date === current.observedOn) {
      return current.recordedPopulationAsOfObservation ?? current.populationAsOfObservation;
    }
    return date === todayIso() ? batch.currentPopulation : null;
  }, [batch.currentPopulation, current, date]);
  const expectedPopulation = context.data?.expectedPopulation ?? fallbackPopulation;
  const populationStatus = context.data?.populationStatus ?? (batch.populationStatus === "VALID" ? "VALID" : "RECONCILIATION_REQUIRED");
  const total = [male, female, unknown].every((value) => value !== "")
    ? Number(male) + Number(female) + Number(unknown)
    : null;
  const knownSexTotal = male !== "" && female !== "" && Number.isInteger(Number(male)) && Number.isInteger(Number(female))
    ? Number(male) + Number(female)
    : null;
  const remainingAsUnclassified = expectedPopulation != null && knownSexTotal != null
    ? expectedPopulation - knownSexTotal
    : null;
  const offlineIssue = syncSnapshot.items.find((item) => item.batchId === batch.id
    && item.entityType === "SEX_COMPOSITION"
    && (item.status === "CONFLICT" || item.status === "REJECTED"));

  const maleValue = displayed ? displayed.projectedMaleCount ?? displayed.maleCount : null;
  const femaleValue = displayed ? displayed.projectedFemaleCount ?? displayed.femaleCount : null;
  const metricValue = displayed && maleValue != null && femaleValue != null ? `${maleValue} / ${femaleValue}` : "—";
  const pendingLabel = displayed?.pendingSync ? t("sexComposition.pendingSync") : undefined;
  const accessibleLabel = displayed
    ? `${t("sexComposition.edit")}: ${maleValue ?? "—"} ${t("sexComposition.male").toLowerCase()}, ${femaleValue ?? "—"} ${t("sexComposition.female").toLowerCase()}`
    : t("sexComposition.record");

  function startEdit() {
    const source = current ?? fallback;
    const observedOn = source?.observedOn ?? todayIso();
    setDate(observedOn);
    setMale(String(source?.recordedMaleCount ?? source?.maleCount ?? ""));
    setFemale(String(source?.recordedFemaleCount ?? source?.femaleCount ?? ""));
    setUnknown(String(source?.recordedUnclassifiedCount ?? source?.unclassifiedCount ?? 0));
    setError(null);
    setOpen(true);
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const counts = [male, female, unknown].map((value) => Number(value));
    if ([male, female, unknown].some((value) => value === "" || !Number.isInteger(Number(value)) || Number(value) < 0)) {
      setError(t("sexComposition.validationWholeNumbers"));
      return;
    }
    if (expectedPopulation == null) {
      setError(t("sexComposition.populationUnavailable"));
      return;
    }
    if (populationStatus !== "VALID") {
      setError(context.data?.populationMessage ?? t("sexComposition.populationNeedsReview"));
      return;
    }
    if (counts.reduce((sum, value) => sum + value, 0) !== expectedPopulation) {
      setError(`${t("sexComposition.populationMismatch")} ${expectedPopulation} ${t("sexComposition.birds")} ${formatDate(date)}.`);
      return;
    }

    try {
      await save.mutateAsync({
        batchId: batch.id,
        body: {
          observedOn: date,
          maleCount: counts[0],
          femaleCount: counts[1],
          unclassifiedCount: counts[2],
          expectedCurrentRecordId: context.data?.currentRecordId ?? current?.id ?? null,
        },
      });
      toast.success(t("sexComposition.recorded"));
      setOpen(false);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t("sexComposition.saveError"));
      if (cause instanceof ApiError && cause.status === 409) {
        await Promise.all([refetchCurrent(), context.refetch()]);
      }
    }
  }

  const metric = <div className={cn("min-w-0 bg-card px-3 py-3.5 text-left sm:px-4", !readOnly && "transition-colors hover:bg-muted/40")}>
    <div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("sexComposition.maleFemale")}</p>{!readOnly && (displayed ? <Pencil className="size-3.5 shrink-0 text-primary" aria-hidden="true" /> : <Plus className="size-3.5 shrink-0 text-primary" aria-hidden="true" />)}</div>
    <p className="mt-1 truncate text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{isLoading && !displayed ? "…" : metricValue}</p>
    {pendingLabel && <span className="mt-1 block size-1.5 rounded-full bg-warning" title={pendingLabel} aria-label={pendingLabel} />}
  </div>;

  return <>
    {readOnly ? metric : <button type="button" className="min-w-0 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={accessibleLabel} onClick={startEdit}>{metric}</button>}
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-5"><DialogTitle>{displayed ? t("sexComposition.editTitle") : t("sexComposition.recordTitle")}</DialogTitle><DialogDescription>{t("sexComposition.description")}</DialogDescription></DialogHeader>
        <form className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden" onSubmit={submit}>
          <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {offlineIssue && <p role="alert" className="rounded-lg border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning-ink"><strong>{t("sexComposition.pendingRecord")}:</strong> {offlineIssue.lastErrorMessage ?? t("sexComposition.pendingRecordHint")}</p>}
            <div className="space-y-1"><Label htmlFor={`sex-observed-on-${batch.id}`}>{t("sexComposition.observationDate")}</Label><Input id={`sex-observed-on-${batch.id}`} type="date" min={batch.hatchDate ?? undefined} max={todayIso()} value={date} onChange={(event) => { setError(null); setDate(event.target.value); }} className="h-11 rounded-lg" /><p className="text-xs text-muted-foreground">{t("sexComposition.populationHint")}</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><CountInput id={`sex-male-${batch.id}`} label={t("sexComposition.male")} value={male} onChange={(value) => { setError(null); setMale(value); }} /><CountInput id={`sex-female-${batch.id}`} label={t("sexComposition.female")} value={female} onChange={(value) => { setError(null); setFemale(value); }} /><div className="col-span-2 sm:col-span-1"><CountInput id={`sex-unclassified-${batch.id}`} label={t("sexComposition.unclassified")} value={unknown} onChange={(value) => { setError(null); setUnknown(value); }} /></div></div>
            <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={remainingAsUnclassified == null || remainingAsUnclassified < 0} onClick={() => { setUnknown(String(remainingAsUnclassified)); setError(null); }}>{t("sexComposition.useRemaining")}</Button>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"><div className="flex justify-between gap-2"><span>{t("sexComposition.assigned")}</span><strong className="tabular-nums">{total ?? "—"} / {expectedPopulation ?? "—"}</strong></div>{expectedPopulation != null && total != null && <p className="mt-1 text-xs text-muted-foreground">{expectedPopulation - total === 0 ? t("sexComposition.allAssigned") : `${Math.abs(expectedPopulation - total)} ${t("sexComposition.birds")} ${expectedPopulation - total > 0 ? t("sexComposition.stillNeed") : t("sexComposition.overAssigned")}.`}</p>}</div>
            {context.isFetching && <p className="text-xs text-muted-foreground">{t("sexComposition.checking")} {formatDate(date)}…</p>}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t bg-card px-4 py-3 sm:px-5"><Button type="button" variant="outline" className="min-h-11" onClick={() => handleOpenChange(false)}>{t("common.cancel")}</Button><Button type="submit" className="min-h-11" aria-busy={save.isPending} disabled={save.isPending || context.isFetching || expectedPopulation == null || populationStatus !== "VALID"}>{save.isPending && <><Loader2 className="size-4 animate-spin" /><span className="sr-only" role="status">{t("sexComposition.saving")}</span></>}{t("sexComposition.save")}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
