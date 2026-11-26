"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateSelectionSession, useFinalizeSelectionSession, useSelectionSessions, useUpdateSelectionSession } from "@/hooks/use-selection-sessions";
import { ApiError } from "@/lib/api-client";
import { newSecureUuid } from "@/lib/uuid";
import { formatDate, todayIso } from "@/lib/format";
import type { CreateSelectionSessionRequest, SelectionReviewResponse, SelectionSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function sameDraftValues(request: CreateSelectionSessionRequest, draft: SelectionSession) {
  const note = (value: string | null | undefined) => value?.trim() || null;
  return request.selectionDate === draft.selectionDate && request.evaluatedCount === draft.evaluatedCount
    && request.acceptedCount === draft.acceptedCount && request.continueObservationCount === draft.continueObservationCount
    && request.notAcceptedCount === draft.notAcceptedCount && request.otherCount === draft.otherCount
    && JSON.stringify([...request.criterionCodes].sort()) === JSON.stringify([...draft.criterionCodes].sort())
    && note(request.criteriaNotes) === note(draft.criteriaNotes) && note(request.sessionNotes) === note(draft.sessionNotes)
    && request.selectionReviewId === draft.selectionReviewId
    && Boolean(request.sourceDataAcknowledged) === Boolean(draft.sourceDataAcknowledged);
}

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
  return <label htmlFor={id} className="grid gap-1.5 text-sm font-semibold"><span>{label}</span><Input id={id} type="number" inputMode="numeric" min={0} max={max} step={1} value={value} disabled={disabled} aria-invalid={invalid} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg text-center text-base font-bold" /></label>;
}

type ReviewBasis = Pick<SelectionReviewResponse, "id" | "versionNumber" | "asOfDate" | "status" | "reviewStatus" | "newerDataAvailable">;

function summaryForSession(session: SelectionSession) {
  return `${session.acceptedCount} accepted of ${session.evaluatedCount} evaluated`;
}

