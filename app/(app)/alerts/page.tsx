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
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";

const severityConfig: Record<Severity, { label: string; badgeClass: string; statClass: string }> = {
  INFO: { label: "Info", badgeClass: "border-primary/20 bg-primary/10 text-primary", statClass: "text-primary" },
  WARNING: { label: "Warning", badgeClass: "border-warning-border bg-warning-muted text-warning-ink", statClass: "text-warning-ink" },
  CRITICAL: { label: "Critical", badgeClass: "border-destructive/20 bg-destructive/10 text-destructive", statClass: "text-destructive" },
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
  const acknowledgeAllMutation = useAcknowledgeFarmAlert();

  const batchName = (batchId: number) =>
    batches?.find((b) => b.id === batchId)?.name ?? `Batch #${batchId}`;

  const items = alerts.data?.items ?? [];
  const alertErrorMessage = alerts.error instanceof ApiError
    ? alerts.error.message
    : "The alert service could not be reached. Check the backend connection and try again.";
  const unacknowledgedItems = items.filter((alert) => !alert.acknowledged);

  async function acknowledgeAll() {
    if (unacknowledgedItems.length === 0) return;
    try {
      await Promise.all(unacknowledgedItems.map((alert) => acknowledgeAllMutation.mutateAsync({ id: alert.id })));
      toast.success(`${unacknowledgedItems.length} alert${unacknowledgedItems.length === 1 ? "" : "s"} acknowledged`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to acknowledge all alerts");
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-[calc(100dvh-8rem)] w-full max-w-5xl min-w-0 flex-col gap-4 sm:gap-5">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Alerts"
          titleClassName="text-3xl sm:text-4xl"
          description={showAll ? "All alerts across your batches." : "Unacknowledged alerts across your batches."}
          className="sm:items-end"
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <AlertStat label="Active" value={summary.data?.activeTotal ?? "—"} />
          <AlertStat label="Critical" value={summary.data?.critical ?? "—"} className={severityConfig.CRITICAL.statClass} />
          <AlertStat label="Warning" value={summary.data?.warning ?? "—"} className={severityConfig.WARNING.statClass} />
          <AlertStat label="Info" value={summary.data?.info ?? "—"} className={severityConfig.INFO.statClass} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Active / All toggle */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Tabs value={showAll ? "all" : "active"} onValueChange={(value) => { setShowAll(value === "all"); setPage(0); }}>
              <TabsList aria-label="Alert status">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <NativeSelect aria-label="Alert severity" value={severity} onChange={(event) => { setSeverity(event.target.value as Severity | "ALL"); setPage(0); }}>
              <option value="ALL">All severities</option><option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="INFO">Info</option>
            </NativeSelect>
            <NativeSelect aria-label="Alert sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}>
              <option value="priority">Sort: Priority</option><option value="newest">Sort: Newest</option>
            </NativeSelect>
          </div>
          {isManager && unacknowledgedItems.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={acknowledgeAllMutation.isPending}
              onClick={acknowledgeAll}
            >
              {acknowledgeAllMutation.isPending && <Loader2 data-icon="inline-start" className="animate-spin" />} Acknowledge all
            </Button>
          )}
        </div>
      </div>

      {alerts.isLoading && (
        <Card className="overflow-hidden py-0 shadow-none">
          <div className="divide-y">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-none" />)}
          </div>
        </Card>
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Card className="overflow-hidden py-0 shadow-none">
            <div className="divide-y">
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
          </Card>
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

function AlertStat({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <Card className="min-w-0">
      <CardContent>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", className)}>{value}</p>
      </CardContent>
    </Card>
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
    <div className="flex min-w-0 flex-col gap-3 px-3 py-3.5 transition-colors hover:bg-muted/30 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-4">
      <Badge variant="outline" className={cn("w-fit shrink-0 text-[10px] uppercase tracking-wide", cfg.badgeClass)}>{cfg.label}</Badge>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{alert.message}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground">
          <Link href={`/batches/${alert.batchId}`} className="max-w-full truncate font-medium text-foreground/80 hover:text-foreground hover:underline">
            {batchName}
          </Link>
          <span aria-hidden="true">·</span>
          <span title={formatDateTime(alert.createdAt)}>{formatDateTime(alert.createdAt)}</span>
        </div>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Link
          href={`/batches/${alert.batchId}`}
          className={cn(buttonVariants({ variant: "outline", size: "xs" }), "min-w-0 flex-1 sm:flex-none")}
        >
          View batch
        </Link>
        {alert.acknowledged ? (
          <span className="flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-success-muted px-2 text-xs font-semibold text-success sm:flex-none">
            <Check className="size-3.5" />
            Acknowledged
          </span>
        ) : (
          canAck && (
            <Button
              size="xs"
              className="min-w-0 flex-1 bg-primary px-2 font-semibold sm:flex-none"
              disabled={acknowledge.isPending}
              onClick={ack}
            >
              {acknowledge.isPending && <Loader2 data-icon="inline-start" className="animate-spin" />} Acknowledge
            </Button>
          )
        )}
      </div>
    </div>
  );
}
