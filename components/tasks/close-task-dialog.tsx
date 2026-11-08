"use client";

import { useState, type FormEvent } from "react";
import type { HandlerTask } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/locale-provider";

const REASONS = [
  ["NO_LONGER_NEEDED", "No longer needed"],
  ["DUPLICATE", "Duplicate task"],
  ["WRONG_BATCH", "Wrong batch"],
  ["WRONG_ASSIGNMENT", "Wrong assignment"],
  ["SCHEDULE_CHANGED", "Schedule changed"],
  ["BATCH_OPERATION_ENDED", "Batch operation ended"],
  ["OTHER", "Other"],
] as const;

export function CloseTaskDialog({
  task,
  open,
  pending,
  vaccinationOrphan = false,
  onOpenChange,
  onSubmit,
}: {
  task: HandlerTask | null;
  open: boolean;
  pending: boolean;
  vaccinationOrphan?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reasonCode: string, reason: string | null) => void;
}) {
  const { t } = useLocale();
  const [reasonCode, setReasonCode] = useState(vaccinationOrphan ? "SCHEDULE_CHANGED" : "NO_LONGER_NEEDED");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!task) return null;
  const title = vaccinationOrphan ? t("tasks.closeOrphanTitle") : t("tasks.closeTitle");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reasonCode === "OTHER" && !reason.trim()) {
      setError(t("tasks.closeOtherRequired"));
      return;
    }
    onSubmit(reasonCode, reason.trim() || null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("tasks.closeDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">{task.title}</p>
            {task.dueAt && <p className="mt-1 text-xs text-muted-foreground">{t("tasks.overdueSince")} {new Date(task.dueAt).toLocaleDateString([], { dateStyle: "medium" })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close-task-reason">{t("tasks.closeReason")}</Label>
            <NativeSelect id="close-task-reason" value={reasonCode} onChange={(event) => { setReasonCode(event.target.value); setError(""); }}>
              {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close-task-note">{t("tasks.closeDetails")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></Label>
            <Textarea id="close-task-note" value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder={t("tasks.closeDetailsPlaceholder")} rows={3} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.back")}</Button>
            <Button type="submit" disabled={pending}>{vaccinationOrphan ? t("tasks.closeOrphanAction") : t("tasks.closeAction")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
