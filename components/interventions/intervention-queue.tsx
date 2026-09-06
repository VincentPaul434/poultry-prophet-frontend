"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  History,
  Loader2,
  Play,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAssignIntervention,
  useClaimIntervention,
  useCompleteIntervention,
  useDismissIntervention,
  useEscalateIntervention,
  useInterventionHistory,
  useStartIntervention,
} from "@/hooks/use-interventions";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { Batch, Handler, Intervention, InterventionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ACTIVE_STATUSES: InterventionStatus[] = ["PENDING", "ACKNOWLEDGED", "IN_PROGRESS", "ESCALATED"];

const statusConfig: Record<InterventionStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-muted text-muted-foreground" },
  ACKNOWLEDGED: { label: "Claimed", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  ESCALATED: { label: "Escalated", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  DISMISSED: { label: "Dismissed", className: "bg-muted text-muted-foreground" },
};

const severityClass = {
  INFO: "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20",
  WARNING: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
  CRITICAL: "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
};

function ActionError(error: unknown) {
  return error instanceof ApiError ? error.message : "The intervention could not be updated.";
}

export function InterventionQueue({
  interventions,
  batches,
  handlers,
  batchName,
  assignedHandlerIds,
  showBatch = true,
}: {
  interventions: Intervention[];
  batches?: Batch[];
  handlers?: Handler[];
  batchName?: string;
  assignedHandlerIds?: number[];
  showBatch?: boolean;
}) {
  if (interventions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
        <ClipboardCheck className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-semibold">No active interventions</p>
        <p className="mt-1 text-xs text-muted-foreground">New operational recommendations will appear here when an alert needs action.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interventions.map((intervention) => (
        <InterventionCard
          key={intervention.id}
          intervention={intervention}
          batches={batches}
          handlers={handlers}
          batchName={batchName}
          assignedHandlerIds={assignedHandlerIds}
          showBatch={showBatch}
        />
      ))}
    </div>
  );
}

function InterventionCard({
  intervention,
  batches,
  handlers,
  batchName,
  assignedHandlerIds,
  showBatch,
}: {
  intervention: Intervention;
  batches?: Batch[];
  handlers?: Handler[];
  batchName?: string;
  assignedHandlerIds?: number[];
  showBatch: boolean;
}) {
  const { user, isManager } = useAuth();
  const claim = useClaimIntervention();
  const start = useStartIntervention();
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[intervention.status];
  const owns = user?.userId === intervention.assignedHandlerId;
  const allowedHandlerIds = assignedHandlerIds ?? batches?.find((b) => b.id === intervention.batchId)?.handlerUserIds ?? [];
  const eligibleHandlers = handlers?.filter((handler) => allowedHandlerIds.includes(handler.id)) ?? [];
  const resolvedBatchName = batchName ?? batches?.find((batch) => batch.id === intervention.batchId)?.name ?? `Batch #${intervention.batchId}`;
  const canAssign = isManager && ACTIVE_STATUSES.includes(intervention.status) && intervention.status !== "IN_PROGRESS";
  const canDismiss = isManager && ACTIVE_STATUSES.includes(intervention.status);

  return (
    <article className={cn("overflow-hidden rounded-2xl border bg-card", severityClass[intervention.severity])}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/80 text-primary">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-0 text-[10px]", status.className)}>{status.label}</Badge>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{intervention.severity}</span>
              {intervention.managerReviewRequired && <Badge variant="outline" className="text-[10px]">Manager review</Badge>}
            </div>
            <h3 className="mt-2 text-sm font-bold leading-snug sm:text-base">{intervention.title}</h3>
            {showBatch && <p className="mt-1 text-xs text-muted-foreground">{resolvedBatchName} · {intervention.indicatorType}</p>}
          </div>
          <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={expanded ? "Collapse details" : "Expand details"} onClick={() => setExpanded((value) => !value)}>
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-current/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0" />
            <span>{formatDateTime(intervention.updatedAt || intervention.createdAt)}</span>
            {intervention.assignedHandlerName && <><span>·</span><span className="truncate">{intervention.assignedHandlerName}</span></>}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {user?.role === "HANDLER" && !intervention.assignedHandlerId && intervention.status === "PENDING" && (
              <MutationButton label="Claim" icon={<UserRound />} mutation={claim} onClick={() => ({ id: intervention.id })} />
            )}
            {user?.role === "HANDLER" && owns && ["PENDING", "ACKNOWLEDGED"].includes(intervention.status) && (
              <MutationButton label="Start" icon={<Play />} mutation={start} onClick={() => ({ id: intervention.id })} />
            )}
            {user?.role === "HANDLER" && owns && ["ACKNOWLEDGED", "IN_PROGRESS"].includes(intervention.status) && (
              <NoteActionButton label="Complete" icon={<Check />} action="complete" interventionId={intervention.id} />
            )}
            {user?.role === "HANDLER" && owns && ["ACKNOWLEDGED", "IN_PROGRESS"].includes(intervention.status) && (
              <NoteActionButton label="Escalate" icon={<Send />} action="escalate" interventionId={intervention.id} variant="outline" required />
            )}
            {canAssign && eligibleHandlers.length > 0 && (
              <AssignButton interventionId={intervention.id} handlers={eligibleHandlers} />
            )}
            {canDismiss && <NoteActionButton label="Dismiss" icon={<X />} action="dismiss" interventionId={intervention.id} variant="outline" required />}
            <HistoryDialog interventionId={intervention.id} />
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t border-current/10 pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Checklist</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{intervention.instructions}</p>
            </div>
            {intervention.outcomeNote && (
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Latest note</p>
                <p className="mt-1 text-sm">{intervention.outcomeNote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function MutationButton({ label, icon, mutation, onClick, variant = "default" }: { label: string; icon: React.ReactNode; mutation: { isPending: boolean; mutateAsync: (args: { id: number }) => Promise<unknown> }; onClick: () => { id: number }; variant?: "default" | "outline" }) {
  const successLabel = label === "Claim" ? "Claimed" : label === "Start" ? "Started" : label;
  return (
    <Button size="sm" variant={variant} className="h-8 rounded-lg text-xs font-semibold" disabled={mutation.isPending} onClick={() => mutation.mutateAsync(onClick()).then(() => toast.success(`${successLabel} intervention`)).catch((error) => toast.error(ActionError(error)))}>
      {mutation.isPending ? <Loader2 className="size-3 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

function NoteActionButton({ label, icon, action, interventionId, variant = "default", required = false }: { label: string; icon: React.ReactNode; action: "complete" | "escalate" | "dismiss"; interventionId: number; variant?: "default" | "outline"; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const complete = useCompleteIntervention();
  const escalate = useEscalateIntervention();
  const dismiss = useDismissIntervention();
  const mutation = action === "complete" ? complete : action === "escalate" ? escalate : dismiss;
  const actionLabel = action === "complete" ? "Complete" : action === "escalate" ? "Escalate" : "Dismiss";

  async function submit() {
    if (required && !note.trim()) return;
    try {
      await mutation.mutateAsync({ id: interventionId, body: { note: note.trim() || null } });
      toast.success(`${actionLabel}d intervention`);
      setNote("");
      setOpen(false);
    } catch (error) {
      toast.error(ActionError(error));
    }
  }

  return (
    <>
      <Button size="sm" variant={variant} className="h-8 rounded-lg text-xs font-semibold" onClick={() => setOpen(true)}>
        {icon}{label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{actionLabel} intervention</DialogTitle>
            <DialogDescription>{required ? "Add a note before continuing." : "Add an optional outcome note."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor={`${action}-${interventionId}-note`}>Note {required ? "(required)" : "(optional)"}</Label>
            <Textarea id={`${action}-${interventionId}-note`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder={action === "escalate" ? "What needs manager attention?" : action === "dismiss" ? "Why is this being dismissed?" : "What was observed or done?"} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={mutation.isPending || (required && !note.trim())} onClick={submit}>{mutation.isPending && <Loader2 className="size-4 animate-spin" />}{actionLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssignButton({ interventionId, handlers }: { interventionId: number; handlers: Handler[] }) {
  const [open, setOpen] = useState(false);
  const [handlerId, setHandlerId] = useState("");
  const assign = useAssignIntervention();
  async function submit() {
    if (!handlerId) return;
    try {
      await assign.mutateAsync({ id: interventionId, body: { handlerUserId: Number(handlerId) } });
      toast.success("Intervention assigned");
      setOpen(false);
    } catch (error) {
      toast.error(ActionError(error));
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs font-semibold" onClick={() => setOpen(true)}><UserRound />Assign</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Assign intervention</DialogTitle><DialogDescription>Only handlers assigned to this batch can receive this task.</DialogDescription></DialogHeader>
          <div className="py-2"><Select value={handlerId} onValueChange={(value) => setHandlerId(value ?? "")}><SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose a handler" /></SelectTrigger><SelectContent>{handlers.map((handler) => <SelectItem key={handler.id} value={String(handler.id)}>{handler.fullName}</SelectItem>)}</SelectContent></Select></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!handlerId || assign.isPending} onClick={submit}>{assign.isPending && <Loader2 className="size-4 animate-spin" />}Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HistoryDialog({ interventionId }: { interventionId: number }) {
  const [open, setOpen] = useState(false);
  const history = useInterventionHistory(interventionId, open);
  return (
    <>
      <Button size="sm" variant="ghost" className="h-8 rounded-lg px-2 text-xs" onClick={() => setOpen(true)} aria-label="View intervention history"><History className="size-3.5" /></Button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg"><DialogHeader><DialogTitle>Intervention history</DialogTitle><DialogDescription>Immutable actions recorded by Poultry Prophet.</DialogDescription></DialogHeader><div className="max-h-80 space-y-3 overflow-y-auto py-2">{history.isLoading && <Loader2 className="mx-auto size-5 animate-spin" />}{history.data?.map((entry) => <div key={entry.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">{entry.action}</p><span className="text-[10px] text-muted-foreground">{formatDateTime(entry.createdAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{entry.actorName ?? "System"} · {entry.status}</p>{entry.note && <p className="mt-2 text-sm">{entry.note}</p>}</div>)}</div></DialogContent></Dialog>
    </>
  );
}
