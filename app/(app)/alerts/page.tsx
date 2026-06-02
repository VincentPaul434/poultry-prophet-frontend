"use client";

// Farm-wide notifications centre: active (and optionally resolved) alerts across
// every batch, each linking to its batch. Managers can acknowledge inline; the
// backend restricts acknowledgement to managers, so handlers see a read-only feed.

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFarmAlerts, useAcknowledgeFarmAlert } from "@/hooks/use-analytics";
import { useBatches } from "@/hooks/use-batches";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { Alert, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const severityConfig: Record<Severity, { label: string; cls: string; icon: string }> = {
  INFO: { label: "Info", cls: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40", icon: "ℹ️" },
  WARNING: { label: "Warning", cls: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40", icon: "⚠️" },
  CRITICAL: { label: "Critical", cls: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40", icon: "🚨" },
};

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export default function AlertsPage() {
  const { isManager } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const alerts = useFarmAlerts(!showAll);
  const { data: batches } = useBatches();

  const batchName = (batchId: number) =>
    batches?.find((b) => b.id === batchId)?.name ?? `Batch #${batchId}`;

  // Most severe first, then most recent.
  const sorted = [...(alerts.data ?? [])].sort((a, b) => {
    const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return r !== 0 ? r : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {showAll
              ? "All alerts across your batches."
              : "Unacknowledged alerts across your batches."}
          </p>
        </div>
        {/* Active / All toggle */}
        <div className="flex shrink-0 rounded-xl border bg-card p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-colors",
              !showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-colors",
              showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
        </div>
      </div>

      {alerts.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}

      {alerts.isError && (
        <p className="text-sm text-destructive">Failed to load alerts.</p>
      )}

      {alerts.data && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card py-14 text-center space-y-2">
          <div className="flex justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-6" />
            </span>
          </div>
          <p className="text-sm font-semibold">
            {showAll ? "No alerts yet" : "You're all caught up"}
          </p>
          <p className="text-xs text-muted-foreground">
            {showAll
              ? "Alerts will appear here when a batch crosses a threshold."
              : "No unacknowledged alerts right now."}
          </p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="space-y-2.5">
          {sorted.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              batchName={batchName(a.batchId)}
              canAck={isManager}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  batchName,
  canAck,
}: {
  alert: Alert;
  batchName: string;
  canAck: boolean;
}) {
  const acknowledge = useAcknowledgeFarmAlert();
  const cfg = severityConfig[alert.severity];

  function ack() {
    acknowledge
      .mutateAsync({ id: alert.id })
      .then(() => toast.success("Alert acknowledged"))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Failed to acknowledge"));
  }

  return (
    <div className={cn("rounded-2xl border p-4", cfg.cls)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-xl">{cfg.icon}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide">{cfg.label}</span>
            <span className="text-[10px] text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
          </div>

          <Link
            href={`/batches/${alert.batchId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 hover:text-foreground"
          >
            {batchName}
            <ChevronRight className="size-3.5" />
          </Link>

          <p className="text-sm leading-snug">{alert.message}</p>

          {alert.acknowledged ? (
            <p className="flex items-center gap-1.5 pt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" />
              Acknowledged
            </p>
          ) : (
            canAck && (
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-8 rounded-lg text-xs font-semibold"
                disabled={acknowledge.isPending}
                onClick={ack}
              >
                {acknowledge.isPending && <Loader2 className="size-3 animate-spin" />}
                Mark as seen
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
