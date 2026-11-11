"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, SlidersHorizontal, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useBatches } from "@/hooks/use-batches";
import { useCreateFinanceTransaction, useFinanceAnalytics, useFinanceTransactionPage } from "@/hooks/use-operations";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError } from "@/lib/api-client";
import { todayIso } from "@/lib/format";
import type { Batch, FinanceAnalytics, FinanceTransactionType } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/page-header";

const CATEGORIES = [
  "Feed",
  "Medicine / vitamin",
  "Eggs / incubation",
  "Utilities",
  "Labor",
  "Transport",
  "Equipment",
  "Other",
];

type FinanceFilterState = {
  period: "year" | "30d" | "90d" | "custom";
  start?: string;
  end?: string;
  location: string;
  type: "ALL" | FinanceTransactionType;
  category: string;
  source: string;
  status: "ALL" | "POSTED" | "VOIDED";
  page: number;
  view: "report" | "transactions";
};

function defaultFinanceFilters(view: FinanceFilterState["view"] = "report"): FinanceFilterState {
  return {
    period: "year",
    location: "all",
    type: "ALL",
    category: "ALL",
    source: "ALL",
    status: "ALL",
    page: 0,
    view,
  };
}

function readFinanceFilters(searchParams: ReturnType<typeof useSearchParams>): FinanceFilterState {
  const period = searchParams.get("period");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const view = searchParams.get("view");
  return {
    period: period === "30d" || period === "90d" || period === "custom" ? period : "year",
    start: searchParams.get("start") ?? undefined,
    end: searchParams.get("end") ?? undefined,
    location: searchParams.get("location") ?? "all",
    type: type === "INCOME" || type === "EXPENSE" ? type : "ALL",
    category: searchParams.get("category") ?? "ALL",
    source: searchParams.get("source") ?? "ALL",
    status: status === "POSTED" || status === "VOIDED" ? status : "ALL",
    page: Math.max(0, Number(searchParams.get("page") ?? 0) || 0),
    view: view === "transactions" ? "transactions" : "report",
  };
}

function countActiveFinanceFilters(filters: FinanceFilterState) {
  return [
    filters.period !== "year",
    filters.location !== "all",
    filters.type !== "ALL",
    filters.category !== "ALL",
    filters.source !== "ALL",
    filters.status !== "ALL",
  ].filter(Boolean).length;
}

function describeFinanceFilters(
  filters: FinanceFilterState,
  batchNames: Map<number, string>,
  t: (key: TranslationKey) => string,
) {
  const period = filters.period === "30d"
    ? t("finance.period30d")
    : filters.period === "90d"
      ? t("finance.period90d")
      : filters.period === "custom"
        ? t("finance.periodCustom")
        : t("finance.periodYear");
  const location = filters.location === "all"
    ? t("finance.allLocations")
    : filters.location === "farm"
      ? t("finance.generalFarmRecords")
      : batchNames.get(Number(filters.location.slice(6))) ?? t("common.batch");
  const type = filters.type === "ALL" ? t("finance.allTypes") : filters.type === "EXPENSE" ? t("finance.expenses") : t("finance.income");
  return `${period} · ${location} · ${type}`;
}

function financeDates(filters: FinanceFilterState) {
  if (filters.period === "custom") return { start: filters.start, end: filters.end };
  const end = todayIso();
  const startDate = new Date(`${end}T00:00:00`);
  startDate.setDate(startDate.getDate() - (filters.period === "30d" ? 29 : filters.period === "90d" ? 89 : 364));
  return { start: startDate.toISOString().slice(0, 10), end };
}

function updateFinanceUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  current: ReturnType<typeof useSearchParams>,
  patch: Partial<FinanceFilterState>,
) {
  const next = { ...readFinanceFilters(current), ...patch };
  const params = new URLSearchParams(current.toString());
  const values: Record<string, string | undefined> = {
    period: next.period === "year" ? undefined : next.period,
    start: next.period === "custom" ? next.start : undefined,
    end: next.period === "custom" ? next.end : undefined,
    location: next.location === "all" ? undefined : next.location,
    type: next.type === "ALL" ? undefined : next.type,
    category: next.category === "ALL" ? undefined : next.category,
    source: next.source === "ALL" ? undefined : next.source,
    status: next.status === "ALL" ? undefined : next.status,
    page: next.page > 0 ? String(next.page) : undefined,
    view: next.view === "report" ? undefined : next.view,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
}

export default function FinancePage() {
  return <Suspense fallback={<div className="mx-auto w-full max-w-7xl p-6 text-sm text-muted-foreground">Loading finance…</div>}><FinancePageContent /></Suspense>;
}

function FinancePageContent() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data: batches } = useBatches();
  const create = useCreateFinanceTransaction();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = readFinanceFilters(searchParams);
  const dates = financeDates(filters);
  const selectedBatchId = filters.location.startsWith("batch:") ? Number(filters.location.slice(6)) : undefined;
  const farmWide = filters.location === "farm";
  const sharedFilters = { page: filters.page, size: 10, batchId: selectedBatchId, farmWide, type: filters.type === "ALL" ? undefined : filters.type, category: filters.category === "ALL" ? undefined : filters.category, sourceType: filters.source === "ALL" ? undefined : filters.source, status: filters.status === "ALL" ? undefined : filters.status, start: dates.start, end: dates.end };
  const { data: transactionPage, isLoading } = useFinanceTransactionPage(sharedFilters);
  const transactions = transactionPage?.items ?? [];
  const { data: financeAnalytics, isLoading: isAnalyticsLoading } = useFinanceAnalytics(selectedBatchId, dates.start, dates.end, true, filters.type === "ALL" ? undefined : filters.type, farmWide, filters.category === "ALL" ? undefined : filters.category, filters.source === "ALL" ? undefined : filters.source, filters.status === "ALL" ? undefined : filters.status);
  const [formError, setFormError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FinanceFilterState>(filters);
  const initialDraft = useMemo(() => ({ date: todayIso(), scope: "", type: "EXPENSE" as FinanceTransactionType, category: "", amount: "", description: "" }), []);
  const draft = useLocalDraft(user ? `pp_draft:finance:${user.userId}:${user.farmId ?? "none"}` : null, initialDraft);
  const { date, scope, type, category, amount, description } = draft.value;

  const batchNames = useMemo(() => new Map((batches ?? []).map((batch) => [batch.id, batch.name])), [batches]);
  const activeFilterCount = countActiveFinanceFilters(filters);
  const filterSummary = describeFinanceFilters(filters, batchNames, t);
  const visibleTransactions = transactions;

  function openFilters() {
    setDraftFilters(filters);
    setFiltersOpen(true);
  }

  function applyFilters() {
    updateFinanceUrl(router, pathname, searchParams, { ...draftFilters, page: 0 });
    setFiltersOpen(false);
  }

  function resetFilters() {
    setDraftFilters(defaultFinanceFilters(filters.view));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const numericAmount = Number(amount);
    if (!scope) return setFormError("Choose a batch or explicitly select general farm records.");
    if (!date) return setFormError("Choose the transaction date.");
    if (!category) return setFormError("Choose a category.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setFormError("Enter an amount greater than zero.");

    try {
      await create.mutateAsync({
        batchId: scope === "farm" ? null : Number(scope),
        transactionDate: date,
        type,
        category,
        amount: numericAmount,
        currency: "PHP",
        description: description.trim() || null,
      });
      toast.success("Saved transaction");
      setLastSaved(`${type === "EXPENSE" ? "Expense" : "Income"} recorded for ${scope === "farm" ? t("finance.generalFarmRecords") : batchNames.get(Number(scope)) ?? "the selected batch"} on ${date}.`);
      draft.clearDraft();
      setFormOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Could not save the transaction.";
      setFormError(message);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 pb-8">
      <PageHeader title={t("finance.title")} titleClassName="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl" description={t("finance.notAccounting")} action={<Button type="button" className="w-full sm:w-auto" onClick={() => setFormOpen(true)}><WalletCards aria-hidden="true" />{t("finance.recordTransaction")}</Button>} />

      <div className="flex flex-col gap-4 rounded-2xl bg-muted/55 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <p className="min-w-0 text-sm text-foreground/80" title={filterSummary}>{filterSummary}</p>
        <Button type="button" variant="secondary" className="w-full shrink-0 bg-background sm:w-auto" onClick={openFilters} aria-haspopup="dialog"><SlidersHorizontal aria-hidden="true" />{t("finance.filters")}{activeFilterCount > 0 && <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>}</Button>
      </div>

      <nav aria-label="Finance views" className="flex gap-1 border-b border-border/60">
        <button type="button" aria-current={filters.view === "report" ? "page" : undefined} onClick={() => updateFinanceUrl(router, pathname, searchParams, { view: "report" })} className={`px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filters.view === "report" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Report</button>
        <button type="button" aria-current={filters.view === "transactions" ? "page" : undefined} onClick={() => updateFinanceUrl(router, pathname, searchParams, { view: "transactions" })} className={`px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filters.view === "transactions" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Transactions <span className="ml-1 font-normal text-muted-foreground">{transactionPage?.totalItems ?? 0}</span></button>
      </nav>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t("finance.record")}</DialogTitle><DialogDescription>{t("finance.batchHint")}</DialogDescription></DialogHeader>
          {draft.hasDraft && <p role="status" className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">Draft restored. Check the batch, date, and amount before saving.</p>}
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="grid gap-4 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="finance-scope">{t("finance.where")} <span className="text-destructive">*</span></Label>
                <NativeSelect id="finance-scope" required value={scope} onChange={(event) => draft.setValue((current) => ({ ...current, scope: event.target.value }))}>
                  <option value="">Choose a batch or {t("finance.generalFarmRecords")}</option>
                  <option value="farm">{t("finance.generalFarmRecords")}</option>
                  {(batches ?? []).map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{t("finance.batchHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-date">{t("common.date")}</Label>
                <Input id="finance-date" required type="date" value={date} onChange={(event) => draft.setValue((current) => ({ ...current, date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-type">{t("common.type")}</Label>
                <NativeSelect id="finance-type" value={type} onChange={(event) => draft.setValue((current) => ({ ...current, type: event.target.value as FinanceTransactionType }))}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </NativeSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="finance-category">{t("finance.category")}</Label>
                <NativeSelect id="finance-category" required value={category} onChange={(event) => draft.setValue((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">Choose a category</option>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-amount">{t("finance.amount")}</Label>
                <Input id="finance-amount" required min="0.01" step="0.01" inputMode="decimal" type="number" value={amount} onChange={(event) => draft.setValue((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="finance-description">{t("common.description")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></Label>
                <Input id="finance-description" value={description} onChange={(event) => draft.setValue((current) => ({ ...current, description: event.target.value }))} placeholder="Supplier, buyer, or short reference" />
              </div>
            </div>

            {formError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</p>}
            <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
              {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <WalletCards aria-hidden="true" />}
              {t("common.save")} transaction
            </Button>
            {lastSaved && <p role="status" aria-live="polite" className="rounded-xl border border-success-border bg-success-muted px-4 py-3 text-sm text-success">Saved: {lastSaved}</p>}
          </form>
        </DialogContent>
      </Dialog>

      <FinanceFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        draftFilters={draftFilters}
        onDraftChange={(patch) => setDraftFilters((current) => ({ ...current, ...patch }))}
        onApply={applyFilters}
        onReset={resetFilters}
        batches={batches ?? []}
        t={t}
      />

      {filters.view === "report" ? (
        <FinanceReport analytics={financeAnalytics} isLoading={isAnalyticsLoading} selectedBatchName={selectedBatchId == null ? "All farm records" : batchNames.get(selectedBatchId) ?? `Batch ${selectedBatchId}`} />
      ) : (
        <section data-testid="finance-transaction-panel" className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-2xl font-semibold tracking-tight">{t("finance.history")}</h2><p className="mt-1 text-sm text-muted-foreground">Recorded income and expenses for this view.</p></div>
            <p className="text-sm text-muted-foreground">{transactionPage?.totalItems ?? 0} {t("finance.matchingRecord")}{transactionPage && transactionPage.totalItems !== 1 ? "s" : ""}</p>
          </div>
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm shadow-foreground/5">
            <div className="hidden grid-cols-[8rem_minmax(0,1fr)_9rem_8rem] gap-4 bg-muted/50 px-5 py-3 text-xs font-medium text-muted-foreground md:grid"><span>Date</span><span>Record</span><span>Scope</span><span className="text-right">Amount</span></div>
            {isLoading && <p className="p-6 text-sm text-muted-foreground">Loading transactions…</p>}
            <div data-testid="finance-transaction-list" className="divide-y divide-border/50">
              {visibleTransactions.map((transaction) => (
                <div key={transaction.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-4 sm:px-5 md:grid-cols-[8rem_minmax(0,1fr)_9rem_8rem] md:items-center md:gap-4">
                  <p className="order-2 col-span-2 text-xs text-muted-foreground md:order-none md:col-span-1 md:text-sm">{transaction.transactionDate}</p>
                  <div className="min-w-0"><p className="truncate font-medium">{transaction.category}</p><p className="truncate text-xs text-muted-foreground">{transaction.description || (transaction.sourceType === "SALE_EVENT" ? "Linked sale event" : transaction.type === "INCOME" ? "Income" : "Expense")}{transaction.status === "VOIDED" ? " · Voided" : ""}</p></div>
                  <p className="hidden truncate text-sm text-muted-foreground md:block">{transaction.batchId == null ? t("finance.generalFarmRecords") : batchNames.get(transaction.batchId) ?? `Batch ${transaction.batchId}`}</p>
                  <p className={`text-right font-semibold tabular-nums ${transaction.type === "EXPENSE" ? "text-foreground" : "text-primary"}`}>{transaction.type === "EXPENSE" ? "−" : "+"}{formatPeso(transaction.amount)}</p>
                </div>
              ))}
            </div>
            {!isLoading && visibleTransactions.length === 0 && <p className="px-5 py-14 text-center text-sm text-muted-foreground">No transactions match this view.</p>}
          </div>
          {!isLoading && transactionPage && transactionPage.totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{transactionPage.totalItems} transaction{transactionPage.totalItems === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={!transactionPage.hasPrevious} onClick={() => updateFinanceUrl(router, pathname, searchParams, { page: Math.max(0, filters.page - 1) })}><ChevronLeft className="size-4" />Previous</Button><span>Page {transactionPage.page + 1} of {transactionPage.totalPages}</span><Button type="button" variant="outline" size="sm" disabled={!transactionPage.hasNext} onClick={() => updateFinanceUrl(router, pathname, searchParams, { page: filters.page + 1 })}>Next<ChevronRight className="size-4" /></Button></div></div>}
        </section>
      )}
    </div>
  );
}

function FinanceFilterSheet({
  open,
  onOpenChange,
  draftFilters,
  onDraftChange,
  onApply,
  onReset,
  batches,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftFilters: FinanceFilterState;
  onDraftChange: (patch: Partial<FinanceFilterState>) => void;
  onApply: () => void;
  onReset: () => void;
  batches: Batch[];
  t: (key: TranslationKey) => string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:w-[min(92vw,30rem)] sm:max-w-md">
        <SheetHeader className="pr-14">
          <SheetTitle>{t("finance.filtersTitle")}</SheetTitle>
          <SheetDescription>{t("finance.filtersDescription")}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="finance-filter-period">{t("finance.period")}</Label>
              <NativeSelect id="finance-filter-period" value={draftFilters.period} onChange={(event) => onDraftChange({ period: event.target.value as FinanceFilterState["period"] })}>
                <option value="30d">{t("finance.period30d")}</option>
                <option value="90d">{t("finance.period90d")}</option>
                <option value="year">{t("finance.periodYear")}</option>
                <option value="custom">{t("finance.periodCustom")}</option>
              </NativeSelect>
            </div>

            {draftFilters.period === "custom" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="finance-filter-start">{t("finance.startDate")}</Label>
                  <Input id="finance-filter-start" type="date" value={draftFilters.start ?? ""} onChange={(event) => onDraftChange({ start: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-filter-end">{t("finance.endDate")}</Label>
                  <Input id="finance-filter-end" type="date" value={draftFilters.end ?? ""} onChange={(event) => onDraftChange({ end: event.target.value })} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="finance-filter-location">{t("finance.location")}</Label>
              <NativeSelect id="finance-filter-location" value={draftFilters.location} onChange={(event) => onDraftChange({ location: event.target.value })}>
                <option value="all">{t("finance.allLocations")}</option>
                <option value="farm">{t("finance.generalFarmRecords")}</option>
                {batches.map((batch) => <option key={batch.id} value={`batch:${batch.id}`}>{batch.name}</option>)}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-filter-type">{t("finance.transactionType")}</Label>
              <NativeSelect id="finance-filter-type" value={draftFilters.type} onChange={(event) => onDraftChange({ type: event.target.value as FinanceFilterState["type"] })}>
                <option value="ALL">{t("finance.allTypes")}</option>
                <option value="EXPENSE">{t("finance.expenses")}</option>
                <option value="INCOME">{t("finance.income")}</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-filter-category">{t("finance.category")}</Label>
              <NativeSelect id="finance-filter-category" value={draftFilters.category} onChange={(event) => onDraftChange({ category: event.target.value })}>
                <option value="ALL">{t("finance.allCategories")}</option>
                {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-filter-source">{t("finance.source")}</Label>
              <NativeSelect id="finance-filter-source" value={draftFilters.source} onChange={(event) => onDraftChange({ source: event.target.value })}>
                <option value="ALL">{t("finance.allSources")}</option>
                <option value="MANUAL">{t("finance.manualSource")}</option>
                <option value="SALE_EVENT">{t("finance.saleSource")}</option>
                <option value="INVENTORY_PURCHASE">{t("finance.inventorySource")}</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-filter-status">{t("finance.status")}</Label>
              <NativeSelect id="finance-filter-status" value={draftFilters.status} onChange={(event) => onDraftChange({ status: event.target.value as FinanceFilterState["status"] })}>
                <option value="ALL">{t("finance.allStatuses")}</option>
                <option value="POSTED">{t("finance.postedStatus")}</option>
                <option value="VOIDED">{t("finance.voidedStatus")}</option>
              </NativeSelect>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t bg-popover/95 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onReset}><RotateCcw aria-hidden="true" />{t("finance.resetFilters")}</Button>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="button" className="flex-1 sm:flex-none" onClick={onApply}>{t("finance.applyFilters")}</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FinanceReport({
  analytics,
  isLoading,
  selectedBatchName,
}: {
  analytics?: FinanceAnalytics;
  isLoading: boolean;
  selectedBatchName: string;
}) {
  if (isLoading) {
    return <div className="space-y-5" aria-label="Loading finance report"><div className="h-56 animate-pulse rounded-3xl bg-muted" /><div className="h-80 animate-pulse rounded-3xl bg-muted" /></div>;
  }

  if (!analytics) {
    return <div className="rounded-3xl bg-card px-6 py-16 text-center text-sm text-muted-foreground">No finance analytics are available for this view yet.</div>;
  }

  const series = analytics.series ?? [];
  const totals = analytics.totals;
  const income = Number(totals.recordedIncome);
  const expense = Number(totals.recordedExpense);
  const net = Number(totals.recordedNetCashFlow);
  const totalMovement = Math.max(income, expense, 1);
  const chartWidth = 640;
  const chartHeight = 204;
  const chartBottom = 176;
  const chartTop = 18;
  const chartMax = Math.max(1, ...series.flatMap((point) => [Number(point.income), Number(point.expense)]));
  const groupWidth = (chartWidth - 44) / Math.max(series.length, 1);
  const barWidth = Math.min(22, groupWidth * 0.26);
  const categoryMax = Math.max(1, ...analytics.categoryTotals.map((item) => Number(item.amount)));
  const chartDescription = `Recorded income and expenses across ${series.length} period${series.length === 1 ? "" : "s"}.`;

  return (
    <div className="space-y-6">
      <section aria-label="Financial summary" className="grid overflow-hidden rounded-[1.75rem] bg-[#194b37] text-white shadow-xl shadow-[#194b37]/10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]">
        <div className="flex min-h-64 flex-col justify-between gap-10 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-medium text-white/85">Net cash flow</h2><p className="mt-1 text-sm text-white/60">{selectedBatchName} · {analytics.startDate} to {analytics.endDate}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Recorded cash</span></div>
          <div><p className="break-words text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-none tracking-[-0.065em] tabular-nums">{formatSignedPeso(net)}</p><p className="mt-3 text-sm text-white/65">Income less cash expenses for this period</p></div>
        </div>
        <div className="grid bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex flex-col justify-center gap-3 p-6 sm:p-8 lg:p-8"><h3 className="text-sm font-medium text-white/75">Income</h3><p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{formatPeso(income)}</p><div className="h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#c6e5b4]" style={{ width: `${Math.max(income > 0 ? 2 : 0, income / totalMovement * 100)}%` }} /></div></div>
          <div className="flex flex-col justify-center gap-3 border-t border-white/10 p-6 sm:border-l sm:border-t-0 sm:p-8 lg:border-l-0 lg:border-t lg:p-8"><h3 className="text-sm font-medium text-white/75">Cash expenses</h3><p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{formatPeso(expense)}</p><div className="h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#e5b679]" style={{ width: `${Math.max(expense > 0 ? 2 : 0, expense / totalMovement * 100)}%` }} /></div></div>
        </div>
      </section>

      <section className="grid min-w-0 overflow-hidden rounded-[1.75rem] bg-card shadow-sm shadow-foreground/5 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Cash movement</h2><p className="mt-1 text-sm text-muted-foreground">Income and expenses over the selected period</p></div><div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[#467e53]" />Income</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[#d3a25e]" />Expenses</span></div></div>
          {series.length > 0 ? (
            <div className="mt-8">
              <div role="img" aria-label={chartDescription}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-48 w-full sm:h-56" preserveAspectRatio="none">
                  <line x1="22" x2="618" y1={chartBottom} y2={chartBottom} stroke="currentColor" className="text-border" />
                  {[0.25, 0.5, 0.75, 1].map((tick) => <line key={tick} x1="22" x2="618" y1={chartBottom - tick * (chartBottom - chartTop)} y2={chartBottom - tick * (chartBottom - chartTop)} stroke="currentColor" strokeDasharray="2 5" className="text-border/70" />)}
                  {series.map((point, index) => {
                    const x = 22 + groupWidth * (index + 0.5);
                    const incomeHeight = Math.max(Number(point.income) > 0 ? 2 : 0, Number(point.income) / chartMax * (chartBottom - chartTop));
                    const expenseHeight = Math.max(Number(point.expense) > 0 ? 2 : 0, Number(point.expense) / chartMax * (chartBottom - chartTop));
                    return <g key={`${point.label}-${index}`}><title>{`${point.label}: ${formatPeso(point.income)} income, ${formatPeso(point.expense)} expenses`}</title><rect x={x - barWidth - 2} y={chartBottom - incomeHeight} width={barWidth} height={incomeHeight} rx="3" fill="#467e53" /><rect x={x + 2} y={chartBottom - expenseHeight} width={barWidth} height={expenseHeight} rx="3" fill="#d3a25e" /></g>;
                  })}
                </svg>
                <div className="flex justify-between gap-2 px-1 text-xs text-muted-foreground"><span className="truncate">{series[0]?.label}</span>{series.length > 1 && <span className="truncate text-right">{series[series.length - 1]?.label}</span>}</div>
              </div>
              <details className="mt-5 text-sm"><summary className="w-fit cursor-pointer font-medium text-primary">View period values</summary><div className="mt-3 max-h-60 overflow-auto rounded-xl bg-muted/35 p-3"><table className="w-full min-w-72 text-left text-xs"><thead><tr><th className="pb-2 font-medium">Period</th><th className="pb-2 text-right font-medium">Income</th><th className="pb-2 text-right font-medium">Expenses</th></tr></thead><tbody className="divide-y divide-border/60">{series.map((point, index) => <tr key={`${point.label}-${index}`}><th scope="row" className="py-2 font-normal">{point.label}</th><td className="py-2 text-right tabular-nums">{formatPeso(point.income)}</td><td className="py-2 text-right tabular-nums">{formatPeso(point.expense)}</td></tr>)}</tbody></table></div></details>
            </div>
          ) : <p className="mt-8 flex min-h-48 items-center justify-center rounded-2xl bg-muted/35 p-5 text-center text-sm text-muted-foreground">Add a posted income or expense to see the trend.</p>}
        </div>
        <div className="bg-muted/35 p-5 sm:p-8"><h2 className="text-xl font-semibold tracking-tight">Where spending went</h2><p className="mt-1 text-sm text-muted-foreground">Top recorded expense categories</p><div className="mt-8 space-y-5">{analytics.categoryTotals.length === 0 && <p className="text-sm text-muted-foreground">No categories recorded.</p>}{analytics.categoryTotals.slice(0, 5).map((item) => <div key={item.category}><div className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate font-medium">{item.category}</span><span className="shrink-0 font-semibold tabular-nums">{formatPeso(item.amount)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10"><div className="h-full rounded-full bg-[#9ab476]" style={{ width: `${Number(item.amount) / categoryMax * 100}%` }} /></div></div>)}</div></div>
      </section>

      <section className="rounded-[1.75rem] bg-card p-5 shadow-sm shadow-foreground/5 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Recorded statement</h2><p className="mt-1 text-sm text-muted-foreground">A breakdown of the figures above</p></div><p className="text-sm text-muted-foreground">{totals.postedTransactionCount} posted record{totals.postedTransactionCount === 1 ? "" : "s"}</p></div><dl className="mt-6 divide-y divide-border/60"><StatementRow label="Sale proceeds" value={totals.saleIncome} /><StatementRow label="Other income" value={totals.otherIncome} /><StatementRow label="Total income" value={totals.recordedIncome} emphasis /><StatementRow label="Cash expenses" value={totals.recordedExpense} negative />{analytics.scope === "BATCH" && <><StatementRow label="Products consumed" value={totals.productsConsumedCost} negative /><StatementRow label="Total recorded batch cost" value={totals.totalRecordedBatchCost} negative /></>}<StatementRow label={analytics.scope === "BATCH" ? "Recorded contribution" : "Net cash flow"} value={analytics.scope === "BATCH" ? totals.recordedContribution : totals.recordedNetCashFlow} signed emphasis /></dl><div className="mt-6 flex flex-wrap items-start justify-between gap-4 text-xs leading-5 text-muted-foreground"><p className="max-w-2xl">{analytics.limitations.message}{totals.voidedTransactionCount > 0 ? ` ${totals.voidedTransactionCount} voided record${totals.voidedTransactionCount === 1 ? " was" : "s were"} excluded.` : ""}</p><details className="shrink-0"><summary className="cursor-pointer font-medium text-foreground">View period details</summary><p className="mt-1">{analytics.startDate} to {analytics.endDate} · {analytics.currency}</p></details></div></section>
    </div>
  );
}

function StatementRow({ label, value, negative = false, signed = false, emphasis = false }: { label: string; value: string | number; negative?: boolean; signed?: boolean; emphasis?: boolean }) {
  const amount = Number(value);
  return <div className={`flex items-baseline justify-between gap-4 py-3.5 ${emphasis ? "font-semibold" : "text-sm"}`}><dt className="text-foreground/80">{label}</dt><dd className={`text-right tabular-nums ${signed && amount >= 0 ? "text-primary" : ""}`}>{signed ? formatSignedPeso(amount) : `${negative ? "−" : ""}${formatPeso(amount)}`}</dd></div>;
}

function formatSignedPeso(value: number) { return value === 0 ? formatPeso(0) : `${value < 0 ? "−" : "+"}${formatPeso(Math.abs(value))}`; }

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  
}
