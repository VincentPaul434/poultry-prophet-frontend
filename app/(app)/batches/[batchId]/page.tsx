"use client";

import { use } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ClipboardList,
  ListChecks,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useBatchOverview, useChangeStage, useAutoStage } from "@/hooks/use-batches";
import { useAcknowledgeAlert } from "@/hooks/use-analytics";
import { useLifecycleStages } from "@/hooks/use-reference";
import { useBatchEvents } from "@/hooks/use-events";
import { qk } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Alert, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BatchLogSection, EVENT_EMOJI } from "@/components/batch-log-section";
import {
  ArchiveBatchButton,
  RestoreBatchButton,
} from "@/components/archive-batch-controls";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysElapsed(startDate: string) {
  return Math.max(1, Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000));
}

function stageStep(days: number) {
  if (days <= 30) return 1;
  if (days <= 120) return 2;
  return 3;
}

function scoreToStatus(score: number | null | undefined) {
  if (score == null) return { label: "Not yet scored", color: "text-muted-foreground", dot: "bg-muted-foreground" };
  if (score >= 70) return { label: "Good", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
  if (score >= 50) return { label: "Watch", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
  return { label: "Alert", color: "text-red-600 dark:text-red-400", dot: "bg-red-500" };
}

const severityConfig: Record<Severity, { label: string; cls: string; icon: string }> = {
  INFO: { label: "Info", cls: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40", icon: "ℹ️" },
  WARNING: { label: "Warning", cls: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40", icon: "⚠️" },
  CRITICAL: { label: "Critical", cls: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40", icon: "🚨" },
};

// ─── Stage progress strip ─────────────────────────────────────────────────────

function StageProgress({ days }: { days: number }) {
  const step = stageStep(days);
  const steps = [
    { n: 1, label: "Brooding", range: "Day 1–30" },
    { n: 2, label: "Ranging", range: "Day 31–120" },
    { n: 3, label: "Selection", range: "Day 121–150" },
  ];
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                s.n < step ? "bg-primary text-primary-foreground" : s.n === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground")}>
                {s.n < step ? "✓" : s.n}
              </div>
              <p className={cn("text-[10px] font-semibold text-center leading-tight", s.n === step ? "text-primary" : "text-muted-foreground")}>{s.label}</p>
              <p className="text-[9px] text-muted-foreground text-center">{s.range}</p>
            </div>
            {i < steps.length - 1 && <div className={cn("h-0.5 w-6 shrink-0 rounded-full", s.n < step ? "bg-primary" : "bg-muted")} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Health card ──────────────────────────────────────────────────────────────

function HealthCard({ label, technicalLabel, score, icon }: { label: string; technicalLabel: string; score: number | null | undefined; icon: string }) {
  const status = scoreToStatus(score);
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        <div className={cn("flex items-center gap-1.5", status.color)}>
          <div className={cn("size-2 rounded-full", status.dot)} />
          <span className="text-xs font-bold">{status.label}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold leading-tight">{label}</p>
        <p className="text-[10px] text-muted-foreground">{technicalLabel}</p>
      </div>
      <p className={cn("text-2xl font-bold", status.color)}>{score != null ? score.toFixed(1) : "—"}</p>
    </div>
  );
}

// ─── Alert item ───────────────────────────────────────────────────────────────

function AlertItem({ batchId, alert, canAck }: { batchId: number; alert: Alert; canAck: boolean }) {
  const acknowledge = useAcknowledgeAlert(batchId);
  const cfg = severityConfig[alert.severity];
  return (
    <div className={cn("rounded-xl border p-3.5", cfg.cls)}>
      <div className="flex items-start gap-2.5">
        <span className="text-xl shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide">{cfg.label}</span>
            <span className="text-[10px] text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
          </div>
          <p className="text-sm leading-snug">{alert.message}</p>
          {canAck && (
            <Button size="sm" variant="outline" className="mt-1 h-8 w-full rounded-lg text-xs font-semibold" disabled={acknowledge.isPending}
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

// ─── Stage selector (manager-only) ───────────────────────────────────────────

function StageSelect({ batchId, currentStageId, auto, stageName }: { batchId: number; currentStageId: number; auto: boolean; stageName: string }) {
  const { data: stages } = useLifecycleStages();
  const changeStage = useChangeStage(batchId);
  const autoStage = useAutoStage(batchId);
  return (
    <Select value={auto ? "auto" : String(currentStageId)} onValueChange={(v) => {
      if (!v) return;
      if (v === "auto") {
        autoStage.mutateAsync().then(() => toast.success("Stage now follows age")).catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed to change stage"));
        return;
      }
      changeStage.mutateAsync(Number(v)).then(() => toast.success("Stage updated")).catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed to change stage"));
    }}>
      <SelectTrigger className="h-10 w-44 rounded-xl capitalize text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="auto" className="capitalize">Auto · {stageName}</SelectItem>
        {stages?.map((s) => <SelectItem key={s.id} value={String(s.id)} className="capitalize">{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: qk.batches.detail(batchId) }) > 0;
  const { data, isLoading, isError, error } = useBatchOverview(batchId);
  const { data: recentEvents } = useBatchEvents(batchId, 5);

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: qk.batches.detail(batchId) });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground rounded-xl"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <ArrowLeft className="size-4" /> Back to dashboard
        </Button>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load batch."}
          </p>
        </div>
      </div>
    );
  }

  const { batch, latestIndicator, activeAlerts } = data;
  const days = daysElapsed(batch.startDate);

  return (
    <div className="mx-auto max-w-2xl space-y-4">

      {/* Back to dashboard */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1.5 text-muted-foreground rounded-xl"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Button>

      {/* ── 1. Compact header ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{batch.name}</h1>
              <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>{batch.status}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground hover:text-foreground size-7"
                onClick={refreshAll}
                disabled={isFetching}
                title="Refresh"
              >
                <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {batch.currentPopulation} of {batch.initialPopulation} birds ·{" "}
              <span className="font-medium">{days} days old</span>
              {batch.bloodline ? ` · ${batch.bloodline}` : ""}
            </p>
          </div>
          {isManager && (
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <StageSelect batchId={batch.id} currentStageId={batch.stageId} auto={batch.stageAuto} stageName={batch.stageName} />
              <div className="flex items-center gap-1.5">
                <Link href={`/batches/${batch.id}/selection`}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors">
                  <ListChecks className="size-3.5" /> Selection
                </Link>
                {batch.status === "ARCHIVED" ? (
                  <RestoreBatchButton batch={batch} />
                ) : (
                  <ArchiveBatchButton batch={batch} className="h-9 px-3 text-xs" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Archived notice ────────────────────────────────────────────── */}
      {batch.status === "ARCHIVED" && (
        <div className="flex items-center gap-2.5 rounded-2xl border bg-muted/50 px-4 py-3">
          <Archive className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This batch is <span className="font-semibold text-foreground">archived</span> — hidden from the
            active dashboard. Restore it to resume tracking.
          </p>
        </div>
      )}

      {/* ── No birds left → suggest archiving (managers only) ──────────── */}
      {isManager && batch.status !== "ARCHIVED" && batch.currentPopulation <= 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Archive className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold">No birds left in this batch</p>
              <p className="text-xs text-muted-foreground">
                Archive it to clear it from your active dashboard. All records and scores are kept.
              </p>
            </div>
          </div>
          <ArchiveBatchButton batch={batch} className="h-9 px-3 text-xs sm:self-center" />
        </div>
      )}

      {/* ── 2. Quick Log (handlers) / Event log link (managers) ───────── */}
      {!isManager ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Quick Log
            </h2>
            <Link
              href={`/batches/${batch.id}/data-entry`}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
            >
              <ClipboardList className="size-3.5" />
              View all events
            </Link>
          </div>
          <BatchLogSection batchId={String(batch.id)} population={batch.currentPopulation} />
        </section>
      ) : (
        <Link
          href={`/batches/${batch.id}/data-entry`}
          className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3.5 text-sm font-semibold hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ClipboardList className="size-4 text-muted-foreground" />
            <span>Event Log</span>
          </div>
          <span className="text-xs text-muted-foreground">View handler field logs →</span>
        </Link>
      )}

      {/* ── 3. Stage progress ──────────────────────────────────────────── */}
      <StageProgress days={days} />

      {/* ── 4. Health KPIs ─────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-0.5">Health indicators</h2>
        <div className="grid grid-cols-2 gap-3">
          <HealthCard label="Overall Readiness" technicalLabel="CRS score" score={latestIndicator?.readinessScore} icon="🏆" />
          <HealthCard label="Brooding Health" technicalLabel="BHI score" score={latestIndicator?.bhi} icon="🌡️" />
          <HealthCard label="Behavior Stress" technicalLabel="BSI score" score={latestIndicator?.bsi} icon="😤" />
          <HealthCard label="Feed vs. Water" technicalLabel="WFR ratio" score={latestIndicator?.wfr} icon="💧" />
        </div>
        {latestIndicator && (
          <p className="text-[11px] text-muted-foreground px-0.5">
            Last computed from records on {formatDate(latestIndicator.recordDate)}.
          </p>
        )}
      </section>

      {/* ── 5. Active alerts ───────────────────────────────────────────── */}
      {activeAlerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider px-0.5">
            <AlertTriangle className="size-4 text-amber-500" />
            {activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? "s" : ""}
          </h2>
          <div className="space-y-2">
            {activeAlerts.map((a) => <AlertItem key={a.id} batchId={batch.id} alert={a} canAck={isManager} />)}
          </div>
        </section>
      )}

      {/* ── 6. Recent field events ─────────────────────────────────────── */}
      {recentEvents && recentEvents.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Recent events</h2>
            <Link href={`/batches/${batch.id}/data-entry`} className="text-xs font-semibold text-primary hover:underline underline-offset-4">
              See all
            </Link>
          </div>
          <div className="rounded-2xl border bg-card overflow-hidden">
            {recentEvents.slice(0, 5).map((ev, idx) => (
              <div key={ev.id} className={cn("flex items-start gap-3 px-4 py-3", idx !== 0 && "border-t")}>
                <span className="text-lg shrink-0 mt-0.5">{EVENT_EMOJI[ev.eventType]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{ev.title}</p>
                    {ev.affectedCount > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">{ev.affectedCount} bird{ev.affectedCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {ev.handlerName} · {formatDate(ev.eventDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
