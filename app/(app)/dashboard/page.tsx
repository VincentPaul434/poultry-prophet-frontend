"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, Loader2, Plus, Users } from "lucide-react";
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

function healthLabel(score: number | null | undefined) {
  if (score == null) return null;
  if (score >= 70) return { label: "Healthy", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 50) return { label: "Watch", color: "text-amber-600 dark:text-amber-400" };
  return { label: "Alert", color: "text-red-600 dark:text-red-400" };
}

export default function DashboardPage() {
  const { isManager, user } = useAuth();
  const { data: batches, isLoading, isError, error } = useBatches();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName?.split(" ")[0];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <FarmOnboardingBanner />
      <PendingInvitesBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {batches
              ? `${batches.filter((b) => b.status === "ACTIVE").length} active batch${batches.filter((b) => b.status === "ACTIVE").length !== 1 ? "es" : ""}`
              : "Loading your batches…"}
          </p>
        </div>
        <CreateBatchDialog />
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive font-medium">
            {error instanceof ApiError ? error.message : "Could not load batches."}
          </p>
        </div>
      )}

      {/* Empty state */}
      {batches && batches.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center space-y-3">
          <div className="text-5xl">🐔</div>
          <p className="font-semibold text-foreground">No batches yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first batch to start tracking your game fowl.
          </p>
          <CreateBatchDialog variant="inline" />
        </div>
      )}

      {/* Batch cards */}
      {batches && batches.length > 0 && (
        <div className="space-y-3">
          {batches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} isManager={isManager} />
          ))}
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
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Colored top strip by stage */}
      <div className={cn("h-1.5 w-full", stageBar)} />

      <div className="p-4 space-y-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold truncate">{batch.name}</h2>
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
          <div className="shrink-0 rounded-xl bg-muted px-3 py-1.5 text-center">
            <p className="text-lg font-bold leading-none">{days}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">days old</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
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
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", stageBar)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          {isManager ? (
            <Link
              href={`/batches/${batch.id}`}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View details
            </Link>
          ) : (
            <>
              <Link
                href={`/batches/${batch.id}`}
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-center text-sm font-semibold hover:bg-muted transition-colors"
              >
                View details
              </Link>
              <Link
                href={`/batches/${batch.id}`}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <ClipboardList className="size-4" />
                Log now
              </Link>
            </>
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
}: {
  value: string;
  label: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5 text-center">
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
            <Button className="h-11 rounded-xl px-5 font-semibold">
              <Plus className="size-4" /> Create first batch
            </Button>
          ) : (
            <Button className="h-10 rounded-xl px-4 font-semibold">
              <Plus className="size-4" /> New batch
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
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
