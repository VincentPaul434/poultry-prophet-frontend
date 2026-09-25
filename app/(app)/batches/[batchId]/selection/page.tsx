"use client";

import { use, useRef, useState } from "react";
import { Download, FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";
import { PageBackLink } from "@/components/page-back-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime, todayIso } from "@/lib/format";
import { selectionReviewApi } from "@/lib/api";
import type { ManagerReviewStatus, SelectionReviewPayload, SelectionReviewResponse } from "@/lib/types";
import {
  useCreateSelectionReview,
  useFinalizeSelectionReview,
  useSelectionReviewPreview,
  useSelectionReviews,
} from "@/hooks/use-selection-review";

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
  const create = useCreateSelectionReview(batchId);
  const finalize = useFinalizeSelectionReview(batchId);
  const payload = selected?.payload ?? preview.data;

  async function generateSnapshot() {
    try {
      requestKey.current ??= typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await create.mutateAsync({
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        asOfDate: periodEnd || undefined,
        purpose,
        snapshotNote: snapshotNote.trim() || undefined,
        idempotencyKey: requestKey.current,
      });
      requestKey.current = null;
      setSelected(result); setPeriodStart(result.periodStart); setPeriodEnd(result.periodEnd); setReviewStatus(result.reviewStatus); setNotes(result.managerNotes ?? ""); setNextReviewDate(result.nextReviewDate ?? "");
      toast.success("Report snapshot saved — batch remains active");
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not generate the report"); }
  }

  async function finalizeSnapshot() {
    if (!selected) return;
    try {
      const result = await finalize.mutateAsync({ reviewId: selected.id, body: { reviewStatus, managerNotes: notes.trim() || null, nextReviewDate: nextReviewDate || null } });
      setSelected(result); toast.success("Manager review saved — batch remains active");
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not finalize the report"); }
  }

  async function downloadPdf() {
    if (!selected) return;
    try {
      const blob = await selectionReviewApi.pdf(batchId, selected.id);
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `selection-review-${batchId}-${selected.id}.pdf`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not download the PDF"); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <PageBackLink destination="batch" batchId={batchId} className="mb-2" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-semibold tracking-tight">Batch review report</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">A factual, traceable report for human review. It does not rank or automatically select birds.</p></div>
          <Badge variant={selected?.status === "FINALIZED" ? "default" : "secondary"}>{selected ? selected.status === "FINALIZED" ? "MANAGER REVIEWED" : `SAVED SNAPSHOT v${selected.versionNumber}` : "LIVE REPORT"}</Badge>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold">Report start<Input type="date" value={periodStart} onChange={(event) => { setSelected(null); setPeriodStart(event.target.value); }} /></label>
          <label className="space-y-1.5 text-sm font-semibold">Report as of<Input type="date" max={todayIso()} value={periodEnd} onChange={(event) => { setSelected(null); setPeriodEnd(event.target.value); }} /></label>
          {isManager && <label className="space-y-1.5 text-sm font-semibold">Why are you saving this report?<select className="h-11 w-full rounded-xl border bg-background px-3 text-base font-normal" value={purpose} onChange={(event) => setPurpose(event.target.value)}><option value="ROUTINE_REVIEW">Routine review</option><option value="SELECTION_REVIEW">Selection review</option><option value="CONSULTATION">Consultation</option><option value="STAKEHOLDER_VALIDATION">Stakeholder validation</option><option value="OTHER">Other</option></select></label>}
          {isManager && <label className="space-y-1.5 text-sm font-semibold">Manager note <Textarea rows={2} value={snapshotNote} onChange={(event) => setSnapshotNote(event.target.value)} placeholder="Optional context for this report" /></label>}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Leave dates blank for the batch start through today. Saving a snapshot does not close the batch or stop handler records.</p>
          {isManager ? <Button className="h-12 w-full sm:w-auto" onClick={generateSnapshot} disabled={create.isPending || !payload}>{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save report snapshot</Button> : <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">Read-only preview for handlers</p>}
        </div>
      </section>

      {preview.isLoading && <div className="h-56 animate-pulse rounded-2xl bg-muted" />}
      {preview.isError && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{preview.error instanceof ApiError ? preview.error.message : "Failed to load the report preview."}</p>}
      {payload && <ReportContent payload={payload} />}

      {isManager && selected && selected.status === "DRAFT" && <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5"><div><h2 className="font-semibold">Optional manager review</h2><p className="text-sm text-muted-foreground">You may record the human review outcome now or continue observation. This action does not close the batch.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-semibold">Review status<select className="h-11 w-full rounded-xl border bg-background px-3 text-base font-normal" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as ManagerReviewStatus)}>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-1.5 text-sm font-semibold">Next review date (optional)<Input type="date" min={todayIso()} value={nextReviewDate} onChange={(event) => setNextReviewDate(event.target.value)} /></label></div><label className="block space-y-1.5 text-sm font-semibold">Manager notes / reason<Textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What should be checked during in-person assessment?" /></label><Button className="h-12" onClick={finalizeSnapshot} disabled={finalize.isPending}>{finalize.isPending && <Loader2 className="size-4 animate-spin" />} Save manager review</Button></section>}

      {isManager && selected && <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div><p className="font-semibold">{selected.status === "FINALIZED" ? "Manager-reviewed snapshot" : `Saved snapshot v${selected.versionNumber}`}</p><p className="text-sm text-muted-foreground">{selected.purpose ?? "Routine review"} · Generated {formatDateTime(selected.generatedAt)}. The batch remains active and handlers may continue recording.</p>{selected.snapshotNote && <p className="mt-1 text-sm">Note: {selected.snapshotNote}</p>}{selected.newerDataAvailable && <p className="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-200">Newer records are available. Generate an updated report when ready.</p>}</div><Button variant="outline" onClick={downloadPdf}><Download className="size-4" /> Download PDF</Button></section>}

      <section className="space-y-3"><h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Saved report history</h2>{reviews.isLoading && <div className="h-16 animate-pulse rounded-xl bg-muted" />}{reviews.data?.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No saved report snapshots yet.</p>}{reviews.data?.map((review) => <button type="button" key={review.id} onClick={() => { setSelected(review); setPeriodStart(review.periodStart); setPeriodEnd(review.periodEnd); setPurpose(review.purpose ?? "ROUTINE_REVIEW"); setSnapshotNote(review.snapshotNote ?? ""); setReviewStatus(review.reviewStatus); setNotes(review.managerNotes ?? ""); setNextReviewDate(review.nextReviewDate ?? ""); }} className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left hover:border-primary/40"><span className="min-w-0"><span className="block truncate font-semibold">Report v{review.versionNumber} · {formatDate(review.periodStart)} – {formatDate(review.periodEnd)}</span><span className="mt-1 block text-xs text-muted-foreground">{review.status === "FINALIZED" ? "Manager reviewed" : "Saved snapshot"} · {review.purpose ?? "Routine review"} · Generated {formatDateTime(review.generatedAt)}</span></span><Badge variant={review.status === "FINALIZED" ? "default" : "secondary"}>{review.status === "FINALIZED" ? "REVIEWED" : "SNAPSHOT"}</Badge></button>)}</section>
    </div>
  );
}

function ReportContent({ payload }: { payload: SelectionReviewPayload }) {
  const p = payload.population;
  return <div className="space-y-4">
    <section className="rounded-2xl border bg-card p-4 sm:p-5"><div className="flex items-start gap-3"><FileText className="mt-0.5 size-5 shrink-0 text-primary" /><div><h2 className="font-semibold">{payload.reportTitle}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{payload.disclaimer}</p><p className="mt-2 text-xs text-muted-foreground">As of {formatDate(payload.asOfDate)} · {formatDate(payload.periodStart)} – {formatDate(payload.periodEnd)}</p></div></div></section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Fact label="Population" value={payload.batch.currentPopulationDisplay} detail={`${payload.batch.stageName.replace("-", " ")} · ${payload.batch.ageDays} days`} /><Fact label="Health-related deaths" value={String(p.healthRelatedDeaths)} detail={p.healthRelatedLossPercentage == null ? "Rate unavailable" : `${p.healthRelatedLossPercentage}% of initial`} /><Fact label="Health events" value={String(payload.healthEvents.length)} detail="Recorded only" /><Fact label="Product use" value={String(payload.productUse.length)} detail="Recorded interventions" /></section>
    <ReportSection title="Population-change summary" open><p className="text-xs text-muted-foreground">Categories are kept separate; they are not all called mortality.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(p.categoryCounts).map(([key, value]) => <div key={key} className="rounded-xl border p-3"><p className="text-xs capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Current population: {p.currentPopulation} / {p.initialPopulation}.</p></ReportSection>
    <ReportSection title={`Health-event history (${payload.healthEvents.length})`}>{payload.healthEvents.length === 0 ? <Empty text="No health observations or health-related events were recorded in this period." /> : <div className="space-y-2">{payload.healthEvents.map((event) => <div key={event.sourceEventId} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{event.title}</p><span className="text-xs text-muted-foreground">{formatDate(event.eventDate)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.eventType.replaceAll("_", " ")} · {event.affectedCount} affected · {event.severity ?? "No severity recorded"}</p>{event.details && <p className="mt-2 text-sm">{event.details}</p>}</div>)}</div>}</ReportSection>
    <ReportSection title={`Product-use history (${payload.productUse.length})`}>{payload.productUse.length === 0 ? <Empty text="No product-use record was found in this period." /> : <div className="space-y-2">{payload.productUse.map((item) => <div key={item.sourceId} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{item.brandName}{item.productName ? ` · ${item.productName}` : ""}</p><span className="text-xs text-muted-foreground">{formatDate(item.recordedAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.productType} · {item.quantity == null ? "Quantity not measured" : `${item.quantity} ${item.unit ?? ""}`} {item.purpose ? `· ${item.purpose}` : ""}</p></div>)}</div>}</ReportSection>
    {payload.incubation && <ReportSection title="Incubation context"><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Fact label="Cycle" value={payload.incubation.cycleName} detail={payload.incubation.incubatorCode} /><Fact label="Eggs loaded" value={String(payload.incubation.eggsLoaded)} detail={formatDate(payload.incubation.loadedDate)} /><Fact label="Hatched" value={payload.incubation.hatchedCount == null ? "—" : String(payload.incubation.hatchedCount)} detail={payload.incubation.hatchRate == null ? "Rate unavailable" : `${payload.incubation.hatchRate}%`} /><Fact label="Unhatched / damaged" value={`${payload.incubation.unhatchedCount ?? "—"} / ${payload.incubation.removedDamagedCount ?? "—"}`} detail="Recorded counts" /></div><p className="mt-3 text-xs text-muted-foreground">{payload.incubation.limitation}</p></ReportSection>}
    {payload.finance && <ReportSection title="Recorded batch finance"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Fact label="Income" value={`₱${Number(payload.finance.recordedIncome).toLocaleString()}`} detail="Posted records" /><Fact label="Expense" value={`₱${Number(payload.finance.recordedExpense).toLocaleString()}`} detail="Posted records" /><div className="col-span-2 sm:col-span-1"><Fact label="Net cash flow" value={`₱${Number(payload.finance.recordedNetCashFlow).toLocaleString()}`} detail="Not accounting profit" /></div></div><p className="mt-3 text-xs text-muted-foreground">{payload.finance.limitation}</p></ReportSection>}
    <ReportSection title="Data availability and limitations"><div className="space-y-2">{payload.dataAvailability.map((item) => <div key={item.section} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3"><div><p className="font-semibold">{item.section}</p><p className="mt-1 text-xs text-muted-foreground">{item.message}</p></div><Badge variant={item.status === "NO_RECORDS" ? "secondary" : "outline"}>{item.status.replaceAll("_", " ")} · {item.recordCount}</Badge></div>)}</div></ReportSection>
  </div>;
}

function ReportSection({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return <details open={open} className="group rounded-2xl border bg-card"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:px-5"><span>{title}</span><span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span></summary><div className="border-t px-4 pb-5 pt-4 sm:px-5">{children}</div></details>;
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="min-w-0 rounded-xl border bg-card p-3"><p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-bold">{value}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{text}</p>; }
