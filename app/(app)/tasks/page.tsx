"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Eye, Filter, Loader2, Plus, Search, SlidersHorizontal, Syringe, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useCloseTask, useHandlerTaskQueueSummary, useTaskHistory, useTaskPage, useTaskPageInfinite, useTaskQueue, useTaskSummary, useCreateTask, useUpdateTaskStatus } from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import { useHandlers } from "@/hooks/use-reference";
import { useBatches } from "@/hooks/use-batches";
import { ApiError } from "@/lib/api-client";
import type { HandlerTask, HandlerTaskQueueBucket, HandlerTaskQueueSummary, PageResponse, TaskAssignmentMode, TaskDueBucket, TaskKind, TaskPageFilters, TaskPriority, TaskStatusHistory, TaskSummaryResponse, TaskView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/locale-provider";
import { VaccinationManagerAction } from "@/components/vaccination-plan-card";
import { HandlerTaskDetailDialog } from "@/components/tasks/handler-task-ui";
import { CloseTaskDialog } from "@/components/tasks/close-task-dialog";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { useIsMobile } from "@/hooks/use-mobile";

const PAGE_SIZE = 20;
const HANDLER_PAGE_SIZE = 10;
const PAGE_SIZES = [10, 20, 50] as const;

function readFilters(searchParams: ReturnType<typeof useSearchParams>): TaskPageFilters {
  const view = searchParams.get("view");
  const dueBucket = searchParams.get("due");
  const batch = searchParams.get("batch");
  const handler = searchParams.get("handler");
  const priority = searchParams.get("priority");
  const kind = searchParams.get("kind");
  const requestedSize = Number(searchParams.get("size"));
  return {
    page: Math.max(0, Number(searchParams.get("page") ?? 0) || 0),
    size: PAGE_SIZES.includes(requestedSize as typeof PAGE_SIZES[number]) ? requestedSize : PAGE_SIZE,
    view: ["OPEN", "COMPLETED", "CANCELLED", "ALL"].includes(view ?? "") ? view as TaskView : "OPEN",
    dueBucket: ["ALL", "LATE", "TODAY", "UPCOMING", "NO_DUE"].includes(dueBucket ?? "") ? dueBucket as TaskDueBucket : "ALL",
    kind: ["WORK", "VACCINATION"].includes(kind ?? "") ? kind as TaskKind : undefined,
    batchId: batch && batch !== "farm" ? Number(batch) || undefined : undefined,
    farmWide: batch === "farm" ? true : undefined,
    assignedHandlerId: handler ? Number(handler) || undefined : undefined,
    priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority ?? "") ? priority as TaskPriority : undefined,
    search: searchParams.get("q")?.trim() || undefined,
  };
}

