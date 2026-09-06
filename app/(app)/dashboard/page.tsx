"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useBatches, useCreateBatch } from "@/hooks/use-batches";
import { useLifecycleStages } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import type { Batch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const PAGE_SIZE = 5;

export default function DashboardPage() {
  const { isManager, user } = useAuth();
  const { data: batches, isLoading, isError, error } = useBatches();
  const [page, setPage] = useState(1);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName?.split(" ")[0];
  const totalPages = batches ? Math.max(1, Math.ceil(batches.length / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleBatches = batches?.slice(pageStart, pageStart + PAGE_SIZE) ?? [];

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
          <p className="text-sm text-muted-foreground">
            {batches
              ? `${batches.filter((b) => b.status === "ACTIVE").length} active batch${batches.filter((b) => b.status === "ACTIVE").length !== 1 ? "es" : ""}`
              : "Loading your batches…"}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <CreateBatchDialog />
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
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
            <CardTitle className="text-base">No batches yet</CardTitle>
            <CardDescription>
              Create your first batch to start tracking your game fowl.
            </CardDescription>
            <CreateBatchDialog variant="inline" />
          </CardContent>
        </Card>
      )}

      {/* Batch cards */}
      {batches && batches.length > 0 && (
        <div className="space-y-5">
          {visibleBatches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} isManager={isManager} />
          ))}
          {totalPages > 1 && (
            <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, batches.length)} of {batches.length} batches
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
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
                  size="icon-sm"
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
  const days = daysElapsed(batch.startDate);
  const totalTarget = 150;
  const progress = Math.min(100, Math.round((days / totalTarget) * 100));
  const stageBar = stageColor(batch.stageName);

  return (
    <Card className="overflow-hidden">
      {/* Colored top strip by stage */}
      <div className={cn("h-1.5 w-full", stageBar)} />

      <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="truncate text-base">{batch.name}</CardTitle>
              <Badge
                variant={batch.status === "ACTIVE" ? "default" : "secondary"}
                className="shrink-0 text-[10px]"
              >
                {batch.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {batch.stageName} · started {formatDate(batch.startDate)}
              {batch.bloodline ? ` · ${batch.bloodline}` : ""}
            </p>
          </div>
          {/* Days badge */}
          <Badge variant="secondary" className="h-auto min-w-16 shrink-0 flex-col rounded-lg px-2 py-1.5 text-center">
            <span className="text-lg font-bold leading-none">{days}</span>
            <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">days old</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5 sm:p-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatPill
            value={`${batch.currentPopulation}`}
            label="Birds alive"
            icon="🐔"
          />
          <StatPill
            value={`${batch.initialPopulation - batch.currentPopulation}`}
            label="Mortality"
            icon="📉"
          />
          <StatPill
            value={`${Math.round(100 - (batch.currentPopulation / batch.initialPopulation) * 100)}%`}
            label="Loss rate"
            icon="📊"
          />
        </div>

        {/* Timeline progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <span>Lifecycle</span>
            <span>
              <span className="font-semibold text-foreground">Day {days}</span>
              {" "}of 150 &nbsp;·&nbsp; {progress}%
            </span>
          </div>
          <Progress value={progress} aria-label={`${batch.name} lifecycle progress`} className="gap-0 [&_[data-slot=progress-track]]:h-2" />
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-3 border-t-0 bg-transparent p-5 pt-0 sm:flex-row sm:p-6 sm:pt-0">
        {/* Actions */}
        {isManager ? (
          <Button className="w-full sm:flex-1" render={<Link href={`/batches/${batch.id}`} />}>
            View details
          </Button>
        ) : (
          <>
            <Button variant="outline" className="w-full sm:flex-1" render={<Link href={`/batches/${batch.id}`} />}>
              View details
            </Button>
            <Button className="w-full sm:flex-1" render={<Link href={`/batches/${batch.id}`} />}>
              <ClipboardList className="size-4" />
              Log now
            </Button>
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
    <div className="rounded-xl bg-muted/60 p-4 text-center sm:p-5">
      <div className="text-base">{icon}</div>
      <p className="text-sm font-bold mt-0.5">{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

function CreateBatchDialog({ variant }: { variant?: "inline" }) {
  const [open, setOpen] = useState(false);
  const { data: stages } = useLifecycleStages();
  const createBatch = useCreateBatch();

  const [name, setName] = useState("");
  const [initialPopulation, setInitialPopulation] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [stageId, setStageId] = useState<string>("");
  const [bloodline, setBloodline] = useState("");
  const [source, setSource] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createBatch.mutateAsync({
        name,
        initialPopulation: Number(initialPopulation),
        startDate,
        stageId: Number(stageId),
        bloodline: bloodline || null,
        source: source || null,
      });
      toast.success("Batch created!");
      setOpen(false);
      setName("");
      setInitialPopulation("");
      setBloodline("");
      setSource("");
      setStageId("");
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
            <Button className="h-10 w-full rounded-xl px-4 font-semibold sm:w-auto">
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
            <div className="space-y-2">
              <Label htmlFor="stage" className="font-semibold">Starting stage</Label>
              <Select value={stageId} onValueChange={(v) => setStageId(v ?? "")}>
                <SelectTrigger id="stage" className="h-11 w-full rounded-xl">
                  <SelectValue placeholder="Choose stage…" />
                </SelectTrigger>
                <SelectContent>
                  {stages?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} className="capitalize">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={createBatch.isPending || !stageId}
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
