"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bird,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Home,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useArchivedBatches,
  useBatches,
  useCreateBatch,
} from "@/hooks/use-batches";
import {
  ArchiveBatchButton,
  RestoreBatchButton,
} from "@/components/archive-batch-controls";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import type { Batch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingInvitesBanner } from "@/components/pending-invites-banner";
import { FarmOnboardingBanner } from "@/components/farm-onboarding-banner";
import { useFarm } from "@/hooks/use-farm";
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

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export default function DashboardPage() {
  const { isManager, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: batches, isLoading, isFetching, isError, error } = useBatches();
  const { data: farm } = useFarm();
  const farmName = farm?.name?.trim();

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
    queryClient.invalidateQueries({ queryKey: qk.invitesPending });
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName?.split(" ")[0];
  const todayLabel = dateFormatter.format(new Date());

  const batchList = batches ?? [];
  const activeBatches = batchList.filter((batch) => batch.status === "ACTIVE");
  const activeCount = activeBatches.length;
  const totalBirds = batchList.reduce(
    (sum, batch) => sum + batch.currentPopulation,
    0
  );
  const totalInitial = batchList.reduce(
    (sum, batch) => sum + batch.initialPopulation,
    0
  );
  const totalLost = Math.max(0, totalInitial - totalBirds);
  const lossRate = totalInitial
    ? Math.round((totalLost / totalInitial) * 100)
    : 0;
  const avgAge = activeCount
    ? Math.round(
        activeBatches.reduce(
          (sum, batch) => sum + daysElapsed(batch.startDate),
          0
        ) / activeCount
      )
    : null;
  const hasData = batches !== undefined;

  const overviewCards = [
    {
      label: "Active batches",
      value: hasData ? numberFormatter.format(activeCount) : "--",
      helper: hasData
        ? `${numberFormatter.format(batchList.length)} total batches`
        : "Waiting for data",
      icon: Layers,
      tone: "bg-emerald-500/15 text-emerald-700",
      glow: "bg-emerald-500/15",
    },
    {
      label: "Birds on hand",
      value: hasData ? numberFormatter.format(totalBirds) : "--",
      helper: hasData
        ? `${numberFormatter.format(totalInitial)} placed`
        : "Waiting for data",
      icon: Bird,
      tone: "bg-amber-500/15 text-amber-700",
      glow: "bg-amber-500/15",
    },
    {
      label: "Average age",
      value: hasData && avgAge !== null ? `${avgAge} days` : "--",
      helper: activeCount ? "Across active batches" : "No active batches",
      icon: CalendarDays,
      tone: "bg-blue-500/15 text-blue-700",
      glow: "bg-blue-500/15",
    },
    {
      label: "Loss rate",
      value: hasData && totalInitial ? `${lossRate}%` : "--",
      helper: totalInitial
        ? `${numberFormatter.format(totalLost)} birds lost`
        : "No loss data",
      icon: TrendingDown,
      tone: "bg-rose-500/15 text-rose-700",
      glow: "bg-rose-500/15",
    },
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.12),_transparent_55%)] opacity-[0.28] dark:opacity-[0.12]" />
        <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.05] [background-image:linear-gradient(90deg,rgba(2,6,23,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(2,6,23,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-4">
          <FarmOnboardingBanner />
          <PendingInvitesBanner />
        </div>

        <section className="relative overflow-hidden rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <Home className="size-3 text-primary" />
                {isManager ? "Farm Manager" : "Handler"} · {todayLabel}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {farmName ?? `${greeting}${firstName ? `, ${firstName}` : ""}!`}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {farmName ? `${greeting}${firstName ? `, ${firstName}` : ""} — ` : ""}
                  {batches
                    ? `${numberFormatter.format(activeCount)} active batch${activeCount === 1 ? "" : "es"} tracking ${numberFormatter.format(totalBirds)} birds in motion.`
                    : "Loading your batches..."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-xl px-4 text-sm font-semibold"
                onClick={refreshAll}
                disabled={isFetching}
                title="Refresh"
              >
                <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
                Refresh
              </Button>
              <CreateBatchDialog />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overviewCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Batch overview
              </h2>
              <p className="text-sm text-muted-foreground">
                Track daily progress, losses, and lifecycle pace.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1">
                <span className="size-1.5 rounded-full bg-primary" />
                Updated {todayLabel}
              </span>
            </div>
          </div>

          {/* Loading skeletons */}
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-3xl" />
              ))}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="text-sm font-medium text-destructive">
                {error instanceof ApiError
                  ? error.message
                  : "Could not load batches."}
              </p>
            </div>
          )}

          {/* Empty state */}
          {batches && batches.length === 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-dashed bg-card/80 p-10 text-center shadow-sm">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_60%)]" />
              <div className="relative space-y-3">
                <div className="text-5xl">🐔</div>
                <p className="text-lg font-semibold text-foreground">
                  No batches yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Create your first batch to start tracking your game fowl.
                </p>
                <CreateBatchDialog variant="inline" />
              </div>
            </div>
          )}

          {/* Batch cards */}
          {batches && batches.length > 0 && (
            <div className="grid gap-4">
              {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} isManager={isManager} />
              ))}
            </div>
          )}

          {/* Archived batches (managers only) */}
          {isManager && <ArchivedBatchesSection />}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  glow,
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
  glow: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl",
          glow
        )}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-xl ring-1 ring-border/60",
            tone
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{helper}</p>
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
  const days = daysElapsed(batch.startDate);
  const totalTarget = 150;
  const progress = Math.min(100, Math.round((days / totalTarget) * 100));
  const stageBar = stageColor(batch.stageName);
  const mortalityCount = Math.max(
    0,
    batch.initialPopulation - batch.currentPopulation
  );
  const lossRate = batch.initialPopulation
    ? Math.round((mortalityCount / batch.initialPopulation) * 100)
    : 0;

  return (
    <div className="group relative overflow-hidden rounded-3xl border bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn("absolute inset-x-0 top-0 h-1.5", stageBar)} />

      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                {batch.name}
              </h2>
              <Badge
                variant={batch.status === "ACTIVE" ? "default" : "secondary"}
                className="rounded-full px-2 text-[10px] uppercase tracking-[0.18em]"
              >
                {batch.status}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full px-2 text-[10px] capitalize"
                title={batch.stageAuto ? "Stage set automatically from age" : "Stage manually set"}
              >
                {batch.stageName}
                {batch.stageAuto && (
                  <span className="ml-1 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
                    auto
                  </span>
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Started {formatDate(batch.startDate)}
              {batch.bloodline ? ` · ${batch.bloodline}` : ""}
              {batch.source ? ` · ${batch.source}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border bg-background/80 px-4 py-2 shadow-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold leading-none">{days}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                days old
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatPill
            value={numberFormatter.format(batch.currentPopulation)}
            label="Birds alive"
            icon={Bird}
            tone="bg-emerald-500/15 text-emerald-700"
          />
          <StatPill
            value={numberFormatter.format(mortalityCount)}
            label="Mortality"
            icon={AlertTriangle}
            tone="bg-amber-500/15 text-amber-700"
          />
          <StatPill
            value={`${lossRate}%`}
            label="Loss rate"
            icon={TrendingDown}
            tone="bg-rose-500/15 text-rose-700"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Lifecycle</span>
            <span className="text-foreground">
              Day {days} of 150 · {progress}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/70 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", stageBar)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isManager ? (
            <>
              <Button
                nativeButton={false}
                render={<Link href={`/batches/${batch.id}`} />}
                className="h-11 flex-1 rounded-xl px-4 text-sm font-semibold"
              >
                View details
              </Button>
              <ArchiveBatchButton batch={batch} />
            </>
          ) : (
            <Button
              nativeButton={false}
              render={<Link href={`/batches/${batch.id}`} />}
              className="h-11 flex-1 rounded-xl px-4 text-sm font-semibold"
            >
              <ClipboardList className="size-4" />
              View batch
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({
  value,
  label,
  icon,
  tone,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  tone: string;
}) {
  const Icon = icon;

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-3">
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          tone
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground">{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

function ArchivedBatchesSection() {
  const [show, setShow] = useState(false);
  const { data: archived, isLoading } = useArchivedBatches(show);
  const count = archived?.length ?? 0;

  return (
    <div className="space-y-3 pt-2">
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <Archive className="size-3.5" />
        {show ? "Hide archived batches" : "Show archived batches"}
        {show && !isLoading ? ` (${count})` : ""}
        <ChevronDown className={cn("size-3.5 transition-transform", show && "rotate-180")} />
      </button>

      {show &&
        (isLoading ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : count === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-4 py-5 text-center text-sm text-muted-foreground">
            No archived batches yet.
          </p>
        ) : (
          <div className="space-y-2">
            {archived!.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between gap-3 rounded-2xl border bg-card/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{batch.name}</p>
                    <Badge
                      variant="secondary"
                      className="rounded-full px-2 text-[10px] uppercase tracking-[0.18em]"
                    >
                      Archived
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {numberFormatter.format(batch.currentPopulation)} of{" "}
                    {numberFormatter.format(batch.initialPopulation)} birds · started{" "}
                    {formatDate(batch.startDate)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    nativeButton={false}
                    render={<Link href={`/batches/${batch.id}`} />}
                    variant="ghost"
                    className="h-9 rounded-xl px-3 text-xs font-semibold"
                  >
                    View
                  </Button>
                  <RestoreBatchButton batch={batch} />
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function CreateBatchDialog({ variant }: { variant?: "inline" }) {
  const [open, setOpen] = useState(false);
  const createBatch = useCreateBatch();

  const [name, setName] = useState("");
  const [initialPopulation, setInitialPopulation] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [bloodline, setBloodline] = useState("");
  const [source, setSource] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Stage is auto-derived from the start/hatch date on the backend.
      await createBatch.mutateAsync({
        name,
        initialPopulation: Number(initialPopulation),
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
            <Button className="h-11 rounded-full px-6 text-sm font-semibold shadow-sm">
              <Plus className="size-4" /> Create first batch
            </Button>
          ) : (
            <Button className="h-11 rounded-xl px-5 text-sm font-semibold shadow-sm">
              <Plus className="size-4" /> New batch
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg rounded-2xl">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pop" className="font-semibold">Number of birds</Label>
                <Input
                  id="pop"
                  type="number"
                  min={1}
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
                  className="h-11 rounded-xl"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              The lifecycle stage is set automatically from the start/hatch date and advances as
              the birds age. You can override it later from the batch page.
            </p>
            <div className="grid grid-cols-2 gap-3">
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
              disabled={createBatch.isPending || !name.trim() || !initialPopulation || !startDate}
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
