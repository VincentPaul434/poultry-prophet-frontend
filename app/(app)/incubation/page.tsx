"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Egg, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError, apiClient } from "@/lib/api-client";
import type { CompleteIncubationRequest, CreateBatchFromIncubationRequest, CreateIncubationCycleRequest, IncubationCycle, IncubationView } from "@/lib/types";
import { useCompleteIncubation, useCreateIncubationBatch, useCreateIncubationCycle, useIncubationPage, useIncubationSummary } from "@/hooks/use-operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { IncubationCycleCard } from "@/components/incubation/incubation-cycle-card";
import { IncubationCyclePanel } from "@/components/incubation/incubation-cycle-panel";
import { IncubationLoadSheet } from "@/components/incubation/incubation-load-sheet";
import { PageContainer, PageHeader } from "@/components/page-header";

const PAGE_SIZE = 12;

function readView(value: string | null): IncubationView {
  return value === "CLOSED" || value === "ALL" ? value : "ACTIVE";
}

function readPage(value: string | null) {
  const page = Number(value ?? 0);
  return Number.isInteger(page) && page >= 0 ? page : 0;
}

function updateUrl(router: ReturnType<typeof useRouter>, pathname: string, current: ReturnType<typeof useSearchParams>, patch: { view?: IncubationView; page?: number }) {
  const params = new URLSearchParams(current.toString());
  if (patch.view || patch.page !== undefined) params.delete("cycleId");
  if (patch.view) {
    if (patch.view === "ACTIVE") params.delete("view");
    else params.set("view", patch.view);
  }
  if (patch.page !== undefined) {
    if (patch.page > 0) params.set("page", String(patch.page));
    else params.delete("page");
  }
  const query = params.toString();
  router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

export default function IncubationPage() {
  const { display: displayText } = useDisplayLocale();
  return <Suspense fallback={<div className="mx-auto w-full max-w-5xl p-6 text-sm text-muted-foreground">{displayText("Loading incubation…")}</div>}><IncubationPageContent /></Suspense>;
}

function IncubationPageContent() {
  const { display: displayText } = useDisplayLocale();
  const { isManager } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = readView(searchParams.get("view"));
  const page = readPage(searchParams.get("page"));
  const pageQuery = useIncubationPage({ view, page, size: PAGE_SIZE });
  const summaryQuery = useIncubationSummary();
  const create = useCreateIncubationCycle();
  const complete = useCompleteIncubation();
  const createBatch = useCreateIncubationBatch();
  const [loadOpen, setLoadOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<IncubationCycle | null>(null);
  const cycleParam = searchParams.get("cycleId");
  const linkedCycleId = cycleParam && /^\d+$/.test(cycleParam) && Number.isSafeInteger(Number(cycleParam)) && Number(cycleParam) > 0 ? Number(cycleParam) : null;
  const linkedCycle = useQuery({
    queryKey: ["incubation-cycle-detail", linkedCycleId],
    queryFn: () => apiClient.get<IncubationCycle>(`/incubation-cycles/${linkedCycleId}`).then((response) => response.data),
    enabled: linkedCycleId !== null,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const displayedCycle = selectedCycle ?? (linkedCycle.data?.id === linkedCycleId ? linkedCycle.data : null);

  function clearLinkedCycle() {
    if (!searchParams.has("cycleId")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cycleId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const cycles = pageQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  function fail(error: unknown) {
    toast.error(error instanceof ApiError ? error.message : "Could not save the record");
  }

  async function submitLoad(draft: CreateIncubationCycleRequest) {
    try {
      await create.mutateAsync(draft);
      toast.success("Egg load recorded");
      setLoadOpen(false);
    } catch (error) {
      fail(error);
      throw error;
    }
  }

  async function completeCycle(id: number, body: CompleteIncubationRequest) {
    try {
      const updated = await complete.mutateAsync({ id, body });
      toast.success("Hatch results saved");
      setSelectedCycle(updated);
    } catch (error) {
      fail(error);
      throw error;
    }
  }

  async function createBatchFromCycle(id: number, body: CreateBatchFromIncubationRequest) {
    try {
      const batch = await createBatch.mutateAsync({ id, body });
      toast.success("Batch created from hatch results");
      setSelectedCycle((current) => {
        const source = current?.id === id ? current : displayedCycle?.id === id ? displayedCycle : null;
        return source ? { ...source, createdBatchId: batch.id } : current;
      });
    } catch (error) {
      fail(error);
      throw error;
    }
  }

  const titleSummary = summary
    ? `${summary.active} ${t("incubation.activeSummary")} · ${summary.completed + summary.cancelled} ${t("incubation.closedSummary")}`
    : "…";

  return (
    <PageContainer className="flex min-h-full flex-col gap-5 pb-2" data-testid="incubation-page">
      <PageHeader variant="ledger" title={t("incubation.title")} description={t("incubation.loadDescription")} action={!isManager ? <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => setLoadOpen(true)}><Egg className="size-4" aria-hidden="true" />{t("incubation.loadEggs")}</Button> : undefined} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{titleSummary}</span>{summary && summary.activeEggs > 0 && <><span aria-hidden="true">·</span><span>{summary.activeEggs} {t("incubation.eggs")}</span></>}</div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/50 p-1 sm:w-fit sm:max-w-full sm:grid-cols-[repeat(3,minmax(7.5rem,1fr))]" role="tablist" aria-label={t("incubation.title")}>
          <IncubationTab active={view === "ACTIVE"} label={t("incubation.active")} count={summary?.active} onClick={() => { setSelectedCycle(null); updateUrl(router, pathname, searchParams, { view: "ACTIVE", page: 0 }); }} />
          <IncubationTab active={view === "CLOSED"} label={t("incubation.closed")} count={(summary?.completed ?? 0) + (summary?.cancelled ?? 0)} onClick={() => { setSelectedCycle(null); updateUrl(router, pathname, searchParams, { view: "CLOSED", page: 0 }); }} />
          <IncubationTab active={view === "ALL"} label={t("incubation.all")} count={summary ? summary.active + summary.completed + summary.cancelled : undefined} onClick={() => { setSelectedCycle(null); updateUrl(router, pathname, searchParams, { view: "ALL", page: 0 }); }} />
        </div>
      </div>

      {isManager && summary && summary.dueForReview > 0 && <div className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-muted/60 px-3 py-2 text-sm font-semibold text-warning-ink"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{summary.dueForReview} {t("incubation.dueReview")}</div>}

      {linkedCycleId !== null && linkedCycle.isError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{displayText("Could not open this incubation load. It may no longer be available.")}{" "}<button type="button" className="font-semibold underline" onClick={() => linkedCycle.refetch()}>{displayText("Try again")}</button></p>}

      {pageQuery.isLoading && <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-44 rounded-2xl" />)}</div>}
      {pageQuery.isError && <Card className="border-destructive/30 bg-destructive/5 shadow-none"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-destructive"><span>{pageQuery.error instanceof ApiError ? pageQuery.error.message : "Could not load incubation records."}</span><Button type="button" variant="outline" size="sm" onClick={() => pageQuery.refetch()} disabled={pageQuery.isFetching}>{pageQuery.isFetching && <Loader2 className="size-3 animate-spin" />}{t("common.retry")}</Button></CardContent></Card>}
      {!pageQuery.isLoading && !pageQuery.isError && cycles.length === 0 && <Card className="border-dashed shadow-none"><CardContent className="flex flex-col items-center gap-2 p-10 text-center"><Egg className="size-8 text-muted-foreground" aria-hidden="true" /><p className="font-semibold">{view === "ACTIVE" ? t("incubation.noActive") : view === "CLOSED" ? t("incubation.noClosed") : t("incubation.noAll")}</p><p className="max-w-sm text-sm text-muted-foreground">{t("incubation.noRecordsHint")}</p>{!isManager && <Button type="button" className="mt-2 min-h-11" onClick={() => setLoadOpen(true)}>{t("incubation.loadEggs")}</Button>}</CardContent></Card>}
      {!pageQuery.isLoading && !pageQuery.isError && cycles.length > 0 && <div data-testid="incubation-card-grid" className={cn("grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3", pageQuery.isFetching && "opacity-70 transition-opacity")} aria-live="polite">{cycles.map((cycle) => <IncubationCycleCard key={cycle.id} cycle={cycle} isManager={isManager} onOpen={(item) => { clearLinkedCycle(); setSelectedCycle(item); }} />)}</div>}

      {pageQuery.data && pageQuery.data.totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground"><span>{pageQuery.data.totalItems} {t("incubation.title").toLowerCase()}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={!pageQuery.data.hasPrevious} onClick={() => updateUrl(router, pathname, searchParams, { page: Math.max(0, page - 1) })}><ChevronLeft className="size-4" />{t("common.previous")}</Button><span className="tabular-nums">{pageQuery.data.page + 1} / {pageQuery.data.totalPages}</span><Button type="button" variant="outline" size="sm" disabled={!pageQuery.data.hasNext} onClick={() => updateUrl(router, pathname, searchParams, { page: page + 1 })}>{t("common.next")}<ChevronRight className="size-4" /></Button></div></div>}

      <IncubationLoadSheet open={loadOpen} onOpenChange={setLoadOpen} pending={create.isPending} onSubmit={submitLoad} />
      <IncubationCyclePanel key={displayedCycle?.id ?? "none"} cycle={displayedCycle} isManager={isManager} open={Boolean(displayedCycle)} onOpenChange={(open) => { if (!open) { setSelectedCycle(null); clearLinkedCycle(); } }} completePending={complete.isPending} createBatchPending={createBatch.isPending} onComplete={completeCycle} onCreateBatch={createBatchFromCycle} />
    </PageContainer>
  );
}

function IncubationTab({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return <Button variant="ghost" type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60", active ? "bg-card text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60")}><span className="truncate">{label}</span><span className={cn("rounded-full px-1.5 py-0.5 text-[10px] tabular-nums", active ? "bg-primary/10 text-primary" : "bg-background/60")}>{count == null ? "…" : count}</span></Button>;
}
