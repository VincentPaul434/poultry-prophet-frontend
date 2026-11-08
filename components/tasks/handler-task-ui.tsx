"use client";

import type { KeyboardEvent } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { HandlerTask } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/components/locale-provider";
import { VaccinationTaskAction } from "@/components/vaccination-plan-card";

export function formatTaskDeadline(task: HandlerTask, lateLabel: string, todayLabel: string, noDueLabel: string) {
  if (!task.dueAt) return noDueLabel;
  const date = new Date(task.dueAt);
  if (task.overdue && task.status !== "COMPLETED") return `${lateLabel} · ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return `${todayLabel} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function HandlerTaskRow({ task, batchName, onOpen }: { task: HandlerTask; batchName: string; onOpen: (task: HandlerTask) => void }) {
  const { t } = useLocale();
  const urgent = task.priority === "URGENT" || task.priority === "HIGH";
  const deadline = formatTaskDeadline(task, t("tasks.overdue"), t("tasks.today"), t("tasks.noDue"));
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(task);
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${t("tasks.handlerViewDetails")}: ${task.title}`}
      onClick={() => onOpen(task)}
      onKeyDown={onKeyDown}
      className={`group cursor-pointer rounded-2xl border p-3.5 outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary ${task.overdue && task.status !== "COMPLETED" ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold leading-snug">{task.title}</h2>
            {urgent && <Badge variant="destructive">{task.priority === "URGENT" ? "Urgent" : "High priority"}</Badge>}
            {task.pendingSync && <Badge variant="outline">{t("tasks.handlerPending")}</Badge>}
          </div>
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{batchName}</span>
            <span aria-hidden="true">·</span>
            <span className={task.overdue && task.status !== "COMPLETED" ? "font-semibold text-destructive" : ""}>{deadline}</span>
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </article>
  );
}

export function HandlerTaskDetailDialog({
  task,
  open,
  batchName,
  pending,
  onOpenChange,
  onDone,
}: {
  task: HandlerTask | null;
  open: boolean;
  batchName: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (task: HandlerTask) => void;
}) {
  const { t } = useLocale();
  if (!task) return null;
  const completed = task.status === "COMPLETED";
  const deadline = formatTaskDeadline(task, t("tasks.overdue"), t("tasks.today"), t("tasks.noDue"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>{t("tasks.handlerDetailHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tasks.instructions")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{task.instructions || t("tasks.handlerNoInstructions")}</p>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">{t("tasks.whichBatch")}</dt><dd className="font-medium">{batchName}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("tasks.due")}</dt><dd className="font-medium">{deadline}</dd></div>
          </dl>
          {task.pendingSync && <p className="rounded-xl border border-warning-border bg-warning-muted/60 px-3 py-2 text-sm text-warning-ink">{t("tasks.handlerPendingHint")}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          {!completed && task.sourceType === "VACCINATION_PLAN" && <VaccinationTaskAction task={task} />}
          {!completed && task.sourceType !== "VACCINATION_PLAN" && <Button type="button" className="min-h-11" disabled={pending || task.pendingSync} onClick={() => onDone(task)}><CheckCircle2 className="size-4" />{t("tasks.markDone")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
