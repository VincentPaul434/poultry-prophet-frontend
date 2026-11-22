"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FileText, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { useBatchOverview, useUpdateBatchDerbyDate } from "@/hooks/use-batches";
import { useAcknowledgeAlert } from "@/hooks/use-analytics";
import { useBatchEvents } from "@/hooks/use-events";
import { useFarmInputPage } from "@/hooks/use-operations";
import { useSelectionSessions } from "@/hooks/use-selection-sessions";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Alert, Batch, FarmInputLog, InputProductType, PageResponse, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageBackLink } from "@/components/page-back-link";
import { getEventLogHref, getLoggingHref, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { SelectionReviewSummary } from "@/components/selection-review-summary";
import { BatchLifecycleActions } from "@/components/batch-lifecycle-actions";
import { VaccinationPlanCard } from "@/components/vaccination-plan-card";
import { PopulationReconciliationReview } from "@/components/population-reconciliation-review";

function daysElapsed(startDate: string) {
  return Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000));
}

const severityConfig: Record<Severity, { label: string; cls: string }> = {
  INFO: { label: "Info", cls: "border-border bg-muted/40" },
  WARNING: { label: "Warning", cls: "border-warning-border bg-warning-muted text-warning-ink" },
  CRITICAL: { label: "Critical", cls: "border-destructive/30 bg-destructive/5 text-destructive" },
};

