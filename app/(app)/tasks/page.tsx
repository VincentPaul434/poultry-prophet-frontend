"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Clock3, Loader2, Plus } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { useLocale } from "@/components/locale-provider";
import { VaccinationTaskAction } from "@/components/vaccination-plan-card";

function isToday(value: string | null) { return value ? new Date(value).toISOString().slice(0, 10) === todayIso() : false; }

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
  const [showOptions, setShowOptions] = useState(false);
  const [formError, setFormError] = useState("");
  const batchNames = useMemo(() => new Map((batches ?? []).map((item) => [item.id, item.name])), [batches]);
  const groups = useMemo(() => {
    const pending = (tasks ?? []).filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
    return { overdue: pending.filter((task) => task.overdue), today: pending.filter((task) => !task.overdue && isToday(task.dueAt)), upcoming: pending.filter((task) => !task.overdue && !isToday(task.dueAt)), completed: (tasks ?? []).filter((task) => task.status === "COMPLETED") };
  }, [tasks]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setFormError("");
    if (!title.trim()) return setFormError("Add a short task title.");
    try {
      await create.mutateAsync({ title: title.trim(), instructions: instructions.trim() || null, assignedHandlerId: handler ? Number(handler) : null, batchId: batch ? Number(batch) : null, dueAt: due ? new Date(due).toISOString() : null, priority });
      toast.success("Task assigned"); setTitle(""); setInstructions(""); setHandler(""); setBatch(""); setDue(""); setPriority("NORMAL"); setShowOptions(false);
    } catch (error) { setFormError(error instanceof ApiError ? error.message : "Could not save the task."); }
  }
  async function markDone(id: number) {
    try { await update.mutateAsync({ id, body: { status: "COMPLETED" } }); toast.success("Task marked done"); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not update the task."); }
  }
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="size-5" aria-hidden="true" /></div><div><h1 className="text-2xl font-bold tracking-tight">{t("tasks.title")}</h1><p className="text-sm text-muted-foreground">Assign, then mark done. Simple lang.</p></div></header>
      {isManager && <Card className="shadow-none"><CardHeader className="p-4 pb-2"><CardTitle className="text-base">{t("tasks.assign")}</CardTitle><CardDescription>{t("tasks.anyHandler")}</CardDescription></CardHeader><CardContent className="p-4 pt-2"><form onSubmit={submit} className="space-y-3" noValidate><div className="space-y-1.5"><Label htmlFor="task-title">Task <span className="text-destructive">*</span></Label><Input id="task-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Check waterers and record concerns" /></div><div className="grid gap-2.5 sm:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="task-handler">Handler</Label><NativeSelect id="task-handler" value={handler} onChange={(e) => setHandler(e.target.value)}><option value="">{t("tasks.anyHandler")}</option>{handlers?.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</NativeSelect></div><div className="space-y-1.5"><Label htmlFor="task-batch">Batch</Label><NativeSelect id="task-batch" value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">{t("tasks.farmWide")}</option>{batches?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></div><div className="space-y-1.5"><Label htmlFor="task-due">Due <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="task-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></div></div><details open={showOptions} onToggle={(e) => setShowOptions(e.currentTarget.open)} className="rounded-lg border px-3"><summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold">More options <span className="ml-1 font-normal text-muted-foreground">(optional)</span></summary><div className="space-y-2 pb-3"><NativeSelect id="task-priority" aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}><option value="LOW">Low priority</option><option value="NORMAL">Normal priority</option><option value="HIGH">High priority</option><option value="URGENT">Urgent priority</option></NativeSelect><Textarea id="task-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions for the handler" /></div></details>{formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>}<Button disabled={create.isPending} type="submit" className="h-11 w-full sm:w-auto">{create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}{t("tasks.assign")}</Button></form></CardContent></Card>}
      <Card className="shadow-none"><CardHeader className="p-4 pb-2"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">{isManager ? t("tasks.allTasks") : t("tasks.myTasks")}</CardTitle><CardDescription>Open tasks are grouped by due date.</CardDescription></div><Badge variant="outline">{tasks?.filter((task) => task.status !== "COMPLETED").length ?? 0} {t("tasks.open")}</Badge></div></CardHeader><CardContent className="space-y-6 p-4 pt-2"><TaskGroup title={t("tasks.late")} tasks={groups.overdue} tone="danger" batchNames={batchNames} onDone={markDone} updatePending={update.isPending} /><TaskGroup title={t("tasks.today")} tasks={groups.today} batchNames={batchNames} onDone={markDone} updatePending={update.isPending} /><TaskGroup title={t("tasks.next")} tasks={groups.upcoming} batchNames={batchNames} onDone={markDone} updatePending={update.isPending} /><TaskGroup title={t("tasks.done")} tasks={groups.completed} batchNames={batchNames} onDone={markDone} updatePending={update.isPending} collapsed /></CardContent></Card>
    </div>
  );
}

function TaskGroup({ title, tasks, tone, batchNames, onDone, updatePending, collapsed = false }: { title: string; tasks: HandlerTask[]; tone?: "danger"; batchNames: Map<number, string>; onDone: (id: number) => void; updatePending: boolean; collapsed?: boolean }) {
  if (tasks.length === 0) return null;
  return <section className="space-y-2"><div className="flex items-center gap-2"><h3 className={tone === "danger" ? "text-base font-bold text-destructive" : "text-base font-bold"}>{title}</h3><Badge variant={tone === "danger" ? "destructive" : "secondary"}>{tasks.length}</Badge></div><div className="space-y-2">{tasks.map((task) => <TaskCard key={task.id} task={task} batchName={task.batchId == null ? "Farm-wide" : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`} onDone={onDone} updatePending={updatePending} compact={collapsed} />)}</div></section>;
}

function TaskCard({ task, batchName, onDone, updatePending, compact }: { task: HandlerTask; batchName: string; onDone: (id: number) => void; updatePending: boolean; compact?: boolean }) {
  const due = task.dueAt ? new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due date";
  return <article className={`rounded-xl border p-3 ${compact ? "bg-muted/20" : "bg-card"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{task.title}</h4><Badge variant={task.priority === "URGENT" || task.priority === "HIGH" ? "destructive" : "secondary"}>{task.priority}</Badge></div>{task.instructions && <p className="text-sm text-muted-foreground">{task.instructions}</p>}<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{batchName}</span><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{due}</span></div></div>{task.status !== "COMPLETED" && task.status !== "CANCELLED" && (task.sourceType === "VACCINATION_PLAN" ? <VaccinationTaskAction task={task} /> : <Button size="lg" disabled={updatePending} onClick={() => onDone(task.id)} aria-label={`Mark task done: ${task.title}`}><CheckCircle2 className="size-4" aria-hidden="true" />Done</Button>)}</div></article>;
}
