"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Clock3, Loader2, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTasks, useCreateTask, useUpdateTaskStatus } from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import { useHandlers } from "@/hooks/use-reference";
import { useBatches } from "@/hooks/use-batches";
import { ApiError } from "@/lib/api-client";
import { todayIso } from "@/lib/format";
import type { HandlerTask, TaskPriority } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/locale-provider";

const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function isToday(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) === todayIso() : false;
}

export default function TasksPage() {
  const { isManager } = useAuth();
  const { t } = useLocale();
  const { data: tasks } = useTasks(!isManager);
  const { data: handlers } = useHandlers(isManager);
  const { data: batches } = useBatches();
  const create = useCreateTask();
  const update = useUpdateTaskStatus();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [handler, setHandler] = useState("");
  const [batch, setBatch] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [formError, setFormError] = useState("");

  const batchNames = useMemo(() => new Map((batches ?? []).map((item) => [item.id, item.name])), [batches]);
  const groups = useMemo(() => {
    const pending = (tasks ?? []).filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
    return {
      overdue: pending.filter((task) => task.overdue),
      today: pending.filter((task) => !task.overdue && isToday(task.dueAt)),
      upcoming: pending.filter((task) => !task.overdue && !isToday(task.dueAt)),
      completed: (tasks ?? []).filter((task) => task.status === "COMPLETED"),
    };
  }, [tasks]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!title.trim()) return setFormError("Add a short task title.");
    try {
      await create.mutateAsync({
        title: title.trim(),
        instructions: instructions.trim() || null,
        assignedHandlerId: handler ? Number(handler) : null,
        batchId: batch ? Number(batch) : null,
        dueAt: due ? new Date(due).toISOString() : null,
        priority,
      });
      toast.success("Task assigned");
      setTitle("");
      setInstructions("");
      setHandler("");
      setBatch("");
      setDue("");
      setPriority("NORMAL");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save the task.");
    }
  }

  async function changeStatus(id: number, status: "IN_PROGRESS" | "COMPLETED") {
    try {
      await update.mutateAsync({ id, body: { status } });
      if (status === "COMPLETED") toast.success("Task marked done");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update the task.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <header className="space-y-2"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ClipboardList className="size-6" aria-hidden="true" /></div><div><h1 className="text-3xl font-bold tracking-tight">{t("tasks.title")}</h1><p className="text-sm text-muted-foreground">{t("dashboard.todayTasksHint")}</p></div></div></header>

      {isManager && <Card className="overflow-hidden shadow-sm"><div className="h-1.5 bg-primary" /><CardHeader><CardTitle>{t("tasks.assign")}</CardTitle><CardDescription>{t("tasks.anyHandler")}</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-5" noValidate><div className="space-y-2"><Label htmlFor="task-title">What needs to be done? <span className="text-destructive">*</span></Label><Input id="task-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Check waterers and record concerns" /></div><div className="space-y-2"><Label htmlFor="task-instructions">Instructions <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="task-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="What should the handler check?" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="task-handler">Who can do it?</Label><select id="task-handler" className={selectClass} value={handler} onChange={(event) => setHandler(event.target.value)}><option value="">{t("tasks.anyHandler")}</option>{handlers?.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></div><div className="space-y-2"><Label htmlFor="task-batch">Which batch?</Label><select id="task-batch" className={selectClass} value={batch} onChange={(event) => setBatch(event.target.value)}><option value="">{t("tasks.farmWide")}</option>{batches?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="task-due">Due date and time <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="task-due" type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="task-priority">Priority</Label><select id="task-priority" className={selectClass} value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></div></div>{formError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</p>}<Button disabled={create.isPending} type="submit" className="w-full sm:w-auto">{create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}{t("tasks.assign")}</Button></form></CardContent></Card>}

      <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>{isManager ? t("tasks.allTasks") : t("tasks.myTasks")}</CardTitle><CardDescription>{t("dashboard.todayTasksHint")}</CardDescription></div><Badge variant="outline">{tasks?.filter((task) => task.status !== "COMPLETED").length ?? 0} {t("tasks.open")}</Badge></div></CardHeader><CardContent className="space-y-7"><TaskGroup title={t("tasks.late")} tasks={groups.overdue} tone="danger" batchNames={batchNames} onStatus={changeStatus} updatePending={update.isPending} /><TaskGroup title={t("tasks.today")} tasks={groups.today} batchNames={batchNames} onStatus={changeStatus} updatePending={update.isPending} /><TaskGroup title={t("tasks.next")} tasks={groups.upcoming} batchNames={batchNames} onStatus={changeStatus} updatePending={update.isPending} /><TaskGroup title={t("tasks.done")} tasks={groups.completed} batchNames={batchNames} onStatus={changeStatus} updatePending={update.isPending} collapsed /></CardContent></Card>
    </div>
  );
}

function TaskGroup({ title, tasks, tone, batchNames, onStatus, updatePending, collapsed = false }: { title: string; tasks: HandlerTask[]; tone?: "danger"; batchNames: Map<number, string>; onStatus: (id: number, status: "IN_PROGRESS" | "COMPLETED") => void; updatePending: boolean; collapsed?: boolean }) {
  if (tasks.length === 0) return null;
  return <section className="space-y-3"><div className="flex items-center gap-2"><h3 className={tone === "danger" ? "text-base font-bold text-destructive" : "text-base font-bold"}>{title}</h3><Badge variant={tone === "danger" ? "destructive" : "secondary"}>{tasks.length}</Badge></div><div className="space-y-2">{tasks.map((task) => <TaskCard key={task.id} task={task} batchName={task.batchId == null ? "Farm-wide" : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`} onStatus={onStatus} updatePending={updatePending} compact={collapsed} />)}</div></section>;
}

function TaskCard({ task, batchName, onStatus, updatePending, compact }: { task: HandlerTask; batchName: string; onStatus: (id: number, status: "IN_PROGRESS" | "COMPLETED") => void; updatePending: boolean; compact?: boolean }) {
  const { t } = useLocale();
  const due = task.dueAt ? new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due date";
  return <article className={`rounded-2xl border p-4 ${compact ? "bg-muted/20" : "bg-card"}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 space-y-1.5"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{task.title}</h4><Badge variant={task.priority === "URGENT" || task.priority === "HIGH" ? "destructive" : "secondary"}>{task.priority}</Badge></div>{task.instructions && <p className="text-sm text-muted-foreground">{task.instructions}</p>}<div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground"><span>{batchName}</span><span className="inline-flex items-center gap-1"><Clock3 className="size-4" aria-hidden="true" />{due}</span></div></div>{task.status !== "COMPLETED" && task.status !== "CANCELLED" && <div className="grid grid-cols-2 gap-2 sm:min-w-48"><Button size="lg" variant="outline" disabled={updatePending || task.status === "IN_PROGRESS"} onClick={() => onStatus(task.id, "IN_PROGRESS")} aria-label={`Start task: ${task.title}`}><Play className="size-4" aria-hidden="true" />{task.status === "IN_PROGRESS" ? "Started" : t("tasks.start")}</Button><Button size="lg" disabled={updatePending} onClick={() => onStatus(task.id, "COMPLETED")} aria-label={`Mark task done: ${task.title}`}><CheckCircle2 className="size-4" aria-hidden="true" />{t("tasks.markDone")}</Button></div>}</div></article>;
}
