"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArchiveRestore,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useArchivedBatches, useCreateBatch, useDashboardBatches, useRestoreBatch } from "@/hooks/use-batches";
import { useHandlerTaskQueueSummary, useTaskQueue, useTaskSummary } from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, isFutureDate, todayIso } from "@/lib/format";
import type { BatchDashboardItem, TaskSummaryResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingInvitesBanner } from "@/components/pending-invites-banner";
import { FarmOnboardingBanner } from "@/components/farm-onboarding-banner";
import { getLoggingHref, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { useLocale } from "@/components/locale-provider";
import { BatchMetricStrip, type BatchMetricStripItem } from "@/components/dashboard/batch-metric-strip";
import { PageContainer, PageHeader } from "@/components/page-header";
import { formatTaskDeadline } from "@/components/tasks/handler-task-ui";
import { ArchivedBatchDeleteAction } from "@/components/archived-batch-delete-action";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function daysElapsed(startDate: string) {
  return Math.max(
    0,
    Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000)
  );
}

function stageColor(stageName: string): string {
  const s = stageName.toLowerCase();
  if (s.includes("brood")) return "ledger-stage-warning";
  if (s.includes("rang") || s.includes("grow")) return "ledger-stage-success";
  if (s.includes("select") || s.includes("pre")) return "ledger-stage-primary";
  return "ledger-stage-primary";
}

