"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { useRecordSexComposition, useSexComposition, useSexCompositionContext } from "@/hooks/use-operations";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import { useOfflineSync } from "@/lib/offline-sync-provider";
import type { Batch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CountInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`sex-${label.toLowerCase()}`}>{label}</Label>
      <Input
        id={`sex-${label.toLowerCase()}`}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function SexCompositionCard({ batch }: { batch: Batch }) {
  const { data: current, isLoading, refetch: refetchCurrent } = useSexComposition(batch.id);
  const save = useRecordSexComposition();
  const { snapshot: syncSnapshot } = useOfflineSync();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [male, setMale] = useState("");
  const [female, setFemale] = useState("");
  const [unknown, setUnknown] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const context = useSexCompositionContext(batch.id, date, editing);
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

  function startEdit() {
    const observedOn = current?.observedOn ?? todayIso();
    setDate(observedOn);
    setMale(String(current?.recordedMaleCount ?? current?.maleCount ?? ""));
    setFemale(String(current?.recordedFemaleCount ?? current?.femaleCount ?? ""));
    setUnknown(String(current?.recordedUnclassifiedCount ?? current?.unclassifiedCount ?? 0));
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const counts = [male, female, unknown].map((value) => Number(value));
    if ([male, female, unknown].some((value) => value === "" || !Number.isInteger(Number(value)) || Number(value) < 0)) {
      setError("Enter whole numbers of zero or more for all three categories.");
      return;
    }
    if (expectedPopulation == null) {
      setError("The population for this observation date is not available yet. Refresh the batch and try again.");
      return;
    }
    if (populationStatus !== "VALID") {
      setError(context.data?.populationMessage ?? "Population history needs reconciliation before sexing this batch.");
      return;
    }
    if (counts.reduce((sum, value) => sum + value, 0) !== expectedPopulation) {
      setError(`Male + female + unclassified must equal ${expectedPopulation} birds for ${formatDate(date)}.`);
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
      toast.success("Sex composition recorded");
      setEditing(false);
      setError(null);
    } catch (cause) {
      const message = cause instanceof ApiError
        ? cause.message
        : "The sex composition could not be saved. Refresh and try again.";
      setError(message);
      if (cause instanceof ApiError && cause.status === 409) {
        await Promise.all([refetchCurrent(), context.refetch()]);
      }
    }
  }

  if (isLoading) {
    return <Card><CardContent className="flex min-h-28 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading sex composition" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-success" /> Sex composition</CardTitle>
        {!editing && <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="size-3.5" /> {current ? "Update" : "Record"}</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {offlineIssue && <p role="alert" className="rounded-lg border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning-ink"><strong>Pending sex-composition record:</strong> {offlineIssue.lastErrorMessage ?? "Review the saved counts and submit again."} Your entered record remains saved on this device.</p>}
        {!editing && (
          current ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-2"><p className="text-[10px] uppercase text-muted-foreground">Male</p><p className="text-lg font-semibold tabular-nums">{current.projectedMaleCount ?? current.maleCount}</p></div>
              <div className="rounded-lg border p-2"><p className="text-[10px] uppercase text-muted-foreground">Female</p><p className="text-lg font-semibold tabular-nums">{current.projectedFemaleCount ?? current.femaleCount}</p></div>
              <div className="rounded-lg border p-2"><p className="text-[10px] uppercase text-muted-foreground">Unclassified</p><p className="text-lg font-semibold tabular-nums">{current.projectedUnclassifiedCount ?? current.unclassifiedCount}</p></div>
              <p className="col-span-3 text-xs text-muted-foreground">Recorded {formatDate(current.observedOn)} · {current.recordedPopulationAsOfObservation ?? current.populationAsOfObservation} birds · Effective as of {formatDate(current.projectedAsOf ?? current.observedOn)} · {current.projectedPopulation ?? current.populationAsOfObservation} birds</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">No sex count recorded yet. Unclassified starts at 0 when every bird is identified.</p>
        )}

        {editing && (
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-1"><Label htmlFor="sex-observed-on">Observation date</Label><Input id="sex-observed-on" type="date" min={batch.hatchDate ?? undefined} max={todayIso()} value={date} onChange={(event) => { setError(null); setDate(event.target.value); }} /><p className="text-xs text-muted-foreground">Counts must match the population recorded on this date, not necessarily today&apos;s total.</p></div>
            <div className="grid grid-cols-3 gap-2"><CountInput label="Male" value={male} onChange={setMale} /><CountInput label="Female" value={female} onChange={setFemale} /><CountInput label="Unclassified" value={unknown} onChange={setUnknown} /></div>
            <Button type="button" variant="outline" size="sm" disabled={remainingAsUnclassified == null || remainingAsUnclassified < 0} onClick={() => { setUnknown(String(remainingAsUnclassified)); setError(null); }}>Use remaining as unclassified</Button>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"><div className="flex justify-between gap-2"><span>Assigned</span><strong className="tabular-nums">{total ?? "—"} / {expectedPopulation ?? "—"}</strong></div>{expectedPopulation != null && total != null && <p className="mt-1 text-xs text-muted-foreground">{expectedPopulation - total === 0 ? "All birds are assigned." : `${Math.abs(expectedPopulation - total)} bird${Math.abs(expectedPopulation - total) === 1 ? "" : "s"} ${expectedPopulation - total > 0 ? "still need" : "over-assigned"}.`}</p>}</div>
            {context.isFetching && <p className="text-xs text-muted-foreground">Checking the population for {formatDate(date)}…</p>}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button><Button type="submit" disabled={save.isPending || context.isFetching || expectedPopulation == null || populationStatus !== "VALID"}>{save.isPending && <Loader2 className="size-4 animate-spin" />} Save composition</Button></div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
