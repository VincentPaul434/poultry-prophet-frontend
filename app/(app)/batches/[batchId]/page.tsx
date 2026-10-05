"use client";

import { use } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList, Loader2 } from "lucide-react";
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
import { BatchLogSection, EVENT_EMOJI } from "@/components/batch-log-section";
import { getLoggingHref, LOGGING_ORIGINS } from "@/lib/logging-navigation";
import { SelectionReviewSummary } from "@/components/selection-review-summary";
import { SelectionSessionDialog } from "@/components/selection-session-dialog";

function daysElapsed(startDate: string) {
  return Math.max(1, Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000));
}

const severityConfig: Record<Severity, { label: string; cls: string; icon: string }> = {
  INFO: { label: "Info", cls: "border-border bg-muted/40", icon: "ℹ️" },
  WARNING: { label: "Warning", cls: "border-warning-border bg-warning-muted text-warning-ink", icon: "⚠️" },
  CRITICAL: { label: "Critical", cls: "border-destructive/30 bg-destructive/5 text-destructive", icon: "🚨" },
};

function AlertItem({ batchId, alert, canAck }: { batchId: number; alert: Alert; canAck: boolean }) {
  const acknowledge = useAcknowledgeAlert(batchId);
  const cfg = severityConfig[alert.severity];
  return (
    <div className={cn("rounded-xl border p-3", cfg.cls)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-lg">{cfg.icon}</span>
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

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const { isManager } = useAuth();
  const { data, isLoading, isError, error } = useBatchOverview(batchId);
  const { data: recentEvents } = useBatchEvents(batchId, 3);

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
  const days = daysElapsed(batch.startDate);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <PageBackLink destination="dashboard" />

      <header className="rounded-2xl border bg-card px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight">{batch.name}</h1>
              <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>{batch.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {batch.currentPopulation} / {batch.initialPopulation} birds · Day {days}
              {batch.bloodline ? ` · ${batch.bloodline}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 sm:min-w-44 sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current stage</p>
              <p className="text-sm font-bold capitalize text-primary">{batch.stageName.replace("-", " ")}</p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">Day {days}</span>
          </div>
        </div>
      </header>

      {!isManager && (
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Record activity</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Saved directly to {batch.name}. Date defaults to today.</p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Batch selected</span>
          </div>
          <BatchLogSection batchId={String(batch.id)} population={batch.currentPopulation} batchName={batch.name} stageName={batch.stageName} />
        </section>
      )}


      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-4">
          {isManager && <SelectionSessionDialog batchId={batch.id} batchName={batch.name} currentPopulation={batch.currentPopulation} />}
          <SelectionReviewSummary batchId={batch.id} />

          {recentEvents && recentEvents.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent events</h2>
                <Link href={getLoggingHref(batch.id, LOGGING_ORIGINS.batch)} className="text-xs font-semibold text-primary hover:underline underline-offset-4">
                  See all
                </Link>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-card">
                {recentEvents.slice(0, 3).map((ev, idx) => (
                  <div key={ev.id} className={cn("flex items-start gap-3 px-4 py-3", idx !== 0 && "border-t")}>
                    <span className="mt-0.5 shrink-0 text-lg">{EVENT_EMOJI[ev.eventType]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{ev.title}</p>
                        {ev.affectedCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">{ev.affectedCount} bird{ev.affectedCount !== 1 ? "s" : ""}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ev.handlerName} · {formatDate(ev.eventDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="min-w-0 space-y-4">
          {isManager && (
            <Link href={getLoggingHref(batch.id, LOGGING_ORIGINS.batch)} className="flex min-h-14 items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted">
              <span className="flex items-center gap-2.5"><ClipboardList className="size-4 text-muted-foreground" />Event log</span>
              <span className="text-xs text-muted-foreground">View logs →</span>
            </Link>
          )}

          {activeAlerts.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 px-0.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="size-4 text-warning" />
                {activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""}
              </h2>
              <div className="space-y-2">
                {activeAlerts.map((alert) => <AlertItem key={alert.id} batchId={batch.id} alert={alert} canAck={isManager} />)}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
