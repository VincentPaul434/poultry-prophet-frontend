"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useArchiveBatch, useRestoreBatch } from "@/hooks/use-batches";
import { ApiError } from "@/lib/api-client";
import type { Batch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Manager-only archive control. Opens a confirmation dialog before retiring a batch
 * out of the working dashboard. When the batch has no birds left it renders as a
 * prominent primary action (the usual moment to archive); otherwise it's a quiet
 * outline button.
 */
export function ArchiveBatchButton({
  batch,
  className,
  onArchived,
}: {
  batch: Batch;
  className?: string;
  onArchived?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const archive = useArchiveBatch(batch.id);
  const noBirdsLeft = batch.currentPopulation <= 0;

  async function confirm() {
    try {
      await archive.mutateAsync();
      toast.success(`"${batch.name}" archived`);
      setOpen(false);
      onArchived?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to archive batch");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={noBirdsLeft ? "default" : "outline"}
            className={cn("h-11 rounded-xl px-4 text-sm font-semibold", className)}
            title="Archive this batch"
          >
            <Archive className="size-4" />
            {noBirdsLeft ? "Archive batch" : "Archive"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Archive &ldquo;{batch.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            {noBirdsLeft
              ? "This batch has no birds left. Archiving moves it out of your active dashboard — all of its records, scores and history stay intact, and you can restore it anytime."
              : "Archiving moves this batch out of your active dashboard. Its records, scores and history are kept, and you can restore it anytime."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="h-11 rounded-xl px-5 font-semibold"
            onClick={() => setOpen(false)}
            disabled={archive.isPending}
          >
            Cancel
          </Button>
          <Button
            className="h-11 rounded-xl px-5 font-semibold"
            onClick={confirm}
            disabled={archive.isPending}
          >
            {archive.isPending && <Loader2 className="size-4 animate-spin" />}
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Manager-only restore control — brings an archived batch back to the working
 * dashboard. Low-risk and reversible, so it acts directly without a confirm dialog.
 */
export function RestoreBatchButton({
  batch,
  className,
  onRestored,
}: {
  batch: Batch;
  className?: string;
  onRestored?: () => void;
}) {
  const restore = useRestoreBatch(batch.id);

  async function onClick() {
    try {
      await restore.mutateAsync();
      toast.success(`"${batch.name}" restored`);
      onRestored?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to restore batch");
    }
  }

  return (
    <Button
      variant="outline"
      className={cn("h-9 rounded-xl px-3 text-xs font-semibold", className)}
      onClick={onClick}
      disabled={restore.isPending}
      title="Restore this batch to the active dashboard"
    >
      {restore.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <ArchiveRestore className="size-3.5" />
      )}
      Restore
    </Button>
  );
}