function stageDisplayName(stageName: string): string {
  const labels: Record<string, string> = {
    brooding: "Brooding",
    ranging: "Ranging",
    "pre-conditioning": "Pre-conditioning",
    maintenance: "Maintenance",
    conditioning: "Conditioning",
  };
  return labels[stageName.toLowerCase()] ?? stageName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const PAGE_SIZE = 6;

function batchNeedsAttention({ batch, summary }: BatchDashboardItem) {
  return batch.populationStatus === "RECONCILIATION_REQUIRED" || summary.activeAlertCount > 0;
}

export default function DashboardPage() {
  const { isManager, user } = useAuth();
  const { t } = useLocale();
  const { data: dashboardItems, isLoading, isError, error } = useDashboardBatches();
  const { data: archivedBatches } = useArchivedBatches(isManager);
  const handlerTaskQueue = useTaskQueue("NOW", !isManager);
  const { data: handlerTaskSummary } = useHandlerTaskQueueSummary(!isManager);
  const { data: taskSummary } = useTaskSummary({}, Boolean(user?.farmId));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const filteredBatches = (dashboardItems ?? []).filter(({ batch }) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [batch.name, batch.bloodline, batch.source]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query));
    const matchesStage = stageFilter === "all" || batch.stageName === stageFilter;
    return matchesSearch && matchesStage;
  });
  const visibleBatches = filteredBatches.slice(0, visibleCount);
  const openTasks = handlerTaskQueue.data?.pages.flatMap((page) => page.items).slice(0, 2) ?? [];
  const taskCount = handlerTaskSummary?.now ?? handlerTaskQueue.data?.pages[0]?.totalItems ?? 0;
  const activeBatchCount = (dashboardItems ?? []).filter(({ batch }) => batch.status === "ACTIVE").length;
  const needsAttention = visibleBatches.filter(batchNeedsAttention);
  const allGood = visibleBatches.filter((item) => !batchNeedsAttention(item));
  const needsAttentionCount = dashboardItems ? dashboardItems.filter(batchNeedsAttention).length : null;
  const openTaskCount = taskSummary?.open ?? null;

  return (
    <PageContainer className="space-y-5 sm:space-y-10">
      <PageHeader
        data-testid="dashboard-sticky-header"
        title={t("dashboard.pageTitle")}
        variant="ledger"
        description={dashboardItems ? `${t("dashboard.activeBatches")}: ${activeBatchCount}` : t("dashboard.loadingBatches")}
        action={<CreateBatchDialog className="w-full sm:w-auto" />}
      />

      {dashboardItems && dashboardItems.length > 0 && (
        <div className="ledger-toolbar flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
          <div className="ledger-search relative min-w-0 border border-foreground/10 transition-colors focus-within:border-ring/60 sm:w-64 sm:flex-none lg:w-72">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span id="dashboard-search-help" className="sr-only">{t("dashboard.searchHelp")}</span>
            <Input
              aria-describedby="dashboard-search-help"
              aria-label={t("dashboard.searchLabel")}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder={t("dashboard.searchPlaceholder")}
              className="min-h-11 rounded-full border-0 bg-transparent pl-11 pr-4 shadow-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <NativeSelect aria-label={t("dashboard.filterLabel")} value={stageFilter} onChange={(event) => { setStageFilter(event.target.value); setVisibleCount(PAGE_SIZE); }} className="ledger-filter w-full sm:w-44" selectClassName="h-11 rounded-full border-0 bg-[var(--ledger-card)] px-3 pr-9 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/40"><option value="all">{t("dashboard.allStages")}</option>{Array.from(new Set(dashboardItems.map(({ batch }) => batch.stageName))).map((stage) => <option key={stage} value={stage}>{stageDisplayName(stage)}</option>)}</NativeSelect>
        </div>
      )}

      <DashboardSummaryStrip
        needsAttentionCount={needsAttentionCount}
        openTaskCount={openTaskCount}
      />

      <FarmOnboardingBanner />
      <PendingInvitesBanner />

      {!isManager && taskCount > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="dashboard-today-tasks">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h2 id="dashboard-today-tasks" className="text-sm font-bold">{t("dashboard.todayTasks")}</h2>
            <Badge variant="secondary" className="tabular-nums">{taskCount}</Badge>
          </div>
          <div className="divide-y border-t">
            {openTasks.map((task) => {
              const deadline = formatTaskDeadline(task, t("dashboard.overdue"), t("dashboard.today"), t("dashboard.noDueDate"));
              return (
                <Link
                  key={task.id}
                  href={`/tasks?taskId=${task.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/60"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", task.overdue ? "bg-warning" : "bg-primary")} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{task.title}</span>
                    <span className={cn("block truncate text-xs", task.overdue ? "font-medium text-warning-ink" : "text-muted-foreground")}>{deadline}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
          <Link href="/tasks" className="flex min-h-11 items-center px-4 text-sm font-semibold text-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/60">
            {t("dashboard.viewAllTasks")}
          </Link>
        </section>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t("dashboard.loadError")}</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : t("dashboard.loadErrorHint")}
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {dashboardItems && dashboardItems.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-14">
            <div className="text-5xl">🐔</div>
            <CardTitle className="text-base">
              {user?.farmId == null ? t("dashboard.joinFarm") : t("dashboard.noBatches")}
            </CardTitle>
            <CardDescription>
              {user?.farmId == null
                ? t("dashboard.joinFarmHint")
                : t("dashboard.noBatchesHint")}
            </CardDescription>
            <CreateBatchDialog variant="inline" />
          </CardContent>
        </Card>
      )}

      {/* Batch cards */}
      {dashboardItems && dashboardItems.length > 0 && (
        <div className="space-y-5">
          {visibleBatches.length === 0 && (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {t("dashboard.noMatches")}
              </CardContent>
            </Card>
          )}
          {needsAttention.length > 0 && <section aria-labelledby="needs-attention-heading" className="space-y-3 sm:space-y-4"><h2 id="needs-attention-heading" className="ledger-section-heading">Needs attention</h2><div className="grid gap-4 sm:grid-cols-2">{needsAttention.map((item) => <BatchCard key={item.batch.id} item={item} isManager={isManager} />)}</div></section>}
          {allGood.length > 0 && <section aria-labelledby="no-batch-alerts-heading" className="space-y-3 sm:space-y-4"><h2 id="no-batch-alerts-heading" className="ledger-section-heading">No active alerts or count issues</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{allGood.map((item) => <BatchCard key={item.batch.id} item={item} isManager={isManager} />)}</div></section>}
          {visibleCount < filteredBatches.length && (
            <div className="flex justify-center border-t pt-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-xl"
                onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
              >
                {t("dashboard.showMore")}
              </Button>
            </div>
          )}
        </div>
      )}

      {isManager && archivedBatches && archivedBatches.length > 0 && <ArchivedBatches batches={archivedBatches} />}
    </PageContainer>
  );
}

function DashboardSummaryStrip({
  needsAttentionCount,
  openTaskCount,
}: {
  needsAttentionCount: number | null;
  openTaskCount: number | null;
}) {
  const items = [
    { label: "Needs attention", value: needsAttentionCount, icon: AlertTriangle, iconClassName: "text-warning" },
    { label: "Open tasks", value: openTaskCount, icon: ClipboardCheck, iconClassName: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Dashboard summary" data-testid="dashboard-summary">
      {items.map(({ label, value, icon: Icon, iconClassName }) => (
        <div key={label} className="grid min-h-20 min-w-0 grid-cols-[minmax(0,1fr)_auto] content-between gap-x-2 gap-y-1 rounded-xl bg-primary/5 px-3 py-3 sm:px-4">
          <p className="min-w-0 text-sm font-semibold leading-4 [overflow-wrap:anywhere]">{label}</p>
          <Icon className={cn("size-5 shrink-0 sm:size-6", iconClassName)} strokeWidth={1.8} aria-hidden="true" />
          <p className="col-span-2 text-2xl font-bold leading-none tabular-nums">{value == null ? "—" : formatCount(value)}</p>
        </div>
      ))}
    </div>
  );
}

function ArchivedBatches({ batches }: { batches: import("@/lib/types").Batch[] }) {
  const restore = useRestoreBatch();
  return <section className="space-y-3 border-t pt-5">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Archived batches</h2><p className="mt-0.5 text-xs text-muted-foreground">History is kept and read-only until restored.</p></div><Badge variant="secondary">{batches.length}</Badge></div>
    <div className="space-y-2">{batches.map((batch) => <div key={batch.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><Link href={`/batches/${batch.id}`} className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"><p className="truncate text-sm font-semibold">{batch.name}</p><p className="mt-1 text-xs text-muted-foreground">Archived {batch.archivedAt ? formatDate(batch.archivedAt) : "date unavailable"}{batch.archiveReason ? ` · ${batch.archiveReason}` : ""}</p></Link><div className="flex flex-wrap gap-2"><Link href={`/batches/${batch.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 rounded-xl")}>View records</Link><Button type="button" size="sm" className="min-h-11 rounded-xl" disabled={restore.isPending} onClick={() => restore.mutateAsync(batch.id).then(() => toast.success("Batch restored.")).catch((error) => toast.error(error instanceof ApiError ? error.message : "Could not restore this batch."))}><ArchiveRestore className="size-4" />Restore</Button><ArchivedBatchDeleteAction batch={batch} /></div></div>)}</div>
  </section>;
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function alertAttentionText(
  severity: "INFO" | "WARNING" | "CRITICAL",
  count: number,
  t: ReturnType<typeof useLocale>["t"],
) {
  const label = severity === "CRITICAL"
    ? t("dashboard.critical")
    : severity === "WARNING"
      ? t("dashboard.warning")
      : t("dashboard.info");
  return `${label} · ${count} ${t("dashboard.activeAlerts")}`;
}

function BatchCard({ item, isManager }: { item: BatchDashboardItem; isManager: boolean }) {
  const { user } = useAuth();
  const { data, isError } = useTaskSummary({ batchId: item.batch.id }, Boolean(user?.farmId));
  return isManager
    ? <ManagerBatchCard item={item} taskSummary={data} taskSummaryError={isError} />
    : <HandlerBatchCard item={item} taskSummary={data} taskSummaryError={isError} />;
}

function BatchCardHeader({ item }: { item: BatchDashboardItem }) {
  const { t } = useLocale();
  const { batch, summary } = item;
  const days = daysElapsed(batch.hatchDate ?? batch.startDate);
  const stageBar = stageColor(batch.stageName);
  const stageLabel = stageDisplayName(batch.stageName);
  const overviewHref = `/batches/${batch.id}`;
  const stageBadgeClass = stageBar === "ledger-stage-warning"
    ? "bg-warning text-white"
    : stageBar === "ledger-stage-success"
      ? "bg-success text-white"
      : "bg-primary/15 text-primary";

  return (
    <CardHeader className="p-4 pb-0 sm:p-5 sm:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={cn("inline-flex shrink-0 items-center rounded-lg px-3 py-1 text-xs font-bold", stageBadgeClass)}>{stageLabel}</span>
            <CardTitle className="ledger-card-title min-w-0 max-w-full text-xl leading-tight [overflow-wrap:anywhere]"><Link href={overviewHref} className="rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">{batch.name}</Link></CardTitle>
          </div>
          <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{t("dashboard.day")} {days}{batch.bloodline ? ` · ${batch.bloodline}` : batch.source ? ` · ${batch.source}` : ""}{batch.status !== "ACTIVE" ? ` · ${batch.status}` : ""}</p>
        </div>
        {summary.activeAlertCount > 0 && <Badge variant={summary.highestActiveAlertSeverity === "CRITICAL" ? "destructive" : summary.highestActiveAlertSeverity === "WARNING" ? "secondary" : "secondary"} className="shrink-0 px-1.5 text-[10px]" aria-label={summary.highestActiveAlertSeverity ? alertAttentionText(summary.highestActiveAlertSeverity, summary.activeAlertCount, t) : `${summary.activeAlertCount} ${t("dashboard.activeAlerts")}`}><AlertCircle aria-hidden="true" />{summary.activeAlertCount}</Badge>}
      </div>
    </CardHeader>
  );
}

function getPopulationMetric(
  item: BatchDashboardItem,
  t: ReturnType<typeof useLocale>["t"],
): BatchMetricStripItem {
  const { batch } = item;
  const populationNeedsReview = batch.populationStatus === "RECONCILIATION_REQUIRED";
  const populationLabel = populationNeedsReview
    ? `—/${formatCount(batch.initialPopulation)}`
    : `${formatCount(batch.currentPopulation)}/${formatCount(batch.initialPopulation)}`;
  return {
    value: populationLabel,
    label: t("dashboard.batchCount"),
    warning: populationNeedsReview,
    title: populationNeedsReview ? t("dashboard.populationNeedsReview") : populationLabel,
    ariaLabel: `${t("dashboard.batchCount")}: ${populationLabel}${populationNeedsReview ? `. ${t("dashboard.populationNeedsReview")}` : ""}`,
  };
}

function getTaskMetric(
  tasks: TaskSummaryResponse | undefined,
  isError: boolean,
  t: ReturnType<typeof useLocale>["t"],
): BatchMetricStripItem {
  if (!tasks || typeof tasks.open !== "number" || typeof tasks.late !== "number") {
    const description = t(isError || tasks ? "dashboard.taskCountUnavailable" : "dashboard.taskCountLoading");
    return { value: "—", label: t("dashboard.batchTasks"), title: description, ariaLabel: description };
  }
  const taskDescription = tasks.late > 0
    ? `${formatCount(tasks.open)} ${t("dashboard.batchTasks").toLowerCase()}; ${formatCount(tasks.late)} ${t("dashboard.overdue").toLowerCase()}`
    : `${formatCount(tasks.open)} ${t("dashboard.batchTasks").toLowerCase()}`;
  return {
    value: formatCount(tasks.open),
    label: t("dashboard.batchTasks"),
    warning: tasks.late > 0,
    note: tasks.late > 0 ? `${formatCount(tasks.late)} ${t("dashboard.overdue").toLowerCase()}` : undefined,
    title: taskDescription,
    ariaLabel: taskDescription,
  };
}

function getBatchMetricItems(
  item: BatchDashboardItem,
  taskSummary: TaskSummaryResponse | undefined,
  taskSummaryError: boolean,
  t: ReturnType<typeof useLocale>["t"],
): BatchMetricStripItem[] {
  return [getPopulationMetric(item, t), getTaskMetric(taskSummary, taskSummaryError, t)];
}

function ManagerBatchCard({ item, taskSummary, taskSummaryError }: { item: BatchDashboardItem; taskSummary?: TaskSummaryResponse; taskSummaryError: boolean }) {
  const { t } = useLocale();
  const { batch } = item;

  return (
    <Card className={cn("ledger-batch-card flex h-full flex-col", (item.batch.populationStatus === "RECONCILIATION_REQUIRED" || item.summary.activeAlertCount > 0) && "ledger-batch-card-attention")}>
      <BatchCardHeader item={item} />
      <CardContent className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <BatchMetricStrip items={getBatchMetricItems(item, taskSummary, taskSummaryError, t)} />
      </CardContent>
      <CardFooter className="mt-auto border-t-0 p-3 pt-0 sm:p-4 sm:pt-0">
        <Link href={`/batches/${batch.id}`} className={cn(buttonVariants({ size: "lg" }), "h-11 w-full rounded-xl text-base font-semibold")}>
          {t("dashboard.viewBatch")}
        </Link>
      </CardFooter>
    </Card>
  );
}

function HandlerBatchCard({ item, taskSummary, taskSummaryError }: { item: BatchDashboardItem; taskSummary?: TaskSummaryResponse; taskSummaryError: boolean }) {
  const { t } = useLocale();
  const { batch } = item;
  const overviewHref = `/batches/${batch.id}`;
  const logHref = getLoggingHref(batch.id, LOGGING_ORIGINS.dashboard, true);

  return (
    <Card className={cn("ledger-batch-card flex h-full flex-col", (item.batch.populationStatus === "RECONCILIATION_REQUIRED" || item.summary.activeAlertCount > 0) && "ledger-batch-card-attention")}>
      <BatchCardHeader item={item} />
      <CardContent className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <BatchMetricStrip items={getBatchMetricItems(item, taskSummary, taskSummaryError, t)} />
      </CardContent>
      <CardFooter className="mt-auto flex flex-col gap-2 border-t-0 p-3 pt-0 sm:p-4 sm:pt-0 lg:flex-row">
        <Link href={logHref} className={cn(buttonVariants({ size: "lg" }), "h-11 w-full rounded-xl text-sm font-semibold lg:min-w-0 lg:flex-1")} aria-label={`Log an event for ${batch.name}`}><ClipboardList className="size-4" />{t("dashboard.logNow")}</Link>
        <Link href={overviewHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 w-full rounded-xl text-sm font-semibold lg:min-w-0 lg:flex-1")} aria-label={`View overview for ${batch.name}`}>{t("dashboard.viewBatch")}</Link>
      </CardFooter>
    </Card>
  );
}

function CreateBatchDialog({ variant = "header", className }: { variant?: "header" | "inline"; className?: string }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const createBatch = useCreateBatch();

  const [name, setName] = useState("");
  const [initialPopulation, setInitialPopulation] = useState("");
  const [hatchDate, setHatchDate] = useState(todayIso());
  const [farmEntryDate, setFarmEntryDate] = useState(todayIso());
  const [derbyDate, setDerbyDate] = useState("");
  const [bloodline, setBloodline] = useState("");
  const [source, setSource] = useState("");

  // Managers and handlers may register batches within their farm. A handler
  // who has not accepted a farm invite has no safe farm scope yet.
  if (user?.farmId == null) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const population = Number(initialPopulation);
    if (!name.trim()) {
      toast.error(t("dashboard.batchNameRequired"));
      return;
    }
    if (!bloodline.trim()) {
      toast.error(t("dashboard.bloodlineRequired"));
      return;
    }
    if (!Number.isInteger(population) || population < 1) {
      toast.error(t("dashboard.populationRequired"));
      return;
    }
    if (!hatchDate || isFutureDate(hatchDate) || !farmEntryDate || isFutureDate(farmEntryDate)) {
      toast.error("Choose both dates; neither can be in the future.");
      return;
    }
    if (farmEntryDate < hatchDate) {
      toast.error("Farm entry date cannot be before the hatch date.");
      return;
    }
    try {
      await createBatch.mutateAsync({
        name: name.trim(),
        initialPopulation: population,
        startDate: farmEntryDate,
        hatchDate,
        farmEntryDate,
        bloodline: bloodline.trim(),
        derbyDate: derbyDate || null,
        source: source || null,
      });
      toast.success(t("dashboard.created"));
      setOpen(false);
      setName("");
      setInitialPopulation("");
      setBloodline("");
      setDerbyDate("");
      setSource("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("dashboard.createError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          variant === "inline" ? (
            <Button className="h-11 w-full rounded-xl px-5 font-semibold sm:w-auto">
              <Plus className="size-4" /> {t("dashboard.createFirstBatch")}
            </Button>
          ) : (
            <Button className={cn("h-11 w-auto shrink-0 rounded-xl px-3 font-semibold sm:px-4", className)}>
              <Plus className="size-4" /> {t("dashboard.createBatch")}
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t("dashboard.createDialogTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.createDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">{t("dashboard.batchName")}</Label>
              <Input
                id="name"
                required
                placeholder={t("dashboard.batchNamePlaceholder")}
                className="h-11 rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodline" className="font-semibold">
                {t("dashboard.bloodline")} <span className="font-normal text-muted-foreground">({t("common.required")})</span>
              </Label>
              <Input
                id="bloodline"
                required
                maxLength={255}
                placeholder={t("dashboard.bloodlinePlaceholder")}
                className="h-11 rounded-xl"
                value={bloodline}
                onChange={(e) => setBloodline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pop" className="font-semibold">{t("dashboard.numberOfBirds")}</Label>
              <Input
                id="pop"
                type="number"
                min={1}
                step={1}
                required
                placeholder={t("dashboard.numberOfBirdsPlaceholder")}
                className="h-11 rounded-xl"
                value={initialPopulation}
                onChange={(e) => setInitialPopulation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hatch-date" className="font-semibold">Hatch date</Label>
              <Input
                id="hatch-date"
                type="date"
                required
                max={todayIso()}
                className="h-11 rounded-xl"
                value={hatchDate}
                onChange={(e) => setHatchDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="farm-entry-date" className="font-semibold">Farm entry date</Label>
              <Input
                id="farm-entry-date"
                type="date"
                required
                max={todayIso()}
                className="h-11 rounded-xl"
                value={farmEntryDate}
                onChange={(e) => setFarmEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="derby-date" className="font-semibold">
                {t("batch.derbyDate")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input
                id="derby-date"
                type="date"
                className="h-11 rounded-xl"
                value={derbyDate}
                onChange={(e) => setDerbyDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="source" className="font-semibold">
                {t("dashboard.source")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input
                id="source"
                placeholder={t("dashboard.sourcePlaceholder")}
                className="h-11 rounded-xl"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="h-11 rounded-xl px-6 font-semibold"
              disabled={createBatch.isPending}
            >
              {createBatch.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("dashboard.createBatch")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
