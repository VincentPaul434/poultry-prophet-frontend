"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBatchRetirementImpact, useDeleteBatch } from "@/hooks/use-batches";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { ApiError } from "@/lib/api-client";
import type { Batch } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ArchivedBatchDeleteAction({ batch, returnToDashboard = false }: { batch: Batch; returnToDashboard?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const online = useNetworkStatus();
  const impact = useBatchRetirementImpact(batch.id, open && online);
  const remove = useDeleteBatch();
  const router = useRouter();

  const close = () => { setOpen(false); setConfirmation(""); setReason(""); };
  const handleDelete = async () => {
    try {
      await remove.mutateAsync({ batchId: batch.id, body: { confirmationName: confirmation, reason: reason.trim() || null } });
      close();
      toast.success("Archived batch and its records permanently deleted.");
      if (returnToDashboard) router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete this batch.");
      void impact.refetch();
    }
  };

  const recordLabels: Record<string, string> = { events: "Event records", dailyRecords: "Daily records", indicators: "Indicators", alerts: "Alerts", productRecords: "Product-use records", inventoryMovements: "Inventory movements", financeTransactions: "Financial transactions", tasks: "Tasks", birds: "Bird records", selectionRecords: "Selection records", birdScores: "Bird scores", rangingRecords: "Ranging records", selectionSessions: "Selection tallies", selectionReviews: "Review snapshots", sexComposition: "Sex composition records", vaccinationPlans: "Vaccination plan items", reports: "Reports", incubationLinks: "Incubation links to remove" };
  const blockingRecords = Object.entries(impact.data?.recordCounts ?? {}).filter(([, count]) => count > 0);
  const ready = online && !impact.isFetching && !impact.isError && impact.data?.canDelete;
  return <>
    <Button type="button" variant="destructive" size="sm" className="min-h-11 rounded-xl" aria-label={`Delete ${batch.name}`} onClick={() => setOpen(true)}>
      <Trash2 className="size-4" /> Delete
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!value && !remove.isPending) close(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{batch.name}”?</DialogTitle>
          <DialogDescription>This permanently deletes the archived batch and its linked health, product-use, expense, task, vaccination, and review records. This cannot be undone.</DialogDescription>
        </DialogHeader>
        {!online ? <p className="text-sm text-muted-foreground">Connect to the internet to check whether this batch can be deleted.</p>
          : impact.isFetching ? <p className="text-sm text-muted-foreground">Checking batch records…</p>
          : impact.isError || !impact.data ? <div className="space-y-2"><p className="text-sm text-destructive">Could not check this batch. Try again.</p><Button type="button" variant="outline" onClick={() => void impact.refetch()}>Try again</Button></div>
          : !impact.data.canDelete ? <div className="space-y-2 text-sm" role="status"><p className="font-medium">This batch cannot be deleted.</p>{impact.data.deleteBlockers.length > 0 ? impact.data.deleteBlockers.map((blocker) => <p key={blocker} className="text-muted-foreground">{blocker}</p>) : <p className="text-muted-foreground">It must remain archived to preserve its records.</p>}<Link href={`/batches/${batch.id}/data-entry?from=batch&view=records&period=custom`} className={buttonVariants({ variant: "outline" })}>View event history</Link></div>
          : <div className="space-y-2 py-2">{blockingRecords.length > 0 && <dl aria-label="Linked records to delete" className="max-h-48 divide-y overflow-y-auto rounded-xl border px-3">{blockingRecords.map(([key, count]) => <div key={key} className="flex items-center justify-between gap-3 py-2"><dt>{recordLabels[key] ?? key.replace(/([A-Z])/g, " $1")}</dt><dd className="font-semibold tabular-nums">{count}</dd></div>)}</dl>}<p className="text-xs text-muted-foreground">Current stock quantities stay unchanged. The originating incubation cycle and deletion audit are kept.</p><Label htmlFor={`delete-batch-name-${batch.id}`}>Type <strong>{batch.name}</strong> to continue</Label><Input id={`delete-batch-name-${batch.id}`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="min-h-11 rounded-xl" autoComplete="off" /><Label htmlFor={`delete-batch-reason-${batch.id}`}>Reason <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id={`delete-batch-reason-${batch.id}`} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-11 rounded-xl" /></div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={remove.isPending}>{ready ? "Cancel" : "Close"}</Button>
          {ready && <Button type="button" variant="destructive" onClick={handleDelete} disabled={confirmation.trim() !== batch.name || remove.isPending}>{remove.isPending && <Loader2 className="size-4 animate-spin" />}Delete permanently</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
