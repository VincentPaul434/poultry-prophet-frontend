"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { use, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Clock3, Download, Loader2, Save, Syringe, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";
import { PageBackLink } from "@/components/page-back-link";
import { SelectionOutcomePanel } from "@/components/selection-session-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, todayIso } from "@/lib/format";
import { inventoryApi, selectionReviewApi } from "@/lib/api";
import { financeCurrencyGroups, formatReviewAmount, missingProductCostCount, reportCostMetric } from "@/lib/selection-review-finance";
import { collectDeathNotes, fetchDeathEvents } from "@/lib/death-summary";
import type { ManagerReviewStatus, SelectionReviewPayload, SelectionReviewProductUse, SelectionReviewResponse, VaccinationPlanItem } from "@/lib/types";
import { useCreateSelectionReview, useFinalizeSelectionReview, useSelectionReviewPreview, useSelectionReviews } from "@/hooks/use-selection-review";
import { useSelectionSessions } from "@/hooks/use-selection-sessions";
import { useVaccinationPlan } from "@/hooks/use-operations";

const reviewLabels: Record<ManagerReviewStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  FOR_IN_PERSON_ASSESSMENT: "Proceed to in-person selection",
  CONTINUE_OBSERVATION: "Continue observation",
  REVIEW_COMPLETED: "Reviewed — no further action",
};

type PendingReviewCompletion = { key: string; reviewId?: number };
function pendingCompletionKey(batchId: string) { return `pp_pending_review_completion:${batchId}`; }
function readPendingCompletion(batchId: string): PendingReviewCompletion | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(pendingCompletionKey(batchId)) ?? "null") as PendingReviewCompletion | null;
    if (!value || typeof value.key !== "string" || !value.key) return null;
    if (value.reviewId != null && (!Number.isSafeInteger(value.reviewId) || value.reviewId <= 0)) return null;
    return value;
  } catch { return null; }
}
function writePendingCompletion(batchId: string, value: PendingReviewCompletion | null) {
  try {
    if (value) window.sessionStorage.setItem(pendingCompletionKey(batchId), JSON.stringify(value));
    else window.sessionStorage.removeItem(pendingCompletionKey(batchId));
  } catch { /* The in-memory attempt still works if session storage is unavailable. */ }
}

export default function SelectionPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  return <RouteGuard><SelectionReviewView batchId={batchId} /></RouteGuard>;
}

