"use client";

// Farm-wide notifications centre: active (and optionally resolved) alerts across
// every batch, each linking to its batch. Managers can acknowledge inline; the
// backend restricts acknowledgement to managers, so handlers see a read-only feed.

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFarmAlertPage, useFarmAlertSummary, useAcknowledgeFarmAlert } from "@/hooks/use-analytics";
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
import { PageBackLink } from "@/components/page-back-link";

const severityConfig: Record<Severity, { label: string; cls: string; icon: string }> = {
  INFO: { label: "Info", cls: "border-primary/20 bg-primary/5", icon: "ℹ️" },
  WARNING: { label: "Warning", cls: "border-accent bg-accent/25", icon: "⚠️" },
  CRITICAL: { label: "Critical", cls: "border-destructive/25 bg-destructive/5", icon: "🚨" },
};

export default function AlertsPage() {
  const { isManager } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [sort, setSort] = useState("priority");
  const alerts = useFarmAlertPage({ activeOnly: !showAll, page, size: 20, severity: severity === "ALL" ? undefined : severity, sort });
  const summary = useFarmAlertSummary();
  const { data: batches } = useBatches();

  const batchName = (batchId: number) =>
    batches?.find((b) => b.id === batchId)?.name ?? `Batch #${batchId}`;

  const items = alerts.data?.items ?? [];
  const alertErrorMessage = alerts.error instanceof ApiError
    ? alerts.error.message
    : "The alert service could not be reached. Check the backend connection and try again.";

  return (
    <div className="mx-auto flex h-full min-h-[calc(100dvh-8rem)] w-full max-w-5xl min-w-0 flex-col gap-5">
      <PageBackLink destination="dashboard" />
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
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        <div className="flex rounded-xl border bg-card p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setShowAll(false); setPage(0); }}
            aria-pressed={!showAll}
            className={cn(
              "min-h-11 rounded-lg px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              !showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => { setShowAll(true); setPage(0); }}
            aria-pressed={showAll}
            className={cn(
              "min-h-11 rounded-lg px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
        </div>
        <select aria-label="Alert severity" className="min-h-11 rounded-xl border bg-card px-3 text-sm" value={severity} onChange={(event) => { setSeverity(event.target.value as Severity | "ALL"); setPage(0); }}>
          <option value="ALL">All severities</option><option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="INFO">Info</option>
        </select>
        <select aria-label="Alert sort" className="min-h-11 rounded-xl border bg-card px-3 text-sm" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}>
          <option value="priority">Priority</option><option value="newest">Newest</option>
        </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Active: {summary.data?.activeTotal ?? "—"}</Badge>
        <Badge variant="outline">Critical: {summary.data?.critical ?? "—"}</Badge>
        <Badge variant="outline">Warning: {summary.data?.warning ?? "—"}</Badge>
        <Badge variant="outline">Info: {summary.data?.info ?? "—"}</Badge>
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
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{alertErrorMessage}</span>
            <Button type="button" variant="outline" size="sm" disabled={alerts.isFetching} onClick={() => alerts.refetch()}>
              {alerts.isFetching && <Loader2 className="size-3 animate-spin" />}
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {alerts.data && items.length === 0 && (
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
              ? "Factual event notices and review reminders will appear here when available."
              : "No unacknowledged alerts right now."}
          </p>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {items.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              batchName={batchName(a.batchId)}
              canAck={isManager}
              onAcknowledged={() => {
                if (!showAll && items.length === 1 && page > 0) setPage((value) => Math.max(0, value - 1));
              }}
            />
          ))}
        </div>
      )}
      {alerts.data && alerts.data.totalPages > 0 && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
          <span>{alerts.data.totalItems} eligible alert{alerts.data.totalItems === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={!alerts.data.hasPrevious} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="size-4" />Previous</Button><span>Page {alerts.data.page + 1} of {alerts.data.totalPages}</span><Button type="button" variant="outline" size="sm" disabled={!alerts.data.hasNext} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="size-4" /></Button></div>
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  batchName,
  canAck,
  onAcknowledged,
}: {
  alert: AlertRecord;
  batchName: string;
  canAck: boolean;
  onAcknowledged: () => void;
}) {
  const acknowledge = useAcknowledgeFarmAlert();
  const cfg = severityConfig[alert.severity];

  function ack() {
    acknowledge
      .mutateAsync({ id: alert.id })
      .then(() => {
        onAcknowledged();
        toast.success("Alert acknowledged");
      })
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
            <p className="flex items-center gap-1.5 pt-0.5 text-xs font-medium text-success">
              <Check className="size-3.5" />
              Acknowledged
            </p>
          ) : (
            canAck && (
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-11 rounded-lg text-sm font-semibold"
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
