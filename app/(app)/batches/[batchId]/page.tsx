"use client";

import { use } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBatchOverview, useChangeStage } from "@/hooks/use-batches";
import { useAcknowledgeAlert } from "@/hooks/use-analytics";
import { useLifecycleStages } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime, formatScore, scoreColor } from "@/lib/format";
import type { Alert, Severity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const severityVariant: Record<Severity, "default" | "secondary" | "destructive"> = {
  INFO: "secondary",
  WARNING: "default",
  CRITICAL: "destructive",
};

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  const { isManager } = useAuth();
  const { data, isLoading, isError, error } = useBatchOverview(batchId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load batch."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { batch, latestIndicator, recentRecords, activeAlerts } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{batch.name}</h1>
            <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>
              {batch.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {batch.currentPopulation}/{batch.initialPopulation} birds · started{" "}
            {formatDate(batch.startDate)}
            {batch.bloodline ? ` · ${batch.bloodline}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href={`/batches/${batch.id}/data-entry`} />}>
            <ClipboardList className="size-4" /> Log record
          </Button>
          {isManager && (
            <Button variant="outline" render={<Link href={`/batches/${batch.id}/selection`} />}>
              <ListChecks className="size-4" /> Selection
            </Button>
          )}
          {isManager && <StageSelect batchId={batch.id} currentStageId={batch.stageId} />}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Readiness (CRS)"
          value={formatScore(latestIndicator?.readinessScore)}
          valueClass={scoreColor(latestIndicator?.readinessScore)}
        />
        <Kpi
          label="Brooding Health (BHI)"
          value={formatScore(latestIndicator?.bhi)}
          valueClass={scoreColor(latestIndicator?.bhi)}
        />
        <Kpi label="Behaviour Stress (BSI)" value={formatScore(latestIndicator?.bsi)} />
        <Kpi label="Water:Feed Ratio (WFR)" value={formatScore(latestIndicator?.wfr, 2)} />
      </div>
      {latestIndicator && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Latest indicator from {formatDate(latestIndicator.recordDate)}.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent daily records</CardTitle>
            <CardDescription>Last {recentRecords.length} entries</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No records yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Temp °C</TableHead>
                    <TableHead className="text-right">Mortality</TableHead>
                    <TableHead className="text-right">Feed g</TableHead>
                    <TableHead className="text-right">Water ml</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.recordDate)}</TableCell>
                      <TableCell className="text-right">{r.temperatureC}</TableCell>
                      <TableCell className="text-right">{r.mortalityCount}</TableCell>
                      <TableCell className="text-right">{r.feedIntakeG}</TableCell>
                      <TableCell className="text-right">{r.waterIntakeMl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" /> Active alerts
            </CardTitle>
            <CardDescription>{activeAlerts.length} open</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAlerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active alerts.
              </p>
            ) : (
              activeAlerts.map((a) => (
                <AlertItem key={a.id} batchId={batch.id} alert={a} canAck={isManager} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold ${valueClass ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AlertItem({
  batchId,
  alert,
  canAck,
}: {
  batchId: number;
  alert: Alert;
  canAck: boolean;
}) {
  const acknowledge = useAcknowledgeAlert(batchId);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={severityVariant[alert.severity]}>{alert.severity}</Badge>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(alert.createdAt)}
        </span>
      </div>
      <p className="mt-2 text-sm">{alert.message}</p>
      {canAck && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={acknowledge.isPending}
          onClick={() =>
            acknowledge
              .mutateAsync({ id: alert.id })
              .then(() => toast.success("Alert acknowledged"))
              .catch((err) =>
                toast.error(err instanceof ApiError ? err.message : "Failed")
              )
          }
        >
          {acknowledge.isPending && <Loader2 className="size-4 animate-spin" />}
          Acknowledge
        </Button>
      )}
    </div>
  );
}

function StageSelect({
  batchId,
  currentStageId,
}: {
  batchId: number;
  currentStageId: number;
}) {
  const { data: stages } = useLifecycleStages();
  const changeStage = useChangeStage(batchId);

  return (
    <Select
      value={String(currentStageId)}
      onValueChange={(v) => {
        if (!v) return;
        changeStage
          .mutateAsync(Number(v))
          .then(() => toast.success("Stage updated"))
          .catch((err) =>
            toast.error(err instanceof ApiError ? err.message : "Failed to change stage")
          );
      }}
    >
      <SelectTrigger className="w-44 capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stages?.map((s) => (
          <SelectItem key={s.id} value={String(s.id)} className="capitalize">
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
