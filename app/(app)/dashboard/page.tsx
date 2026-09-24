"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useBatches, useCreateBatch } from "@/hooks/use-batches";
import { useTasks } from "@/hooks/use-operations";
import { useFarm } from "@/hooks/use-farm";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, isFutureDate, todayIso } from "@/lib/format";
import type { Batch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Progress } from "@/components/ui/progress";
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
  if (s.includes("brood")) return "bg-amber-500";
  if (s.includes("rang") || s.includes("grow")) return "bg-emerald-500";
  if (s.includes("select") || s.includes("pre")) return "bg-blue-500";
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
  const { data: batches, isLoading, isError, error } = useBatches();
  const { data: tasks } = useTasks(!isManager);
  const farm = useFarm(!!user && user.farmId != null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("dashboard.goodMorning") : hour < 17 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");
  const firstName = user?.fullName?.split(" ")[0];
  const filteredBatches = (batches ?? []).filter((batch) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [batch.name, batch.bloodline, batch.source]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query));
    const matchesStage = stageFilter === "all" || batch.stageName === stageFilter;
    return matchesSearch && matchesStage;
  });
  const totalPages = filteredBatches ? Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleBatches = filteredBatches.slice(pageStart, pageStart + PAGE_SIZE);
  const farmName = getFarmDisplayName({
    farm: farm.data,
    farmId: user?.farmId,
    isError: farm.isError,
  });
  const openTasks = (tasks ?? []).filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <FarmOnboardingBanner />
      <PendingInvitesBanner />

      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {greeting}{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="text-sm font-semibold text-primary">{farmName}</p>
          <p className="text-sm text-muted-foreground">
            {batches
              ? `${batches.filter((b) => b.status === "ACTIVE").length} ${batches.filter((b) => b.status === "ACTIVE").length === 1 ? t("dashboard.activeBatch") : t("dashboard.activeBatchesPlural")}`
              : t("dashboard.loadingBatches")}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <CreateBatchDialog />
        </div>
      </div>

      {!isManager && openTasks.length > 0 && <Card className="border-primary/20 bg-primary/5 shadow-none"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-lg">{t("dashboard.todayTasks")}</CardTitle><CardDescription>{t("dashboard.todayTasksHint")}</CardDescription></div><Badge variant="secondary">{openTasks.length} open</Badge></div></CardHeader><CardContent className="space-y-2 pt-0">{openTasks.slice(0, 3).map((task) => <Link key={task.id} href="/tasks" className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{task.title}</span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" />{task.overdue ? "Overdue" : task.dueAt ? new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due date"}</span></span>{task.status === "IN_PROGRESS" ? <Badge variant="outline">Started</Badge> : <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />}</Link>)}{openTasks.length > 3 && <Link href="/tasks" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{t("dashboard.viewAllTasks")}</Link>}</CardContent></Card>}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load batches</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : "Please try again in a moment."}
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {batches && batches.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-14">
            <div className="text-5xl">🐔</div>
            <CardTitle className="text-base">
              {user?.farmId == null ? "Join a farm first" : "No batches yet"}
            </CardTitle>
            <CardDescription>
              {user?.farmId == null
                ? "Accept a farm invite before viewing or creating batches."
                : "Create your first batch to start tracking your game fowl."}
            </CardDescription>
            <CreateBatchDialog variant="inline" />
          </CardContent>
        </Card>
      )}

      {/* Batch cards */}
      {batches && batches.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search batches"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search batch, bloodline, or source"
                className="pl-10"
              />
            </div>
            <select
              aria-label="Filter batches by stage"
              value={stageFilter}
              onChange={(event) => { setStageFilter(event.target.value); setPage(1); }}
              className="h-11 rounded-lg border border-input bg-background px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-56"
            >
              <option value="all">All stages</option>
              {Array.from(new Set(batches.map((batch) => batch.stageName))).map((stage) => (
                <option key={stage} value={stage}>{stageDisplayName(stage)}</option>
              ))}
            </select>
          </div>
          {visibleBatches.length === 0 && (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No batches match this search or stage filter.
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} isManager={isManager} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {filteredBatches.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredBatches.length)} of {filteredBatches.length} batches
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft />
                </Button>
                <span className="min-w-16 text-center text-xs font-medium tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next page"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BatchCard({
  batch,
  isManager,
}: {
  batch: Batch;
  isManager: boolean;
}) {
  const { t } = useLocale();
  const days = daysElapsed(batch.startDate);
  const totalTarget = 150;
  const progress = Math.min(100, Math.round((days / totalTarget) * 100));
  const stageBar = stageColor(batch.stageName);
  const stageLabel = stageDisplayName(batch.stageName);
  const lossCount = batch.initialPopulation - batch.currentPopulation;
  const lossRate = batch.initialPopulation > 0
    ? ((lossCount / batch.initialPopulation) * 100).toFixed(1)
    : "0.0";

  const overviewHref = `/batches/${batch.id}`;
  const logHref = getLoggingHref(batch.id, LOGGING_ORIGINS.dashboard, true);

  return (
    <Card className="group flex min-h-[380px] flex-col overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className={cn("h-1.5 w-full", stageBar)} />

      <Link href={overviewHref} className="flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset" aria-label={`Open ${batch.name} overview`}>
        <CardHeader className="space-y-3 p-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="truncate text-base">{batch.name}</CardTitle>
                <Badge
                  variant={batch.status === "ACTIVE" ? "default" : "secondary"}
                  className="shrink-0 text-xs"
                >
                  {batch.status}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Started {formatDate(batch.startDate)}
                {batch.bloodline ? ` · ${batch.bloodline}` : ""}
              </p>
            </div>
            <Badge variant="secondary" className="h-auto min-w-14 shrink-0 flex-col rounded-xl px-2 py-1.5 text-center">
              <span className="text-lg font-bold leading-none">{days}</span>
              <span className="mt-0.5 text-xs font-medium text-muted-foreground">days</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-between gap-4 p-4 pt-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("dashboard.currentStage")}</p>
              <p className="truncate text-sm text-muted-foreground">{t("dashboard.autoStage")}</p>
            </div>
            <Badge variant="outline" className="shrink-0 border-primary/25 bg-background font-semibold text-primary">
              {stageLabel}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatPill value={`${batch.currentPopulation} / ${batch.initialPopulation}`} label={t("dashboard.birdsAlive")} icon="🐔" />
            <StatPill value={`${lossRate}%`} label={`${lossCount} ${t("dashboard.populationChanges")}`} icon="📊" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{t("dashboard.ageReference")}</span>
              <span>
                <span className="font-semibold text-foreground">Day {days}</span>
                {" "}· {stageLabel}
              </span>
            </div>
            <Progress value={progress} aria-label={`${batch.name} lifecycle progress`} className="gap-0 [&_[data-slot=progress-track]]:h-2" />
          </div>
        </CardContent>
      </Link>

      <CardFooter className="flex flex-col gap-2 p-4 pt-0 sm:flex-row">
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

function StatPill({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{icon}</span>
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function CreateBatchDialog({ variant }: { variant?: "inline" }) {
  const { user } = useAuth();
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
      toast.error("Batch name is required.");
      return;
    }
    if (!Number.isInteger(population) || population < 1) {
      toast.error("Number of birds must be a whole number greater than 0.");
      return;
    }
    if (!startDate || isFutureDate(startDate)) {
      toast.error("Choose a valid start date that is not in the future.");
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
      toast.success("Batch created!");
      setOpen(false);
      setName("");
      setInitialPopulation("");
      setBloodline("");
      setSource("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create batch");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          variant === "inline" ? (
            <Button className="h-11 w-full rounded-xl px-5 font-semibold sm:w-auto">
              <Plus className="size-4" /> Create first batch
            </Button>
          ) : (
            <Button className="h-12 w-full rounded-xl px-4 font-semibold sm:w-auto">
              <Plus className="size-4" /> New batch
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create new batch</DialogTitle>
            <DialogDescription>
              Register a new group of game fowl chicks or birds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">Batch name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Alpha-01, Batch June"
                className="h-11 rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pop" className="font-semibold">Number of birds</Label>
                <Input
                  id="pop"
                  type="number"
                  min={1}
                  step={1}
                  required
                  placeholder="e.g. 50"
                  className="h-11 rounded-xl"
                  value={initialPopulation}
                  onChange={(e) => setInitialPopulation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start" className="font-semibold">Start / hatch date</Label>
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
              <p className="text-sm font-semibold text-primary">Stage assigned automatically</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                The batch moves through its lifecycle based on the start or hatch date. You do not need to choose a stage.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bloodline" className="font-semibold">
                  Bloodline <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="bloodline"
                  placeholder="e.g. Sweater"
                  className="h-11 rounded-xl"
                  value={bloodline}
                  onChange={(e) => setBloodline(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source" className="font-semibold">
                  Source <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="source"
                  placeholder="e.g. Own hatch"
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
              Create batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
