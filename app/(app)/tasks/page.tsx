"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, Loader2, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useHandlerTaskQueueSummary, useTaskPage, useTaskQueue, useTaskSummary, useCreateTask, useUpdateTaskStatus } from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import { useHandlers } from "@/hooks/use-reference";
import { useBatches } from "@/hooks/use-batches";
import { ApiError } from "@/lib/api-client";
import type { HandlerTask, HandlerTaskQueueBucket, HandlerTaskQueueSummary, PageResponse, TaskAssignmentMode, TaskDueBucket, TaskPageFilters, TaskPriority, TaskSummaryResponse, TaskView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/locale-provider";
import { VaccinationTaskAction } from "@/components/vaccination-plan-card";

const PAGE_SIZE = 20;
const HANDLER_PAGE_SIZE = 10;

function readFilters(searchParams: ReturnType<typeof useSearchParams>): TaskPageFilters {
  const view = searchParams.get("view");
  const dueBucket = searchParams.get("due");
  const batch = searchParams.get("batch");
  const handler = searchParams.get("handler");
  const priority = searchParams.get("priority");
  return {
    page: Math.max(0, Number(searchParams.get("page") ?? 0) || 0),
    size: PAGE_SIZE,
    view: ["OPEN", "COMPLETED", "ALL"].includes(view ?? "") ? view as TaskView : "OPEN",
    dueBucket: ["ALL", "LATE", "TODAY", "UPCOMING", "NO_DUE"].includes(dueBucket ?? "") ? dueBucket as TaskDueBucket : "ALL",
    batchId: batch && batch !== "farm" ? Number(batch) || undefined : undefined,
    farmWide: batch === "farm" ? true : undefined,
    assignedHandlerId: handler ? Number(handler) || undefined : undefined,
    priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority ?? "") ? priority as TaskPriority : undefined,
  };
}

function formatFilters(filters: TaskPageFilters) {
  const params = new URLSearchParams();
  if (filters.page > 0) params.set("page", String(filters.page));
  if (filters.view !== "OPEN") params.set("view", filters.view);
  if (filters.dueBucket !== "ALL") params.set("due", filters.dueBucket);
  if (filters.farmWide) params.set("batch", "farm");
  else if (filters.batchId != null) params.set("batch", String(filters.batchId));
  if (filters.assignedHandlerId != null) params.set("handler", String(filters.assignedHandlerId));
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.search?.trim()) params.set("q", filters.search.trim());
  return params.toString();
}

function taskLoadErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return error ? fallback : null;
  if (error.status >= 500) return "Tasks are temporarily unavailable. Please try again.";
  return error.message;
}

export default function TasksPage() {
  return <Suspense fallback={<div className="mx-auto w-full max-w-5xl p-6 text-sm text-muted-foreground">Loading tasks…</div>}><TasksPageContent /></Suspense>;
}

