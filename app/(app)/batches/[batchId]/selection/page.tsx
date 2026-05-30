"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useSelectionView, useSelectionDecision } from "@/hooks/use-selection";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api-client";
import { formatScore, scoreColor } from "@/lib/format";
import type { SelectionRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SelectionPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  return (
    <RouteGuard managerOnly>
      <SelectionView batchId={batchId} />
    </RouteGuard>
  );
}

interface PendingDecision {
  row: SelectionRow;
  advance: boolean;
}

function SelectionView({ batchId }: { batchId: string }) {
  const { data, isLoading, isError, error } = useSelectionView(batchId);
  const decide = useSelectionDecision(batchId);
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [reason, setReason] = useState("");

  const isOverride = pending ? pending.advance !== pending.row.recommendedAdvance : false;

  async function confirm() {
    if (!pending) return;
    if (isOverride && !reason.trim()) {
      toast.error("A reason is required when overriding the recommendation.");
      return;
    }
    try {
      await decide.mutateAsync({
        birdId: pending.row.birdId,
        body: { advance: pending.advance, reason: reason.trim() || null },
      });
      toast.success(
        `${pending.row.bandNumber} ${pending.advance ? "advanced" : "rejected"}`
      );
      setPending(null);
      setReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record decision");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          render={<Link href={`/batches/${batchId}`} />}
        >
          <ArrowLeft className="size-4" /> Back to batch
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Month-5 selection</h1>
        <p className="text-sm text-muted-foreground">
          Birds ranked by Conditioning Readiness Score (CRS).
          {data ? ` Suggested cut-line: ${formatScore(data.cutLineCrs)}.` : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranked candidates</CardTitle>
          <CardDescription>
            Sub-scores are shown alongside the CRS so every ranking is interrogable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
          {isError && (
            <p className="py-6 text-center text-sm text-destructive">
              {error instanceof ApiError ? error.message : "Failed to load selection."}
            </p>
          )}
          {data && data.rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No scored birds yet for this batch.
            </p>
          )}
          {data && data.rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead className="text-right">CRS</TableHead>
                    <TableHead className="text-right">BHI</TableHead>
                    <TableHead className="text-right">Growth</TableHead>
                    <TableHead className="text-right">Health</TableHead>
                    <TableHead className="text-right">Behaviour</TableHead>
                    <TableHead className="text-center">Rec.</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.birdId}>
                      <TableCell className="text-muted-foreground">{row.rank}</TableCell>
                      <TableCell className="font-medium">{row.bandNumber}</TableCell>
                      <TableCell className={`text-right font-semibold ${scoreColor(row.crs)}`}>
                        {formatScore(row.crs)}
                      </TableCell>
                      <TableCell className="text-right">{formatScore(row.broodingHealthIndex)}</TableCell>
                      <TableCell className="text-right">{formatScore(row.growthScore)}</TableCell>
                      <TableCell className="text-right">{formatScore(row.healthHistoryScore)}</TableCell>
                      <TableCell className="text-right">{formatScore(row.behaviouralScore)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={row.recommendedAdvance ? "default" : "secondary"}>
                          {row.recommendedAdvance ? "Advance" : "Reject"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.decision ? (
                          <Badge
                            variant={row.decision.outcome === "ADVANCE" ? "default" : "secondary"}
                          >
                            {row.decision.outcome}
                            {row.decision.overridden ? " *" : ""}
                          </Badge>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-8"
                              aria-label="Advance"
                              onClick={() => {
                                setReason("");
                                setPending({ row, advance: true });
                              }}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-8"
                              aria-label="Reject"
                              onClick={() => {
                                setReason("");
                                setPending({ row, advance: false });
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pending?.advance ? "Advance" : "Reject"} {pending?.row.bandNumber}
            </DialogTitle>
            <DialogDescription>
              {isOverride
                ? "This overrides the system recommendation, so a reason is required."
                : "This matches the system recommendation. A reason is optional."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Reason {isOverride && <span className="text-destructive">*</span>}</Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this decision?"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={decide.isPending}>
              {decide.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
