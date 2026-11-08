"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArchiveRestore,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useArchivedBatches, useCreateBatch, useDashboardBatches, useRestoreBatch } from "@/hooks/use-batches";
import { useTaskPage, useTaskSummary } from "@/hooks/use-operations";
import { useFarm } from "@/hooks/use-farm";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, isFutureDate, todayIso } from "@/lib/format";
import type { BatchDashboardItem } from "@/lib/types";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingInvitesBanner } from "@/components/pending-invites-banner";
import { FarmOnboardingBanner } from "@/components/farm-onboarding-banner";
import { getFarmDisplayName } from "@/lib/farm-display";
import { getLoggingHref, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { useLocale } from "@/components/locale-provider";
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

export default function DashboardPage() {
  const { isManager, user } = useAuth();
  const { t } = useLocale();
  const { data: dashboardItems, isLoading, isError, error } = useDashboardBatches();
  const { data: archivedBatches } = useArchivedBatches(isManager);
  const { data: taskSummary } = useTaskSummary();
  const { data: taskPage } = useTaskPage({ page: 0, size: 2, view: "OPEN", dueBucket: "ALL" });
  const farm = useFarm(!!user && user.farmId != null);
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
  const farmName = getFarmDisplayName({
    farm: farm.data,
    farmId: user?.farmId,
    isError: farm.isError,
  });
  const openTasks = taskPage?.items ?? [];
  const activeBatchCount = (dashboardItems ?? []).filter(({ batch }) => batch.status === "ACTIVE").length;
  const needsAttention = visibleBatches.filter(({ batch, summary }) =>
    batch.populationStatus === "RECONCILIATION_REQUIRED" || summary.activeAlertCount > 0
  );
  const allGood = visibleBatches.filter(({ batch, summary }) =>
    batch.populationStatus !== "RECONCILIATION_REQUIRED" && summary.activeAlertCount === 0
  );

  return (
    <div className="ledger-page mx-auto w-full max-w-6xl space-y-8 sm:space-y-10">
      <FarmOnboardingBanner />
      <PendingInvitesBanner />

      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="ledger-heading text-4xl leading-none sm:text-5xl">{t("dashboard.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{farmName} · {dashboardItems ? `${activeBatchCount} ${activeBatchCount === 1 ? t("dashboard.activeBatch") : t("dashboard.activeBatchesPlural")}` : t("dashboard.loadingBatches")}</p>
        </div>
        <div className="ledger-toolbar grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-nowrap">
          <CreateBatchDialog className="order-first col-span-2 w-full justify-self-stretch sm:order-last sm:col-span-1 sm:w-auto sm:justify-self-auto" />
          {dashboardItems && dashboardItems.length > 0 && (
            <div className="ledger-search relative min-w-0 sm:w-52 sm:flex-none">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label={t("dashboard.searchLabel")}
                value={search}
                onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }}
                placeholder={t("dashboard.searchLabel")}
                className="min-h-11 rounded-full border-0 bg-transparent pl-11 pr-4 shadow-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          )}
          {dashboardItems && dashboardItems.length > 0 && (
            <NativeSelect
              aria-label={t("dashboard.filterLabel")}
              value={stageFilter}
              onChange={(event) => { setStageFilter(event.target.value); setVisibleCount(PAGE_SIZE); }}
              className="ledger-filter min-h-11 w-32 rounded-full border-0 bg-transparent px-3 text-xs shadow-none sm:w-36"
            >
              <option value="all">{t("dashboard.allStages")}</option>
              {Array.from(new Set(dashboardItems.map(({ batch }) => batch.stageName))).map((stage) => (
                <option key={stage} value={stage}>{stageDisplayName(stage)}</option>
              ))}
            </NativeSelect>
          )}
        </div>
      </div>

      {!isManager && (taskSummary?.open ?? 0) > 0 && (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3">
            <div>
              <CardTitle className="text-base">{t("dashboard.todayTasks")}</CardTitle>
              <CardDescription>{t("dashboard.todayTasksHint")}</CardDescription>
            </div>
            <Badge variant="secondary">{taskSummary?.open ?? 0} {t("dashboard.openTasks")}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {openTasks.slice(0, 2).map((task) => (
              <Link
                key={task.id}
                href="/tasks"
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{task.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {task.overdue
                      ? t("dashboard.overdue")
                      : task.dueAt
                        ? new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                        : t("dashboard.noDueDate")}
                  </span>
                </span>
                {task.status === "IN_PROGRESS" ? (
                  <Badge variant="outline">{t("dashboard.inProgress")}</Badge>
                ) : (
                  <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
                )}
              </Link>
            ))}
            {(taskSummary?.open ?? 0) > 2 && (
              <Link href="/tasks" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
                {t("dashboard.viewAllTasks")}
              </Link>
            )}
          </CardContent>
        </Card>
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
          {needsAttention.length > 0 && (
            <section aria-labelledby="needs-attention-heading" className="space-y-4">
              <div className="flex items-baseline gap-2">
                <h2 id="needs-attention-heading" className="ledger-section-heading">Needs attention</h2>
                <span className="ledger-section-count">· {needsAttention.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {needsAttention.map((item) => (
                  <BatchCard key={item.batch.id} item={item} isManager={isManager} />
                ))}
              </div>
            </section>
          )}
          {allGood.length > 0 && (
            <section aria-labelledby="all-good-heading" className="space-y-4">
              <div className="flex items-baseline gap-2">
                <h2 id="all-good-heading" className="ledger-section-heading">All good</h2>
                <span className="ledger-section-count">· {allGood.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allGood.map((item) => (
                  <BatchCard key={item.batch.id} item={item} isManager={isManager} />
                ))}
              </div>
            </section>
          )}
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
    </div>
  );
}

function ArchivedBatches({ batches }: { batches: import("@/lib/types").Batch[] }) {
  const restore = useRestoreBatch();
  return <section className="space-y-3 border-t pt-5">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Archived batches</h2><p className="mt-0.5 text-xs text-muted-foreground">History is kept and read-only until restored.</p></div><Badge variant="secondary">{batches.length}</Badge></div>
    <div className="space-y-2">{batches.map((batch) => <div key={batch.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><Link href={`/batches/${batch.id}`} className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"><p className="truncate text-sm font-semibold">{batch.name}</p><p className="mt-1 text-xs text-muted-foreground">Archived {batch.archivedAt ? formatDate(batch.archivedAt) : "date unavailable"}{batch.archiveReason ? ` · ${batch.archiveReason}` : ""}</p></Link><div className="flex gap-2"><Link href={`/batches/${batch.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 rounded-xl")}>View records</Link><Button type="button" size="sm" className="min-h-11 rounded-xl" disabled={restore.isPending} onClick={() => restore.mutateAsync(batch.id).then(() => toast.success("Batch restored.")).catch((error) => toast.error(error instanceof ApiError ? error.message : "Could not restore this batch."))}><ArchiveRestore className="size-4" />Restore</Button></div></div>)}</div>
  </section>;
}

function BatchCard({
  item,
  isManager,
}: {
  item: BatchDashboardItem;
  isManager: boolean;
}) {
  const { t } = useLocale();
  const { batch, summary } = item;
  const days = daysElapsed(batch.hatchDate ?? batch.startDate);
  const stageTone = stageColor(batch.stageName);
  const stageLabel = stageDisplayName(batch.stageName);
  const needsReview = batch.populationStatus === "RECONCILIATION_REQUIRED";
  const needsAttention = needsReview || summary.activeAlertCount > 0;

  const overviewHref = `/batches/${batch.id}`;
  const logHref = getLoggingHref(batch.id, LOGGING_ORIGINS.dashboard, true);

  return (
    <Card className={cn("ledger-batch-card flex h-full flex-col", needsAttention && "ledger-batch-card-attention")}>
      <CardHeader className="space-y-4 p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
            <span className={cn("ledger-stage-dot", stageTone)} aria-hidden="true" />
            <span className="truncate">{stageLabel}</span>
            {batch.status !== "ACTIVE" && <span className="truncate text-muted-foreground">· {batch.status}</span>}
          </div>
          <Link
            href={overviewHref}
            className="ledger-card-arrow hidden size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:flex"
            aria-label={`${t("dashboard.viewBatch")}: ${batch.name}`}
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="min-w-0">
          <CardTitle className="ledger-card-title truncate text-2xl leading-tight">
            <Link href={overviewHref} className="rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">{batch.name}</Link>
          </CardTitle>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {t("dashboard.day")} {days}{batch.bloodline ? ` · ${batch.bloodline}` : batch.source ? ` · ${batch.source}` : ""}
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-end gap-4 p-5 pt-8 sm:p-6 sm:pt-10">
        <div>
          <p className="text-xs text-muted-foreground">{t("dashboard.currentCount")}</p>
          {needsReview ? (
            <p className="ledger-review-value mt-1 text-2xl">Needs review</p>
          ) : (
            <p className="mt-1 flex items-baseline gap-2 text-4xl leading-none tabular-nums">
              <span className="ledger-number text-4xl">{batch.currentPopulation}</span>
              <span className="text-xl text-muted-foreground">/ {batch.initialPopulation}</span>
            </p>
          )}
        </div>
        {(needsReview || summary.activeAlertCount > 0) && (
          <p className="text-xs font-medium text-warning-ink">
            {needsReview ? `Initial: ${batch.initialPopulation}` : `${summary.activeAlertCount} health event${summary.activeAlertCount === 1 ? "" : "s"}`}
          </p>
        )}
        {isManager && (
          <Link
            href={overviewHref}
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-full rounded-full border-current/15 bg-transparent sm:hidden")}
            aria-label={`View overview for ${batch.name}`}
          >
            {t("dashboard.viewBatch")}
          </Link>
        )}
        {isManager === false && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Link href={logHref} className={cn(buttonVariants({ size: "sm" }), "rounded-full px-4")} aria-label={`Log an event for ${batch.name}`}>
              <ClipboardList className="size-3.5" />
              {t("dashboard.logNow")}
            </Link>
            <Link href={overviewHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full rounded-full border-current/15 bg-transparent px-4 sm:w-auto")} aria-label={`View overview for ${batch.name}`}>
              {t("dashboard.viewBatch")}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateBatchDialog({ variant, className }: { variant?: "inline"; className?: string }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const createBatch = useCreateBatch();

  const [name, setName] = useState("");
  const [initialPopulation, setInitialPopulation] = useState("");
  const [hatchDate, setHatchDate] = useState(todayIso());
  const [farmEntryDate, setFarmEntryDate] = useState(todayIso());
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
        bloodline: bloodline || null,
        source: source || null,
      });
      toast.success(t("dashboard.created"));
      setOpen(false);
      setName("");
      setInitialPopulation("");
      setBloodline("");
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
            <Button className={cn("h-11 w-full rounded-xl px-5 font-semibold sm:w-auto", className)}>
              <Plus className="size-4" /> {t("dashboard.createFirstBatch")}
            </Button>
          ) : (
            <Button className={cn("h-12 w-full rounded-xl px-4 font-semibold sm:w-auto", className)}>
              <Plus className="size-4" /> {t("dashboard.createBatch")}
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t("dashboard.createDialogTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.createDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
              <p className="text-sm font-semibold text-primary">{t("dashboard.stageAutomatic")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t("dashboard.stageAutomaticHint")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bloodline" className="font-semibold">
                  {t("dashboard.bloodline")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Input
                  id="bloodline"
                  placeholder={t("dashboard.bloodlinePlaceholder")}
                  className="h-11 rounded-xl"
                  value={bloodline}
                  onChange={(e) => setBloodline(e.target.value)}
                />
              </div>
              <div className="space-y-2">
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
