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
import type { Alert as AlertRecord, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const severityConfig: Record<Severity, { label: string; cls: string; icon: string }> = {
  INFO: { label: "Info", cls: "border-primary/20 bg-primary/5", icon: "ℹ️" },
  WARNING: { label: "Warning", cls: "border-accent bg-accent/25", icon: "⚠️" },
  CRITICAL: { label: "Critical", cls: "border-destructive/25 bg-destructive/5", icon: "🚨" },
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
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            {showAll
              ? "All alerts across your batches."
              : "Unacknowledged alerts across your batches."}
          </p>
        </div>
        {/* Active / All toggle */}
        <div className="flex self-start rounded-xl border bg-card p-1 text-xs font-semibold sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={cn(
              "rounded-lg px-4 py-2 transition-colors",
              !showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              "rounded-lg px-4 py-2 transition-colors",
              showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
        </div>
      </div>

      {alerts.isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      )}

      {alerts.isError && (
        <Alert variant="destructive">
          <Bell />
          <AlertTitle>Failed to load alerts</AlertTitle>
          <AlertDescription>Please try again in a moment.</AlertDescription>
        </Alert>
      )}

      {alerts.data && sorted.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center sm:p-16">
          <div className="flex justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-6" />
            </span>
          </div>
          <p className="text-base font-semibold">
            {showAll ? "No alerts yet" : "You're all caught up"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {showAll
              ? "Alerts will appear here when a batch crosses a threshold."
              : "No unacknowledged alerts right now."}
          </p>
          </CardContent>
        </Card>
      )}

      {sorted.length > 0 && (
        <div className="space-y-4">
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
  alert: AlertRecord;
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
    <div className={cn("rounded-2xl border p-5 sm:p-6", cfg.cls)}>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/70 text-xl">
          {cfg.icon}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="outline" className="w-fit uppercase tracking-wide">{cfg.label}</Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
          </div>

          <Link
            href={`/batches/${alert.batchId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/80 hover:text-foreground"
          >
            {batchName}
            <ChevronRight className="size-3.5" />
          </Link>

          <p className="text-sm leading-relaxed sm:text-base">{alert.message}</p>

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