function TasksPageContent() {
  const { isManager } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const managerFilters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [handlerQueueBucket, setHandlerQueueBucket] = useState<HandlerTaskQueueBucket>("NOW");
  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") ?? "");
  const [selectedTask, setSelectedTask] = useState<HandlerTask | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<TaskAssignmentMode>("ALL_HANDLERS");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [handler, setHandler] = useState("");
  const [batch, setBatch] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [formError, setFormError] = useState("");

  const filters = useMemo<TaskPageFilters>(() => ({ page: 0, size: isManager ? PAGE_SIZE : HANDLER_PAGE_SIZE, view: isManager ? managerFilters.view : "OPEN", dueBucket: isManager ? managerFilters.dueBucket : "ALL", batchId: managerFilters.batchId, farmWide: managerFilters.farmWide, assignedHandlerId: managerFilters.assignedHandlerId, priority: managerFilters.priority, search: managerFilters.search }), [isManager, managerFilters]);
  const managerPageQuery = useTaskPage(managerFilters, isManager);
  const handlerQueueQuery = useTaskQueue(handlerQueueBucket, !isManager);
  const handlerPages = handlerQueueQuery.data?.pages ?? [];
  const handlerPage = handlerPages.at(-1);
  const page = isManager ? managerPageQuery.data : handlerPage ? { ...handlerPage, items: handlerPages.flatMap((item) => item.items) } : undefined;
  const isLoading = isManager ? managerPageQuery.isLoading : handlerQueueQuery.isLoading;
  const isFetching = isManager ? managerPageQuery.isFetching : handlerQueueQuery.isFetching;
  const error = isManager ? managerPageQuery.error : handlerQueueQuery.error;
  const summaryFilters = useMemo(() => ({
    batchId: isManager ? managerFilters.batchId : undefined,
    farmWide: isManager ? managerFilters.farmWide : undefined,
    assignedHandlerId: isManager ? managerFilters.assignedHandlerId : undefined,
    priority: isManager ? managerFilters.priority : undefined,
  }), [isManager, managerFilters.assignedHandlerId, managerFilters.batchId, managerFilters.farmWide, managerFilters.priority]);
  const { data: summary } = useTaskSummary(summaryFilters, isManager);
  const handlerSummaryQuery = useHandlerTaskQueueSummary(!isManager);
  const { data: handlers } = useHandlers(isManager);
  const { data: batches } = useBatches();
  const create = useCreateTask();
  const update = useUpdateTaskStatus();
  const batchNames = useMemo(() => new Map((batches ?? []).map((item) => [item.id, item.name])), [batches]);
  const handlerNames = useMemo(() => new Map((handlers ?? []).map((item) => [item.id, item.fullName])), [handlers]);

  const changeFilters = useCallback((patch: Partial<TaskPageFilters>) => {
    const next = { ...readFilters(searchParams), ...patch, page: patch.page ?? 0 };
    const query = formatFilters(next);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!isManager) return;
    const nextSearch = searchInput.trim() || undefined;
    const timer = window.setTimeout(() => changeFilters({ search: nextSearch }), 300);
    return () => window.clearTimeout(timer);
  }, [changeFilters, isManager, searchInput]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!title.trim()) return setFormError("Add a short task title.");
    if (assignmentMode === "SPECIFIC_HANDLER" && !handler) return setFormError("Select the handler who owns this task.");
    try {
      await create.mutateAsync({
        title: title.trim(), instructions: instructions.trim() || null,
        assignedHandlerId: assignmentMode === "SPECIFIC_HANDLER" ? Number(handler) : null,
        assignmentMode, batchId: batch ? Number(batch) : null,
        dueAt: due ? new Date(due).toISOString() : null, priority,
      });
      toast.success("Task assigned");
      setTitle(""); setInstructions(""); setHandler(""); setBatch(""); setDue(""); setPriority("NORMAL"); setAssignmentMode("ALL_HANDLERS");
    } catch (submitError) {
      setFormError(submitError instanceof ApiError ? submitError.message : "Could not save the task.");
    }
  }

  async function markDone(task: HandlerTask) {
    try {
      await update.mutateAsync({ id: task.id, batchId: task.batchId, body: { status: "COMPLETED" } });
      setSelectedTask(null);
      toast.success("Task marked done");
    } catch (updateError) {
      toast.error(updateError instanceof ApiError ? updateError.message : "Could not update the task.");
    }
  }

  function toggleStatus(view: TaskView) {
    changeFilters(filters.view === view ? { view: "ALL", dueBucket: "ALL" } : { view, dueBucket: "ALL" });
  }

  function togglePriority(value: TaskPriority) {
    changeFilters(filters.priority === value ? { priority: undefined } : { priority: value });
  }

  function toggleBatch(value: "all" | "farm" | number) {
    const selected = value === "farm" ? !!filters.farmWide : value === "all" ? !filters.farmWide && filters.batchId == null : filters.batchId === value;
    if (selected || value === "all") changeFilters({ batchId: undefined, farmWide: undefined });
    else changeFilters({ batchId: typeof value === "number" ? value : undefined, farmWide: value === "farm" });
  }

  function toggleHandler(value?: number) {
    changeFilters({ assignedHandlerId: filters.assignedHandlerId === value ? undefined : value });
  }

  function changeHandlerQueue(bucket: HandlerTaskQueueBucket) {
    setHandlerQueueBucket(bucket);
    setSelectedTask(null);
  }

  const activeFilterCount = [filters.view !== "OPEN", filters.dueBucket !== "ALL", filters.batchId != null || filters.farmWide, filters.assignedHandlerId != null, !!filters.priority, !!filters.search].filter(Boolean).length;
  const visibleItems = page?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {isManager ? <>
      <header className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="size-5" aria-hidden="true" /></div><div><h1 className="text-2xl font-bold tracking-tight">{t("tasks.title")}</h1><p className="text-sm text-muted-foreground">Assign, monitor, and complete farm work.</p></div></header>
      <TaskSummaryBar summary={summary} filters={filters} onFilter={changeFilters} />
      <div className={isManager ? "grid gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]" : "block"}>
        {isManager && <Card className="h-fit shadow-none lg:sticky lg:top-4"><CardHeader className="p-4 pb-2"><CardTitle className="text-base">{t("tasks.assign")}</CardTitle><CardDescription>Choose one handler or make the task visible to all handlers.</CardDescription></CardHeader><CardContent className="p-4 pt-2"><form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1.5"><Label htmlFor="task-title">Task <span className="text-destructive">*</span></Label><Input id="task-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Check waterers and record concerns" /></div>
          <div className="space-y-1.5"><Label htmlFor="task-assignment">Who should see it?</Label><NativeSelect id="task-assignment" value={assignmentMode} onChange={(event) => { const mode = event.target.value as TaskAssignmentMode; setAssignmentMode(mode); if (mode === "ALL_HANDLERS") setHandler(""); }}><option value="ALL_HANDLERS">All handlers</option><option value="SPECIFIC_HANDLER">Specific handler</option></NativeSelect></div>
          {assignmentMode === "SPECIFIC_HANDLER" && <div className="space-y-1.5"><Label htmlFor="task-handler">Handler</Label><NativeSelect id="task-handler" value={handler} onChange={(event) => setHandler(event.target.value)}><option value="">Select a handler</option>{handlers?.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</NativeSelect></div>}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1"><div className="space-y-1.5"><Label htmlFor="task-batch">Batch <span className="font-normal text-muted-foreground">(optional)</span></Label><NativeSelect id="task-batch" value={batch} onChange={(event) => setBatch(event.target.value)}><option value="">Farm-wide</option>{batches?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></div><div className="space-y-1.5"><Label htmlFor="task-due">Due <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="task-due" type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /></div></div>
          <details className="rounded-lg border px-3"><summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold">More options <span className="ml-1 font-normal text-muted-foreground">(optional)</span></summary><div className="space-y-2 pb-3"><NativeSelect id="task-priority" aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="LOW">Low priority</option><option value="NORMAL">Normal priority</option><option value="HIGH">High priority</option><option value="URGENT">Urgent priority</option></NativeSelect><Textarea id="task-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Instructions for the handler" /></div></details>
          {formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>}<Button disabled={create.isPending} type="submit" className="h-11 w-full">{create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}{t("tasks.assign")}</Button>
        </form></CardContent></Card>}
        <Card className="flex min-h-0 flex-col overflow-hidden shadow-none"><CardHeader className="space-y-3 p-4 pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{isManager ? t("tasks.allTasks") : t("tasks.myTasks")}</CardTitle><CardDescription>Click a task to view its details. Only this list scrolls.</CardDescription></div><Badge variant="outline">{summary?.open ?? 0} {t("tasks.open")}</Badge></div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Search tasks" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search task title" className="pl-9" /></div>
          <div className="space-y-3"><FilterGroup label="Status"><FilterPill active={filters.view === "OPEN"} onClick={() => toggleStatus("OPEN")}>Open</FilterPill><FilterPill active={filters.view === "COMPLETED"} onClick={() => toggleStatus("COMPLETED")}>Completed</FilterPill><span className="self-center text-xs text-muted-foreground">{activeFilterCount > 0 ? `${activeFilterCount} active` : "All visible tasks"}</span></FilterGroup>
            <FilterGroup label="Priority"><FilterPill active={!filters.priority} onClick={() => changeFilters({ priority: undefined })}>All</FilterPill>{(["URGENT", "HIGH", "NORMAL", "LOW"] as TaskPriority[]).map((value) => <FilterPill key={value} active={filters.priority === value} onClick={() => togglePriority(value)}>{value[0] + value.slice(1).toLowerCase()}</FilterPill>)}</FilterGroup>
            <FilterGroup label="Batch"><FilterPill active={!filters.farmWide && filters.batchId == null} onClick={() => toggleBatch("all")}>All batches</FilterPill><FilterPill active={!!filters.farmWide} onClick={() => toggleBatch("farm")}>Farm-wide</FilterPill>{batches?.map((item) => <FilterPill key={item.id} active={filters.batchId === item.id} onClick={() => toggleBatch(item.id)}>{item.name}</FilterPill>)}</FilterGroup>
            {isManager && <FilterGroup label="Handler"><FilterPill active={filters.assignedHandlerId == null} onClick={() => toggleHandler(undefined)}>All handlers</FilterPill>{handlers?.map((item) => <FilterPill key={item.id} active={filters.assignedHandlerId === item.id} onClick={() => toggleHandler(item.id)}>{item.fullName}</FilterPill>)}</FilterGroup>}
          </div>
        </CardHeader><CardContent className="flex min-h-0 flex-1 flex-col p-4 pt-0"><div className="min-h-[18rem] max-h-[min(62dvh,44rem)] min-w-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">{isLoading && <TaskSkeleton />}{error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error instanceof ApiError ? error.message : "Could not load tasks."}</p>}{!isLoading && !error && page?.items.map((task) => <TaskCard key={task.id} task={task} batchName={task.batchId == null ? "Farm-wide" : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`} onOpen={setSelectedTask} />)}{!isLoading && !error && page?.items.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No tasks match this view.</div>}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span>{page?.totalItems ?? 0} matching task{page?.totalItems === 1 ? "" : "s"}{isFetching && !isLoading ? " · Updating…" : ""}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={!page?.hasPrevious || isFetching} onClick={() => changeFilters({ page: Math.max(0, filters.page - 1) })}><ChevronLeft className="size-4" />Previous</Button><span>Page {(page?.page ?? filters.page) + 1} of {Math.max(1, page?.totalPages ?? 1)}</span><Button type="button" variant="outline" size="sm" disabled={!page?.hasNext || isFetching} onClick={() => changeFilters({ page: filters.page + 1 })}>Next<ChevronRight className="size-4" /></Button></div></div></CardContent></Card>
      </div>
      </> : <HandlerTaskQueue
        summary={handlerSummaryQuery.data}
        summaryLoading={handlerSummaryQuery.isLoading}
        summaryError={handlerSummaryQuery.error}
        page={page}
        items={visibleItems}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        bucket={handlerQueueBucket}
        batchNames={batchNames}
        onBucketChange={changeHandlerQueue}
        onOpen={setSelectedTask}
        onLoadMore={() => { void handlerQueueQuery.fetchNextPage(); }}
        onRetry={() => { void handlerQueueQuery.refetch(); void handlerSummaryQuery.refetch(); }}
      />}
      {isManager
        ? <TaskDetailDialog task={selectedTask} open={selectedTask != null} isManager handlerNames={handlerNames} pending={update.isPending} onOpenChange={(open) => { if (!open) setSelectedTask(null); }} onDone={markDone} />
        : <HandlerTaskDetailDialog task={selectedTask} open={selectedTask != null} batchName={selectedTask?.batchId == null ? "Farm-wide" : batchNames.get(selectedTask?.batchId ?? -1) ?? `Batch ${selectedTask?.batchId}`} pending={update.isPending} onOpenChange={(open) => { if (!open) setSelectedTask(null); }} onDone={markDone} />}
    </div>
  );
}

function HandlerTaskQueue({
  summary,
  summaryLoading,
  summaryError,
  page,
  items,
  isLoading,
  isFetching,
  error,
  bucket,
  batchNames,
  onBucketChange,
  onOpen,
  onLoadMore,
  onRetry,
}: {
  summary?: HandlerTaskQueueSummary;
  summaryLoading: boolean;
  summaryError: unknown;
  page?: PageResponse<HandlerTask>;
  items: HandlerTask[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  bucket: HandlerTaskQueueBucket;
  batchNames: Map<number, string>;
  onBucketChange: (bucket: HandlerTaskQueueBucket) => void;
  onOpen: (task: HandlerTask) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const showingNow = bucket === "NOW";
  const count = summary?.now ?? (showingNow ? page?.totalItems : undefined);
  const errorMessage = taskLoadErrorMessage(error, "Could not load tasks.");
  const summaryMessage = taskLoadErrorMessage(summaryError, "Could not load the task count.");
  const combinedError = errorMessage || summaryMessage;
  const grouped = groupHandlerTasks(items, bucket);
  const countReady = !summaryLoading || page != null;
  return <section className="space-y-5">
    <header className="space-y-1">
      <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ClipboardList className="size-5" aria-hidden="true" /></div><div><h1 className="text-2xl font-bold tracking-tight">{t("tasks.myTasks")}</h1><p className="text-sm text-muted-foreground">{t("tasks.handlerSubtitle")}</p></div></div>
      {!countReady && <p className="pt-2 text-lg font-semibold text-muted-foreground">{t("common.loading")}</p>}
      {countReady && showingNow && count === 0 && <p className="pt-2 text-lg font-semibold">{t("tasks.handlerNoTasks")}</p>}
      {countReady && showingNow && typeof count === "number" && count > 0 && <p className="pt-2 text-lg font-semibold">{count} {t("tasks.handlerRemaining")}</p>}
      {countReady && !showingNow && typeof count === "number" && <p className="pt-2 text-lg font-semibold">{count} {t("tasks.handlerScheduledCount")}</p>}
      {showingNow && summary && summary.upcoming > 0 && <p className="text-sm text-muted-foreground">{t("tasks.handlerUpcomingHint").replace("{count}", String(summary.upcoming))}</p>}
      {summaryMessage && !errorMessage && <p className="text-xs text-muted-foreground">{summaryMessage}</p>}
    </header>
    <div className="flex gap-2" role="tablist" aria-label={t("tasks.title")}>
      <button type="button" role="tab" aria-selected={bucket === "NOW"} onClick={() => onBucketChange("NOW")} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${bucket === "NOW" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{t("tasks.handlerNowTab")} {summary ? `(${summary.now})` : ""}</button>
      <button type="button" role="tab" aria-selected={bucket === "UPCOMING"} onClick={() => onBucketChange("UPCOMING")} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${bucket === "UPCOMING" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{t("tasks.handlerUpcomingTab")} {summary ? `(${summary.upcoming})` : ""}</button>
      <button type="button" role="tab" aria-selected={bucket === "COMPLETED"} onClick={() => onBucketChange("COMPLETED")} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${bucket === "COMPLETED" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{t("tasks.handlerDoneTab")} {summary ? `(${summary.completed})` : ""}</button>
    </div>
    {isLoading && <TaskSkeleton />}
    {combinedError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><p>{combinedError}</p><Button type="button" variant="outline" className="mt-3 min-h-10" onClick={onRetry}>Try again</Button></div>}
    {!isLoading && !error && items.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto size-8 text-primary" aria-hidden="true" /><p className="mt-2 font-semibold">{bucket === "COMPLETED" ? t("tasks.handlerNoCompleted") : bucket === "UPCOMING" ? t("tasks.handlerNoUpcoming") : t("tasks.handlerNoTasks")}</p><p className="mt-1 text-sm text-muted-foreground">{bucket === "COMPLETED" ? t("tasks.handlerNoCompletedHint") : t("tasks.handlerNoTasksHint")}</p></div>}
    {!isLoading && !error && items.length > 0 && <div className="space-y-4" aria-live="polite">{Array.from(grouped.entries()).map(([label, tasks]) => <section key={label} className="space-y-2"><h2 className="border-l-4 border-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</h2><div className="space-y-2">{tasks.map((task) => <HandlerTaskRow key={task.id} task={task} batchName={task.batchId == null ? t("tasks.handlerFarmWide") : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`} onOpen={onOpen} />)}</div></section>)}</div>}
    {!isLoading && !error && page?.hasNext && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={isFetching} onClick={onLoadMore}>{isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{t("tasks.handlerLoadMore")}</Button>}
  </section>;
}

