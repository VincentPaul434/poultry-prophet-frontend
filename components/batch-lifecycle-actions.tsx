"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { useState } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useArchiveBatch, useBatchRetirementImpact, useRestoreBatch } from "@/hooks/use-batches";
import { ApiError } from "@/lib/api-client";
import { useNetworkStatus } from "@/hooks/use-network-status";
import type { Batch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArchivedBatchDeleteAction } from "@/components/archived-batch-delete-action";

export function BatchLifecycleActions({ batch }: { batch: Batch }) {
  const { display: displayText } = useDisplayLocale();
  const [open, setOpen] = useState<"archive" | null>(null);
  const [reason, setReason] = useState("");
  const online = useNetworkStatus();
  const impact = useBatchRetirementImpact(batch.id);
  const archive = useArchiveBatch();
  const restore = useRestoreBatch();
  const busy = archive.isPending || restore.isPending;

  const close = () => { setOpen(null); setReason(""); };
  const handleArchive = async () => {
    try {
      await archive.mutateAsync({ batchId: batch.id, body: { reason: reason.trim() || null } });
      toast.success("Batch archived. Records were kept.");
      close();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not archive this batch.");
    }
  };
  const handleRestore = async () => {
    try {
      await restore.mutateAsync(batch.id);
      toast.success("Batch restored.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not restore this batch.");
    }
  };
  if (batch.status === "ARCHIVED") {
    return <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={handleRestore} disabled={!online || busy}>
        {restore.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArchiveRestore className="size-4" />} {displayText("Restore batch")}</Button>
      <ArchivedBatchDeleteAction batch={batch} returnToDashboard />
    </div>;
  }

  return <>
    <Button type="button" variant="outline" size="icon" className="size-10 rounded-lg" onClick={() => setOpen("archive")} disabled={!online || archive.isPending} aria-label={displayText("Archive batch")} title={!online ? "Connect to the internet to archive this batch" : "Archive batch"}>
      {archive.isPending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
    </Button>
    <Dialog open={open === "archive"} onOpenChange={(value) => { if (!value) close(); }}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader><DialogTitle>{displayText("Archive “")}{batch.name}”?</DialogTitle><DialogDescription>{displayText("The batch will leave the active dashboard. All health, population, finance, product, task, and review records stay available, and a manager can restore it later.")}</DialogDescription></DialogHeader>
        {impact.data && impact.data.openTaskCount > 0 && <p className="rounded-xl border border-warning-border bg-warning-muted px-3 py-2 text-sm text-warning-ink">{displayText("Complete or cancel")}{" "}{impact.data.openTaskCount} {displayText("open task")}{impact.data.openTaskCount === 1 ? "" : "s"} {displayText("before archiving.")}</p>}
        <div className="space-y-2 py-2"><Label htmlFor="archive-reason">{displayText("Reason")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional)")}</span></Label><Input id="archive-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={displayText("Observation completed")} className="min-h-11 rounded-xl" /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={close}>{displayText("Cancel")}</Button><Button type="button" onClick={handleArchive} disabled={!online || busy || impact.data?.canArchive === false}>{archive.isPending && <Loader2 className="size-4 animate-spin" />}{displayText("Archive batch")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