export function SelectionOutcomePanel({
  batchId,
  batchName,
  currentPopulation,
  populationUnavailableMessage,
  review,
  isManager,
}: {
  batchId: number | string;
  batchName: string;
  currentPopulation: number | null;
  populationUnavailableMessage?: string;
  review: ReviewBasis;
  isManager: boolean;
}) {
  const { display: displayText } = useDisplayLocale();
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [selectionDate, setSelectionDate] = useState(todayIso());
  const [evaluated, setEvaluated] = useState("");
  const [accepted, setAccepted] = useState("");
  const [continued, setContinued] = useState("");
  const [notAccepted, setNotAccepted] = useState("");
  const [other, setOther] = useState("");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [criteriaNotes, setCriteriaNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceDataAcknowledged, setSourceDataAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [operationId, setOperationId] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | undefined>(undefined);
  const sessions = useSelectionSessions(batchId);
  const create = useCreateSelectionSession(batchId);
  const update = useUpdateSelectionSession(batchId);
  const finalize = useFinalizeSelectionSession(batchId);
  const linkedSessions = useMemo(
    () => (sessions.data ?? []).filter((session) => session.selectionReviewId === review.id),
    [review.id, sessions.data],
  );
  const activeDraft = linkedSessions.find((session) => session.status === "DRAFT");
  const finalizedSession = linkedSessions.find((session) => session.status === "FINALIZED");
  const isSelectionReview = review.status === "FINALIZED" && review.reviewStatus === "FOR_IN_PERSON_ASSESSMENT";
  const legacySessionCount = (sessions.data ?? []).filter((session) => session.selectionReviewId == null).length;
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
  const exceedsCurrentPopulation = currentPopulation != null && selectionDate === today && evaluatedReady && evaluatedCount > currentPopulation;
  const busy = create.isPending || update.isPending || finalize.isPending;
  const canRecord = isManager
    && currentPopulation != null
    && review.status === "FINALIZED"
    && review.reviewStatus === "FOR_IN_PERSON_ASSESSMENT";

  const reset = () => {
    setSelectionDate(todayIso()); setEvaluated(""); setAccepted(""); setContinued(""); setNotAccepted(""); setOther("");
    setCriteria([]); setCriteriaNotes(""); setNotes(""); setSourceDataAcknowledged(false); setError(""); setOperationId(""); setEditingDraftId(null); setEditingVersion(undefined); setAdditionalOpen(false);
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
      setAdditionalOpen(activeDraft.continueObservationCount > 0 || activeDraft.otherCount > 0);
      setCriteria([...activeDraft.criterionCodes]);
      setCriteriaNotes(activeDraft.criteriaNotes ?? "");
      setNotes(activeDraft.sessionNotes ?? "");
      setSourceDataAcknowledged(activeDraft.sourceDataAcknowledged ?? false);
      setOperationId(activeDraft.id > 0 ? newSecureUuid() : activeDraft.operationId ?? newSecureUuid());
      setEditingVersion(activeDraft.version);
      setEditingDraftId(activeDraft.id);
    } else {
      setOperationId(newSecureUuid());
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
    ...(editingDraftId != null && editingDraftId > 0 ? { expectedVersion: editingVersion } : {}),
    selectionReviewId: review.id,
    sourceDataAcknowledged,
  });

  const validate = (finalizing: boolean) => {
    if (editingDraftId != null && editingDraftId > 0 && (!Number.isSafeInteger(editingVersion) || editingVersion! < 0))
      return "Refresh the selection draft to obtain its current revision before saving an edit.";
    if (finalizing && activeDraft?.offlineSyncStatus)
      return "This draft has queued changes. Wait for sync, then review the saved draft before finalizing.";
    if (!selectionDate || selectionDate > today) return "Choose today or an earlier selection date.";
    if (selectionDate < review.asOfDate) return `Selection date cannot be before this report's as-of date (${formatDate(review.asOfDate)}).`;
    if (!evaluatedReady) return "Evaluated must be a whole number of at least 1.";
    if (!outcomesValid) return "Use whole numbers only for every selection outcome.";
    if (outcomeTotal > evaluatedCount) return "Outcome counts cannot exceed evaluated birds.";
    if (finalizing && remaining !== 0) return `Complete the outcome count: ${Math.max(0, remaining ?? 0)} bird${remaining === 1 ? "" : "s"} still unaccounted for.`;
    if ((parsedOther ?? 0) > 0 && !notes.trim()) return "Add a note when using Other.";
    if (exceedsCurrentPopulation) return `Evaluated count cannot exceed today's recorded population (${currentPopulation}).`;
    if (finalizing && review.newerDataAvailable && !sourceDataAcknowledged) return "Review the newer records or acknowledge this report snapshot before finalizing.";
    return "";
  };

  async function save(finalizing: boolean) {
    const validation = validate(finalizing);
    if (validation) { setError(validation); return; }
    setError("");
    try {
      const requestOperationId = operationId || newSecureUuid();
      if (!operationId) setOperationId(requestOperationId);
      const request = buildRequest(requestOperationId);
      if (finalizing && activeDraft?.id === editingDraftId && !activeDraft.offlineSyncStatus
          && activeDraft.version === editingVersion && sameDraftValues(request, activeDraft)) {
        if (!navigator.onLine) { setError("Connect to the server before finalizing this saved draft."); return; }
        await finalize.mutateAsync({ sessionId: activeDraft.id, expectedVersion: editingVersion! });
        toast.success("Selection outcome finalized."); reset(); setOpen(false); return;
      }
      const saved = editingDraftId == null
        ? await create.mutateAsync(request)
        : await update.mutateAsync({ sessionId: editingDraftId, body: request });
      if (editingDraftId == null) setEditingDraftId(saved.id);
      const needsOnlineFinalization = finalizing && (saved.id < 0 || saved.offlineSyncStatus != null || !navigator.onLine || !Number.isSafeInteger(saved.version));
      if (finalizing && !needsOnlineFinalization) await finalize.mutateAsync({ sessionId: saved.id, expectedVersion: saved.version! });
      toast.success(needsOnlineFinalization
        ? "Draft saved. Wait for sync, then review and finalize the saved draft."
        : finalizing
          ? "Selection outcome finalized."
          : editingDraftId == null
            ? "Selection outcome saved as a draft."
            : saved.offlineSyncStatus
              ? "Draft saved on this device and will sync when online."
              : "Selection outcome draft updated.");
      reset(); setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the selection outcome.");
    }
  }

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
    <div className="flex flex-wrap items-center justify-between gap-3">
      {isSelectionReview && <div className="min-w-0 flex-1 basis-48"><p role="status" className="text-sm font-semibold">{sessions.isLoading ? "Checking tally…" : sessions.isError ? "Tally status unavailable" : finalizedSession ? "Tally recorded" : "Review complete · Needs tally"}</p><p className="mt-1 text-xs text-muted-foreground">{displayText("Based on saved report v")}{review.versionNumber} · {formatDate(review.asOfDate)}{displayText(". Batch remains active.")}</p></div>}
      <Button type="button" variant={isSelectionReview && !finalizedSession ? "default" : "outline"} className="ml-auto min-h-11 shrink-0" onClick={() => { if (canRecord && !finalizedSession && !sessions.isLoading && !sessions.isError) beginSession(); else setStatusOpen(true); }}><ClipboardCheck className="size-4" />{isSelectionReview ? finalizedSession ? "View tally" : activeDraft ? "Resume tally" : "Record tally" : "Selection tally"}</Button>
    </div>
    <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{displayText("Selection tally")}</DialogTitle><DialogDescription>{displayText("Based on Report v")}{review.versionNumber} {displayText("· as of")}{" "}{formatDate(review.asOfDate)}</DialogDescription></DialogHeader>
        {sessions.isLoading ? <p role="status" className="text-sm text-muted-foreground">{displayText("Checking selection records…")}</p> : sessions.isError ? <p role="alert" className="text-sm text-destructive">{displayText("Could not load selection records. Reconnect and try again before recording a tally.")}</p> : finalizedSession ? <div className="space-y-2 text-sm"><p className="font-semibold">{displayText("Selection outcome recorded ·")}{" "}{formatDate(finalizedSession.selectionDate)}</p><p>{displayText("Selected:")}{" "}{finalizedSession.acceptedCount} {displayText("· Not selected:")}{" "}{finalizedSession.notAcceptedCount}</p>{(finalizedSession.continueObservationCount > 0 || finalizedSession.otherCount > 0) && <p>{displayText("Continue observation:")}{" "}{finalizedSession.continueObservationCount} {displayText("· Other:")}{" "}{finalizedSession.otherCount}</p>}{finalizedSession.sessionNotes && <p className="whitespace-pre-wrap break-words">{finalizedSession.sessionNotes}</p>}<p className="text-muted-foreground">{summaryForSession(finalizedSession)}{displayText(". The recorded tally is linked to this report.")}</p></div> : currentPopulation == null ? <p role="status" className="text-sm text-warning-ink">{populationUnavailableMessage ?? "A verified current population is needed before recording a selection tally. Review population records and try again."}</p> : review.status !== "FINALIZED" ? <p className="text-sm text-muted-foreground">{displayText("Save the manager review and choose “Proceed to in-person selection” before recording a selection tally.")}</p> : <p className="text-sm text-muted-foreground">{displayText("This report is not marked for in-person selection. Create and finalize a new report with “Proceed to in-person selection” to record a tally.")}</p>}
        {legacySessionCount > 0 && <p className="text-xs text-muted-foreground">{legacySessionCount} {displayText("earlier selection")}{" "}{legacySessionCount === 1 ? "record is" : "records are"} {displayText("retained without a linked report.")}</p>}
      </DialogContent>
    </Dialog>

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-5"><DialogTitle>{displayText("Selection tally")}</DialogTitle><DialogDescription>{batchName} {displayText("· Based on Report v")}{review.versionNumber} {displayText("as of")}{" "}{formatDate(review.asOfDate)}{displayText(". Population is not changed automatically.")}</DialogDescription></DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {activeDraft?.offlineSyncStatus && <p role="status" className="text-sm text-warning-ink">{displayText("Draft sync status:")}{" "}{activeDraft.offlineSyncStatus.replaceAll("_", " ").toLowerCase()}{displayText(". Check its synchronization status before finalizing.")}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-xs text-muted-foreground"><span>{displayText("Evidence basis")}</span><span className="font-semibold text-foreground">{displayText("Report v")}{review.versionNumber} · {formatDate(review.asOfDate)}</span></div>
          {review.newerDataAvailable && <label className="flex cursor-pointer items-start gap-3 border-b border-warning-border pb-4 text-sm text-warning-ink"><input type="checkbox" checked={sourceDataAcknowledged} onChange={(event) => { setSourceDataAcknowledged(event.target.checked); setError(""); }} className="mt-0.5 size-4 accent-primary" /><span>{displayText("I reviewed the newer records and will use this saved report as the evidence basis for this outcome.")}</span></label>}
          <div className="grid gap-3 sm:grid-cols-2"><label htmlFor="selection-date" className="grid gap-1.5 text-sm font-semibold"><span>{displayText("Selection date")}</span><Input id="selection-date" type="date" min={review.asOfDate} max={today} value={selectionDate} onChange={(event) => { setSelectionDate(event.target.value); setError(""); }} className="h-11 rounded-lg" /></label><div className="border px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{displayText("Population today")}</p><p className="mt-0.5 text-base font-bold">{currentPopulation == null ? displayText("Unavailable") : `${currentPopulation.toLocaleString()} birds`}</p></div></div>
          <div className="border py-3"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 px-3"><div><p className="text-sm font-bold">{displayText("Outcome counts")}</p><p className="text-xs text-muted-foreground">{displayText("Assign every evaluated bird once.")}</p></div><div className="w-28"><NumberField id="evaluated" label={displayText("Evaluated")} value={evaluated} max={selectionDate === today ? currentPopulation ?? undefined : MAX_COUNT} onChange={(value) => { setEvaluated(value); setError(""); }} /></div></div><div role="status" aria-live="polite" className={cn("mx-3 flex min-h-10 items-center gap-2 border px-3 py-2", outcomeStatus.tone === "success" ? "border-success-border bg-success-muted text-success" : outcomeStatus.tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-warning-border bg-warning-muted text-warning-ink")}>{outcomeStatus.tone === "success" ? <CircleCheck className="size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="size-4 shrink-0" aria-hidden="true" />}<div className="min-w-0"><p className="text-xs font-semibold">{outcomeStatus.text}</p>{evaluatedReady && outcomesValid && <p className="text-[10px] opacity-80">{outcomeTotal} {displayText("of")}{" "}{evaluatedCount} {displayText("assigned")}</p>}</div></div><div className="mt-3 grid grid-cols-2 gap-3 px-3"><NumberField id="accepted" label={displayText("Selected")} value={accepted} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setAccepted(value); setError(""); }} /><NumberField id="not-accepted" label={displayText("Not selected")} value={notAccepted} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setNotAccepted(value); setError(""); }} /></div><details open={additionalOpen} onToggle={(event) => setAdditionalOpen(event.currentTarget.open)} className="mx-3 mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold text-primary">{displayText("Additional outcomes (optional)")}</summary><div className="mt-3 grid grid-cols-2 gap-3"><NumberField id="continued" label={displayText("Continue observation")} value={continued} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setContinued(value); setError(""); }} /><NumberField id="other" label={displayText("Other")} value={other} max={evaluatedCount} disabled={!evaluatedReady} onChange={(value) => { setOther(value); setError(""); }} /></div></details></div>
          <div className="space-y-2"><p className="text-sm font-bold">{displayText("Criteria considered")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional)")}</span></p><div className="flex flex-wrap gap-2">{CRITERIA.map(([code, label]) => <Button variant="ghost" key={code} type="button" aria-pressed={criteria.includes(code)} onClick={() => toggleCriterion(code)} className={cn("min-h-9 rounded-full border px-3 text-xs font-semibold", criteria.includes(code) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>{criteria.includes(code) ? "✓ " : ""}{label}</Button>)}</div><Input value={criteriaNotes} maxLength={1000} onChange={(event) => setCriteriaNotes(event.target.value)} placeholder={displayText("Optional detail about what was considered")} className="h-11 rounded-lg text-sm" /></div>
          <div className="space-y-1.5"><Label htmlFor="selection-notes">{displayText("Comments")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional; required if Other is used)")}</span></Label><Textarea id="selection-notes" rows={3} value={notes} maxLength={2000} onChange={(event) => { setNotes(event.target.value); setError(""); }} placeholder={displayText("What did the manager observe or decide?")} className="resize-none rounded-lg" /></div>
          {error && <p role="alert" aria-live="assertive" className="border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-semibold text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-col gap-2 border-t p-4 sm:flex-row sm:p-5"><Button type="button" variant="outline" className="h-11 w-full rounded-lg sm:w-auto" onClick={() => save(false)} disabled={busy}>{displayText("Save draft")}</Button><Button type="button" className="h-11 w-full rounded-lg font-bold sm:w-auto" onClick={() => save(true)} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{displayText("Finalize outcome")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
