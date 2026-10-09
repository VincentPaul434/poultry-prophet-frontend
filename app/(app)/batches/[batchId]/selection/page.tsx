"use client";

import { use, useRef, useState, type ReactNode } from "react";
import { Check, Download, Loader2, Save, Syringe, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";
import { PageBackLink } from "@/components/page-back-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, todayIso } from "@/lib/format";
import { selectionReviewApi } from "@/lib/api";
import type { ManagerReviewStatus, SelectionReviewPayload, SelectionReviewProductUse, SelectionReviewResponse, VaccinationPlanItem } from "@/lib/types";
import { useCreateSelectionReview, useFinalizeSelectionReview, useSelectionReviewPreview, useSelectionReviews } from "@/hooks/use-selection-review";
import { useSexComposition, useVaccinationPlan } from "@/hooks/use-operations";

const reviewLabels: Record<ManagerReviewStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  FOR_IN_PERSON_ASSESSMENT: "For in-person assessment",
  CONTINUE_OBSERVATION: "Continue observation",
  REVIEW_COMPLETED: "Review completed",
};

export default function SelectionPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  return <RouteGuard><SelectionReviewView batchId={batchId} /></RouteGuard>;
}

function SelectionReviewView({ batchId }: { batchId: string }) {
  const { isManager } = useAuth();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selected, setSelected] = useState<SelectionReviewResponse | null>(null);
  const [purpose, setPurpose] = useState("ROUTINE_REVIEW");
  const [snapshotNote, setSnapshotNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ManagerReviewStatus>("FOR_IN_PERSON_ASSESSMENT");
  const [notes, setNotes] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const requestKey = useRef<string | null>(null);
  const params = { periodStart: periodStart || undefined, periodEnd: periodEnd || undefined, asOfDate: periodEnd || undefined };
  const preview = useSelectionReviewPreview(batchId, params);
  const reviews = useSelectionReviews(batchId);
  const vaccinationPlan = useVaccinationPlan(Number(batchId));
  const sexComposition = useSexComposition(Number(batchId));
  const create = useCreateSelectionReview(batchId);
  const finalize = useFinalizeSelectionReview(batchId);
  const payload = selected?.payload ?? preview.data;

  async function generateSnapshot() {
    try {
      requestKey.current ??= typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await create.mutateAsync({ periodStart: periodStart || undefined, periodEnd: periodEnd || undefined, asOfDate: periodEnd || undefined, purpose, snapshotNote: snapshotNote.trim() || undefined, idempotencyKey: requestKey.current });
      requestKey.current = null;
      setSelected(result); setPeriodStart(result.periodStart); setPeriodEnd(result.periodEnd); setReviewStatus(result.reviewStatus); setNotes(result.managerNotes ?? ""); setNextReviewDate(result.nextReviewDate ?? "");
      toast.success("Report snapshot saved — batch remains active");
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not generate the report"); }
  }

  async function finalizeSnapshot() {
    if (!selected) return;
    try { const result = await finalize.mutateAsync({ reviewId: selected.id, body: { reviewStatus, managerNotes: notes.trim() || null, nextReviewDate: nextReviewDate || null } }); setSelected(result); toast.success("Manager review saved — batch remains active"); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not finalize the report"); }
  }

  async function downloadPdf() {
    if (!selected) return;
    try { const blob = await selectionReviewApi.pdf(batchId, selected.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `selection-review-${batchId}-${selected.id}.pdf`; anchor.click(); URL.revokeObjectURL(url); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not download the PDF"); }
  }

  function selectSavedReport(review: SelectionReviewResponse) {
    setSelected(review);
    setPeriodStart(review.periodStart);
    setPeriodEnd(review.periodEnd);
    setPurpose(review.purpose ?? "ROUTINE_REVIEW");
    setSnapshotNote(review.snapshotNote ?? "");
    setReviewStatus(review.reviewStatus);
    setNotes(review.managerNotes ?? "");
    setNextReviewDate(review.nextReviewDate ?? "");
  }

  const reportStatus = selected?.status === "FINALIZED"
    ? "MANAGER REVIEWED"
    : selected
      ? `SAVED SNAPSHOT v${selected.versionNumber}`
      : "LIVE REPORT";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-6">
      <ReportIdentityHeader batchId={batchId} batchName={payload?.batch.batchName} stageName={payload?.batch.stageName} ageDays={payload?.batch.ageDays} periodStart={periodStart || payload?.periodStart || ""} periodEnd={periodEnd || payload?.periodEnd || ""} status={reportStatus} />

      {payload && <ReportMetricStrip payload={payload} sexComposition={selected || periodEnd ? payload.sexComposition : sexComposition.data ?? payload.sexComposition} />}

      {preview.isLoading && <div className="h-56 animate-pulse rounded-2xl bg-muted" />}
      {preview.isError && <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{preview.error instanceof ApiError ? preview.error.message : "Failed to load the report preview."}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <ReportControlsPanel isManager={isManager} periodStart={periodStart} periodEnd={periodEnd} purpose={purpose} snapshotNote={snapshotNote} onPeriodStartChange={(value) => { setSelected(null); setPeriodStart(value); }} onPeriodEndChange={(value) => { setSelected(null); setPeriodEnd(value); }} onPurposeChange={setPurpose} onSnapshotNoteChange={setSnapshotNote} onSave={generateSnapshot} saveDisabled={create.isPending || !payload} savePending={create.isPending} />

        {payload && <ReportContent payload={payload} vaccinationPlan={vaccinationPlan.data ?? []} vaccinationLoading={vaccinationPlan.isLoading} />}

        {isManager && selected && selected.status === "DRAFT" && <ManagerReviewPanel reviewStatus={reviewStatus} nextReviewDate={nextReviewDate} notes={notes} pending={finalize.isPending} onReviewStatusChange={setReviewStatus} onNextReviewDateChange={setNextReviewDate} onNotesChange={setNotes} onSave={finalizeSnapshot} />}

        {isManager && selected && <SnapshotStatusPanel selected={selected} onDownload={downloadPdf} />}

        <SavedVersionList reviews={reviews.data ?? []} isLoading={reviews.isLoading} selectedId={selected?.id} onSelect={selectSavedReport} />
      </div>
    </div>
  );
}

function ReportIdentityHeader({ batchId, batchName, stageName, ageDays, periodStart, periodEnd, status }: { batchId: string; batchName?: string; stageName?: string; ageDays?: number; periodStart: string; periodEnd: string; status: string }) {
  return (
    <header className="space-y-3">
      <PageBackLink destination="batch" batchId={batchId} className="mb-1" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{batchName ?? "Batch review report"}</h1>
            <Badge variant={status === "MANAGER REVIEWED" ? "default" : "secondary"}>{status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Recorded batch history for human review.</p>
          {(stageName || periodStart || periodEnd) && <p className="mt-2 text-sm font-medium text-foreground/80">{stageName?.replaceAll("-", " ")}{typeof ageDays === "number" ? ` · Day ${ageDays}` : ""}{stageName && (periodStart || periodEnd) ? " · " : ""}{periodStart || "Start not set"} – {periodEnd || "As of today"}</p>}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">Report remains linked to the active batch</p>
      </div>
    </header>
  );
}

type ReportSexComposition = Pick<NonNullable<SelectionReviewPayload["sexComposition"]>, "observedOn" | "maleCount" | "femaleCount" | "unclassifiedCount"> & { pendingSync?: boolean };

function ReportMetricStrip({ payload, sexComposition }: { payload: SelectionReviewPayload; sexComposition: ReportSexComposition | null | undefined }) {
  const p = payload.population;
  const selection = payload.selectionSummary;
  const selectionValue = selection ? `${selection.acceptedCount} / ${selection.evaluatedCount}` : "—";
  const sexValue = sexComposition ? `${sexComposition.maleCount} / ${sexComposition.femaleCount}` : "—";
  const sexDetail = sexComposition
    ? `${sexComposition.unclassifiedCount} unclassified · ${sexComposition.pendingSync ? "Pending sync" : formatDate(sexComposition.observedOn)}`
    : "Not recorded";
  return <div className="space-y-2"><section aria-label="Report summary" className="overflow-hidden rounded-2xl border bg-card"><div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0"><Metric label="Population" value={payload.batch.currentPopulationDisplay} detail={p.reconciliationRequired ? "Records need review" : "Current / initial"} prominent valueClassName={p.reconciliationRequired ? "text-destructive" : undefined} /><Metric label="Total deaths" value={String(p.totalDeaths)} detail={`${p.healthRelatedDeaths} health · ${p.accidentalDeaths} accidental`} valueClassName={p.totalDeaths > 0 ? "text-destructive" : undefined} /><Metric label="Male / female" value={sexValue} detail={sexDetail} valueClassName={sexComposition?.pendingSync ? "text-warning-ink" : undefined} /><Metric label="Selection outcome" value={selectionValue} detail={selection ? `${selection.selectionRatePercent ?? "—"}% accepted` : "No finalized review"} valueClassName={selection ? "text-primary" : undefined} /></div></section>{p.reconciliationRequired && <PopulationReconciliationWarning message={p.reconciliationMessage} />}</div>;
}

function Metric({ label, value, detail, prominent = false, valueClassName }: { label: string; value: string; detail: string; prominent?: boolean; valueClassName?: string }) {
  return <div className="min-w-0 px-4 py-3.5 sm:px-5"><p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={cn("mt-1 truncate font-bold tabular-nums", prominent ? "text-2xl" : "text-xl", valueClassName)}>{value}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p></div>;
}

function ReportControlsPanel({ isManager, periodStart, periodEnd, purpose, snapshotNote, onPeriodStartChange, onPeriodEndChange, onPurposeChange, onSnapshotNoteChange, onSave, saveDisabled, savePending }: { isManager: boolean; periodStart: string; periodEnd: string; purpose: string; snapshotNote: string; onPeriodStartChange: (value: string) => void; onPeriodEndChange: (value: string) => void; onPurposeChange: (value: string) => void; onSnapshotNoteChange: (value: string) => void; onSave: () => void; saveDisabled: boolean; savePending: boolean }) {
  return <section className="order-1 min-w-0 rounded-2xl border bg-card p-4 lg:col-start-9 lg:col-span-4 lg:row-start-1 lg:self-start lg:p-5">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Report settings</h2><p className="mt-1 text-xs text-muted-foreground">Choose the period you want to review.</p></div>{!isManager && <Badge variant="outline">Read-only</Badge>}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <label className="space-y-1.5 text-sm font-semibold"><span>Report start</span><Input type="date" value={periodStart} onChange={(event) => onPeriodStartChange(event.target.value)} /></label>
      <label className="space-y-1.5 text-sm font-semibold"><span>Report as of</span><Input type="date" max={todayIso()} value={periodEnd} onChange={(event) => onPeriodEndChange(event.target.value)} /></label>
      {isManager && <label className="space-y-1.5 text-sm font-semibold"><span>Report purpose</span><NativeSelect value={purpose} onChange={(event) => onPurposeChange(event.target.value)}><option value="ROUTINE_REVIEW">Routine review</option><option value="SELECTION_REVIEW">Selection review</option><option value="CONSULTATION">Consultation</option><option value="STAKEHOLDER_VALIDATION">Stakeholder validation</option><option value="OTHER">Other</option></NativeSelect></label>}
      {isManager && <label className="space-y-1.5 text-sm font-semibold sm:col-span-2 lg:col-span-1"><span>Note <span className="font-normal text-muted-foreground">(optional)</span></span><Textarea rows={2} value={snapshotNote} onChange={(event) => onSnapshotNoteChange(event.target.value)} placeholder="Optional context" /></label>}
    </div>
    <div className="mt-4 border-t pt-4">{isManager ? <><p className="mb-3 text-xs text-muted-foreground">Saving creates a report snapshot. The batch stays active.</p><Button className="h-12 w-full" onClick={onSave} disabled={saveDisabled}>{savePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{savePending ? "Saving…" : "Save report snapshot"}</Button></> : <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">This report can be viewed but not saved by your role.</p>}</div>
  </section>;
}

function ReportContent({ payload, vaccinationPlan, vaccinationLoading }: { payload: SelectionReviewPayload; vaccinationPlan: VaccinationPlanItem[]; vaccinationLoading: boolean }) {
  const p = payload.population;
  const products = groupProducts(payload.productUse);
  const visibleChanges = Object.entries(p.categoryCounts).filter(([, value]) => value > 0);
  const selection = payload.selectionSummary;
  return <main className="order-2 min-w-0 lg:col-span-8 lg:row-start-1 lg:row-span-5"><div className="grid gap-3 md:grid-cols-2">
    <ReportSection title="Selection outcome"><SelectionOutcomeSummary selection={selection} /></ReportSection>
    <ReportSection title="Population"><PopulationSummary population={p} visibleChanges={visibleChanges} /></ReportSection>
    <ReportSection title="Vaccines" className="md:col-span-2"><VaccinationChecklist plan={vaccinationPlan} recordedVaccines={payload.productUse.filter((item) => item.productType === "VACCINE")} loading={vaccinationLoading} /></ReportSection>
    <ReportSection title={`Health history (${payload.healthEvents.length})`} collapsible>{payload.healthEvents.length === 0 ? <Empty text="No health events recorded." /> : <div className="divide-y rounded-xl border">{payload.healthEvents.map((event) => { const tone = healthEventTone(event.eventType); return <div key={event.sourceEventId} className={cn("p-3", tone.row)}><div className="flex flex-wrap items-start justify-between gap-2"><p className={cn("flex min-w-0 items-center gap-2 font-semibold", tone.title)}><span className={cn("size-2 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />{event.title}</p><span className="shrink-0 text-xs text-muted-foreground">{formatDate(event.eventDate)}</span></div><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span className={tone.badge}>{event.eventType.replaceAll("_", " ")}</span><span>·</span><span>{event.affectedCount} affected</span><span>·</span><span>{event.severity ?? "No severity"}</span></p>{event.details && <p className="mt-2 text-sm leading-relaxed">{event.details}</p>}</div>; })}</div>}</ReportSection>
    <ReportSection title={`Products used (${payload.productUse.length})`} collapsible>{products.length === 0 ? <Empty text="No product-use record." /> : <div className="divide-y rounded-xl border">{products.map((item) => <div key={`${item.type}:${item.label}:${item.unit}`} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.type} · {item.count} record{item.count === 1 ? "" : "s"}</p></div><div className="shrink-0 text-right text-sm font-semibold"><p>{item.quantity == null ? "Not measured" : item.cost != null ? `${item.quantity} ${item.unit ?? "unit"} × ₱${(item.unitCost ?? (item.cost / item.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ₱${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${item.quantity} ${item.unit ?? "unit"}`}</p><p className="text-xs font-normal text-muted-foreground">{item.cost == null ? "Cost unavailable" : "Batch product cost"}</p></div></div>)}</div>}</ReportSection>
    {payload.finance && <ReportSection title="Batch finance" className="md:col-span-2"><div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-5"><ReportFact label="Income" value={`₱${Number(payload.finance.recordedIncome).toLocaleString()}`} detail="Cash recorded" /><ReportFact label="Cash expense" value={`₱${Number(payload.finance.recordedExpense).toLocaleString()}`} detail="Direct batch expense" /><ReportFact label="Products used" value={`₱${Number(payload.finance.productsConsumedCost).toLocaleString()}`} detail="Inventory cost" /><ReportFact label="Batch cost" value={`₱${Number(payload.finance.totalRecordedBatchCost).toLocaleString()}`} detail="Known recorded cost" /><ReportFact label="Contribution" value={`₱${Number(payload.finance.recordedContribution).toLocaleString()}`} detail="Income − batch cost" valueClassName={Number(payload.finance.recordedContribution) > 0 ? "text-success" : Number(payload.finance.recordedContribution) < 0 ? "text-destructive" : undefined} /></div>{payload.finance.recordsMayBeIncomplete && <p className="mt-2 text-xs text-warning-ink">Some product usage has no available historical cost. Batch cost is based on known valued records.</p>}</ReportSection>}
    {payload.incubation && <ReportSection title="Incubation"><div className="grid grid-cols-2 divide-x divide-y rounded-xl border sm:grid-cols-4 sm:divide-y-0"><ReportFact label="Cycle" value={payload.incubation.cycleName} detail={payload.incubation.incubatorCode} /><ReportFact label="Eggs" value={String(payload.incubation.eggsLoaded)} detail={formatDate(payload.incubation.loadedDate)} /><ReportFact label="Hatched" value={payload.incubation.hatchedCount == null ? "—" : String(payload.incubation.hatchedCount)} detail={payload.incubation.hatchRate == null ? "Rate unavailable" : `${payload.incubation.hatchRate}%`} /><ReportFact label="Unhatched" value={`${payload.incubation.unhatchedCount ?? "—"}`} detail="Recorded" /></div></ReportSection>}
    <ReportSection title="Supporting details" collapsible className="md:col-span-2"><div className="divide-y rounded-xl border">{payload.dataAvailability.map((item) => <div key={item.section} className="flex flex-wrap items-center justify-between gap-2 p-3"><p className="font-semibold">{item.section}</p><Badge variant={item.status === "NO_RECORDS" ? "secondary" : "outline"}>{item.status.replaceAll("_", " ")} · {item.recordCount}</Badge></div>)}</div></ReportSection>
  </div></main>;
}

function PopulationSummary({ population, visibleChanges }: { population: SelectionReviewPayload["population"]; visibleChanges: [string, number][] }) {
  const otherChanges = visibleChanges.filter(([key]) => key !== "healthRelatedDeaths" && key !== "accidentalDeaths").reduce((total, [, value]) => total + value, 0);
  return <div className="space-y-3">
    {population.reconciliationRequired && <PopulationReconciliationWarning message={population.reconciliationMessage} />}
    <div className="grid grid-cols-2 gap-x-4 gap-y-3"><ReportFact label="Alive" value={`${population.currentPopulation} / ${population.initialPopulation}`} detail="Current / start" /><ReportFact label="Total deaths" value={String(population.totalDeaths)} detail={`${population.healthRelatedDeaths} health · ${population.accidentalDeaths} accidental`} valueClassName={population.totalDeaths > 0 ? "text-destructive" : undefined} /><ReportFact label="Health deaths" value={String(population.healthRelatedDeaths)} detail={population.healthRelatedLossPercentage == null ? "Rate unavailable" : `${population.healthRelatedLossPercentage}% of start`} valueClassName={population.healthRelatedDeaths > 0 ? "text-destructive" : undefined} /><ReportFact label="Other changes" value={String(otherChanges)} detail="Recorded losses / moves" /><ReportFact label="Events" value={String(population.sourceEventCount)} detail="Population records" /></div>
  </div>;
}

function VaccinationChecklist({ plan, recordedVaccines, loading }: { plan: VaccinationPlanItem[]; recordedVaccines: SelectionReviewProductUse[]; loading: boolean }) {
  if (loading) return <div className="h-16 animate-pulse rounded-lg bg-muted" aria-label="Loading vaccine checklist" />;
  const linkedInputIds = new Set(plan.map((item) => item.completedInputLogId).filter((id): id is number => id != null));
  const additionalVaccines = recordedVaccines.filter((input) => !linkedInputIds.has(input.sourceId));
  if (plan.length === 0 && additionalVaccines.length === 0) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Syringe className="size-4" /> No vaccine schedule or vaccine record for this batch.</div>;
  const applied = plan.filter((item) => item.status === "COMPLETED").length;
  return <div className="space-y-2"><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Applied {applied} of {plan.length} scheduled{additionalVaccines.length > 0 ? ` · ${additionalVaccines.length} additional record${additionalVaccines.length === 1 ? "" : "s"}` : ""}</p><div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Check className="size-3 text-primary" /> Applied</span><span className="inline-flex items-center gap-1"><X className="size-3 text-destructive" /> Not applied</span></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{plan.map((item) => { const done = item.status === "COMPLETED"; return <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2"><span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive")} aria-label={done ? "Applied" : "Not applied"}>{done ? <Check className="size-3.5" /> : <X className="size-3.5" />}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold" title={item.vaccineName}>{item.vaccineName}</span><span className="block truncate text-[11px] text-muted-foreground">Day {item.ageDay} · {formatDate(item.dueDate)}{done ? " · Applied" : " · Not applied"}</span></span></div>; })}{additionalVaccines.map((input) => <div key={`record-${input.sourceId}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-label="Recorded"><Check className="size-3.5" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold" title={input.productName ?? input.brandName}>{input.productName ?? input.brandName}</span><span className="block truncate text-[11px] text-muted-foreground">Recorded {formatDate(input.recordedAt)} · Product log</span></span></div>)}</div></div>;
}

function SelectionOutcomeSummary({ selection }: { selection: SelectionReviewPayload["selectionSummary"] }) {
  if (!selection) return <div className="rounded-xl border border-dashed p-4"><p className="font-semibold">No finalized selection session</p><p className="mt-1 text-sm text-muted-foreground">The report shows recorded batch history only. A manager can add a batch-level selection review from the batch page.</p></div>;
  const criteria = selection.criterionCodes ?? [];
  return <div className="space-y-4">

    <div className="grid grid-cols-2 gap-2.5"><ReportFact label="Accepted" value={`${selection.acceptedCount} / ${selection.evaluatedCount}`} detail={`${selection.selectionRatePercent ?? "—"}% of evaluated`} valueClassName="text-primary" /><ReportFact label="Continue" value={String(selection.continueObservationCount)} detail="Review again later" /><ReportFact label="Not accepted" value={String(selection.notAcceptedCount)} detail="Manager outcome" /><ReportFact label="Other" value={String(selection.otherCount)} detail="See notes" /></div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Recorded {formatDate(selection.selectionDate)}</span><Badge variant="outline">Batch-level review</Badge><span>Population is not changed automatically</span></div>
    {criteria.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Criteria recorded</p><div className="flex flex-wrap gap-2">{criteria.map((criterion) => <Badge key={criterion} variant="secondary">{criterion.replaceAll("_", " ").toLowerCase()}</Badge>)}</div></div>}
    {selection.criteriaNotes && <p className="text-sm leading-relaxed text-muted-foreground">{selection.criteriaNotes}</p>}
    {selection.notes && <p className="rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">{selection.notes}</p>}

  </div>;
}

function ReportSection({ title, children, open = false, collapsible = false, className }: { title: string; children: ReactNode; open?: boolean; collapsible?: boolean; className?: string }) {
  const headingClassName = "flex min-h-14 items-center justify-between gap-3 px-4 py-3.5 text-left font-semibold sm:px-5";
  const panelClassName = cn("overflow-hidden rounded-xl border bg-card", className);
  if (collapsible) return <details open={open} className={cn("group", panelClassName)}><summary className={cn(headingClassName, "cursor-pointer list-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60")}><span>{title}</span><span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span></summary><div className="px-4 pb-4 pt-1 sm:px-5">{children}</div></details>;
  return <section className={panelClassName}><h2 className={headingClassName}>{title}</h2><div className="px-4 pb-4 pt-1 sm:px-5">{children}</div></section>;
}

function ReportFact({ label, value, detail, valueClassName }: { label: string; value: string; detail: string; valueClassName?: string }) {
  return <div className="min-w-0 bg-card px-2 py-3"><p className="break-words text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{label}</p><p className={cn("mt-1 break-words text-base font-bold leading-tight tabular-nums", valueClassName)}>{value}</p><p className="mt-0.5 break-words text-[10px] leading-tight text-muted-foreground">{detail}</p></div>;
}

function healthEventTone(eventType: string) {
  const normalizedType = eventType.toUpperCase();
  const isDeath = normalizedType.includes("DEATH") || normalizedType === "MORTALITY";
  return isDeath
    ? { row: "bg-destructive/5", title: "text-destructive", dot: "bg-destructive", badge: "inline-flex rounded-full border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive" }
    : { row: "bg-warning-muted/30", title: "text-warning-ink", dot: "bg-warning-ink", badge: "inline-flex rounded-full border border-warning-border bg-warning-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-ink" };
}

function ManagerReviewPanel({ reviewStatus, nextReviewDate, notes, pending, onReviewStatusChange, onNextReviewDateChange, onNotesChange, onSave }: { reviewStatus: ManagerReviewStatus; nextReviewDate: string; notes: string; pending: boolean; onReviewStatusChange: (value: ManagerReviewStatus) => void; onNextReviewDateChange: (value: string) => void; onNotesChange: (value: string) => void; onSave: () => void }) {
  return <section className="order-3 min-w-0 rounded-2xl border bg-card p-4 lg:col-start-9 lg:col-span-4 lg:row-start-2 lg:self-start lg:p-5"><div className="mb-4"><h2 className="text-base font-semibold">Manager review</h2><p className="mt-1 text-xs text-muted-foreground">Record the human review outcome. The batch remains active.</p></div><div className="space-y-3"><label className="block space-y-1.5 text-sm font-semibold"><span>Review status</span><NativeSelect value={reviewStatus} onChange={(event) => onReviewStatusChange(event.target.value as ManagerReviewStatus)}>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></label><label className="block space-y-1.5 text-sm font-semibold"><span>Next review date</span><Input type="date" min={todayIso()} value={nextReviewDate} onChange={(event) => onNextReviewDateChange(event.target.value)} /></label><label className="block space-y-1.5 text-sm font-semibold"><span>Notes</span><Textarea rows={3} value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="What should be checked in person?" /></label><Button className="h-12 w-full" onClick={onSave} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Saving…" : "Save manager review"}</Button></div></section>;
}

function SnapshotStatusPanel({ selected, onDownload }: { selected: SelectionReviewResponse; onDownload: () => void }) {
  return <section className="order-4 min-w-0 rounded-2xl border border-primary/20 bg-primary/5 p-4 lg:col-start-9 lg:col-span-4 lg:row-start-3 lg:self-start lg:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{selected.status === "FINALIZED" ? "Manager-reviewed snapshot" : `Saved snapshot v${selected.versionNumber}`}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selected.purpose ?? "Routine review"} · {formatDateTime(selected.generatedAt)}. Batch remains active.</p></div><Badge variant={selected.status === "FINALIZED" ? "default" : "secondary"}>{selected.status === "FINALIZED" ? "REVIEWED" : "SNAPSHOT"}</Badge></div>{selected.newerDataAvailable && <p className="mt-3 text-sm font-semibold text-warning-ink">Newer records are available.</p>}<Button variant="outline" className="mt-4 h-11 w-full" onClick={onDownload}><Download className="size-4" /> Download PDF</Button></section>;
}

function SavedVersionList({ reviews, isLoading, selectedId, onSelect }: { reviews: SelectionReviewResponse[]; isLoading: boolean; selectedId?: number; onSelect: (review: SelectionReviewResponse) => void }) {
  return <section className="order-5 min-w-0 lg:col-start-9 lg:col-span-4 lg:row-start-4 lg:self-start"><div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saved versions</h2>{reviews.length > 0 && <span className="text-xs text-muted-foreground">{reviews.length}</span>}</div>{isLoading && <div className="h-16 animate-pulse rounded-xl bg-muted" />}{!isLoading && reviews.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No saved reports yet.</p>}{reviews.length > 0 && <div className="divide-y overflow-hidden rounded-2xl border bg-card">{reviews.map((review) => { const current = selectedId === review.id; return <button type="button" key={review.id} onClick={() => onSelect(review)} aria-pressed={current} className={cn("flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60", current && "bg-primary/5")}><span className="min-w-0"><span className="block truncate text-sm font-semibold">Report v{review.versionNumber} · {formatDate(review.periodStart)} – {formatDate(review.periodEnd)}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{review.status === "FINALIZED" ? "Manager reviewed" : "Saved snapshot"} · {formatDateTime(review.generatedAt)}</span></span><Badge variant={review.status === "FINALIZED" ? "default" : "secondary"}>{review.status === "FINALIZED" ? "REVIEWED" : "SNAPSHOT"}</Badge></button>; })}</div>}</section>;
}

function groupProducts(items: SelectionReviewProductUse[]) {
  const groups = new Map<string, { label: string; type: string; count: number; quantity: number | null; unit: string | null; unitCost: number | null; cost: number | null }>();
  for (const item of items) {
    const key = `${item.productType}:${item.brandName}:${item.unit ?? ""}`;
    const current = groups.get(key) ?? { label: item.brandName, type: item.productType, count: 0, quantity: item.quantity == null ? null : 0, unit: item.unit, unitCost: item.unitCost == null ? null : item.unitCost, cost: item.calculatedCost == null ? null : 0 };
    current.count += 1;
    if (current.quantity != null && item.quantity != null) current.quantity += item.quantity;
    else current.quantity = null;
    if (current.cost != null && item.calculatedCost != null) current.cost += item.calculatedCost;
    else current.cost = null;
    if (current.unitCost != null && item.unitCost != null && Math.abs(current.unitCost - item.unitCost) > 0.000001) current.unitCost = null;
    else if (item.unitCost == null) current.unitCost = null;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{text}</p>; }

function PopulationReconciliationWarning({ message, className }: { message: string | null; className?: string }) {
  return <div role="alert" className={cn("flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2.5 text-sm text-warning-ink", className)}><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>{message ?? "Population records do not reconcile. Review the population event history."}</p></div>;
}