function formatFilters(filters: TaskPageFilters) {
  const params = new URLSearchParams();
  if (filters.page > 0) params.set("page", String(filters.page));
  if (filters.size !== PAGE_SIZE) params.set("size", String(filters.size));
  if (filters.view !== "OPEN") params.set("view", filters.view);
  if (filters.dueBucket !== "ALL") params.set("due", filters.dueBucket);
  if (filters.kind) params.set("kind", filters.kind);
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
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const managerFilters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [handlerQueueBucket, setHandlerQueueBucket] = useState<HandlerTaskQueueBucket>("NOW");
  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") ?? "");
  const [selectedTask, setSelectedTask] = useState<HandlerTask | null>(null);
  const [closeTarget, setCloseTarget] = useState<HandlerTask | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<TaskAssignmentMode>("ALL_HANDLERS");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [handler, setHandler] = useState("");
  const [batch, setBatch] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [formError, setFormError] = useState("");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const mobileTaskLoadMoreRef = useRef<HTMLDivElement>(null);

  const filters = useMemo<TaskPageFilters>(() => ({ page: 0, size: isManager ? managerFilters.size : HANDLER_PAGE_SIZE, view: isManager ? managerFilters.view : "OPEN", dueBucket: isManager ? managerFilters.dueBucket : "ALL", kind: isManager ? managerFilters.kind : undefined, batchId: managerFilters.batchId, farmWide: managerFilters.farmWide, assignedHandlerId: managerFilters.assignedHandlerId, priority: managerFilters.priority, search: managerFilters.search }), [isManager, managerFilters]);
  const managerPageQuery = useTaskPage(managerFilters, isManager && !isMobile);
  const mobileManagerPageQuery = useTaskPageInfinite({ ...managerFilters, page: 0, size: PAGE_SIZE }, isManager && isMobile);
  const { fetchNextPage: fetchMobileNextPage } = mobileManagerPageQuery;
  const handlerQueueQuery = useTaskQueue(handlerQueueBucket, !isManager);
  const handlerPages = useMemo(() => handlerQueueQuery.data?.pages ?? [], [handlerQueueQuery.data?.pages]);
  const handlerPage = handlerPages.at(-1);
  const mobileManagerPages = useMemo(() => mobileManagerPageQuery.data?.pages ?? [], [mobileManagerPageQuery.data?.pages]);
  const mobileManagerLastPage = mobileManagerPages.at(-1);
  const mobileManagerPage = useMemo(
    () => mobileManagerLastPage
      ? { ...mobileManagerLastPage, items: mobileManagerPages.flatMap((item) => item.items), hasPrevious: false }
      : undefined,
    [mobileManagerLastPage, mobileManagerPages],
  );
  const page = useMemo(
    () => isManager ? (isMobile ? mobileManagerPage : managerPageQuery.data) : handlerPage ? { ...handlerPage, items: handlerPages.flatMap((item) => item.items) } : undefined,
    [handlerPage, handlerPages, isManager, isMobile, managerPageQuery.data, mobileManagerPage],
  );
  const isLoading = isManager ? (isMobile ? mobileManagerPageQuery.isLoading : managerPageQuery.isLoading) : handlerQueueQuery.isLoading;
  const isFetching = isManager ? (isMobile ? mobileManagerPageQuery.isFetching : managerPageQuery.isFetching) : handlerQueueQuery.isFetching;
  const error = isManager ? (isMobile ? mobileManagerPageQuery.error : managerPageQuery.error) : handlerQueueQuery.error;
  const mobileHasNextPage = mobileManagerPageQuery.hasNextPage;
  const mobileIsFetchingNextPage = mobileManagerPageQuery.isFetchingNextPage;
  const summaryFilters = useMemo(() => ({
    batchId: isManager ? managerFilters.batchId : undefined,
    farmWide: isManager ? managerFilters.farmWide : undefined,
    assignedHandlerId: isManager ? managerFilters.assignedHandlerId : undefined,
    priority: isManager ? managerFilters.priority : undefined,
    kind: isManager ? managerFilters.kind : undefined,
    search: isManager ? managerFilters.search : undefined,
  }), [isManager, managerFilters.assignedHandlerId, managerFilters.batchId, managerFilters.farmWide, managerFilters.kind, managerFilters.priority, managerFilters.search]);
  const { data: summary } = useTaskSummary(summaryFilters, isManager);
  const handlerSummaryQuery = useHandlerTaskQueueSummary(!isManager);
  const { data: handlers } = useHandlers(isManager);
  const { data: batches } = useBatches();
  const create = useCreateTask();
  const update = useUpdateTaskStatus();
  const close = useCloseTask();
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

  useEffect(() => {
    if (!isManager || !isMobile || !mobileTaskLoadMoreRef.current || !mobileHasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !mobileIsFetchingNextPage) void fetchMobileNextPage();
    }, { rootMargin: "480px" });
    observer.observe(mobileTaskLoadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchMobileNextPage, isManager, isMobile, mobileHasNextPage, mobileIsFetchingNextPage]);

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
      setAssignmentOpen(false);
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

  function changeHandlerQueue(bucket: HandlerTaskQueueBucket) {
    setHandlerQueueBucket(bucket);
    setSelectedTask(null);
  }

  const activeFilterCount = [filters.view !== "OPEN", filters.dueBucket !== "ALL", filters.batchId != null || filters.farmWide, filters.assignedHandlerId != null, !!filters.priority, !!filters.kind, !!filters.search].filter(Boolean).length;
  const visibleItems = useMemo(() => page?.items ?? [], [page]);
  const requestedTaskId = Number(searchParams.get("taskId"));
  const requestedTask = Number.isSafeInteger(requestedTaskId) && requestedTaskId > 0
    ? visibleItems.find((item) => item.id === requestedTaskId) ?? null
    : null;
  const activeTask = selectedTask ?? requestedTask;
  const { data: taskHistory } = useTaskHistory(activeTask?.id, isManager && activeTask != null);

  function closeTaskDetails(open: boolean) {
    if (open) return;
    setSelectedTask(null);
    if (searchParams.has("taskId")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("taskId");
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }

  function requestClose(task: HandlerTask) {
    closeTaskDetails(false);
    setCloseTarget(task);
  }

  async function submitClose(reasonCode: string, reason: string | null) {
    if (!closeTarget) return;
    try {
      await close.mutateAsync({ id: closeTarget.id, body: { reasonCode, reason } });
      setCloseTarget(null);
      toast.success(t("tasks.closedStatus"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not close the task.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-4">
      {isManager ? <>
      <DashboardPageHeader icon={ClipboardList} title={t("tasks.title")} description="Assign, monitor, and complete farm work." />
      <TaskSummaryBar summary={summary} filters={filters} onFilter={changeFilters} />
      <div className="task-workspace grid gap-4">
        <div className="task-assignment-trigger">
          <Button type="button" className="w-full" onClick={() => setAssignmentOpen(true)}><Plus aria-hidden="true" />{t("tasks.assign")}</Button>
        </div>
        <Card className="task-assignment-panel h-fit shadow-none">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-base">{t("tasks.assign")}</CardTitle><CardDescription>Choose one handler or make the task visible to all handlers.</CardDescription></CardHeader>
          <CardContent className="p-4 pt-2"><TaskAssignmentForm idPrefix="panel" handlers={handlers} batches={batches} assignmentMode={assignmentMode} onAssignmentModeChange={setAssignmentMode} title={title} onTitleChange={setTitle} instructions={instructions} onInstructionsChange={setInstructions} handler={handler} onHandlerChange={setHandler} batch={batch} onBatchChange={setBatch} due={due} onDueChange={setDue} priority={priority} onPriorityChange={setPriority} formError={formError} pending={create.isPending} onSubmit={submit} /></CardContent>
        </Card>
      <TaskRecordsCard summary={summary} filters={filters} searchInput={searchInput} onSearchInputChange={setSearchInput} activeFilterCount={activeFilterCount} batches={batches} handlers={handlers} page={page} isLoading={isLoading} isFetching={isFetching} error={error} batchNames={batchNames} handlerNames={handlerNames} onFilter={changeFilters} onClearFilters={() => { setSearchInput(""); changeFilters({ view: "OPEN", dueBucket: "ALL", kind: undefined, batchId: undefined, farmWide: undefined, assignedHandlerId: undefined, priority: undefined, search: undefined }); }} onOpen={setSelectedTask} mobileLoadMoreRef={isManager && isMobile ? mobileTaskLoadMoreRef : undefined} mobileHasNextPage={isManager && isMobile ? mobileHasNextPage : false} mobileIsFetchingNextPage={isManager && isMobile ? mobileIsFetchingNextPage : false} />
      </div>
      <Sheet open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{t("tasks.assign")}</SheetTitle><SheetDescription>Choose one handler or make the task visible to all handlers.</SheetDescription></SheetHeader>
          <div className="px-4 pb-4"><TaskAssignmentForm idPrefix="sheet" handlers={handlers} batches={batches} assignmentMode={assignmentMode} onAssignmentModeChange={setAssignmentMode} title={title} onTitleChange={setTitle} instructions={instructions} onInstructionsChange={setInstructions} handler={handler} onHandlerChange={setHandler} batch={batch} onBatchChange={setBatch} due={due} onDueChange={setDue} priority={priority} onPriorityChange={setPriority} formError={formError} pending={create.isPending} onSubmit={submit} /></div>
        </SheetContent>
      </Sheet>
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
        ? <TaskDetailDialog task={activeTask} open={activeTask != null} isManager handlerNames={handlerNames} history={taskHistory} pending={update.isPending} onOpenChange={closeTaskDetails} onDone={markDone} onCloseTask={requestClose} />
        : <HandlerTaskDetailDialog task={activeTask} open={activeTask != null} batchName={activeTask?.batchId == null ? "Farm-wide" : batchNames.get(activeTask?.batchId ?? -1) ?? `Batch ${activeTask?.batchId}`} pending={update.isPending} onOpenChange={closeTaskDetails} onDone={markDone} />}
      <CloseTaskDialog key={`${closeTarget?.id ?? "none"}-${closeTarget?.sourceType === "VACCINATION_PLAN" ? "vaccination" : "task"}`} task={closeTarget} open={closeTarget != null} pending={close.isPending} vaccinationOrphan={closeTarget?.sourceType === "VACCINATION_PLAN"} onOpenChange={(open) => { if (!open) setCloseTarget(null); }} onSubmit={submitClose} />
    </div>
  );
}

type BatchOption = { id: number; name: string };
type HandlerOption = { id: number; fullName: string };

function TaskAssignmentForm({
  idPrefix,
  handlers,
  batches,
  assignmentMode,
  onAssignmentModeChange,
  title,
  onTitleChange,
  instructions,
  onInstructionsChange,
  handler,
  onHandlerChange,
  batch,
  onBatchChange,
  due,
  onDueChange,
  priority,
  onPriorityChange,
  formError,
  pending,
  onSubmit,
}: {
  idPrefix: string;
  handlers?: HandlerOption[];
  batches?: BatchOption[];
  assignmentMode: TaskAssignmentMode;
  onAssignmentModeChange: (value: TaskAssignmentMode) => void;
  title: string;
  onTitleChange: (value: string) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  handler: string;
  onHandlerChange: (value: string) => void;
  batch: string;
  onBatchChange: (value: string) => void;
  due: string;
  onDueChange: (value: string) => void;
  priority: TaskPriority;
  onPriorityChange: (value: TaskPriority) => void;
  formError: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLocale();
  return <form onSubmit={onSubmit} className="space-y-3" noValidate>
    <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-task-title`}>Task <span className="text-destructive">*</span></Label><Input id={`${idPrefix}-task-title`} required value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Check waterers and record concerns" /></div>
    <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-task-assignment`}>Who should see it?</Label><NativeSelect id={`${idPrefix}-task-assignment`} value={assignmentMode} onChange={(event) => { const mode = event.target.value as TaskAssignmentMode; onAssignmentModeChange(mode); if (mode === "ALL_HANDLERS") onHandlerChange(""); }}><option value="ALL_HANDLERS">All handlers</option><option value="SPECIFIC_HANDLER">Specific handler</option></NativeSelect></div>
    {assignmentMode === "SPECIFIC_HANDLER" && <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-task-handler`}>Handler</Label><NativeSelect id={`${idPrefix}-task-handler`} value={handler} onChange={(event) => onHandlerChange(event.target.value)}><option value="">Select a handler</option>{handlers?.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</NativeSelect></div>}
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1"><div className="space-y-1.5"><Label htmlFor={`${idPrefix}-task-batch`}>Batch <span className="font-normal text-muted-foreground">(optional)</span></Label><NativeSelect id={`${idPrefix}-task-batch`} value={batch} onChange={(event) => onBatchChange(event.target.value)}><option value="">Farm-wide</option>{batches?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></div><div className="space-y-1.5"><Label htmlFor={`${idPrefix}-task-due`}>Due <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id={`${idPrefix}-task-due`} type="datetime-local" value={due} onChange={(event) => onDueChange(event.target.value)} /></div></div>
    <details className="rounded-lg border px-3"><summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold">More options <span className="ml-1 font-normal text-muted-foreground">(optional)</span></summary><div className="space-y-2 pb-3"><NativeSelect id={`${idPrefix}-task-priority`} aria-label="Priority" value={priority} onChange={(event) => onPriorityChange(event.target.value as TaskPriority)}><option value="LOW">Low priority</option><option value="NORMAL">Normal priority</option><option value="HIGH">High priority</option><option value="URGENT">Urgent priority</option></NativeSelect><Textarea id={`${idPrefix}-task-instructions`} value={instructions} onChange={(event) => onInstructionsChange(event.target.value)} placeholder="Instructions for the handler" /></div></details>
    {formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>}
    <Button disabled={pending} type="submit" className="h-11 w-full">{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}{t("tasks.assign")}</Button>
  </form>;
}

function TaskRecordsCard({
  summary,
  filters,
  searchInput,
  onSearchInputChange,
  activeFilterCount,
  batches,
  handlers,
  page,
  isLoading,
  isFetching,
  error,
  batchNames,
  handlerNames,
  onFilter,
  onClearFilters,
  onOpen,
  mobileLoadMoreRef,
  mobileHasNextPage,
  mobileIsFetchingNextPage,
}: {
  summary?: TaskSummaryResponse;
  filters: TaskPageFilters;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  activeFilterCount: number;
  batches?: BatchOption[];
  handlers?: HandlerOption[];
  page?: PageResponse<HandlerTask>;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  batchNames: Map<number, string>;
  handlerNames: Map<number, string>;
  onFilter: (patch: Partial<TaskPageFilters>) => void;
  onClearFilters: () => void;
  onOpen: (task: HandlerTask) => void;
  mobileLoadMoreRef?: RefObject<HTMLDivElement | null>;
  mobileHasNextPage: boolean;
  mobileIsFetchingNextPage: boolean;
}) {
  const { t } = useLocale();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const advancedFilterCount = [filters.dueBucket !== "ALL", filters.batchId != null || filters.farmWide, filters.assignedHandlerId != null, !!filters.priority, !!filters.kind, !!filters.search].filter(Boolean).length;
  const total = page?.totalItems ?? 0;
  const pageSize = filters.size || PAGE_SIZE;
  const start = total === 0 ? 0 : (page?.page ?? filters.page) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(start + (page?.items.length ?? 0) - 1, total);
  const errorMessage = taskLoadErrorMessage(error, "Could not load tasks.");

  function setBatch(value: string) {
    if (value === "farm") onFilter({ batchId: undefined, farmWide: true });
    else if (value) onFilter({ batchId: Number(value) || undefined, farmWide: undefined });
    else onFilter({ batchId: undefined, farmWide: undefined });
  }

  function clearSearch() {
    onSearchInputChange("");
    onFilter({ search: undefined });
  }

  return <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden shadow-none">
    <CardHeader className="space-y-3 p-4 pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{t("tasks.allTasks")}</CardTitle><CardDescription>Use the filters to find a task, then open it for the full record.</CardDescription></div><Badge variant="outline">{summary?.open ?? 0} {t("tasks.open")}</Badge></div>
      <div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label={t("tasks.searchPlaceholder")} value={searchInput} onChange={(event) => onSearchInputChange(event.target.value)} placeholder={t("tasks.searchPlaceholder")} className="pl-9" /></div><Button type="button" variant="outline" className="shrink-0" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="size-4" />{t("tasks.filters")}{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}</Button></div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Task status filters"><FilterPill active={filters.view === "OPEN" && filters.dueBucket === "ALL"} onClick={() => onFilter({ view: "OPEN", dueBucket: "ALL" })}>Open</FilterPill><FilterPill active={filters.view === "COMPLETED"} onClick={() => onFilter({ view: "COMPLETED", dueBucket: "ALL" })}>Completed</FilterPill><FilterPill active={filters.view === "CANCELLED"} onClick={() => onFilter({ view: "CANCELLED", dueBucket: "ALL" })}>{t("tasks.closedStatus")} {summary?.cancelled != null ? `(${summary.cancelled})` : ""}</FilterPill><FilterPill active={filters.view === "ALL"} onClick={() => onFilter({ view: "ALL", dueBucket: "ALL" })}>All</FilterPill><span className="ml-auto text-xs text-muted-foreground">{activeFilterCount > 0 ? `${activeFilterCount} active` : "All visible tasks"}</span></div>
      {advancedFilterCount > 0 && <div className="flex flex-wrap items-center gap-1.5" aria-label={t("tasks.activeFilters")}><span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Filter className="size-3.5" aria-hidden="true" />{t("tasks.activeFilters")}</span>{filters.search && <ActiveTaskFilter label={`Search: ${filters.search}`} onClear={clearSearch} />}{filters.dueBucket !== "ALL" && <ActiveTaskFilter label={filters.dueBucket.replace("_", " ")} onClear={() => onFilter({ dueBucket: "ALL" })} />}{filters.priority && <ActiveTaskFilter label={filters.priority} onClear={() => onFilter({ priority: undefined })} />}{filters.kind && <ActiveTaskFilter label={filters.kind === "VACCINATION" ? t("tasks.vaccination") : t("tasks.work")} onClear={() => onFilter({ kind: undefined })} />}{(filters.batchId != null || filters.farmWide) && <ActiveTaskFilter label={filters.farmWide ? t("tasks.farmWide") : batchNames.get(filters.batchId ?? -1) ?? t("common.batch")} onClear={() => onFilter({ batchId: undefined, farmWide: undefined })} />}{filters.assignedHandlerId != null && <ActiveTaskFilter label={handlerNames.get(filters.assignedHandlerId) ?? t("tasks.anyHandler")} onClear={() => onFilter({ assignedHandlerId: undefined })} />}<button type="button" className="min-h-8 px-2 text-xs font-semibold text-primary underline-offset-4 hover:underline" onClick={onClearFilters}>{t("tasks.clearFilters")}</button></div>}
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col p-4 pt-0">
      <div data-testid="manager-task-records" className="min-h-[18rem] min-w-0 flex-1 md:max-h-[min(62dvh,44rem)] md:overflow-y-auto md:overscroll-contain md:pr-1">{isLoading && <TaskSkeleton />}{errorMessage && !isLoading && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage}</p>}{!isLoading && !errorMessage && page?.items.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><p>{t("tasks.noMatches")}</p><Button type="button" variant="link" className="mt-1" onClick={onClearFilters}>{t("tasks.clearFilters")}</Button></div>}{!isLoading && !errorMessage && page?.items.length ? <ManagerTaskRecords items={page.items} batchNames={batchNames} handlerNames={handlerNames} onOpen={onOpen} /> : null}{mobileHasNextPage && mobileLoadMoreRef && <div ref={mobileLoadMoreRef} className="h-3" aria-hidden="true">{mobileIsFetchingNextPage && <span className="sr-only">Loading more tasks</span>}</div>}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground"><div className="flex items-center gap-2"><span>{start}–{end} of {total} task{total === 1 ? "" : "s"}</span>{isFetching && !isLoading ? <span>· Updating…</span> : null}</div><div className="flex flex-wrap items-center justify-end gap-2"><label className="hidden items-center gap-1.5 sm:flex">{t("tasks.rows")}<NativeSelect aria-label={t("tasks.rows")} className="h-9 min-w-16 text-xs" value={String(pageSize)} onChange={(event) => onFilter({ size: Number(event.target.value), page: 0 })}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</NativeSelect></label><Button type="button" variant="outline" size="sm" disabled={!page?.hasPrevious || isFetching} onClick={() => onFilter({ page: Math.max(0, filters.page - 1) })}><ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span></Button><span>Page {(page?.page ?? filters.page) + 1} of {Math.max(1, page?.totalPages ?? 1)}</span><Button type="button" variant="outline" size="sm" disabled={!page?.hasNext || isFetching} onClick={() => onFilter({ page: filters.page + 1 })}><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" /></Button></div></div>
    </CardContent>
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}><SheetContent side="right" className="w-full max-w-md overflow-y-auto"><SheetHeader><SheetTitle>{t("tasks.filterTitle")}</SheetTitle><SheetDescription>{t("tasks.filterDescription")}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><TaskFilterField label={t("tasks.due")}><NativeSelect value={filters.dueBucket} onChange={(event) => onFilter({ dueBucket: event.target.value as TaskDueBucket })}><option value="ALL">{t("tasks.anyDue")}</option><option value="LATE">{t("tasks.late")}</option><option value="TODAY">{t("tasks.today")}</option><option value="UPCOMING">{t("tasks.next")}</option><option value="NO_DUE">{t("tasks.noDue")}</option></NativeSelect></TaskFilterField><TaskFilterField label={t("tasks.priority")}><NativeSelect value={filters.priority ?? ""} onChange={(event) => onFilter({ priority: (event.target.value || undefined) as TaskPriority | undefined })}><option value="">{t("tasks.allPriorities")}</option>{(["URGENT", "HIGH", "NORMAL", "LOW"] as TaskPriority[]).map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}</NativeSelect></TaskFilterField><TaskFilterField label={t("common.type")}><NativeSelect value={filters.kind ?? ""} onChange={(event) => onFilter({ kind: (event.target.value || undefined) as TaskKind | undefined })}><option value="">{t("tasks.allTypes")}</option><option value="WORK">{t("tasks.work")}</option><option value="VACCINATION">{t("tasks.vaccination")}</option></NativeSelect></TaskFilterField><TaskFilterField label={t("common.batch")}><NativeSelect value={filters.farmWide ? "farm" : filters.batchId?.toString() ?? ""} onChange={(event) => setBatch(event.target.value)}><option value="">{t("tasks.allBatches")}</option><option value="farm">{t("tasks.farmWide")}</option>{batches?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></TaskFilterField><TaskFilterField label={t("tasks.who")}><NativeSelect value={filters.assignedHandlerId?.toString() ?? ""} onChange={(event) => onFilter({ assignedHandlerId: event.target.value ? Number(event.target.value) : undefined })}><option value="">{t("tasks.allHandlers")}</option>{handlers?.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</NativeSelect></TaskFilterField></div><SheetFooter><Button type="button" variant="outline" onClick={onClearFilters}>{t("tasks.clearFilters")}</Button><Button type="button" onClick={() => setFiltersOpen(false)}>{t("common.close")}</Button></SheetFooter></SheetContent></Sheet>
  </Card>;
}

function TaskFilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ActiveTaskFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return <button type="button" className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border bg-muted px-2.5 text-xs font-medium hover:bg-muted/70" onClick={onClear}><span className="truncate">{label}</span><X className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">Clear {label}</span></button>;
}

function ManagerTaskRecords({ items, batchNames, handlerNames, onOpen }: { items: HandlerTask[]; batchNames: Map<number, string>; handlerNames: Map<number, string>; onOpen: (task: HandlerTask) => void }) {
  return <>
    <div className="hidden md:block">
      <div data-testid="manager-task-table"><Table aria-label="Farm tasks" className="table-fixed">
        <TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="w-[34%] whitespace-normal">Task</TableHead><TableHead className="w-[22%] whitespace-normal">Batch</TableHead><TableHead className="hidden w-[14%] whitespace-normal xl:table-cell">Assigned to</TableHead><TableHead className="w-[17%] whitespace-normal">Due</TableHead><TableHead className="hidden w-[10%] whitespace-normal xl:table-cell">Priority</TableHead><TableHead className="w-[12%] whitespace-normal">Status</TableHead><TableHead className="w-14 text-right"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
        <TableBody>{items.map((task) => { const batchName = task.batchId == null ? "Farm-wide" : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`; const assignedTo = task.assignmentScope === "HANDLER" ? handlerNames.get(task.assignedHandlerId ?? -1) ?? `Handler #${task.assignedHandlerId}` : "All handlers"; return <TableRow key={task.id} className={task.overdue && task.status !== "COMPLETED" ? "bg-warning-muted/20" : undefined}><TableCell className="whitespace-normal"><button type="button" className="block max-w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onOpen(task)}><span className="block line-clamp-2 font-semibold">{task.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">#{task.id}{task.sourceType === "VACCINATION_PLAN" ? " · Vaccination" : task.sourceType ? ` · ${task.sourceType}` : ""}</span></button></TableCell><TableCell className="whitespace-normal"><span className="block truncate font-medium">{batchName}</span><span className="mt-1 block truncate text-xs text-muted-foreground xl:hidden">{assignedTo}</span></TableCell><TableCell className="hidden whitespace-normal xl:table-cell"><span className="block truncate">{assignedTo}</span></TableCell><TableCell className="whitespace-normal"><span className={task.overdue && task.status !== "COMPLETED" ? "font-semibold text-warning-ink" : ""}>{formatManagerDue(task)}</span></TableCell><TableCell className="hidden xl:table-cell"><Badge variant={task.priority === "URGENT" || task.priority === "HIGH" ? "warning" : "secondary"}>{task.priority}</Badge></TableCell><TableCell><TaskStatusBadge task={task} /></TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon-sm" aria-label={`View task ${task.title}`} onClick={() => onOpen(task)}><Eye className="size-4" /></Button></TableCell></TableRow>; })}</TableBody>
      </Table></div>
    </div>
    <div data-testid="manager-task-mobile-list" className="space-y-2 md:hidden">{items.map((task) => { const batchName = task.batchId == null ? "Farm-wide" : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`; const assignedTo = task.assignmentScope === "HANDLER" ? handlerNames.get(task.assignedHandlerId ?? -1) ?? `Handler #${task.assignedHandlerId}` : "All handlers"; return <button key={task.id} type="button" className={`block min-h-24 w-full rounded-xl border p-3 text-left outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary ${task.overdue && task.status !== "COMPLETED" ? "border-warning-border bg-warning-muted/20" : "bg-card"}`} onClick={() => onOpen(task)}><div className="flex items-start justify-between gap-3"><span className="min-w-0 flex-1"><span className="block line-clamp-2 font-semibold">{task.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{batchName} · {assignedTo}</span></span><TaskStatusBadge task={task} /></div><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{formatManagerDue(task)}</span><span>{task.priority}</span><span>#{task.id}</span><ChevronRight className="ml-auto size-4" aria-hidden="true" /></div></button>; })}</div>
  </>;
}

function formatManagerDue(task: HandlerTask) {
  if (task.status === "COMPLETED" && task.completedAt) return `Done · ${new Date(task.completedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
  if (task.status === "CANCELLED") return `Closed · ${new Date(task.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
  if (!task.dueAt) return "No due date";
  return `${task.overdue ? "Late · " : ""}${new Date(task.dueAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

function TaskStatusBadge({ task }: { task: HandlerTask }) {
  const { t } = useLocale();
  const variant = task.status === "COMPLETED" ? "success" : task.status === "CANCELLED" ? "secondary" : task.status === "BLOCKED" || task.overdue ? "warning" : "outline";
  return <Badge variant={variant}>{task.status === "COMPLETED" ? t("tasks.done") : task.status === "CANCELLED" ? t("tasks.closedStatus") : task.status === "IN_PROGRESS" ? t("tasks.inProgressStatus") : task.status === "BLOCKED" ? t("tasks.blockedStatus") : t("tasks.todoStatus")}</Badge>;
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
  const errorMessage = taskLoadErrorMessage(error, "Could not load tasks.");
  const summaryMessage = taskLoadErrorMessage(summaryError, "Could not load the task count.");
  const combinedError = errorMessage || summaryMessage;
  const vaccinationTasks = bucket === "NOW" ? items.filter((task) => task.sourceType === "VACCINATION_PLAN") : [];
  const workItems = bucket === "NOW" ? items.filter((task) => task.sourceType !== "VACCINATION_PLAN") : items;
  const grouped = groupHandlerTasks(workItems, bucket, {
    completed: t("tasks.handlerDoneTab"),
    noDeadline: t("tasks.noDue"),
    late: t("tasks.overdue"),
    today: t("tasks.handlerNowTab"),
  });
  const tabCount = (value: number | undefined) => summaryLoading && value == null ? "…" : String(value ?? 0);
  return <section className="space-y-4 pb-2">
    <DashboardPageHeader icon={ClipboardList} title={t("tasks.myTasks")} description={t("tasks.handlerSubtitle")} />
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/50 p-1" role="tablist" aria-label={t("tasks.title")}>
      <HandlerQueueTab active={bucket === "NOW"} label={t("tasks.handlerNowTab")} count={tabCount(summary?.now)} onClick={() => onBucketChange("NOW")} />
      <HandlerQueueTab active={bucket === "UPCOMING"} label={t("tasks.handlerUpcomingTab")} count={tabCount(summary?.upcoming)} onClick={() => onBucketChange("UPCOMING")} />
      <HandlerQueueTab active={bucket === "COMPLETED"} label={t("tasks.handlerDoneTab")} count={tabCount(summary?.completed)} onClick={() => onBucketChange("COMPLETED")} />
    </div>
    {summaryMessage && !errorMessage && <p className="text-xs text-muted-foreground">{summaryMessage}</p>}
    {isLoading && <TaskSkeleton />}
    {combinedError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><p>{combinedError}</p><Button type="button" variant="outline" className="mt-3 min-h-10" onClick={onRetry}>Try again</Button></div>}
    {!isLoading && !error && items.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto size-8 text-primary" aria-hidden="true" /><p className="mt-2 font-semibold">{bucket === "COMPLETED" ? t("tasks.handlerNoCompleted") : bucket === "UPCOMING" ? t("tasks.handlerNoUpcoming") : t("tasks.handlerNoTasks")}</p><p className="mt-1 text-sm text-muted-foreground">{bucket === "COMPLETED" ? t("tasks.handlerNoCompletedHint") : t("tasks.handlerNoTasksHint")}</p></div>}
    {!isLoading && !error && items.length > 0 && <div className="space-y-5" aria-live="polite">
      {Array.from(grouped.entries()).map(([label, tasks]) => <section key={label} className="space-y-2"><h2 className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</h2><div className="space-y-2">{tasks.map((task) => <HandlerTaskRow key={task.id} task={task} batchName={task.batchId == null ? t("tasks.handlerFarmWide") : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`} onOpen={onOpen} />)}</div></section>)}
      {vaccinationTasks.length > 0 && <VaccinationReminderGroup tasks={vaccinationTasks} batchNames={batchNames} onOpen={onOpen} />}
    </div>}
    {!isLoading && !error && page?.hasNext && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={isFetching} onClick={onLoadMore}>{isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{t("tasks.handlerLoadMore")}</Button>}
  </section>;
}

function HandlerQueueTab({ active, label, count, onClick }: { active: boolean; label: string; count: string; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition-colors ${active ? "bg-card text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60"}`}><span className="truncate">{label}</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-primary/10 text-primary" : "bg-background/60"}`}>{count}</span></button>;
}

function groupHandlerTasks(items: HandlerTask[], bucket: HandlerTaskQueueBucket, labels: { completed: string; noDeadline: string; late: string; today: string }) {
  const groups = new Map<string, HandlerTask[]>();
  for (const task of items) {
    let label: string;
    if (bucket === "COMPLETED") label = labels.completed;
    else if (!task.dueAt) label = labels.noDeadline;
    else if (task.overdue) label = labels.late;
    else if (bucket === "NOW") label = labels.today;
    else label = new Date(task.dueAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    groups.set(label, [...(groups.get(label) ?? []), task]);
  }
  return groups;
}

function VaccinationReminderGroup({ tasks, batchNames, onOpen }: { tasks: HandlerTask[]; batchNames: Map<number, string>; onOpen: (task: HandlerTask) => void }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const visibleTasks = expanded ? tasks : tasks.slice(0, 2);
  const remaining = tasks.length - visibleTasks.length;

  return <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Syringe className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate font-bold">{t("tasks.handlerVaccinationTitle")}</h2><Badge variant="secondary" className="shrink-0">{tasks.length}</Badge></div><p className="truncate text-xs text-muted-foreground">{t("tasks.handlerVaccinationHint")}</p></div>
    </div>
    <div className="divide-y border-t">
      {visibleTasks.map((task) => {
        const batchName = task.batchId == null ? t("tasks.handlerFarmWide") : batchNames.get(task.batchId) ?? `Batch ${task.batchId}`;
        const deadline = formatTaskDeadline(task, t("tasks.overdue"), t("tasks.today"), t("tasks.noDue"));
        const title = task.title.replace(/^Vaccination:\s*/i, "");
        return <button key={task.id} type="button" className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => onOpen(task)}>
          <span className={`size-2.5 rounded-full ${task.overdue ? "bg-destructive" : "bg-primary"}`} aria-hidden="true" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{title}</span><span className={`mt-0.5 block truncate text-xs ${task.overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>{batchName} · {deadline}</span></span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>;
      })}
    </div>
    {tasks.length > 2 && <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 border-t px-4 text-sm font-semibold text-primary hover:bg-primary/5" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? <><ChevronUp className="size-4" />{t("tasks.handlerHideReminders")}</> : <><ChevronDown className="size-4" />{t("tasks.handlerShowReminders").replace("{count}", String(remaining))}</>}</button>}
  </section>;
}

function HandlerTaskRow({ task, batchName, onOpen }: { task: HandlerTask; batchName: string; onOpen: (task: HandlerTask) => void }) {
  const { t } = useLocale();
  const urgent = task.priority === "URGENT" || task.priority === "HIGH";
  const deadline = formatTaskDeadline(task, t("tasks.overdue"), t("tasks.today"), t("tasks.noDue"));
  function onKeyDown(event: KeyboardEvent<HTMLElement>) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(task); } }
  return <article role="button" tabIndex={0} aria-label={`${t("tasks.handlerViewDetails")}: ${task.title}`} onClick={() => onOpen(task)} onKeyDown={onKeyDown} className={`group cursor-pointer rounded-2xl border p-3.5 outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary ${task.overdue && task.status !== "COMPLETED" ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
    <div className="flex items-start gap-3"><div className="min-w-0 flex-1 space-y-1.5"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold leading-snug">{task.title}</h2>{urgent && <Badge variant="destructive">{task.priority === "URGENT" ? "Urgent" : "High priority"}</Badge>}{task.sourceType === "VACCINATION_PLAN" && task.status !== "COMPLETED" && <Badge variant="secondary">Reminder</Badge>}{task.pendingSync && <Badge variant="outline">{t("tasks.handlerPending")}</Badge>}</div><p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{batchName}</span><span aria-hidden="true">·</span><span className={task.overdue && task.status !== "COMPLETED" ? "font-semibold text-destructive" : ""}>{deadline}</span></p></div><ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></div>
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

function TaskSummaryBar({ summary, filters, onFilter }: { summary?: TaskSummaryResponse; filters: TaskPageFilters; onFilter: (patch: Partial<TaskPageFilters>) => void }) {
  const items: { label: string; value: number; view: TaskView; dueBucket: TaskDueBucket }[] = [
    { label: "Late", value: summary?.late ?? 0, view: "OPEN", dueBucket: "LATE" }, { label: "Today", value: summary?.today ?? 0, view: "OPEN", dueBucket: "TODAY" }, { label: "Upcoming", value: summary?.upcoming ?? 0, view: "OPEN", dueBucket: "UPCOMING" }, { label: "No due date", value: summary?.noDueDate ?? 0, view: "OPEN", dueBucket: "NO_DUE" }, { label: "Completed", value: summary?.completed ?? 0, view: "COMPLETED", dueBucket: "ALL" },
  ];
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{items.map((item) => { const active = filters.view === item.view && filters.dueBucket === item.dueBucket; return <button key={item.label} type="button" aria-pressed={active} onClick={() => onFilter(active ? { view: "ALL", dueBucket: "ALL" } : { view: item.view, dueBucket: item.dueBucket })} className={`min-h-20 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 ${active ? "border-primary bg-primary/5" : "bg-card"}`}><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p></button>; })}</div>;
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-10 shrink-0 rounded-lg border px-3 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{children}</button>;
}

function TaskDetailDialog({ task, open, isManager, handlerNames, history, pending, onOpenChange, onDone, onCloseTask }: { task: HandlerTask | null; open: boolean; isManager: boolean; handlerNames: Map<number, string>; history?: TaskStatusHistory[]; pending: boolean; onOpenChange: (open: boolean) => void; onDone: (task: HandlerTask) => void; onCloseTask: (task: HandlerTask) => void }) {
  const { t } = useLocale();
  if (!task) return null;
  const due = task.dueAt ? new Date(task.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due date";
  const completed = task.status === "COMPLETED";
  const cancelled = task.status === "CANCELLED";
  const assignedTo = task.assignmentScope === "HANDLER" ? handlerNames.get(task.assignedHandlerId ?? -1) ?? `Handler #${task.assignedHandlerId}` : "All handlers";
  const closure = history?.slice().reverse().find((item) => item.status === "CANCELLED");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{task.title}</DialogTitle><DialogDescription>Task information and completion history.</DialogDescription></DialogHeader><div className="space-y-4"><div className="flex flex-wrap gap-2"><Badge variant={cancelled ? "secondary" : task.overdue ? "warning" : completed ? "success" : "outline"}>{cancelled ? t("tasks.closedStatus") : task.overdue ? `${t("tasks.overdueSince")} ${task.dueAt ? new Date(task.dueAt).toLocaleDateString([], { dateStyle: "medium" }) : ""}` : completed ? t("tasks.done") : task.status.replace("_", " ")}</Badge><Badge variant="secondary">{task.priority}</Badge>{task.pendingSync && <Badge variant="outline">Waiting to sync</Badge>}</div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Assigned to</dt><dd className="font-medium">{assignedTo}</dd></div><div><dt className="text-xs text-muted-foreground">Due</dt><dd className="font-medium">{due}</dd></div><div><dt className="text-xs text-muted-foreground">Scope</dt><dd className="font-medium">{task.batchId == null ? "Farm-wide" : `Batch #${task.batchId}`}</dd></div><div><dt className="text-xs text-muted-foreground">Created</dt><dd className="font-medium">{new Date(task.createdAt).toLocaleString()}</dd></div>{task.completedAt && <div><dt className="text-xs text-muted-foreground">Completed</dt><dd className="font-medium">{new Date(task.completedAt).toLocaleString()}{task.completedBy != null ? ` · ${handlerNames.get(task.completedBy) ?? `Handler #${task.completedBy}`}` : ""}</dd></div>}{cancelled && <div><dt className="text-xs text-muted-foreground">Closed</dt><dd className="font-medium">{new Date(task.updatedAt).toLocaleString()}{closure?.changedBy != null ? ` · Manager #${closure.changedBy}` : ""}</dd></div>}<div><dt className="text-xs text-muted-foreground">Source</dt><dd className="font-medium">{task.sourceType === "VACCINATION_PLAN" ? "Vaccination schedule" : task.sourceType ?? "Manual task"}</dd></div></dl>{task.instructions && <div className="rounded-xl border bg-muted/20 p-3 text-sm whitespace-pre-wrap"><p className="mb-1 text-xs font-semibold text-muted-foreground">Instructions</p>{task.instructions}</div>}{task.completionNote && <div className="rounded-xl border bg-muted/20 p-3 text-sm whitespace-pre-wrap"><p className="mb-1 text-xs font-semibold text-muted-foreground">{cancelled ? t("tasks.closeReason") : "Completion note"}</p>{task.completionNote}</div>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.back")}</Button>{isManager && !completed && !cancelled && task.sourceType === "VACCINATION_PLAN" && <VaccinationManagerAction task={task} onOrphanClose={() => { onOpenChange(false); onCloseTask(task); }} />}{isManager && !completed && !cancelled && task.sourceType !== "VACCINATION_PLAN" && <Button type="button" disabled={pending} onClick={() => { onOpenChange(false); onCloseTask(task); }}>{t("tasks.closeAction")}</Button>}{!isManager && !completed && !cancelled && task.sourceType !== "VACCINATION_PLAN" && <Button type="button" disabled={pending || task.pendingSync} onClick={() => onDone(task)}><CheckCircle2 className="size-4" />{t("tasks.markDone")}</Button>}</DialogFooter></DialogContent></Dialog>;
}

function TaskSkeleton() { return <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted/50" />)}</div>; }