function AlertItem({ batchId, alert, canAck }: { batchId: number; alert: Alert; canAck: boolean }) {
  const acknowledge = useAcknowledgeAlert(batchId);
  const cfg = severityConfig[alert.severity];
  return (
    <div className={cn("rounded-xl border p-3", cfg.cls)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-2 size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide">{cfg.label}</span>
            <span className="text-[11px] text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
          </div>
          <p className="text-sm leading-snug">{alert.message}</p>
          {canAck && (
            <Button size="sm" variant="outline" className="mt-1 h-10 w-full rounded-lg text-sm font-semibold" disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutateAsync({ id: alert.id }).then(() => toast.success("Alert acknowledged")).catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed"))}>
              {acknowledge.isPending && <Loader2 className="size-3 animate-spin" />}
              Mark as seen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchFact({ label, value, note, className }: { label: string; value: string; note?: string; className?: string }) {
  return (
    <div className={cn("min-w-0 bg-card/80 px-3 py-3 sm:px-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold tabular-nums sm:text-base" title={value}>{value}</p>
      {note && <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={note}>{note}</p>}
    </div>
  );
}

function DerbyDateFact({ batch }: { batch: Batch }) {
  const { t } = useLocale();
  const updateDerbyDate = useUpdateBatchDerbyDate();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(batch.derbyDate ?? "");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateDerbyDate.mutateAsync({ batchId: batch.id, derbyDate: date || null });
      toast.success(t("batch.derbyDateSaved"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the derby date.");
    }
  }

  return (
    <div className="min-w-0 bg-card/80 px-3 py-3 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("batch.derbyDate")}</p>
      <p className="mt-1 truncate text-sm font-bold tabular-nums sm:text-base">{batch.derbyDate ? formatDate(batch.derbyDate) : "Not recorded"}</p>
      {batch.status !== "ARCHIVED" && (
        <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setDate(batch.derbyDate ?? ""); }}>
          <DialogTrigger render={<Button type="button" variant="link" className="h-auto min-h-9 px-0 text-xs" />}>
            {t("batch.derbyDateEdit")}
          </DialogTrigger>
          <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
            <form className="space-y-4" onSubmit={save}>
              <DialogHeader><DialogTitle>{t("batch.derbyDateEdit")}</DialogTitle><DialogDescription>{t("batch.derbyDateHint")}</DialogDescription></DialogHeader>
              <div className="space-y-2"><Label htmlFor="edit-derby-date">{t("batch.derbyDate")} ({t("common.optional")})</Label><Input id="edit-derby-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={updateDerbyDate.isPending}>{updateDerbyDate.isPending && <Loader2 className="size-4 animate-spin" />}{t("common.save")}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const { isManager } = useAuth();
  const { t } = useLocale();
  const { data, isLoading, isError, error } = useBatchOverview(batchId);
  const selectionSessions = useSelectionSessions(batchId, isManager && data?.batch.status !== "ARCHIVED");
  const { data: recentEvents } = useBatchEvents(batchId, 3);
  const [productsOpen, setProductsOpen] = useState(false);
  const [productHistoryPage, setProductHistoryPage] = useState(0);
  const [productHistoryType, setProductHistoryType] = useState<"ALL" | InputProductType>("ALL");
  const { data: recentInputPage, isLoading: recentInputsLoading } = useFarmInputPage({ page: 0, size: 4, batchId: Number(batchId) }, true);
  const { data: productHistory, isLoading: productHistoryLoading } = useFarmInputPage(
    { page: productHistoryPage, size: 10, batchId: Number(batchId), productType: productHistoryType === "ALL" ? undefined : productHistoryType },
    productsOpen,
  );
  const recentInputs = recentInputPage?.items ?? [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <PageBackLink destination="dashboard" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <PageBackLink destination="dashboard" />
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load batch."}
          </p>
        </div>
      </div>
    );
  }

  const { batch, activeAlerts } = data;
  const hatchDate = batch.hatchDate ?? batch.startDate;
  const days = daysElapsed(hatchDate);
  const activeSelectionDraft = selectionSessions.data?.find(
    (session) => session.status === "DRAFT" && session.selectionReviewId != null,
  );
  const reviewHref = activeSelectionDraft
    ? `/batches/${batch.id}/selection?reviewId=${activeSelectionDraft.selectionReviewId}`
    : `/batches/${batch.id}/selection`;
  const reviewActionLabel = activeSelectionDraft ? "Continue review" : t("batch.reviewReport");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-4">
      <PageBackLink destination="dashboard" />

      <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
        <div className="p-4 pt-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="min-w-0 text-xl font-bold tracking-tight [overflow-wrap:anywhere] min-[375px]:text-2xl sm:text-3xl">{batch.name}</h1>
                  <div aria-label={`Current stage: ${batch.stageName.replace("-", " ")}, day ${days}`} className="inline-flex max-w-full items-center gap-1 rounded-xl border border-primary/20 bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary sm:gap-2 sm:px-2.5">
                    <span className="min-w-0 capitalize [overflow-wrap:anywhere]">{batch.stageName.replace("-", " ")}</span>
                    <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 tabular-nums">D{days}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>{batch.status}</Badge>
                  {activeAlerts.length > 0 && <Badge variant="outline" className="border-warning-border bg-warning-muted text-warning-ink"><AlertTriangle className="size-3" />{activeAlerts.length} alert{activeAlerts.length === 1 ? "" : "s"}</Badge>}
                </div>
                {batch.populationStatus === "RECONCILIATION_REQUIRED" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2">
                    <AlertTriangle className="size-4 shrink-0 text-warning-ink" aria-hidden="true" />
                    <p className="max-w-2xl text-xs font-medium text-warning-ink">{batch.populationWarning ?? "Population records need review before the current count can be verified."}</p>
                    {isManager ? <PopulationReconciliationReview batchId={batch.id} /> : <Link href={getEventLogHref(batch.id)} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{t("population.history")}</Link>}
                  </div>
                )}
              </div>
              <div className={cn("ml-auto flex max-w-full items-center justify-end gap-1.5 sm:gap-2", batch.status === "ARCHIVED" && "flex-wrap")}>
                {!isManager && batch.status !== "ARCHIVED" && <Link className={cn(buttonVariants(), "hidden min-h-11 rounded-xl md:inline-flex")} href={getLoggingHref(batch.id, LOGGING_ORIGINS.batch, true)}><ClipboardList className="size-4" />Mag-record</Link>}
                {isManager && <BatchLifecycleActions batch={batch} />}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {activeSelectionDraft && <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">Draft</Badge>}
                  <Link
                    className={cn(buttonVariants(), "h-11 rounded-xl px-2 font-semibold sm:px-4")}
                    aria-label={`${reviewActionLabel} for ${batch.name}`}
                    href={reviewHref}
                  >
                    <FileText className="hidden size-4 sm:block" />
                    <span className="sm:hidden">{activeSelectionDraft ? "Continue" : t("batch.report")}</span>
                    <span className="hidden sm:inline">{reviewActionLabel}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className={cn("mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border/70", batch.derbyDate !== undefined ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
            <BatchFact label="Bloodline" value={batch.bloodline || "Not recorded"} />
            <BatchFact label="Hatch date" value={formatDate(hatchDate)} />
            <BatchFact className={batch.derbyDate === undefined ? "col-span-2 sm:col-span-1" : undefined} label="Farm entry" value={batch.farmEntryDate ? formatDate(batch.farmEntryDate) : "Not recorded"} />
            {batch.derbyDate !== undefined && <DerbyDateFact batch={batch} />}
          </div>
        </div>
      </header>

      {batch.status === "ARCHIVED" && <div role="status" className="flex items-start gap-2 rounded-2xl border border-warning-border bg-warning-muted px-4 py-3 text-sm text-warning-ink"><span className="mt-2 size-2 shrink-0 rounded-full bg-current" aria-hidden="true" /><p><strong>Archived batch.</strong> Records are read-only. Restore the batch before adding new logs, expenses, products, tasks, or selection sessions.</p></div>}

      {/* Keep the schedule beside the batch identity. Managers can set it immediately;
          handlers can see the next dated step before recording work. */}
      {batch.status !== "ARCHIVED" && <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5"><VaccinationPlanCard batch={batch} canEditSchedule /></section>}


      <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <SelectionReviewSummary batch={batch} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="size-4" aria-hidden="true" /></span>
          <div><h2 className="text-base font-bold">Batch activity</h2></div>
        </div>
        <div className={cn("grid min-w-0 gap-4", activeAlerts.length > 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]")}>
          <main className="grid min-w-0 gap-4 xl:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b px-4 py-3.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
              <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="size-4" /></span><h3 className="font-bold">Recent events</h3></div>
              <Link href={getEventLogHref(batch.id)} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 w-full shrink-0 rounded-xl border-primary/25 bg-primary/5 px-3 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary min-[420px]:w-auto")}>
                Event log<ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            {recentEvents && recentEvents.length > 0 ? (
              <div>
                {recentEvents.slice(0, 3).map((ev, idx) => (
                  <div key={ev.id} className={cn("flex items-start gap-3 px-4 py-3", idx !== 0 && "border-t")}>
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarDays className="size-3.5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{ev.title}</p>{ev.affectedCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">{ev.affectedCount} bird{ev.affectedCount !== 1 ? "s" : ""}</span>}</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ev.handlerName} · {formatDate(ev.eventDate)}</p>
                      {ev.eventType === "SALE" && ev.saleAmount != null && <p className="mt-0.5 text-xs font-semibold text-success">Sale proceeds: ₱{Number(ev.saleAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="m-4 rounded-2xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">No events yet.</div>
            )}
          </section>

          <section className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b px-4 py-3.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
              <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="size-4" /></span><h3 className="font-bold">Products used</h3></div>
              <Button type="button" variant="outline" className="min-h-11 w-full shrink-0 rounded-xl px-3 text-sm font-semibold min-[420px]:w-auto" onClick={() => setProductsOpen(true)}>
                View all{recentInputPage?.totalItems != null ? ` (${recentInputPage.totalItems})` : ""}<ChevronRight className="size-3.5" />
              </Button>
            </div>
            {recentInputsLoading ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading product history…</div>
            ) : recentInputs.length > 0 ? (
              <div>
                {recentInputs.map((input, index) => (
                  <ProductHistoryRow key={input.id} input={input} isManager={isManager} first={index === 0} />
                ))}
              </div>
            ) : (
              <div className="m-4 rounded-2xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">No products yet.</div>
            )}
          </section>
        </main>

          {activeAlerts.length > 0 && <aside className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm"><h3 className="mb-3 flex items-center gap-2 font-bold"><span className="flex size-8 items-center justify-center rounded-lg bg-warning-muted text-warning-ink"><AlertTriangle className="size-4" /></span>{activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""}</h3><div className="space-y-2">{activeAlerts.map((alert) => <AlertItem key={alert.id} batchId={batch.id} alert={alert} canAck={isManager} />)}</div></aside>}
        </div>
      </section>
      <ProductHistorySheet
        open={productsOpen}
        onOpenChange={(open) => {
          setProductsOpen(open);
          if (!open) setProductHistoryPage(0);
        }}
        data={productHistory}
        isLoading={productHistoryLoading}
        page={productHistoryPage}
        onPageChange={setProductHistoryPage}
        productType={productHistoryType}
        onProductTypeChange={(value) => {
          setProductHistoryType(value);
          setProductHistoryPage(0);
        }}
        isManager={isManager}
        batchName={batch.name}
      />
    </div>
  );
}

function ProductHistoryRow({ input, isManager, first = false }: { input: FarmInputLog; isManager: boolean; first?: boolean }) {
  const quantity = input.quantity == null ? "—" : `${input.quantity} ${input.unit ?? "unit"}`;
  const cost = input.calculatedCost != null
    ? `₱${Number(input.calculatedCost).toLocaleString()}`
    : input.farmProductId ? "Cost unavailable" : null;

  return (
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3", !first && "border-t")}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><Package className="size-4" /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{input.brandName}</p>
        <p className="truncate text-xs capitalize text-muted-foreground">{input.productType.toLowerCase()} · {formatDateTime(input.recordedAt)}</p>
        <p className={cn("truncate text-[11px]", input.pendingSync ? "font-medium text-warning-ink" : "text-muted-foreground")}>#{input.recordedBy}{input.pendingSync ? " · Waiting to sync" : " · Saved"}</p>
      </div>
      <div className="max-w-28 shrink-0 text-right"><p className="truncate text-sm font-bold tabular-nums" title={input.quantity == null ? "Amount not recorded" : quantity}>{quantity}</p>{isManager && cost && <p className="truncate text-[11px] text-muted-foreground" title={cost}>{cost}</p>}</div>
    </div>
  );
}

function ProductHistorySheet({
  open,
  onOpenChange,
  data,
  isLoading,
  page,
  onPageChange,
  productType,
  onProductTypeChange,
  isManager,
  batchName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PageResponse<FarmInputLog> | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  productType: "ALL" | InputProductType;
  onProductTypeChange: (value: "ALL" | InputProductType) => void;
  isManager: boolean;
  batchName: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(94vw,34rem)] p-0">
        <SheetHeader className="border-b px-5 py-5 pr-12">
          <SheetTitle>Products used</SheetTitle>
          <SheetDescription>{batchName} · complete product history</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <NativeSelect aria-label="Filter products by type" value={productType} onChange={(event) => onProductTypeChange(event.target.value as "ALL" | InputProductType)}>
            <option value="ALL">All product types</option>
            <option value="FEED">Feed</option>
            <option value="VITAMIN">Vitamin</option>
            <option value="MEDICINE">Medicine</option>
            <option value="VACCINE">Vaccine</option>
            <option value="OTHER">Other</option>
          </NativeSelect>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {isLoading && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Loading product history…</p>}
            {!isLoading && data?.items.map((input, index) => <ProductHistoryRow key={input.id} input={input} isManager={isManager} first={index === 0} />)}
            {!isLoading && (data?.items.length ?? 0) === 0 && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No products match this filter.</p>}
          </div>
          {!isLoading && data && data.totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
              <span>{data.totalItems} records</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="min-h-9" disabled={!data.hasPrevious} onClick={() => onPageChange(Math.max(0, page - 1))}>
                  <ChevronLeft className="size-4" aria-hidden="true" />Previous
                </Button>
                <span>Page {data.page + 1} of {data.totalPages}</span>
                <Button type="button" variant="outline" size="sm" className="min-h-9" disabled={!data.hasNext} onClick={() => onPageChange(page + 1)}>
                  Next<ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
