"use client";

import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateSelectionSession, useFinalizeSelectionSession, useSelectionSessions, useUpdateSelectionSession } from "@/hooks/use-selection-sessions";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import type { CreateSelectionSessionRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CRITERIA = [
  ["GENERAL_PHYSICAL_CONDITION", "Overall condition"],
  ["BODY_CONFORMATION", "Body form"],
  ["LEGS_AND_MOVEMENT", "Legs / movement"],
  ["BEHAVIOR_OR_TEMPERAMENT", "Behavior"],
  ["SIZE_OR_WEIGHT", "Size / weight"],
  ["HEALTH_HISTORY", "Health history"],
  ["BLOODLINE_OR_SOURCE", "Bloodline / source"],
] as const;
const MAX_COUNT = 2_147_483_647;

function newOperationId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseWholeCount(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed <= MAX_COUNT ? parsed : null;
}

function optionalWholeCount(value: string) {
  return value.trim() === "" ? 0 : parseWholeCount(value);
}

function NumberField({ id, label, value, onChange, max, disabled = false }: { id: string; label: string; value: string; onChange: (value: string) => void; max?: number; disabled?: boolean }) {
  const invalid = value.trim() !== "" && parseWholeCount(value) === null;
  return <label htmlFor={id} className="grid gap-1.5 text-sm font-semibold"><span>{label}</span><Input id={id} type="number" inputMode="numeric" min={0} max={max} step={1} value={value} disabled={disabled} aria-invalid={invalid} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" /></label>;
}

export function SelectionSessionDialog({ batchId, batchName, currentPopulation }: { batchId: number | string; batchName: string; currentPopulation: number }) {
  const [open, setOpen] = useState(false);
  const [selectionDate, setSelectionDate] = useState(todayIso());
  const [evaluated, setEvaluated] = useState("");
  const [accepted, setAccepted] = useState("");
  const [continued, setContinued] = useState("");
  const [notAccepted, setNotAccepted] = useState("");
  const [other, setOther] = useState("");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [criteriaNotes, setCriteriaNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [operationId, setOperationId] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const sessions = useSelectionSessions(batchId);
  const create = useCreateSelectionSession(batchId);
  const update = useUpdateSelectionSession(batchId);
  const finalize = useFinalizeSelectionSession(batchId);
  const latest = sessions.data?.[0];
  const activeDraft = sessions.data?.find((session) => session.status === "DRAFT");
  const activeDraftNeedsReview = activeDraft?.offlineSyncStatus != null
    && ["AUTH_REQUIRED", "CONFLICT", "REJECTED"].includes(activeDraft.offlineSyncStatus);
  const parsedEvaluated = parseWholeCount(evaluated);
  const parsedAccepted = optionalWholeCount(accepted);
  const parsedContinued = optionalWholeCount(continued);
  const parsedNotAccepted = optionalWholeCount(notAccepted);
  const parsedOther = optionalWholeCount(other);
  const outcomesValid = [parsedAccepted, parsedContinued, parsedNotAccepted, parsedOther].every((value) => value !== null);
  const evaluatedCount = parsedEvaluated ?? 0;
  const outcomeTotal = outcomesValid
    ? (parsedAccepted ?? 0) + (parsedContinued ?? 0) + (parsedNotAccepted ?? 0) + (parsedOther ?? 0)
    : 0;
  const evaluatedReady = parsedEvaluated !== null && parsedEvaluated >= 1;
  const remaining = evaluatedReady && outcomesValid ? evaluatedCount - outcomeTotal : null;
  const today = todayIso();
  const exceedsCurrentPopulation = selectionDate === today && evaluatedReady && evaluatedCount > currentPopulation;
  const busy = create.isPending || update.isPending || finalize.isPending;

  const reset = () => {
    setSelectionDate(todayIso()); setEvaluated(""); setAccepted(""); setContinued(""); setNotAccepted(""); setOther("");
    setCriteria([]); setCriteriaNotes(""); setNotes(""); setError(""); setOperationId(""); setEditingDraftId(null);
  };

  const beginSession = () => {
    reset();
    if (activeDraft) {
      setSelectionDate(activeDraft.selectionDate);
      setEvaluated(String(activeDraft.evaluatedCount));
      setAccepted(activeDraft.acceptedCount === 0 ? "" : String(activeDraft.acceptedCount));
      setContinued(activeDraft.continueObservationCount === 0 ? "" : String(activeDraft.continueObservationCount));
      setNotAccepted(activeDraft.notAcceptedCount === 0 ? "" : String(activeDraft.notAcceptedCount));
      setOther(activeDraft.otherCount === 0 ? "" : String(activeDraft.otherCount));
      setCriteria([...activeDraft.criterionCodes]);
      setCriteriaNotes(activeDraft.criteriaNotes ?? "");
      setNotes(activeDraft.sessionNotes ?? "");
      setOperationId(activeDraft.operationId ?? newOperationId());
      setEditingDraftId(activeDraft.id);
    } else {
      setOperationId(newOperationId());
    }
    setOpen(true);
  };

  const toggleCriterion = (code: string) => setCriteria((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);

  const buildRequest = (requestOperationId: string): CreateSelectionSessionRequest => ({
    selectionDate,
    evaluatedCount,
    acceptedCount: parsedAccepted ?? 0,
    continueObservationCount: parsedContinued ?? 0,
    notAcceptedCount: parsedNotAccepted ?? 0,
    otherCount: parsedOther ?? 0,
    criterionCodes: criteria,
    criteriaNotes: criteriaNotes.trim() || null,
    sessionNotes: notes.trim() || null,
    operationId: requestOperationId,
  });

  const validate = (finalizing: boolean) => {
    if (!selectionDate || selectionDate > today) return "Choose today or an earlier selection date.";
    if (!evaluatedReady) return "Evaluated must be a whole number of at least 1.";
    if (!outcomesValid) return "Use whole numbers only for every selection outcome.";
    if (outcomeTotal > evaluatedCount) return "Outcome counts cannot exceed evaluated birds.";
    if (finalizing && remaining !== 0) return `Complete the outcome count: ${Math.max(0, remaining ?? 0)} bird${remaining === 1 ? "" : "s"} still unaccounted for.`;
    if ((parsedOther ?? 0) > 0 && !notes.trim()) return "Add a note when using Other.";
    if (exceedsCurrentPopulation) return `Evaluated count cannot exceed today's recorded population (${currentPopulation}).`;
    return "";
  };

  async function save(finalizing: boolean) {
    const validation = validate(finalizing);
    if (validation) { setError(validation); return; }
    setError("");
    try {
      const requestOperationId = editingDraftId != null && editingDraftId > 0
        ? newOperationId()
        : operationId || newOperationId();
      if (!operationId) setOperationId(requestOperationId);
      const request = buildRequest(requestOperationId);
      const saved = editingDraftId == null
        ? await create.mutateAsync(request)
        : await update.mutateAsync({ sessionId: editingDraftId, body: request });
      if (editingDraftId == null) setEditingDraftId(saved.id);
      const needsOnlineFinalization = finalizing && (saved.id < 0 || saved.offlineSyncStatus != null || !navigator.onLine);
      if (finalizing && !needsOnlineFinalization) await finalize.mutateAsync(saved.id);
      toast.success(needsOnlineFinalization
        ? "Draft saved on this device. Reconnect to finalize it."
        : finalizing
          ? "Selection session finalized."
          : editingDraftId == null
            ? "Selection session saved as draft."
            : saved.offlineSyncStatus
              ? "Draft saved on this device and will sync when online."
              : "Selection draft updated.");
      reset(); setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the selection session.");
    }
  }

  const latestText = useMemo(() => {
    if (activeDraft) {
      const assigned = activeDraft.acceptedCount + activeDraft.continueObservationCount + activeDraft.notAcceptedCount + activeDraft.otherCount;
      const draftLabel = activeDraft.id < 0 || activeDraft.offlineSyncStatus ? "Saved on this device" : "Draft";
      return `${draftLabel} · ${formatDate(activeDraft.selectionDate)} · ${assigned}/${activeDraft.evaluatedCount} assigned`;
    }
    if (!latest) return "No selection session recorded";
    return `${latest.status === "FINALIZED" ? "Finalized" : "Draft"} · ${formatDate(latest.selectionDate)} · ${latest.acceptedCount}/${latest.evaluatedCount} accepted`;
  }, [activeDraft, latest]);

  const outcomeStatus = !evaluatedReady
    ? { tone: "warning", text: "Enter the number evaluated first." }
    : exceedsCurrentPopulation
      ? { tone: "error", text: `Only ${currentPopulation} birds are recorded today.` }
      : !outcomesValid
        ? { tone: "error", text: "Use whole numbers only." }
        : remaining === 0
          ? { tone: "success", text: `All ${evaluatedCount} birds are accounted for.` }
          : (remaining ?? 0) > 0
            ? { tone: "warning", text: `${remaining} bird${remaining === 1 ? "" : "s"} still need an outcome.` }
            : { tone: "error", text: `Remove ${Math.abs(remaining ?? 0)} from the outcome counts.` };

  return <>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-bold">Selection review</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{latestText}</p></div>
        {activeDraft ? <Badge variant={activeDraftNeedsReview ? "destructive" : activeDraft.offlineSyncStatus ? "outline" : "secondary"}>{activeDraftNeedsReview ? "Needs review" : activeDraft.offlineSyncStatus ? "Waiting to sync" : "Draft"}</Badge> : latest?.selectionRatePercent != null && <Badge variant="secondary">{latest.selectionRatePercent}% accepted</Badge>}
      </div>
      <Button type="button" className="mt-3 h-12 w-full rounded-xl font-bold" onClick={beginSession}><ClipboardCheck className="size-4" /> {activeDraft ? "Continue selection draft" : "Record selection session"}</Button>
    </div>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-xl">
        <DialogHeader><DialogTitle>Record selection session</DialogTitle><DialogDescription>{batchName} · This records the manager&apos;s review and does not change population automatically. Drafts can be saved offline; finalization requires a connection.</DialogDescription></DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto py-1 pr-1">
          <div className="grid gap-3 sm:grid-cols-2"><label htmlFor="selection-date" className="grid gap-1.5 text-sm font-semibold"><span>Selection date</span><Input id="selection-date" type="date" max={today} value={selectionDate} onChange={(event) => { setSelectionDate(event.target.value); setError(""); }} className="h-12 rounded-xl" /></label><div className="rounded-xl border bg-muted/30 px-3 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Population today</p><p className="mt-1 text-lg font-bold">{currentPopulation.toLocaleString()} birds</p></div></div>
          <div className="rounded-2xl border p-3">
            <div className="mb-3"><p className="text-sm font-bold">Selection outcome</p><p className="text-xs text-muted-foreground">Record each evaluated bird in one outcome.</p></div>
            <div className="grid gap-3 sm:grid-cols-[9rem_1fr] sm:items-end">
              <NumberField id="evaluated" label="Evaluated" value={evaluated} max={selectionDate === today ? currentPopulation : MAX_COUNT} onChange={(value) => { setEvaluated(value); setError(""); }} />
              <div role="status" aria-live="polite" className={cn("flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2", outcomeStatus.tone === "success" ? "border-success-border bg-success-muted text-success" : outcomeStatus.tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-warning-border bg-warning-muted text-warning-ink")}>{outcomeStatus.tone === "success" ? <CircleCheck className="size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="size-4 shrink-0" aria-hidden="true" />}<div><p className="text-sm font-semibold">{outcomeStatus.text}</p>{evaluatedReady && outcomesValid && <p className="text-[11px] opacity-80">{outcomeTotal} of {evaluatedCount} assigned</p>}</div></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField id="accepted" label="Accepted" value={accepted} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setAccepted(value); setError(""); }} />
              <NumberField id="continued" label="Continue observation" value={continued} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setContinued(value); setError(""); }} />
              <NumberField id="not-accepted" label="Not accepted" value={notAccepted} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setNotAccepted(value); setError(""); }} />
              <NumberField id="other" label="Other" value={other} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setOther(value); setError(""); }} />
            </div>
          </div>
          <div className="space-y-2"><p className="text-sm font-bold">Criteria considered <span className="font-normal text-muted-foreground">(optional)</span></p><div className="flex flex-wrap gap-2">{CRITERIA.map(([code, label]) => <button key={code} type="button" aria-pressed={criteria.includes(code)} onClick={() => toggleCriterion(code)} className={cn("min-h-10 rounded-full border px-3 text-sm font-semibold", criteria.includes(code) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>{criteria.includes(code) ? "✓ " : ""}{label}</button>)}</div><Input value={criteriaNotes} maxLength={1000} onChange={(event) => setCriteriaNotes(event.target.value)} placeholder="Optional detail about what was considered" className="h-11 rounded-xl" /></div>
          <div className="space-y-1.5"><Label htmlFor="selection-notes">Notes <span className="font-normal text-muted-foreground">(required if Other is used)</span></Label><Textarea id="selection-notes" rows={3} value={notes} maxLength={2000} onChange={(event) => { setNotes(event.target.value); setError(""); }} placeholder="What did the manager observe or decide?" className="resize-none rounded-xl" /></div>
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-semibold text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" className="h-12 w-full rounded-xl sm:w-auto" onClick={() => save(false)} disabled={busy}>Save draft</Button><Button type="button" className="h-12 w-full rounded-xl font-bold sm:w-auto" onClick={() => save(true)} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Finalize session</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