function groupHandlerTasks(items: HandlerTask[], bucket: HandlerTaskQueueBucket) {
  const groups = new Map<string, HandlerTask[]>();
  for (const task of items) {
    let label: string;
    if (bucket === "COMPLETED") label = "Completed";
    else if (task.sourceType === "VACCINATION_PLAN") label = "Vaccination reminders";
    else if (!task.dueAt) label = "No deadline";
    else if (task.overdue) label = "Late";
    else if (bucket === "NOW") label = "Today";
    else label = new Date(task.dueAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    groups.set(label, [...(groups.get(label) ?? []), task]);
  }
  return groups;
}

function HandlerTaskRow({ task, batchName, onOpen }: { task: HandlerTask; batchName: string; onOpen: (task: HandlerTask) => void }) {
  const { t } = useLocale();
  const urgent = task.priority === "URGENT" || task.priority === "HIGH";
  const deadline = formatTaskDeadline(task, t("tasks.overdue"), t("tasks.today"), t("tasks.noDue"));
  function onKeyDown(event: KeyboardEvent<HTMLElement>) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(task); } }
  return <article role="button" tabIndex={0} aria-label={`${t("tasks.handlerViewDetails")}: ${task.title}`} onClick={() => onOpen(task)} onKeyDown={onKeyDown} className={`group cursor-pointer rounded-2xl border p-4 outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary ${task.overdue && task.status !== "COMPLETED" ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
    <div className="flex items-start gap-3"><div className="min-w-0 flex-1 space-y-1.5"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold leading-snug">{task.title}</h2>{urgent && <Badge variant="destructive">{task.priority === "URGENT" ? "Urgent" : "High priority"}</Badge>}{task.sourceType === "VACCINATION_PLAN" && <Badge variant="secondary">Reminder</Badge>}{task.pendingSync && <Badge variant="outline">{t("tasks.handlerPending")}</Badge>}</div><p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{batchName}</span><span aria-hidden="true">·</span><span className={task.overdue && task.status !== "COMPLETED" ? "font-semibold text-destructive" : ""}>{deadline}</span></p></div><ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></div>
  </article>;
}

function formatTaskDeadline(task: HandlerTask, lateLabel: string, todayLabel: string, noDueLabel: string) {
  if (!task.dueAt) return noDueLabel;
  const date = new Date(task.dueAt);
  if (task.overdue && task.status !== "COMPLETED") return `${lateLabel} · ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return `${todayLabel} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function HandlerTaskDetailDialog({ task, open, batchName, pending, onOpenChange, onDone }: { task: HandlerTask | null; open: boolean; batchName: string; pending: boolean; onOpenChange: (open: boolean) => void; onDone: (task: HandlerTask) => void }) {
  const { t } = useLocale();
  if (!task) return null;
  const completed = task.status === "COMPLETED";
  const deadline = formatTaskDeadline(task, t("tasks.overdue"), t("tasks.today"), t("tasks.noDue"));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{task.title}</DialogTitle><DialogDescription>{t("tasks.handlerDetailHint")}</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tasks.instructions")}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{task.instructions || t("tasks.handlerNoInstructions")}</p></div><dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">{t("tasks.whichBatch")}</dt><dd className="font-medium">{batchName}</dd></div><div><dt className="text-xs text-muted-foreground">{t("tasks.due")}</dt><dd className="font-medium">{deadline}</dd></div></dl>{task.pendingSync && <p className="rounded-xl border border-warning-border bg-warning-muted/60 px-3 py-2 text-sm text-warning-ink">{t("tasks.handlerPendingHint")}</p>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>{!completed && task.sourceType === "VACCINATION_PLAN" && <VaccinationTaskAction task={task} />}{!completed && task.sourceType !== "VACCINATION_PLAN" && <Button type="button" className="min-h-11" disabled={pending || task.pendingSync} onClick={() => onDone(task)}><CheckCircle2 className="size-4" />{t("tasks.markDone")}</Button>}</DialogFooter></DialogContent></Dialog>;
}

function TaskSummaryBar({ summary, filters, onFilter }: { summary?: TaskSummaryResponse; filters: TaskPageFilters; onFilter: (patch: Partial<TaskPageFilters>) => void }) {
  const items: { label: string; value: number; view: TaskView; dueBucket: TaskDueBucket }[] = [
    { label: "Late", value: summary?.late ?? 0, view: "OPEN", dueBucket: "LATE" }, { label: "Today", value: summary?.today ?? 0, view: "OPEN", dueBucket: "TODAY" }, { label: "Upcoming", value: summary?.upcoming ?? 0, view: "OPEN", dueBucket: "UPCOMING" }, { label: "No due date", value: summary?.noDueDate ?? 0, view: "OPEN", dueBucket: "NO_DUE" }, { label: "Completed", value: summary?.completed ?? 0, view: "COMPLETED", dueBucket: "ALL" },
  ];
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{items.map((item) => { const active = filters.view === item.view && filters.dueBucket === item.dueBucket; return <button key={item.label} type="button" aria-pressed={active} onClick={() => onFilter(active ? { view: "ALL", dueBucket: "ALL" } : { view: item.view, dueBucket: item.dueBucket })} className={`min-h-20 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 ${active ? "border-primary bg-primary/5" : "bg-card"}`}><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p></button>; })}</div>;
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2"><span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">{label}</span><div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1" role="group" aria-label={`${label} filters`}>{children}</div></div>;
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-10 shrink-0 rounded-lg border px-3 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{children}</button>;
}

function TaskCard({ task, batchName, onOpen }: { task: HandlerTask; batchName: string; onOpen: (task: HandlerTask) => void }) {
  function onKeyDown(event: KeyboardEvent<HTMLElement>) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(task); } }
  const due = task.dueAt ? new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due date";
  return <article role="button" tabIndex={0} aria-label={`Open task ${task.title}`} onClick={() => onOpen(task)} onKeyDown={onKeyDown} className={`cursor-pointer rounded-xl border p-3 outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary ${task.overdue ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{task.title}</h4><Badge variant={task.priority === "URGENT" || task.priority === "HIGH" ? "destructive" : "secondary"}>{task.priority}</Badge>{task.pendingSync && <Badge variant="outline">Waiting to sync</Badge>}</div>{task.instructions && <p className="line-clamp-2 text-sm text-muted-foreground">{task.instructions}</p>}<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{batchName}</span><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{task.overdue ? "Late · " : ""}{due}</span>{task.sourceType && <span>{task.sourceType === "VACCINATION_PLAN" ? "Vaccination" : task.sourceType}</span>}</div></div><Badge variant={task.status === "COMPLETED" ? "secondary" : task.status === "BLOCKED" ? "destructive" : "outline"}>{task.status.replace("_", " ")}</Badge></div></article>;
}

function TaskDetailDialog({ task, open, isManager, handlerNames, pending, onOpenChange, onDone }: { task: HandlerTask | null; open: boolean; isManager: boolean; handlerNames: Map<number, string>; pending: boolean; onOpenChange: (open: boolean) => void; onDone: (task: HandlerTask) => void }) {
  if (!task) return null;
  const due = task.dueAt ? new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due date";
  const completed = task.status === "COMPLETED";
  const assignedTo = task.assignmentScope === "HANDLER" ? handlerNames.get(task.assignedHandlerId ?? -1) ?? `Handler #${task.assignedHandlerId}` : "All handlers";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg"><DialogHeader><DialogTitle>{task.title}</DialogTitle><DialogDescription>Task information and completion history.</DialogDescription></DialogHeader><div className="space-y-4"><div className="flex flex-wrap gap-2"><Badge variant={task.overdue ? "destructive" : "outline"}>{task.overdue ? "Late" : task.status.replace("_", " ")}</Badge><Badge variant="secondary">{task.priority}</Badge>{task.pendingSync && <Badge variant="outline">Waiting to sync</Badge>}</div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Assigned to</dt><dd className="font-medium">{assignedTo}</dd></div><div><dt className="text-xs text-muted-foreground">Due</dt><dd className="font-medium">{due}</dd></div><div><dt className="text-xs text-muted-foreground">Scope</dt><dd className="font-medium">{task.batchId == null ? "Farm-wide" : `Batch #${task.batchId}`}</dd></div><div><dt className="text-xs text-muted-foreground">Created</dt><dd className="font-medium">{new Date(task.createdAt).toLocaleString()}</dd></div>{task.completedAt && <div><dt className="text-xs text-muted-foreground">Completed</dt><dd className="font-medium">{new Date(task.completedAt).toLocaleString()}{task.completedBy != null ? ` · ${handlerNames.get(task.completedBy) ?? `Handler #${task.completedBy}`}` : ""}</dd></div>}<div><dt className="text-xs text-muted-foreground">Source</dt><dd className="font-medium">{task.sourceType === "VACCINATION_PLAN" ? "Vaccination schedule" : task.sourceType ?? "Manual task"}</dd></div></dl>{task.instructions && <div className="rounded-xl border bg-muted/20 p-3 text-sm whitespace-pre-wrap"><p className="mb-1 text-xs font-semibold text-muted-foreground">Instructions</p>{task.instructions}</div>}{task.completionNote && <div className="rounded-xl border bg-muted/20 p-3 text-sm whitespace-pre-wrap"><p className="mb-1 text-xs font-semibold text-muted-foreground">Completion note</p>{task.completionNote}</div>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>{!isManager && !completed && task.sourceType === "VACCINATION_PLAN" && <VaccinationTaskAction task={task} />}{!isManager && !completed && task.sourceType !== "VACCINATION_PLAN" && <Button type="button" disabled={pending || task.pendingSync} onClick={() => onDone(task)}><CheckCircle2 className="size-4" />Done</Button>}</DialogFooter></DialogContent></Dialog>;
}

function TaskSkeleton() { return <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted/50" />)}</div>; }