function SelectionReviewView({ batchId }: { batchId: string }) {
  const { display: displayText } = useDisplayLocale();
  const { isManager } = useAuth();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<SelectionReviewResponse | null>(null);
  const [purpose, setPurpose] = useState("ROUTINE_REVIEW");
  const [snapshotNote, setSnapshotNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ManagerReviewStatus>("FOR_IN_PERSON_ASSESSMENT");
  const [notes, setNotes] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [managerDecisionEdited, setManagerDecisionEdited] = useState(false);
  const requestKey = useRef<string | null>(null);
  const manualSnapshotKey = useRef<string | null>(null);
  const actionInFlight = useRef(false);
  const [reviewError, setReviewError] = useState("");
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [ignoreRequestedReview, setIgnoreRequestedReview] = useState(false);
  const [startNewReview, setStartNewReview] = useState(false);
  const requestedReviewId = Number(searchParams.get("reviewId"));
  const preview = useSelectionReviewPreview(batchId);
  const reviews = useSelectionReviews(batchId);
  const tallySessions = useSelectionSessions(batchId, isManager);
  const vaccinationPlan = useVaccinationPlan(Number(batchId));
  const create = useCreateSelectionReview(batchId);
  const finalize = useFinalizeSelectionReview(batchId);
  const requestedReview = !ignoreRequestedReview && Number.isInteger(requestedReviewId) && requestedReviewId > 0
    ? reviews.data?.find((review) => review.id === requestedReviewId) ?? null
    : null;
  const cachedSelected = selected ? reviews.data?.find((review) => review.id === selected.id) : null;
  const explicitReview = selected ? selected.status === "FINALIZED" && cachedSelected?.status !== "FINALIZED" ? selected : cachedSelected ?? selected : requestedReview;
  const requestedReviewUnresolved = !ignoreRequestedReview && searchParams.has("reviewId") && !selected && !requestedReview;
  const pendingCompletion = readPendingCompletion(batchId);
  const recoverableReview = !requestedReviewUnresolved && !explicitReview && !startNewReview && pendingCompletion?.reviewId
    ? reviews.data?.find((review) => review.id === pendingCompletion.reviewId) ?? null : null;
  const latestFinalizedReview = reviews.data?.find((review) => review.status === "FINALIZED");
  const pendingTallyReview = !requestedReviewUnresolved && !explicitReview && !recoverableReview && !startNewReview && latestFinalizedReview?.reviewStatus === "FOR_IN_PERSON_ASSESSMENT"
    ? latestFinalizedReview : null;
  // A pending tally identifies its reviewed evidence, not the data source of the live report.
  const selectedReview = explicitReview ?? recoverableReview;
  const payload = requestedReviewUnresolved ? undefined : selectedReview?.payload ?? preview.data;
  const demoCostImpact = useQuery({
    queryKey: ["selection-review-demo-cost-impact", batchId, payload?.periodStart, payload?.periodEnd, selectedReview?.generatedAt ?? null],
    queryFn: () => inventoryApi.demoCostImpact({ batchId: Number(batchId), start: payload!.periodStart, end: payload!.periodEnd, cutoff: selectedReview?.generatedAt }),
    enabled: isManager && (!reviews.isLoading || startNewReview || Boolean(selectedReview)) && Boolean(payload?.finance && payload.periodStart && payload.periodEnd),
    staleTime: 30_000,
    retry: false,
  });
  const activePurpose = selectedReview?.purpose ?? purpose;
  const activeSnapshotNote = selectedReview?.snapshotNote ?? snapshotNote;
  const useManagerDecisionState = selected != null || managerDecisionEdited;
  const storedReviewStatus = selectedReview?.reviewStatus === "NOT_REVIEWED" ? "FOR_IN_PERSON_ASSESSMENT" : selectedReview?.reviewStatus;
  const activeReviewStatus = useManagerDecisionState ? reviewStatus : storedReviewStatus ?? reviewStatus;
  const activeNotes = useManagerDecisionState ? notes : selectedReview?.managerNotes ?? notes;
  const activeNextReviewDate = useManagerDecisionState ? nextReviewDate : selectedReview?.nextReviewDate ?? nextReviewDate;

  async function generateSnapshot() {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      manualSnapshotKey.current ??= typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await create.mutateAsync({ purpose: activePurpose, snapshotNote: activeSnapshotNote.trim() || undefined, idempotencyKey: manualSnapshotKey.current });
      manualSnapshotKey.current = null;
      setSelected(result); setReviewStatus(result.reviewStatus === "NOT_REVIEWED" ? "FOR_IN_PERSON_ASSESSMENT" : result.reviewStatus); setNotes(result.managerNotes ?? ""); setNextReviewDate(result.nextReviewDate ?? "");
      toast.success("Report snapshot saved — batch remains active");
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not generate the report"); }
    finally { actionInFlight.current = false; }
  }

  async function finalizeSnapshot() {
    if (actionInFlight.current || !payload || activeReviewStatus === "NOT_REVIEWED" || (activeReviewStatus === "CONTINUE_OBSERVATION" && !activeNextReviewDate)) return;
    actionInFlight.current = true;
    setReviewError("");
    let draft = selectedReview;
    try {
      if (!draft) {
        requestKey.current ??= readPendingCompletion(batchId)?.key ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        writePendingCompletion(batchId, { key: requestKey.current });
        draft = await create.mutateAsync({ purpose, snapshotNote: snapshotNote.trim() || undefined, idempotencyKey: requestKey.current });
        writePendingCompletion(batchId, { key: requestKey.current, reviewId: draft.id });
        setSelected(draft);
      }
      // Existing saved drafts need the same reload recovery as newly created ones.
      requestKey.current ??= readPendingCompletion(batchId)?.key ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      writePendingCompletion(batchId, { key: requestKey.current, reviewId: draft.id });
      const result = await finalize.mutateAsync({ reviewId: draft.id, body: { reviewStatus: activeReviewStatus, managerNotes: activeNotes.trim() || null, nextReviewDate: activeNextReviewDate || null } });
      setSelected(result);
      requestKey.current = null;
      writePendingCompletion(batchId, null);
      toast.success("Review complete — batch remains active");
    } catch (error) {
      if (draft) {
        // A response may have been lost after the server completed the review.
        // Confirm its saved state before inviting a retry of this same snapshot.
        try {
          const refreshed = await reviews.refetch();
          const saved = refreshed.data?.find((review) => review.id === draft!.id);
          if (saved?.status === "FINALIZED") {
            setSelected(saved);
            requestKey.current = null;
            writePendingCompletion(batchId, null);
            toast.success("Review complete — batch remains active");
            return;
          }
        } catch { /* Preserve the selected draft when its status cannot be checked. */ }
      }
      const detail = error instanceof ApiError ? error.message : "Please try again.";
      setReviewError(draft ? `The snapshot was saved, but the review could not be confirmed. ${detail} Retry to complete this same review.` : `Could not save the report snapshot. ${detail}`);
    } finally { actionInFlight.current = false; }
  }

  async function downloadPdf() {
    if (!selectedReview) return;
    try { const blob = await selectionReviewApi.pdf(batchId, selectedReview.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `selection-review-${batchId}-${selectedReview.id}.pdf`; anchor.click(); URL.revokeObjectURL(url); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not download the PDF"); }
  }

  function selectSavedReport(review: SelectionReviewResponse) {
    setIgnoreRequestedReview(true);
    setStartNewReview(false);
    setManagerDecisionEdited(false);
    setSelected(review);
    setPurpose(review.purpose ?? "ROUTINE_REVIEW");
    setSnapshotNote(review.snapshotNote ?? "");
    setReviewStatus(review.reviewStatus === "NOT_REVIEWED" ? "FOR_IN_PERSON_ASSESSMENT" : review.reviewStatus);
    setNotes(review.managerNotes ?? "");
    setNextReviewDate(review.nextReviewDate ?? "");
  }

  function beginNewReview() {
    setIgnoreRequestedReview(true);
    setStartNewReview(true);
    setSelected(null);
    setManagerDecisionEdited(false);
    setReviewStatus("FOR_IN_PERSON_ASSESSMENT");
    setNotes("");
    setNextReviewDate("");
    setReviewError("");
    requestKey.current = null;
    manualSnapshotKey.current = null;
    writePendingCompletion(batchId, null);
  }

  function beginEditingManagerDecision() {
    if (!managerDecisionEdited && selected == null && selectedReview) {
      setReviewStatus(selectedReview.reviewStatus === "NOT_REVIEWED" ? "FOR_IN_PERSON_ASSESSMENT" : selectedReview.reviewStatus);
      setNotes(selectedReview.managerNotes ?? "");
      setNextReviewDate(selectedReview.nextReviewDate ?? "");
    }
    setManagerDecisionEdited(true);
  }

  const reportStatus = requestedReviewUnresolved ? reviews.isLoading ? "Loading saved report" : "Saved report unavailable" : selectedReview?.status === "FINALIZED"
    ? "MANAGER REVIEWED"
    : selectedReview
      ? `SAVED SNAPSHOT v${selectedReview.versionNumber}`
      : "LIVE REPORT";
  const loadingRequestedReview = requestedReviewId > 0 && !ignoreRequestedReview && reviews.isLoading;
  const showCompleteReview = isManager && !requestedReviewUnresolved && !loadingRequestedReview && selectedReview?.status !== "FINALIZED" && !pendingTallyReview;
  const completeReviewAction = showCompleteReview ? <div className="mt-5 space-y-3 border-t pt-5"><Dialog open={confirmReviewOpen} onOpenChange={setConfirmReviewOpen}><DialogTrigger render={<Button id="complete-review" type="button" className="h-auto min-h-12 w-full scroll-mt-24 whitespace-normal rounded-xl px-4 py-3 text-base active:scale-[0.98] motion-reduce:transform-none" disabled={create.isPending || finalize.isPending || !payload || (!selectedReview && (reviews.isLoading || reviews.isError || tallySessions.isLoading || tallySessions.isError)) || activeReviewStatus === "NOT_REVIEWED" || (activeReviewStatus === "CONTINUE_OBSERVATION" && !activeNextReviewDate)} />}>{create.isPending || finalize.isPending ? <><Loader2 className="size-4 animate-spin" /> {displayText("Completing review…")}</> : displayText("Complete review")}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{displayText("Complete review?")}</DialogTitle><DialogDescription>{selectedReview ? displayText("This saved report will be finalized.") : displayText("A snapshot of this report will be saved.")} {displayText("The batch will remain active.")}</DialogDescription></DialogHeader><div className="rounded-lg bg-muted/50 px-4 py-3 text-sm"><p className="font-semibold">{displayText(reviewLabels[activeReviewStatus])}</p>{activeReviewStatus === "FOR_IN_PERSON_ASSESSMENT" && <p className="mt-1 text-muted-foreground">{displayText("You can record the selection tally after completing the review.")}</p>}{activeNextReviewDate && <p className="mt-1 text-muted-foreground">{displayText("Follow-up review:")}{" "}{formatDate(activeNextReviewDate)}</p>}</div><DialogFooter><DialogClose render={<Button type="button" variant="outline" className="min-h-11" />}>{displayText("Cancel")}</DialogClose><Button type="button" className="min-h-11" onClick={() => { setConfirmReviewOpen(false); void finalizeSnapshot(); }}>{displayText("Complete review")}</Button></DialogFooter></DialogContent></Dialog>{!selectedReview && (reviews.isError || tallySessions.isError) && <p role="alert" className="text-sm text-destructive">{displayText("Could not check saved reviews and tallies.")}{" "}<button type="button" className="font-semibold underline" onClick={() => { void reviews.refetch(); void tallySessions.refetch(); }}>{displayText("Try again")}</button></p>}</div> : null;

  return (
    <div className="@container/review mx-auto w-full min-w-0 max-w-6xl space-y-5 pb-6 [overflow-wrap:anywhere]">
      <ReportIdentityHeader batchId={batchId} batchName={payload?.batch.batchName} stageName={payload?.batch.stageName} ageDays={payload?.batch.ageDays} status={reportStatus} />

      {isManager && (loadingRequestedReview ? <Button type="button" variant="outline" disabled className="min-h-11 w-full sm:w-auto">{displayText("Loading review…")}</Button> : selectedReview?.status === "FINALIZED" || pendingTallyReview ? (() => {
        const tallyReview = selectedReview?.status === "FINALIZED" ? selectedReview : pendingTallyReview!;
        return <div className="space-y-2"><SelectionOutcomePanel key={tallyReview.id} batchId={batchId} batchName={tallyReview.batchName} currentPopulation={preview.data && !preview.data.population.reconciliationRequired ? preview.data.population.currentPopulation : null} populationUnavailableMessage={preview.isLoading ? "Checking current population…" : preview.isError ? "Current population could not be loaded. Try again before recording an outcome." : undefined} review={tallyReview} isManager={isManager} /><Button type="button" variant="ghost" className="min-h-11 px-0 text-primary underline-offset-2 hover:underline" onClick={beginNewReview}>{selectedReview ? "Review latest records" : "Start new review"}</Button></div>;
      })() : null)}
      {requestedReviewUnresolved && !reviews.isLoading && <section role="alert" aria-label={displayText("Saved report unavailable")} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><p>{reviews.isError ? "Could not load the saved report." : "Saved report not found."}</p><Button type="button" variant="outline" className="min-h-11" onClick={beginNewReview}>{displayText("View latest records")}</Button></section>}
      {selectedReview && <section role="status" aria-label={displayText("Saved report status")} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-muted px-4 py-3 text-sm text-warning-ink"><div><p className="font-semibold">{displayText("Saved report v")}{selectedReview.versionNumber} {displayText("· through")}{" "}{formatDate(selectedReview.asOfDate)}</p><p className="mt-1">{selectedReview.newerDataAvailable ? displayText("Newer records are available. ") : ""}{displayText("Population, deaths, health and costs show this saved version.")}</p></div><Button type="button" variant="outline" className="min-h-11" onClick={beginNewReview}>{displayText("View latest records")}</Button></section>}
      {reviewError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{reviewError}</p>}

      {payload && <ReportMetricStrip payload={payload} isManager={isManager} vaccinationPlan={vaccinationPlan.data ?? []} vaccinationLoading={vaccinationPlan.isLoading} vaccinationError={vaccinationPlan.isError} isSavedSnapshot={selectedReview != null} />}

      {isManager && payload?.finance && demoCostImpact.isLoading && <p role="status" className="text-xs text-muted-foreground">{displayText("Checking demo stock impact…")}</p>}
      {isManager && payload?.finance && (demoCostImpact.isError || (demoCostImpact.data && typeof demoCostImpact.data.mayIncludeDemoStock !== "boolean")) && <p role="status" className="rounded-xl border border-warning-border bg-warning-muted/50 px-4 py-3 text-sm text-warning-ink">{displayText("Demo stock impact could not be checked. Verify product costs before using this report.")}</p>}
      {isManager && demoCostImpact.data?.mayIncludeDemoStock === true && <p role="status" className="rounded-xl border border-warning-border bg-warning-muted/50 px-4 py-3 text-sm text-warning-ink"><strong>{displayText("Demo stock may affect this cost.")}</strong> {displayText("Some product use followed a demo stock-in; verify the inventory and prices.")}</p>}

      {preview.isLoading && <div className="h-56 animate-pulse rounded-2xl bg-muted" />}
      {preview.isError && <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{preview.error instanceof ApiError ? preview.error.message : "Failed to load the report preview."}</p>}

      <div className="grid min-w-0 items-start gap-5">
        {payload && <ReportContent payload={payload} isManager={isManager} vaccinationPlan={vaccinationPlan.data ?? []} vaccinationLoading={vaccinationPlan.isLoading} vaccinationError={vaccinationPlan.isError} isSavedSnapshot={selectedReview != null} />}
        <div className="grid min-w-0 items-start gap-5 @min-[760px]/review:grid-cols-2">
          <div className="grid min-w-0 content-start gap-5">
            <ReportControlsPanel isManager={isManager} purpose={activePurpose} snapshotNote={activeSnapshotNote} onPurposeChange={(value) => { setIgnoreRequestedReview(true); setStartNewReview(true); setSelected(null); setPurpose(value); }} onSnapshotNoteChange={(value) => { setIgnoreRequestedReview(true); setStartNewReview(true); setSelected(null); setSnapshotNote(value); }} onSave={generateSnapshot} saveDisabled={create.isPending || finalize.isPending || !payload} savePending={create.isPending} />
            {isManager && payload && (!selectedReview || selectedReview.status === "DRAFT") && <ManagerReviewPanel action={completeReviewAction} reviewStatus={activeReviewStatus} nextReviewDate={activeNextReviewDate} notes={activeNotes} pending={create.isPending || finalize.isPending} onReviewStatusChange={(value) => { beginEditingManagerDecision(); setReviewStatus(value); }} onNextReviewDateChange={(value) => { beginEditingManagerDecision(); setNextReviewDate(value); }} onNotesChange={(value) => { beginEditingManagerDecision(); setNotes(value); }} />}
            {isManager && selectedReview && <SnapshotStatusPanel selected={selectedReview} onDownload={downloadPdf} />}
          </div>
          <div className="min-w-0"><SavedVersionList reviews={reviews.data ?? []} isLoading={reviews.isLoading} selectedId={selectedReview?.id} onSelect={selectSavedReport} /></div>
        </div>
      </div>
      <details className="group rounded-xl border px-4">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-muted-foreground"><span>{displayText("About this report")}</span><ChevronRight className="size-4 shrink-0 group-open:rotate-90" aria-hidden="true" /></summary>
        <div className="space-y-2 pb-4 text-sm leading-6 text-muted-foreground">
          <p>{displayText("Full recorded batch history from hatch to today.")}</p>
          <p>{displayText("Health records describe the batch, not each bird. A saved report keeps its original evidence; vaccination is labelled when it shows the current schedule.")}</p>
        </div>
      </details>
    </div>
  );
}

function ReportIdentityHeader({ batchId, batchName, stageName, ageDays, status }: { batchId: string; batchName?: string; stageName?: string; ageDays?: number; status: string }) {
  return <header className="min-w-0 space-y-3">
    <PageBackLink destination="batch" batchId={batchId} className="mb-0 min-h-12 text-sm" />
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">{batchName ?? "Batch review report"}</h1>
        <Badge className="max-w-full whitespace-normal text-xs" variant={status === "MANAGER REVIEWED" ? "default" : "secondary"}>{status}</Badge>
      </div>
      {stageName && <p className="text-sm text-muted-foreground"><span className="capitalize">{stageName.replaceAll("-", " ")}</span>{typeof ageDays === "number" ? ` · Day ${ageDays}` : ""}</p>}
    </div>
  </header>;
}

function ReportMetricStrip({ payload, isManager, vaccinationPlan, vaccinationLoading, vaccinationError, isSavedSnapshot }: { payload: SelectionReviewPayload; isManager: boolean; vaccinationPlan: VaccinationPlanItem[]; vaccinationLoading: boolean; vaccinationError: boolean; isSavedSnapshot: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const p = payload.population;
  const rate = !p.reconciliationRequired && p.initialPopulation > 0 && p.totalDeaths <= p.initialPopulation ? `${(p.totalDeaths / p.initialPopulation * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : "—";
  const completed = vaccinationPlan.filter((item) => item.status === "COMPLETED").length;
  const vaccinationValue = vaccinationLoading ? "Loading…" : vaccinationError ? "Unavailable" : vaccinationPlan.length ? `${completed} / ${vaccinationPlan.length}` : "No plan";
  const vaccinationDetail = vaccinationError ? "Could not load schedule" : isSavedSnapshot ? "Current schedule" : "Scheduled doses";
  const cost = reportCostMetric(payload);
  const materialLimitations = (payload.dataAvailability ?? []).filter((item) => item.status === "PARTIAL" && item.section !== "Population reconciliation" && (isManager || item.section !== "Batch finance"));
  return <div id="report-summary" className="scroll-mt-20 space-y-2"><section aria-label={displayText("Report summary")} className="overflow-hidden rounded-2xl border bg-card"><div className="grid grid-cols-2 gap-px bg-border @min-[680px]/review:grid-cols-4"><Metric label={displayText("Population")} value={p.reconciliationRequired ? `— / ${p.initialPopulation}` : payload.batch.currentPopulationDisplay} detail={p.reconciliationRequired ? displayText("Records need review") : displayText("Current / starting")} /><DeathMetric payload={payload} rate={rate} isSavedSnapshot={isSavedSnapshot} /><Metric label={isSavedSnapshot ? displayText("Vaccination · live") : displayText("Vaccination")} value={vaccinationValue} detail={vaccinationDetail} /><Metric label={displayText("Batch cost")} value={isManager ? cost.value : "—"} detail={isManager ? cost.detail : displayText("Manager only")} title={isManager ? cost.title : undefined} valueClassName={isManager && cost.warning ? "text-warning-ink" : undefined} /></div></section>{p.reconciliationRequired && <PopulationReconciliationWarning message={p.reconciliationMessage} />}{materialLimitations.length > 0 && <section aria-label={displayText("Report limitations")} className="rounded-xl border border-warning-border bg-warning-muted px-4 py-3 text-sm text-warning-ink"><p className="font-semibold">{displayText("Information to review")}</p>{materialLimitations.map((item) => <p className="mt-1" key={item.section}>{item.message || `${item.section}: some information is unavailable.`}</p>)}</section>}</div>;
}

function DeathMetric({ payload, rate, isSavedSnapshot }: { payload: SelectionReviewPayload; rate: string; isSavedSnapshot: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const [open, setOpen] = useState(false);
  const population = payload.population;
  const events = useQuery({
    queryKey: ["selection-review-death-events", payload.batch.batchId, payload.batch.startDate, payload.asOfDate],
    queryFn: () => fetchDeathEvents(payload.batch.batchId, payload.batch.startDate, payload.asOfDate),
    enabled: open && !isSavedSnapshot && population.totalDeaths > 0,
    staleTime: 30_000,
  });
  const notes = collectDeathNotes(isSavedSnapshot ? payload.healthEvents : events.data ?? []);
  const detail = rate === "—" ? "Rate unavailable" : `${population.totalDeaths} / ${population.initialPopulation} starting birds`;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<button type="button" className="group min-w-0 cursor-pointer bg-card px-4 py-4 text-left transition-colors hover:bg-muted/70 active:bg-muted focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/70" />}>
      <span className="flex items-center justify-between gap-1 text-sm font-medium text-muted-foreground">{displayText("Recorded deaths")}<ChevronRight className="size-4 shrink-0" aria-hidden="true" /></span>
      <span className="mt-2 block break-words text-2xl font-bold tracking-tight tabular-nums">{rate}</span>
      <span className="mt-1 block break-words text-sm leading-5 text-muted-foreground">{detail}</span>
      <span className="sr-only">{displayText("View details")}</span>
    </DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader className="pr-8">
        <DialogTitle className="text-lg font-semibold">{displayText("Recorded deaths")}</DialogTitle>
        <DialogDescription>{population.totalDeaths.toLocaleString()} {displayText("recorded through")}{" "}{formatDate(payload.asOfDate)}{displayText(". Counts reflect batch records.")}</DialogDescription>
      </DialogHeader>
      <p className="text-sm leading-6 text-muted-foreground">{displayText("Recorded health and accidental deaths through")}{" "}{formatDate(payload.asOfDate)} {displayText("as a share of starting birds. Other losses are excluded; transfers can affect this comparison.")}</p>
      <div className="divide-y rounded-xl border">
        <DeathCategory title={displayText("Health-related")} count={population.healthRelatedDeaths} notes={notes.HEALTH_DEATH} loading={!isSavedSnapshot && events.isLoading && population.totalDeaths > 0} unavailable={!isSavedSnapshot && events.isError} />
        <DeathCategory title={displayText("Accidental")} count={population.accidentalDeaths} notes={notes.ACCIDENTAL_DEATH} loading={!isSavedSnapshot && events.isLoading && population.totalDeaths > 0} unavailable={!isSavedSnapshot && events.isError} snapshotDetailsUnavailable={isSavedSnapshot} />
      </div>
      {isSavedSnapshot ? <p className="text-xs leading-5 text-muted-foreground">{displayText("Health notes are limited to this saved report’s period. Accidental death details were not saved in the report.")}</p> : <p className="text-xs leading-5 text-muted-foreground">{displayText("Notes are what was recorded for the batch; they are not a diagnosis.")}</p>}
      {!isSavedSnapshot && events.isError && <Button type="button" variant="outline" onClick={() => { void events.refetch(); }}>{displayText("Retry loading details")}</Button>}
    </DialogContent>
  </Dialog>;
}

function DeathCategory({ title, count, notes, loading, unavailable, snapshotDetailsUnavailable = false }: { title: string; count: number; notes: string[]; loading: boolean; unavailable: boolean; snapshotDetailsUnavailable?: boolean }) {
  const { display: displayText } = useDisplayLocale();
  return <section className="space-y-2 px-4 py-4">
    <div className="flex items-baseline justify-between gap-4"><h3 className="font-semibold">{title}</h3><p className="shrink-0 text-base font-semibold tabular-nums">{count.toLocaleString()} {count === 1 ? displayText("bird") : displayText("birds")}</p></div>
    {count === 0 ? <p className="text-sm text-muted-foreground">{displayText("No deaths recorded in this category.")}</p>
      : loading ? <p className="text-sm text-muted-foreground">{displayText("Loading recorded notes…")}</p>
        : unavailable ? <p className="text-sm text-muted-foreground">{displayText("Could not load death details.")}</p>
          : snapshotDetailsUnavailable ? <p className="text-sm text-muted-foreground">{displayText("Details are not included in this saved report.")}</p>
            : notes.length === 0 ? <p className="text-sm text-muted-foreground">{displayText("No specific cause recorded.")}</p>
              : <div className="space-y-1.5"><p className="text-xs font-semibold text-muted-foreground">{displayText("Recorded notes or tags")}</p><ul className="list-disc space-y-1 pl-4 text-sm leading-5">{notes.slice(0, 3).map(note => <li className="break-words" key={note}>{note}</li>)}</ul>{notes.length > 3 && <details className="text-sm"><summary className="cursor-pointer font-semibold text-primary">{displayText("Show")}{" "}{notes.length - 3} {displayText("more")}</summary><ul className="mt-1 list-disc space-y-1 pl-4">{notes.slice(3).map(note => <li className="break-words" key={note}>{note}</li>)}</ul></details>}</div>}
  </section>;
}


function Metric({ label, value, detail, title, valueClassName }: { label: string; value: string; detail: string; title?: string; valueClassName?: string }) {
  return <div className="min-w-0 bg-card px-4 py-4" title={title}>
    <p className="break-words text-sm font-medium text-muted-foreground">{label}</p>
    <p className={cn("mt-2 break-words text-2xl font-bold tracking-tight tabular-nums", valueClassName)}>{value}</p>
    <p className="mt-1 break-words text-sm leading-5 text-muted-foreground">{detail}</p>
  </div>;
}

function ReportControlsPanel({ isManager, purpose, snapshotNote, onPurposeChange, onSnapshotNoteChange, onSave, saveDisabled, savePending }: { isManager: boolean; purpose: string; snapshotNote: string; onPurposeChange: (value: string) => void; onSnapshotNoteChange: (value: string) => void; onSave: () => void; saveDisabled: boolean; savePending: boolean }) {
  const { display: displayText } = useDisplayLocale();
  if (!isManager) return null;
  return <details id="report-review" className="group order-4 min-w-0 scroll-mt-20 rounded-2xl border bg-card px-4 lg:px-5">
    <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 text-base font-semibold"><span>{displayText("Report options")}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground group-open:rotate-90" aria-hidden="true" /></summary>
    <div className="space-y-4 border-t py-4">
      <label className="block min-w-0 space-y-2 text-sm font-medium"><span>{displayText("Report purpose")}</span><NativeSelect className="w-full" selectClassName="h-12 text-base" value={purpose} onChange={(event) => onPurposeChange(event.target.value)}><option value="ROUTINE_REVIEW">{displayText("Routine review")}</option><option value="SELECTION_REVIEW">{displayText("Selection review")}</option><option value="CONSULTATION">{displayText("Consultation")}</option><option value="STAKEHOLDER_VALIDATION">{displayText("Stakeholder validation")}</option><option value="OTHER">{displayText("Other")}</option></NativeSelect></label>
      <label className="block space-y-2 text-sm font-medium"><span>{displayText("Snapshot note")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional)")}</span></span><Textarea className="min-h-24 text-base" rows={2} value={snapshotNote} onChange={(event) => onSnapshotNoteChange(event.target.value)} placeholder={displayText("Add context for this report")} /></label>
      <p className="text-sm leading-6 text-muted-foreground">{displayText("Complete review saves a snapshot. Save a draft if you want to finish later.")}</p>
      <Button variant="outline" className="min-h-12 w-full rounded-xl" onClick={onSave} disabled={saveDisabled}>{savePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{savePending ? displayText("Saving…") : displayText("Save draft snapshot")}</Button>
    </div>
  </details>;
}

function ReportContent({ payload, isManager, vaccinationPlan, vaccinationLoading, vaccinationError, isSavedSnapshot }: { payload: SelectionReviewPayload; isManager: boolean; vaccinationPlan: VaccinationPlanItem[]; vaccinationLoading: boolean; vaccinationError: boolean; isSavedSnapshot: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const products = groupProducts(payload.productUse);
  return <div className="@container min-w-0"><div className="grid min-w-0 items-start gap-4 @min-[720px]:grid-cols-2 @min-[1000px]:grid-cols-6">
    <ReportSection id="report-vaccination" title={displayText("Vaccination record")} className={isManager ? "@min-[1000px]:col-span-3" : "@min-[720px]:col-span-2 @min-[1000px]:col-span-6"}><VaccinationChecklist plan={vaccinationPlan} recordedVaccines={payload.productUse.filter((item) => item.productType === "VACCINE")} loading={vaccinationLoading} error={vaccinationError} isSavedSnapshot={isSavedSnapshot} /></ReportSection>
    {isManager && <ReportSection id="report-expenses" title={displayText("Batch expenses")} className="@min-[1000px]:col-span-3"><div className="@container">{payload.finance ? <FinanceReport finance={payload.finance} hasProductUsage={payload.productUse.length > 0} missingProductCosts={missingProductCostCount(payload)} /> : <Empty text="No batch finance data available." />}</div></ReportSection>}
    <ReportSection id="report-products" title={`Products used (${payload.productUse.length})`} className="@min-[1000px]:col-span-4"><ProductUseList products={products} isManager={isManager} /></ReportSection>
    <ReportSection id="report-health" title={`Health history (${payload.healthEvents.length})`} className="@min-[1000px]:col-span-2"><HealthHistory events={payload.healthEvents} /></ReportSection>
    {payload.incubation && <ReportSection title={displayText("Incubation")} collapsible className="@min-[1000px]:col-span-3"><div className="grid grid-cols-2 divide-x divide-y rounded-xl border sm:grid-cols-4 sm:divide-y-0"><ReportFact label={displayText("Cycle")} value={payload.incubation.cycleName} detail={payload.incubation.incubatorCode} /><ReportFact label={displayText("Eggs")} value={String(payload.incubation.eggsLoaded)} detail={formatDate(payload.incubation.loadedDate)} /><ReportFact label={displayText("Hatched")} value={payload.incubation.hatchedCount == null ? "—" : String(payload.incubation.hatchedCount)} detail={payload.incubation.hatchRate == null ? "Rate unavailable" : `${payload.incubation.hatchRate}%`} /><ReportFact label={displayText("Unhatched")} value={`${payload.incubation.unhatchedCount ?? "—"}`} detail="Recorded" /></div></ReportSection>}
  </div></div>;
}

function HealthHistory({ events }: { events: SelectionReviewPayload["healthEvents"] }) {
  const { display: displayText } = useDisplayLocale();
  const sorted = [...events].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const rows = (items: typeof sorted) => items.map((event) => {
    const tone = healthEventTone(event.eventType);
    return <div key={event.sourceEventId} className={cn("min-w-0 space-y-2 p-4", tone.row)}>
      <p className={cn("flex min-w-0 items-start gap-2 font-semibold leading-6", tone.title)}><span className={cn("mt-2 size-2 shrink-0 rounded-full", tone.dot)} aria-hidden="true" /><span className="min-w-0 break-words">{event.title}</span></p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground"><span>{event.affectedCount} {displayText("birds")}</span><span>{formatDate(event.eventDate)}</span>{event.severity && <span>{event.severity}</span>}</p>
      {event.details && <p className="break-words text-sm leading-6">{event.details}</p>}
    </div>;
  });
  return <div className="space-y-3">{sorted.length === 0 ? <Empty text="No health events recorded." /> : <>
    <div className="divide-y overflow-hidden rounded-xl border">{rows(sorted.slice(0, 3))}</div>
    {sorted.length > 3 && <details><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-primary">{displayText("Show")}{" "}{sorted.length - 3} {displayText("earlier health records")}</summary><div className="mt-2 divide-y overflow-hidden rounded-xl border">{rows(sorted.slice(3))}</div></details>}
  </>}</div>;
}

function FinanceReport({ finance, hasProductUsage, missingProductCosts }: { finance: NonNullable<SelectionReviewPayload["finance"]>; hasProductUsage: boolean; missingProductCosts: number }) {
  const { display: displayText } = useDisplayLocale();
  const groups = financeCurrencyGroups(finance);
  if (finance.currencyTotals == null) return <p className="text-sm text-muted-foreground">{displayText("Historical finance totals are unavailable because this snapshot does not identify their currencies. Generate a new report for currency-separated totals.")}</p>;
  if (!hasProductUsage && finance.postedTransactionCount === 0 && Number(finance.totalRecordedBatchCost ?? 0) === 0 && groups.every((group) => group.postedTransactionCount === 0 && Number(group.totalRecordedBatchCost ?? 0) === 0)) return <Empty text="No batch expenses recorded." />;
  if (groups.length === 0) return <p className="text-sm text-muted-foreground">{displayText("Historical finance totals are unavailable because this snapshot does not identify their currencies. Generate a new report for currency-separated totals.")}</p>;
  return <div className="space-y-4">{groups.map((group) => <section key={group.currency} aria-label={`${group.currency} finance`}><h3 className="mb-2 text-sm font-semibold">{group.currency}</h3><div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border @min-[560px]:grid-cols-4"><ReportFact label={displayText("Cash expense")} value={formatReviewAmount(group.recordedExpense, group.currency)} detail="Direct batch expense" /><ReportFact label={displayText("Products used")} value={formatReviewAmount(group.productsConsumedCost, group.currency)} detail={group.recordsMayBeIncomplete || missingProductCosts > 0 ? "Known inventory cost · partial" : "Inventory cost"} /><ReportFact label={displayText("Batch cost")} value={formatReviewAmount(group.totalRecordedBatchCost, group.currency)} detail="Known recorded cost" /><ReportFact label={displayText("Sale proceeds")} value={formatReviewAmount(group.saleIncome, group.currency)} detail={`${group.saleTransactionCount} linked sale${group.saleTransactionCount === 1 ? "" : "s"}`} /></div>{(group.recordsMayBeIncomplete || missingProductCosts > 0) && <p className="mt-2 text-xs text-warning-ink">{missingProductCosts ? `${missingProductCosts} product-use record${missingProductCosts === 1 ? "" : "s"} need${missingProductCosts === 1 ? "s" : ""} cost details. Total is partial.` : "Some product usage costs are unavailable or recorded in another currency. Known costs are shown where comparable."}{hasProductUsage && <> <a className="font-semibold underline underline-offset-2" href="#report-products">{displayText("View products")}</a></>}</p>}</section>)}</div>;
}

function ProductUseList({ products, isManager }: { products: ReturnType<typeof groupProducts>; isManager: boolean }) {
  const { display: displayText } = useDisplayLocale();
  if (products.length === 0) return <Empty text="No product-use record." />;
  const money = (amount: number) => `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <div className="@container/products min-w-0">
    <ul aria-label={displayText("Products used")} className="space-y-3 @min-[600px]/products:hidden">
      {products.map((item) => <li key={`${item.type}:${item.label}:${item.unit}`} className="min-w-0 rounded-xl border p-4">
        <p className="break-words font-semibold leading-6">{item.label}</p>
        <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="capitalize">{item.type.toLowerCase().replaceAll("_", " ")}</span>
          <span className="break-words tabular-nums">{item.quantity == null ? displayText("Not measured") : `${item.quantity.toLocaleString()} ${item.unit ?? "unit"}`}{item.quantityPartial && <span className="ml-1 text-warning-ink">{displayText("Partial")}</span>}</span>
        </div>
        {isManager && <dl className="mt-3 grid min-w-0 grid-cols-2 gap-4 border-t pt-3 text-sm">
          <div className="min-w-0"><dt className="text-muted-foreground">{displayText("Unit cost")}</dt><dd className="mt-1 break-words font-medium tabular-nums">{item.unitCost == null ? "—" : money(item.unitCost)}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">{displayText("Total cost")}</dt><dd className="mt-1 break-words font-semibold tabular-nums">{item.cost == null ? displayText("Unavailable") : money(item.cost)}{item.costPartial && <span className="mt-1 block font-normal text-warning-ink">{displayText("Partial")}</span>}</dd></div>
        </dl>}
      </li>)}
    </ul>
    <div role="region" aria-label={displayText("Products used table")} tabIndex={0} className="hidden overflow-x-auto @min-[600px]/products:block rounded-xl border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
    <table className={cn("w-full text-left text-sm", isManager && "min-w-[32rem]")}>
      <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th scope="col" className="sticky left-0 z-10 w-40 min-w-40 max-w-40 bg-muted px-3 py-3 font-semibold">{displayText("Product")}</th><th scope="col" className="px-3 py-3 text-right font-semibold">{displayText("Quantity")}</th>{isManager && <><th scope="col" className="px-3 py-3 text-right font-semibold">{displayText("Unit cost")}</th><th scope="col" className="px-3 py-3 text-right font-semibold">{displayText("Total cost")}</th></>}</tr></thead>
      <tbody className="divide-y">{products.map((item) => <tr key={`${item.type}:${item.label}:${item.unit}`}><th scope="row" className="sticky left-0 z-10 w-40 min-w-40 max-w-40 bg-card px-3 py-3 align-top font-semibold"><span className="block break-words">{item.label}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{item.type} · {item.count} {displayText("record")}{item.count === 1 ? "" : "s"}</span></th><td className="px-3 py-3 text-right align-top tabular-nums">{item.quantity == null ? displayText("Not measured") : <>{`${item.quantity.toLocaleString()} ${item.unit ?? "unit"}`}{item.quantityPartial && <span className="block text-xs text-muted-foreground">{displayText("Partial")}</span>}</>}</td>{isManager && <><td className="px-3 py-3 text-right align-top tabular-nums">{item.unitCost == null ? "—" : money(item.unitCost)}</td><td className="px-3 py-3 text-right align-top font-semibold tabular-nums">{item.cost == null ? <span className="text-xs font-normal text-muted-foreground">{displayText("Unavailable")}</span> : <>{money(item.cost)}{item.costPartial && <span className="block text-xs font-normal text-muted-foreground">{displayText("Partial")}</span>}</>}</td></>}</tr>)}</tbody>
    </table>
  </div></div>;
}

function VaccinationChecklist({ plan, recordedVaccines, loading, error, isSavedSnapshot }: { plan: VaccinationPlanItem[]; recordedVaccines: SelectionReviewProductUse[]; loading: boolean; error: boolean; isSavedSnapshot: boolean }) {
  const { display: displayText } = useDisplayLocale();
  if (loading) return <div className="space-y-2" aria-label={displayText("Loading vaccination record")}>{[0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>;
  const linkedInputIds = new Set(plan.map((item) => item.completedInputLogId).filter((id): id is number => id != null));
  const additionalVaccines = recordedVaccines.filter((input) => error || isSavedSnapshot || !linkedInputIds.has(input.sourceId)).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  if (!error && !isSavedSnapshot && plan.length === 0 && additionalVaccines.length === 0) return <div className="flex items-start gap-2 py-1 text-sm leading-6 text-muted-foreground"><Syringe className="size-4 shrink-0 text-primary" /> {displayText("No vaccinations recorded.")}</div>;

  const scheduledPlan = (error ? [] : [...plan]).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
  const completed = scheduledPlan.filter((item) => item.status === "COMPLETED");
  const scheduled = scheduledPlan.filter((item) => item.status === "SCHEDULED");
  const attention = scheduled.filter((item) => item.displayState === "OVERDUE" || item.displayState === "DUE_TODAY");
  const upcoming = scheduled.filter((item) => !attention.includes(item));
  const unavailable = scheduledPlan.filter((item) => item.status === "SKIPPED" || item.status === "CANCELLED");
  const overdueCount = attention.filter((item) => item.displayState === "OVERDUE").length;
  const dueTodayCount = attention.filter((item) => item.displayState === "DUE_TODAY").length;
  const nextScheduled = upcoming[0];
  const attentionDetail = [overdueCount > 0 ? `${overdueCount} overdue` : null, dueTodayCount > 0 ? `${dueTodayCount} due today` : null, unavailable.length > 0 ? `${unavailable.length} skipped / cancelled` : null].filter(Boolean).join(" · ");
  const needsReview = attention.length > 0 || unavailable.length > 0;

  return <div className="space-y-5">
    {isSavedSnapshot && <div><p className="text-sm font-semibold">{displayText("Current vaccination schedule")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{displayText("This live schedule is not included in the saved report. The list labels current schedule entries and vaccine product records saved in this report.")}</p></div>}
    {error && <p role="alert" className="rounded-xl border border-warning-border bg-warning-muted px-3 py-2 text-sm text-warning-ink">{displayText("Vaccination schedule unavailable. Try again when the connection is restored.")}</p>}
    {!error && scheduledPlan.length === 0 && <p className="text-sm text-muted-foreground">{displayText("No vaccination schedule recorded for this batch.")}</p>}
    {scheduledPlan.length > 0 && <div aria-label={displayText("Vaccination status")} className="grid grid-cols-2 overflow-hidden rounded-xl border bg-border/70 sm:grid-cols-3">
      <VaccinationFact label={displayText("Completed")} value={`${completed.length} / ${scheduledPlan.length}`} detail="scheduled doses" valueClassName="text-primary" />
      <VaccinationFact label={needsReview ? "Needs review" : "Schedule"} value={needsReview ? String(attention.length + unavailable.length) : scheduled.length === 0 ? "Complete" : "On track"} detail={needsReview ? attentionDetail : scheduled.length === 0 ? "All doses recorded" : `${scheduled.length} upcoming`} valueClassName={needsReview ? "text-destructive" : "text-primary"} />
      <VaccinationFact className="col-span-2 sm:col-span-1" label={displayText("Next scheduled")} value={nextScheduled ? `Day ${nextScheduled.ageDay}` : "—"} detail={nextScheduled ? formatDate(nextScheduled.dueDate) : "No upcoming dose"} />
    </div>}

    {(scheduledPlan.length > 0 || additionalVaccines.length > 0) && <Dialog>
      <DialogTrigger render={<button type="button" className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm font-semibold hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/60" />}><span>{displayText("Vaccination list")}{" "}<span className="font-normal text-muted-foreground">({scheduledPlan.length + additionalVaccines.length})</span></span><ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" /></DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-5 pb-4 pt-5 pr-12"><DialogTitle>{displayText("Vaccination list")}</DialogTitle><DialogDescription>{isSavedSnapshot ? "Current schedule alongside saved vaccine records." : "Scheduled doses and recorded vaccine products."}</DialogDescription></DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain"><ol className="divide-y border-t">{scheduledPlan.map((item) => <VaccinationReviewRow key={item.id} item={item} isSavedSnapshot={isSavedSnapshot} />)}{additionalVaccines.map((input) => <li key={`record-${input.sourceId}`} className="flex gap-3 px-3 py-3 sm:px-4"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Check className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5" title={input.productName ?? input.brandName}>{input.productName ?? input.brandName}</p><span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{displayText("Product record")}</span></div><p className="mt-1 text-xs text-muted-foreground">{isSavedSnapshot ? "Saved snapshot · " : ""}{displayText("Recorded")}{" "}{formatDate(input.recordedAt)} {displayText("· Product log")}{!isSavedSnapshot && !error ? " outside the assigned schedule" : ""}</p></div></li>)}</ol></div>
      </DialogContent>
    </Dialog>}
    {isSavedSnapshot && additionalVaccines.length === 0 && <p className="text-sm text-muted-foreground">{displayText("No vaccine product records were saved in this snapshot.")}</p>}
  </div>;
}

function VaccinationFact({ label, value, detail, valueClassName, className }: { label: string; value: string; detail: string; valueClassName?: string; className?: string }) {
  return <div className={cn("min-w-0 bg-card px-3 py-3 sm:px-4", className)}><p className="break-words text-sm font-medium text-muted-foreground">{label}</p><p className={cn("mt-1 break-words text-lg font-bold tabular-nums", valueClassName)}>{value}</p><p className="mt-1 break-words text-sm leading-5 text-muted-foreground">{detail}</p></div>;
}

function VaccinationReviewRow({ item, isSavedSnapshot }: { item: VaccinationPlanItem; isSavedSnapshot: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const status = vaccinationReviewStatus(item);
  return <li className={cn("flex gap-3 px-3 py-3 sm:px-4", status.rowClassName)}><span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", status.iconClassName)}>{status.icon === "check" ? <Check className="size-4" aria-hidden="true" /> : status.icon === "alert" ? <TriangleAlert className="size-4" aria-hidden="true" /> : <Clock3 className="size-4" aria-hidden="true" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5" title={item.vaccineName}>{item.vaccineName}</p><span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", status.badgeClassName)}>{status.label}</span></div><p className="mt-1 text-xs text-muted-foreground">{isSavedSnapshot ? "Current schedule · " : ""}{displayText("Day")}{" "}{item.ageDay} · {status.detail}</p></div></li>;
}

function vaccinationReviewStatus(item: VaccinationPlanItem) {
  if (item.status === "COMPLETED") return { label: "Completed", detail: item.completedAt ? `Recorded ${formatDate(item.completedAt)}` : "Completion date not recorded", icon: "check", rowClassName: "bg-primary/5", iconClassName: "bg-primary/15 text-primary", badgeClassName: "border-primary/25 bg-primary/10 text-primary" } as const;
  if (item.status === "SKIPPED") return { label: "Skipped", detail: `Scheduled ${formatDate(item.dueDate)}`, icon: "clock", rowClassName: "bg-muted/30", iconClassName: "bg-muted text-muted-foreground", badgeClassName: "border bg-muted text-muted-foreground" } as const;
  if (item.status === "CANCELLED") return { label: "Cancelled", detail: `Scheduled ${formatDate(item.dueDate)}`, icon: "clock", rowClassName: "bg-muted/30", iconClassName: "bg-muted text-muted-foreground", badgeClassName: "border bg-muted text-muted-foreground" } as const;
  if (item.displayState === "OVERDUE") return { label: "Overdue", detail: `Due ${formatDate(item.dueDate)}`, icon: "alert", rowClassName: "bg-destructive/5", iconClassName: "bg-destructive/10 text-destructive", badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive" } as const;
  if (item.displayState === "DUE_TODAY") return { label: "Due today", detail: `Due ${formatDate(item.dueDate)}`, icon: "alert", rowClassName: "bg-warning-muted/40", iconClassName: "bg-warning-muted text-warning-ink", badgeClassName: "border-warning-border bg-warning-muted text-warning-ink" } as const;
  return { label: "Upcoming", detail: `Due ${formatDate(item.dueDate)}`, icon: "clock", rowClassName: "", iconClassName: "bg-muted text-muted-foreground", badgeClassName: "border bg-muted text-muted-foreground" } as const;
}

function ReportSection({ id, title, children, open = false, collapsible = false, className }: { id?: string; title: string; children: ReactNode; open?: boolean; collapsible?: boolean; className?: string }) {
  const headingClassName = "flex min-h-14 items-center justify-between gap-3 px-4 py-3.5 text-left font-semibold sm:px-5";
  const panelClassName = cn("min-w-0 scroll-mt-20 overflow-hidden rounded-2xl border bg-card", className);
  if (collapsible) return <details id={id} open={open} className={cn("group", panelClassName)}><summary className={cn(headingClassName, "cursor-pointer list-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60")}><span>{title}</span><span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span></summary><div className="px-4 pb-4 pt-1 sm:px-5">{children}</div></details>;
  return <section id={id} className={panelClassName}><h2 className={headingClassName}>{title}</h2><div className="px-4 pb-4 pt-1 sm:px-5">{children}</div></section>;
}

function ReportFact({ label, value, detail, valueClassName }: { label: string; value: string; detail: string; valueClassName?: string }) {
  return <div className="min-w-0 bg-card px-2 py-3"><p className="break-words text-sm font-medium leading-5 text-muted-foreground">{label}</p><p className={cn("mt-1 break-words text-base font-bold leading-tight tabular-nums", valueClassName)}>{value}</p><p className="mt-0.5 break-words text-sm leading-5 text-muted-foreground">{detail}</p></div>;
}

function healthEventTone(eventType: string) {
  const normalizedType = eventType.toUpperCase();
  const isDeath = normalizedType.includes("DEATH") || normalizedType === "MORTALITY";
  return isDeath
    ? { row: "bg-destructive/5", title: "text-destructive", dot: "bg-destructive", badge: "inline-flex rounded-full border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive" }
    : { row: "bg-warning-muted/30", title: "text-warning-ink", dot: "bg-warning-ink", badge: "inline-flex rounded-full border border-warning-border bg-warning-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-ink" };
}

function ManagerReviewPanel({ reviewStatus, nextReviewDate, notes, pending, action, onReviewStatusChange, onNextReviewDateChange, onNotesChange }: { reviewStatus: ManagerReviewStatus; nextReviewDate: string; notes: string; pending: boolean; action?: ReactNode; onReviewStatusChange: (value: ManagerReviewStatus) => void; onNextReviewDateChange: (value: string) => void; onNotesChange: (value: string) => void }) {
  const { display: displayText } = useDisplayLocale();
  const needsNextReviewDate = reviewStatus === "CONTINUE_OBSERVATION";
  return <section id="review-decision" className="order-3 min-w-0 scroll-mt-20 rounded-2xl border bg-card p-4 lg:p-5">
    <h2 className="mb-5 text-lg font-semibold">{displayText("Review decision")}</h2>
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <label className="block min-w-0 space-y-2 text-sm font-medium"><span>{displayText("Decision after review")}</span><NativeSelect className="w-full min-w-0" selectClassName="h-12 text-base" value={reviewStatus} onChange={(event) => onReviewStatusChange(event.target.value as ManagerReviewStatus)}><option value="NOT_REVIEWED" disabled>{displayText("Choose a decision")}</option>{Object.entries(reviewLabels).filter(([value]) => value !== "NOT_REVIEWED").map(([value, label]) => <option key={value} value={value}>{displayText(label)}</option>)}</NativeSelect></label>
      <label className="block min-w-0 space-y-2 text-sm font-medium"><span>{displayText("Next review date")}{needsNextReviewDate ? " (required)" : " (optional)"}</span><Input className="h-12 max-w-full text-base" type="date" min={todayIso()} value={nextReviewDate} onChange={(event) => onNextReviewDateChange(event.target.value)} /></label>
      {nextReviewDate && <p className="text-sm leading-6 text-muted-foreground">{displayText("Creates or updates the team’s follow-up reminder.")}</p>}
      {needsNextReviewDate && !nextReviewDate && <p className="text-sm text-warning-ink">{displayText("Choose a date to continue observation.")}</p>}
      <label className="block space-y-2 text-sm font-medium"><span>{displayText("Notes")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional)")}</span></span><Textarea className="min-h-28 text-base" rows={3} value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder={displayText("What should the team check next?")} /></label>
    </fieldset>
    {action}
  </section>;
}

function SnapshotStatusPanel({ selected, onDownload }: { selected: SelectionReviewResponse; onDownload: () => void }) {
  const { display: displayText } = useDisplayLocale();
  return <section className="order-5 min-w-0 rounded-2xl border border-primary/20 bg-primary/5 p-4 lg:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{selected.status === "FINALIZED" ? "Manager-reviewed snapshot" : `Saved snapshot v${selected.versionNumber}`}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selected.purpose ?? "Routine review"} · {formatDateTime(selected.generatedAt)}{displayText(". Batch remains active.")}</p></div><Badge variant={selected.status === "FINALIZED" ? "default" : "secondary"}>{selected.status === "FINALIZED" ? "REVIEWED" : "SNAPSHOT"}</Badge></div>{selected.newerDataAvailable && <p className="mt-3 text-sm font-semibold text-warning-ink">{displayText("Newer records are available. Create a new report before relying on fresher evidence.")}</p>}<Button variant="outline" className="mt-4 h-11 w-full" onClick={onDownload}><Download className="size-4" /> {displayText("Download PDF")}</Button></section>;
}

function SavedVersionList({ reviews, isLoading, selectedId, onSelect }: { reviews: SelectionReviewResponse[]; isLoading: boolean; selectedId?: number; onSelect: (review: SelectionReviewResponse) => void }) {
  const { display: displayText } = useDisplayLocale();
  return <section id="report-versions" className="scroll-mt-20 min-w-0 rounded-2xl border bg-card p-4 lg:p-5"><div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{displayText("Saved versions")}</h2>{reviews.length > 0 && <span className="text-xs text-muted-foreground">{reviews.length}</span>}</div>{isLoading && <div className="h-16 animate-pulse rounded-xl bg-muted" />}{!isLoading && reviews.length === 0 && <p className="py-2 text-sm text-muted-foreground">{displayText("No saved reports yet.")}</p>}{reviews.length > 0 && <div className="max-h-80 divide-y overflow-y-auto rounded-2xl border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 " tabIndex={0} aria-label={displayText("Saved report versions")}>{reviews.map((review) => { const current = selectedId === review.id; return <Button variant="ghost" type="button" key={review.id} onClick={() => onSelect(review)} aria-pressed={current} className={cn("flex h-auto min-h-16 w-full flex-wrap items-center justify-between gap-3 whitespace-normal px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60", current && "bg-primary/5")}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{displayText("Report v")}{review.versionNumber} {displayText("· Batch history")}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{review.status === "FINALIZED" ? "Manager reviewed" : "Saved snapshot"} · {formatDateTime(review.generatedAt)}</span></span><Badge variant={review.status === "FINALIZED" ? "default" : "secondary"}>{review.status === "FINALIZED" ? "REVIEWED" : "SNAPSHOT"}</Badge></Button>; })}</div>}</section>;
}

function groupProducts(items: SelectionReviewProductUse[]) {
  const groups = new Map<string, { label: string; type: string; count: number; quantity: number | null; quantityPartial: boolean; unit: string | null; unitCost: number | null; cost: number | null; costPartial: boolean }>();
  for (const item of items) {
    const key = `${item.productType}:${item.brandName}:${item.unit ?? ""}`;
    const current = groups.get(key) ?? { label: item.brandName, type: item.productType, count: 0, quantity: null, quantityPartial: false, unit: item.unit, unitCost: item.unitCost == null ? null : item.unitCost, cost: null, costPartial: false };
    current.count += 1;
    if (item.quantity != null) current.quantity = (current.quantity ?? 0) + item.quantity;
    else current.quantityPartial = true;
    if (item.calculatedCost != null) current.cost = (current.cost ?? 0) + item.calculatedCost;
    else current.costPartial = true;
    if (current.unitCost != null && item.unitCost != null && Math.abs(current.unitCost - item.unitCost) > 0.000001) current.unitCost = null;
    else if (item.unitCost == null) current.unitCost = null;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function Empty({ text }: { text: string }) { return <p className="py-1 text-sm leading-6 text-muted-foreground">{text}</p>; }

function PopulationReconciliationWarning({ message, className }: { message: string | null; className?: string }) {
  return <div role="alert" className={cn("flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2.5 text-sm text-warning-ink", className)}><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>{message ?? "Population records do not reconcile. Review the population event history."}</p></div>;
}
