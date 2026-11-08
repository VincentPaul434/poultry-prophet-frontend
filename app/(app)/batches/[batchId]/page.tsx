"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FileText, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { useBatchOverview, useReconcileBatchPopulation } from "@/hooks/use-batches";
import { useAcknowledgeAlert } from "@/hooks/use-analytics";
import { useBatchEvents } from "@/hooks/use-events";
import { useFarmInputPage } from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Alert, FarmInputLog, InputProductType, PageResponse, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageBackLink } from "@/components/page-back-link";
import { getEventLogHref, getLoggingHref, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { SelectionReviewSummary } from "@/components/selection-review-summary";
import { SelectionSessionDialog } from "@/components/selection-session-dialog";
import { BatchLifecycleActions } from "@/components/batch-lifecycle-actions";
import { VaccinationPlanCard } from "@/components/vaccination-plan-card";

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

function BatchFact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 bg-card/80 px-3 py-3 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold tabular-nums sm:text-base" title={value}>{value}</p>
      {note && <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={note}>{note}</p>}
    </div>
  );
}

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const { isManager } = useAuth();
  const { t } = useLocale();
  const { data, isLoading, isError, error } = useBatchOverview(batchId);
  const reconcilePopulation = useReconcileBatchPopulation();
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-4">
      <PageBackLink destination="dashboard" />

      <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
        <div className="p-4 pt-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight sm:text-3xl" title={batch.name}>{batch.name}</h1>
                  <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>{batch.status}</Badge>
                  {activeAlerts.length > 0 && <Badge variant="outline" className="border-warning-border bg-warning-muted text-warning-ink"><AlertTriangle className="size-3" />{activeAlerts.length} alert{activeAlerts.length === 1 ? "" : "s"}</Badge>}
                </div>
                {batch.populationStatus === "RECONCILIATION_REQUIRED" && batch.populationWarning && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-warning-border bg-warning-muted px-3 py-2">
                    <AlertTriangle className="size-4 shrink-0 text-warning-ink" aria-hidden="true" />
                    <p className="max-w-2xl text-xs font-medium text-warning-ink">{batch.populationWarning}</p>
                    {isManager && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-warning-border px-2.5 text-xs"
                        disabled={reconcilePopulation.isPending}
                        onClick={() => reconcilePopulation.mutate(batch.id, {
                          onSuccess: () => toast.success("Population count reconciled from the event history."),
                          onError: (reconcileError) => toast.error(reconcileError instanceof ApiError ? reconcileError.message : "Could not reconcile the population count."),
                        })}
                      >
                        {reconcilePopulation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                        Reconcile count
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <Button
                className="h-11 shrink-0 rounded-xl px-3 font-semibold sm:px-4"
                aria-label={`${t("batch.reviewReport")} for ${batch.name}`}
                render={<Link href={`/batches/${batch.id}/selection`} />}
              >
                <FileText className="size-4" />
                <span className="sm:hidden">{t("batch.report")}</span>
                <span className="hidden sm:inline">{t("batch.reviewReport")}</span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {!isManager && batch.status !== "ARCHIVED" && <Button className="hidden min-h-11 rounded-xl md:inline-flex" render={<Link href={getLoggingHref(batch.id, LOGGING_ORIGINS.batch, true)} />}><ClipboardList className="size-4" />Mag-record</Button>}
              {isManager && <BatchLifecycleActions batch={batch} />}
              <div className="flex min-w-44 items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current stage</p>
                  <p className="mt-0.5 text-sm font-bold capitalize text-primary">{batch.stageName.replace("-", " ")}</p>
                </div>
                <span className="rounded-full bg-card px-2.5 py-1 text-xs font-bold tabular-nums text-primary shadow-sm">D{days}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border/70 sm:grid-cols-4">
            <BatchFact label="Population" value={batch.populationStatus === "RECONCILIATION_REQUIRED" ? `— / ${batch.initialPopulation}` : `${batch.currentPopulation} / ${batch.initialPopulation}`} note="Current / initial" />
            <BatchFact label="Bloodline" value={batch.bloodline || "Not recorded"} />
            <BatchFact label="Hatch date" value={formatDate(hatchDate)} />
            <BatchFact label="Farm entry" value={batch.farmEntryDate ? formatDate(batch.farmEntryDate) : "Not recorded"} />
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

      {isManager && batch.status !== "ARCHIVED" && <SelectionSessionDialog batchId={batch.id} batchName={batch.name} currentPopulation={batch.currentPopulation} />}

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="size-4" aria-hidden="true" /></span>
          <div><h2 className="text-base font-bold">Batch activity</h2></div>
        </div>
        <div className={cn("grid min-w-0 gap-4", activeAlerts.length > 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]")}>
          <main className="grid min-w-0 gap-4 xl:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="size-4" /></span><h3 className="font-bold">Recent events</h3></div>
              <Link href={getEventLogHref(batch.id)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:underline underline-offset-4">
                Event log<ChevronRight className="size-3.5" />
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
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="size-4" /></span><h3 className="font-bold">Products used</h3></div>
              <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0 rounded-lg text-xs" onClick={() => setProductsOpen(true)}>
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
