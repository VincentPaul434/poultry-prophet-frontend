"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useHandlers, useThresholds, useUpdateThreshold } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import type { Threshold } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function SettingsPage() {
  const { isManager } = useAuth();
  const thresholds = useThresholds();
  const handlers = useHandlers(isManager);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Alert thresholds and farm handlers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert thresholds</CardTitle>
          <CardDescription>
            Indicator bands that drive alerting. {isManager ? "Editable." : "Read-only."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {thresholds.isLoading && <Skeleton className="h-32 w-full rounded-lg" />}
          {thresholds.isError && (
            <p className="text-sm text-destructive">Failed to load thresholds.</p>
          )}
          {thresholds.data?.map((t) => (
            <ThresholdRow key={t.id} threshold={t} editable={isManager} />
          ))}
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Handlers</CardTitle>
            <CardDescription>Handlers assigned to your farm.</CardDescription>
          </CardHeader>
          <CardContent>
            {handlers.isLoading && <Skeleton className="h-24 w-full rounded-lg" />}
            {handlers.data && handlers.data.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No handlers yet. Invite handlers from the backend invites endpoint.
              </p>
            )}
            {handlers.data && handlers.data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {handlers.data.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.fullName}</TableCell>
                      <TableCell className="text-muted-foreground">{h.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ThresholdRow({
  threshold,
  editable,
}: {
  threshold: Threshold;
  editable: boolean;
}) {
  const update = useUpdateThreshold();
  const [min, setMin] = useState(String(threshold.minValue));
  const [max, setMax] = useState(String(threshold.maxValue));

  // Keep local inputs in sync if the cached threshold changes elsewhere.
  useEffect(() => {
    setMin(String(threshold.minValue));
    setMax(String(threshold.maxValue));
  }, [threshold.minValue, threshold.maxValue]);

  const dirty = min !== String(threshold.minValue) || max !== String(threshold.maxValue);

  async function save() {
    if (Number(min) > Number(max)) {
      toast.error("Min must not exceed max.");
      return;
    }
    try {
      await update.mutateAsync({
        id: threshold.id,
        body: { minValue: Number(min), maxValue: Number(max) },
      });
      toast.success(`${threshold.indicator} threshold saved`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="w-20">
        <p className="text-sm font-semibold">{threshold.indicator}</p>
        <p className="text-xs text-muted-foreground">
          {threshold.farmId == null ? "Global" : "Farm"}
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Min</label>
        <Input
          type="number"
          step="0.1"
          className="w-28"
          value={min}
          disabled={!editable}
          onChange={(e) => setMin(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Max</label>
        <Input
          type="number"
          step="0.1"
          className="w-28"
          value={max}
          disabled={!editable}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>
      {editable && (
        <Button size="sm" variant="outline" onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save
        </Button>
      )}
    </div>
  );
}
