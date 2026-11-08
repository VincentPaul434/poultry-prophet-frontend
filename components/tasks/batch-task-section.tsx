"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTaskPage, useUpdateTaskStatus } from "@/hooks/use-operations";
import { ApiError } from "@/lib/api-client";
import type { HandlerTask } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/components/locale-provider";
import { HandlerTaskDetailDialog, HandlerTaskRow } from "@/components/tasks/handler-task-ui";

const PREVIEW_SIZE = 3;
const PAGE_SIZE = 10;

export function BatchTaskSection({ batchId, batchName }: { batchId: number; batchName: string }) {
  const { t } = useLocale();
  const [allOpen, setAllOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedTask, setSelectedTask] = useState<HandlerTask | null>(null);
  const update = useUpdateTaskStatus();
  const previewQuery = useTaskPage({ page: 0, size: PREVIEW_SIZE, view: "OPEN", dueBucket: "ALL", batchId, kind: "WORK" });
  const allQuery = useTaskPage({ page, size: PAGE_SIZE, view: "OPEN", dueBucket: "ALL", batchId, kind: "WORK" }, allOpen);
  const previewItems = previewQuery.data?.items ?? [];
  const listItems = allOpen ? allQuery.data?.items ?? [] : previewItems;

  async function markDone(task: HandlerTask) {
    try {
      await update.mutateAsync({ id: task.id, batchId: task.batchId, body: { status: "COMPLETED" } });
      setSelectedTask(null);
      toast.success(t("tasks.markDone"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update the task.");
    }
  }

  function openAll() {
    setPage(0);
    setAllOpen(true);
  }

  function closeAll(open: boolean) {
    setAllOpen(open);
    if (!open) setPage(0);
  }

  return (
    <>
      <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby={`batch-tasks-${batchId}`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 id={`batch-tasks-${batchId}`} className="text-base font-bold">{t("tasks.batchWorkTitle")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("tasks.batchWorkHint")}</p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">{previewQuery.data?.totalItems ?? "…"}</Badge>
        </div>

        {previewQuery.isLoading && <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">{t("tasks.batchWorkLoading")}</div>}
        {previewQuery.isError && <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{previewQuery.error instanceof ApiError ? previewQuery.error.message : t("tasks.batchWorkLoadError")}</div>}
        {!previewQuery.isLoading && !previewQuery.isError && previewItems.length === 0 && <div className="rounded-2xl border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">{t("tasks.batchWorkEmpty")}</div>}
        {!previewQuery.isLoading && !previewQuery.isError && previewItems.length > 0 && <div className="space-y-2">{previewItems.map((task) => <HandlerTaskRow key={task.id} task={task} batchName={batchName} onOpen={setSelectedTask} />)}</div>}
        {!previewQuery.isLoading && !previewQuery.isError && (previewQuery.data?.totalItems ?? 0) > PREVIEW_SIZE && <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={openAll}>{t("tasks.batchWorkViewAll")}<ChevronRight className="size-4" aria-hidden="true" /></Button>}
      </section>

      <Sheet open={allOpen} onOpenChange={closeAll}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-3xl p-0">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{t("tasks.batchWorkTitle")}</SheetTitle>
            <SheetDescription>{batchName}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {allQuery.isLoading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("tasks.batchWorkLoading")}</div>}
            {allQuery.isError && <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{allQuery.error instanceof ApiError ? allQuery.error.message : t("tasks.batchWorkLoadError")}</div>}
            {!allQuery.isLoading && !allQuery.isError && listItems.length === 0 && <div className="rounded-2xl border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">{t("tasks.batchWorkEmpty")}</div>}
            {!allQuery.isLoading && !allQuery.isError && listItems.length > 0 && <div className="space-y-2">{listItems.map((task) => <HandlerTaskRow key={task.id} task={task} batchName={batchName} onOpen={setSelectedTask} />)}</div>}
            {allQuery.data && <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3"><Button type="button" variant="outline" size="sm" disabled={!allQuery.data.hasPrevious || allQuery.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="size-4" />Previous</Button><span className="text-xs text-muted-foreground">Page {allQuery.data.page + 1} of {Math.max(1, allQuery.data.totalPages)}</span><Button type="button" variant="outline" size="sm" disabled={!allQuery.data.hasNext || allQuery.isFetching} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="size-4" /></Button></div>}
          </div>
        </SheetContent>
      </Sheet>

      <HandlerTaskDetailDialog
        task={selectedTask}
        open={selectedTask != null}
        batchName={batchName}
        pending={update.isPending}
        onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        onDone={markDone}
      />
    </>
  );
}
