"use client";

import { use } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useBatchOverview } from "@/hooks/use-batches";
import { useAcknowledgeAlert } from "@/hooks/use-analytics";
import { useBatchEvents } from "@/hooks/use-events";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Alert, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBackLink } from "@/components/page-back-link";
import { EVENT_EMOJI } from "@/components/batch-log-section";
import { getLoggingHref, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { SelectionReviewSummary } from "@/components/selection-review-summary";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysElapsed(startDate: string) {
  return Math.max(1, Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000));
}

function stageStep(days: number) {
  if (days <= 30) return 1;
  if (days <= 120) return 2;
  return 3;
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
    { n: 3, label: "Pre-conditioning", range: "Day 121+" },
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
              <p className={cn("text-xs font-semibold text-center leading-tight", s.n === step ? "text-primary" : "text-muted-foreground")}>{s.label}</p>
              <p className="text-xs text-muted-foreground text-center">{s.range}</p>
            </div>
            {i < steps.length - 1 && <div className={cn("h-0.5 w-6 shrink-0 rounded-full", s.n < step ? "bg-primary" : "bg-muted")} />}
          </div>
        ))}
      </div>
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
            <span className="text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
          </div>
          <p className="text-sm leading-snug">{alert.message}</p>
          {canAck && (
            <Button size="sm" variant="outline" className="mt-1 h-11 w-full rounded-lg text-sm font-semibold" disabled={acknowledge.isPending}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const { isManager } = useAuth();
  const { data, isLoading, isError, error } = useBatchOverview(batchId);
  const { data: recentEvents } = useBatchEvents(batchId, 5);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageBackLink destination="dashboard" />
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
  const days = daysElapsed(batch.startDate);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageBackLink destination="dashboard" />

      {/* ── 1. Compact header ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{batch.name}</h1>
              <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>{batch.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {batch.currentPopulation} of {batch.initialPopulation} birds ·{" "}
              <span className="font-medium">{days} days old</span>
              {batch.bloodline ? ` · ${batch.bloodline}` : ""}
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current stage</p>
            <p className="text-sm font-bold capitalize text-primary">{batch.stageName.replace("-", " ")}</p>
            <p className="text-xs text-muted-foreground">Based on age</p>
          </div>
        </div>
      </div>

      {/* ── 2. Task shortcut (handlers) / Event log link (managers) ───── */}
      {!isManager ? (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Record field activity</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Log deaths, sickness, medicine, behavior, or today&apos;s readings.
              </p>
            </div>
          </div>
          <Button
            className="w-full shrink-0 sm:w-auto"
            render={
              <Link
                href={getLoggingHref(batch.id, LOGGING_ORIGINS.batch, true)}
              />
            }
          >
            Log an event
          </Button>
        </section>
      ) : (
        <Link
          href={getLoggingHref(batch.id, LOGGING_ORIGINS.batch)}
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

      {/* ── 4. Factual selection-review summary ────────────────────────── */}
      <SelectionReviewSummary batchId={batch.id} />

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
            <Link href={getLoggingHref(batch.id, LOGGING_ORIGINS.batch)} className="text-xs font-semibold text-primary hover:underline underline-offset-4">
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
                  <p className="text-xs text-muted-foreground mt-0.5">
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
