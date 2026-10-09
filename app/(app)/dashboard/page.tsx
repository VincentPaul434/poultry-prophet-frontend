"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
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
import { useTasks } from "@/hooks/use-operations";
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
  CardFooter,
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
    1,
    Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000)
  );
}

function stageColor(stageName: string): string {
  const s = stageName.toLowerCase();
  if (s.includes("brood")) return "bg-warning";
  if (s.includes("rang") || s.includes("grow")) return "bg-success";
  if (s.includes("select") || s.includes("pre")) return "bg-primary";
  return "bg-primary";
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
  const { data: tasks } = useTasks(!isManager);
  const farm = useFarm(!!user && user.farmId != null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [showBatchControls, setShowBatchControls] = useState(false);
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
  const openTasks = (tasks ?? []).filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
  const activeBatchCount = (dashboardItems ?? []).filter(({ batch }) => batch.status === "ACTIVE").length;
  const controlsVisible = showBatchControls || Boolean(search) || stageFilter !== "all";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <FarmOnboardingBanner />
      <PendingInvitesBanner />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("dashboard.pageTitle")}</h1>
          <p className="text-sm font-medium text-muted-foreground">{farmName}</p>
          <p className="text-sm text-muted-foreground">
            {dashboardItems ? `${activeBatchCount} ${activeBatchCount === 1 ? t("dashboard.activeBatch") : t("dashboard.activeBatchesPlural")}` : t("dashboard.loadingBatches")}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <CreateBatchDialog />
        </div>
      </div>

      {!isManager && openTasks.length > 0 && (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3">
            <div>
              <CardTitle className="text-base">{t("dashboard.todayTasks")}</CardTitle>
              <CardDescription>{t("dashboard.todayTasksHint")}</CardDescription>
            </div>
            <Badge variant="secondary">{openTasks.length} {t("dashboard.openTasks")}</Badge>
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
            {openTasks.length > 2 && (
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
          {dashboardItems.length > 3 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{t("dashboard.batchesHeading")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 rounded-xl"
                onClick={() => setShowBatchControls((value) => !value)}
                aria-expanded={controlsVisible}
              >
                <Search className="size-4" aria-hidden="true" />
                {controlsVisible ? t("dashboard.hideSearch") : t("dashboard.searchOrFilter")}
              </Button>
            </div>
          )}
          {controlsVisible && (
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label={t("dashboard.searchLabel")}
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }}
                  placeholder={t("dashboard.searchPlaceholder")}
                  className="min-h-11 pl-10"
                />
              </div>
              <NativeSelect
                aria-label={t("dashboard.filterLabel")}
                value={stageFilter}
                onChange={(event) => { setStageFilter(event.target.value); setVisibleCount(PAGE_SIZE); }}
                className="sm:w-56"
              >
                <option value="all">{t("dashboard.allStages")}</option>
                {Array.from(new Set(dashboardItems.map(({ batch }) => batch.stageName))).map((stage) => (
                  <option key={stage} value={stage}>{stageDisplayName(stage)}</option>
                ))}
              </NativeSelect>
            </div>
          )}
          {visibleBatches.length === 0 && (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {t("dashboard.noMatches")}
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleBatches.map((item) => (
              <BatchCard key={item.batch.id} item={item} isManager={isManager} />
            ))}
          </div>
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
  const days = daysElapsed(batch.startDate);
  const stageBar = stageColor(batch.stageName);
  const stageLabel = stageDisplayName(batch.stageName);

  const overviewHref = `/batches/${batch.id}`;
  const logHref = getLoggingHref(batch.id, LOGGING_ORIGINS.dashboard, true);

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border shadow-none transition-colors hover:border-primary/30">
      <div className={cn("h-1.5 w-full", stageBar)} />

      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate text-base">{batch.name}</CardTitle>
              {batch.status !== "ACTIVE" && <Badge variant="secondary" className="shrink-0 text-xs">{batch.status}</Badge>}
              {summary.activeAlertCount > 0 && (
                <Badge variant="warning" className="shrink-0 text-xs">
                  {summary.activeAlertCount} {summary.activeAlertCount === 1 ? "alert" : "alerts"}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{stageLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{t("dashboard.day")} {days}</span>
              {batch.bloodline && <><span aria-hidden="true">·</span><span className="truncate">{batch.bloodline}</span></>}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4 pt-2">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">{t("dashboard.currentCount")}</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{batch.populationStatus === "RECONCILIATION_REQUIRED" ? "Needs review" : `${batch.currentPopulation} / ${batch.initialPopulation}`}</p>
          {batch.populationStatus === "RECONCILIATION_REQUIRED" && <p className="mt-1 text-[11px] font-medium text-warning-ink">Initial: {batch.initialPopulation}</p>}
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Total deaths</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{summary.totalDeaths}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{summary.healthRelatedDeaths} health · {summary.accidentalDeaths} accidental</p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Other changes</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{summary.otherPopulationChanges}</p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Health events</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">{summary.recordedHealthEvents}</p>
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex flex-col gap-2 p-4 pt-0 sm:flex-row">
        {isManager ? (
          <Link href={overviewHref} className={cn(buttonVariants({ size: "lg" }), "h-12 w-full rounded-xl text-base font-semibold")}>
            {t("dashboard.viewBatch")}
          </Link>
        ) : (
          <>
            <Link href={logHref} className={cn(buttonVariants({ size: "lg" }), "h-12 w-full rounded-xl text-base font-semibold sm:min-w-0 sm:flex-1")} aria-label={`Log an event for ${batch.name}`}>
              <ClipboardList className="size-4" />
              {t("dashboard.logNow")}
            </Link>
            <Link href={overviewHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full rounded-xl text-base font-semibold sm:min-w-0 sm:flex-1")} aria-label={`View overview for ${batch.name}`}>
              {t("dashboard.viewBatch")}
            </Link>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function CreateBatchDialog({ variant }: { variant?: "inline" }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const createBatch = useCreateBatch();

  const [name, setName] = useState("");
  const [initialPopulation, setInitialPopulation] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
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
    if (!startDate || isFutureDate(startDate)) {
      toast.error(t("dashboard.startDateRequired"));
      return;
    }
    try {
      await createBatch.mutateAsync({
        name: name.trim(),
        initialPopulation: population,
        startDate,
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
            <Button className="h-11 w-full rounded-xl px-5 font-semibold sm:w-auto">
              <Plus className="size-4" /> {t("dashboard.createFirstBatch")}
            </Button>
          ) : (
            <Button className="h-12 w-full rounded-xl px-4 font-semibold sm:w-auto">
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
                <Label htmlFor="start" className="font-semibold">{t("dashboard.startDate")}</Label>
                <Input
                  id="start"
                  type="date"
                  required
                  max={todayIso()}
                  className="h-11 rounded-xl"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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
