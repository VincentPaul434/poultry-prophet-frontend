"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Loader2, RotateCcw, SlidersHorizontal, WalletCards } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
  // Summary values must come from the unpaged analytics query. Falling back to
  // the current transaction page would make the report change when the user
  // only changes pagination.
  const summaryIncome = financeAnalytics ? Number(financeAnalytics.totals.recordedIncome) : null;
  const summaryExpense = financeAnalytics ? Number(financeAnalytics.totals.recordedExpense) : null;

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <WalletCards className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">{t("finance.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("finance.notAccounting")}</p>
          </div>
        </div>
        <Button type="button" className="w-full sm:w-auto" onClick={() => setFormOpen(true)}><WalletCards aria-hidden="true" />{t("finance.recordTransaction")}</Button>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Summary label={t("finance.income")} value={summaryIncome == null ? (isAnalyticsLoading ? "…" : "—") : `₱${summaryIncome.toLocaleString()}`} tone="positive" />
        <Summary label={t("finance.expenses")} value={summaryExpense == null ? (isAnalyticsLoading ? "…" : "—") : `₱${summaryExpense.toLocaleString()}`} tone="negative" />
        <Summary label={t("finance.net")} value={summaryIncome == null || summaryExpense == null ? (isAnalyticsLoading ? "…" : "—") : `₱${(summaryIncome - summaryExpense).toLocaleString()}`} tone="neutral" />

      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("finance.filterSummary")}</p>
          <p className="mt-1 truncate text-sm text-foreground" title={filterSummary}>{filterSummary}</p>
        </div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={openFilters} aria-haspopup="dialog"><SlidersHorizontal aria-hidden="true" />{t("finance.filters")}{activeFilterCount > 0 && <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>}</Button>
      </div>

      <div className="flex gap-2 border-b pb-2 xl:hidden"><Button type="button" variant={filters.view === "report" ? "default" : "outline"} onClick={() => updateFinanceUrl(router, pathname, searchParams, { view: "report" })}>Report</Button><Button type="button" variant={filters.view === "transactions" ? "default" : "outline"} onClick={() => updateFinanceUrl(router, pathname, searchParams, { view: "transactions" })}>Transactions</Button></div>

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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(24rem,1fr)]">
      <div className={filters.view === "transactions" ? "hidden xl:block min-w-0" : "min-w-0"}>
        <FinanceAnalyticsCard analytics={financeAnalytics} isLoading={isAnalyticsLoading} selectedBatchName={selectedBatchId == null ? "All farm records" : batchNames.get(selectedBatchId) ?? `Batch ${selectedBatchId}`} />
      </div>
      <section data-testid="finance-transaction-panel" className={filters.view === "report" ? "hidden xl:flex min-w-0 flex-col space-y-4 rounded-2xl border bg-card/30 p-5" : "flex min-w-0 flex-col space-y-4 rounded-2xl border bg-card/30 p-5"}>
        <div className="space-y-2">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{t("finance.history")}</h2>
            <p className="text-sm text-muted-foreground">Review recorded amounts by batch or general farm records.</p>
            <p className="mt-1 text-xs text-muted-foreground">{transactionPage?.totalItems ?? 0} {t("finance.matchingRecord")}{transactionPage && transactionPage.totalItems !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading transactions…</p>}
        <div data-testid="finance-transaction-list" className="min-w-0 space-y-2 pr-1 xl:h-[clamp(24rem,52dvh,36rem)] xl:overflow-y-auto xl:overscroll-contain">
          {visibleTransactions.map((transaction) => (
            <Card key={transaction.id} className="shadow-none">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={transaction.type === "EXPENSE" ? "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive" : "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-success-muted text-success"}>
                    {transaction.type === "EXPENSE" ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{transaction.category}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{transaction.batchId == null ? t("finance.generalFarmRecords") : batchNames.get(transaction.batchId) ?? `Batch ${transaction.batchId}`} · {transaction.transactionDate}</p>
                    {transaction.description && <p className="mt-1 truncate text-sm text-muted-foreground">{transaction.description}</p>}
                    {transaction.sourceType === "SALE_EVENT" && <Badge variant="outline" className="mt-1 text-[10px]">Linked sale event</Badge>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={transaction.type === "EXPENSE" ? "font-bold text-destructive" : "font-bold text-success"}>{transaction.type === "EXPENSE" ? "−" : "+"} ₱{Number(transaction.amount).toLocaleString()}</p>
                  {transaction.status === "VOIDED" && <Badge variant="secondary" className="mt-1">Voided</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {!isLoading && transactionPage && transactionPage.totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground"><span>{transactionPage.totalItems} transaction{transactionPage.totalItems === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={!transactionPage.hasPrevious} onClick={() => updateFinanceUrl(router, pathname, searchParams, { page: Math.max(0, filters.page - 1) })}><ChevronLeft className="size-4" />Previous</Button><span>Page {transactionPage.page + 1} of {transactionPage.totalPages}</span><Button type="button" variant="outline" size="sm" disabled={!transactionPage.hasNext} onClick={() => updateFinanceUrl(router, pathname, searchParams, { page: filters.page + 1 })}>Next<ChevronRight className="size-4" /></Button></div></div>}
        {!isLoading && visibleTransactions.length === 0 && <Card className="border-dashed shadow-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No transactions match this view.</CardContent></Card>}
      </section>
      </div>
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

function Summary({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" | "neutral" }) {
  return <Card className="shadow-none"><CardContent className="p-3 sm:p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={tone === "positive" ? "mt-1 truncate text-lg font-bold text-success sm:text-xl" : tone === "negative" ? "mt-1 truncate text-lg font-bold text-destructive sm:text-xl" : "mt-1 truncate text-lg font-bold sm:text-xl"}>{value}</p></CardContent></Card>;
}

function FinanceAnalyticsCard({
  analytics,
  isLoading,
  selectedBatchName,
}: {
  analytics?: FinanceAnalytics;
  isLoading: boolean;
  selectedBatchName: string;
}) {
  if (isLoading) {
    return <Card className="shadow-none"><CardContent className="space-y-3 p-5"><div className="h-5 w-48 animate-pulse rounded bg-muted" /><div className="h-36 animate-pulse rounded-xl bg-muted" /></CardContent></Card>;
  }

  if (!analytics) {
    return <Card className="border-dashed shadow-none"><CardContent className="p-5 text-sm text-muted-foreground">No finance analytics are available for this view yet.</CardContent></Card>;
  }

  const series = analytics.series ?? [];
  const values = series.map((point) => Number(point.cumulativeNetCashFlow));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const width = 640;
  const height = 170;
  const padding = 18;
  const coordinates = values.map((value, index) => {
    const x = series.length <= 1 ? width / 2 : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = padding + ((maxValue - value) / range) * (height - padding * 2);
    return { x, y };
  });
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const zeroY = padding + ((maxValue - 0) / range) * (height - padding * 2);
  const singlePoint = series.length === 1 ? series[0] : undefined;
  const singlePointCoordinate = coordinates[0];
  const chartDescription = singlePoint
    ? `${singlePoint.label} cumulative recorded net cash flow: ${formatPeso(singlePoint.cumulativeNetCashFlow)}`
    : "Cumulative recorded net cash flow trend across the selected period.";

  return (
    <Card className="overflow-hidden shadow-none">
      <div className="h-1 bg-primary" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">Finance trend</CardTitle>
            <CardDescription className="truncate">{selectedBatchName} · recorded cash flow</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">{analytics.scope === "BATCH" ? "Batch" : "Farm"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-2 ${analytics.scope === "BATCH" ? "grid-cols-2 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
          <AnalyticsStat label="Income" value={formatPeso(analytics.totals.recordedIncome)} tone="positive" />
          <AnalyticsStat label="Sale proceeds" value={formatPeso(analytics.totals.saleIncome ?? "0")} tone="positive" />
          <AnalyticsStat label={analytics.scope === "BATCH" ? "Cash expense" : "Expenses"} value={formatPeso(analytics.totals.recordedExpense)} tone="negative" />
          {analytics.scope === "BATCH" && <AnalyticsStat label="Products used" value={formatPeso(analytics.totals.productsConsumedCost)} tone="negative" />}
          {analytics.scope === "BATCH" && <AnalyticsStat label="Batch cost" value={formatPeso(analytics.totals.totalRecordedBatchCost)} tone="negative" />}
          <AnalyticsStat label={analytics.scope === "BATCH" ? "Contribution" : "Net"} value={formatPeso(analytics.scope === "BATCH" ? analytics.totals.recordedContribution : analytics.totals.recordedNetCashFlow)} tone="neutral" />
        </div>

        {series.length > 0 ? (
          <div className="rounded-xl border bg-muted/20 p-2" role="img" aria-label={chartDescription}>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full sm:h-44" preserveAspectRatio="none">
              <line x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground/40" />
              {singlePoint && singlePointCoordinate ? (
                <circle cx={singlePointCoordinate.x} cy={singlePointCoordinate.y} r="6" fill="currentColor" className="text-primary" vectorEffect="non-scaling-stroke" />
              ) : (
                <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-primary" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            <div className={`flex px-2 text-[11px] text-muted-foreground ${singlePoint ? "justify-center" : "justify-between"}`}>
              {singlePoint ? <span>{singlePoint.label} · {formatPeso(singlePoint.cumulativeNetCashFlow)}</span> : <><span>{series[0]?.label}</span><span>{series[series.length - 1]?.label}</span></>}
            </div>
          </div>
        ) : <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Add a posted income or expense to see the trend.</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top expense categories</p>
            <div className="space-y-1.5">
              {analytics.categoryTotals.length === 0 && <p className="text-sm text-muted-foreground">No categories recorded.</p>}
              {analytics.categoryTotals.slice(0, 5).map((item) => <div key={item.category} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{item.category}</span><span className="shrink-0 font-semibold">{formatPeso(item.amount)}</span></div>)}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Coverage</p>
            <p>{analytics.totals.postedTransactionCount} posted record{analytics.totals.postedTransactionCount === 1 ? "" : "s"} included.</p>
            {analytics.totals.voidedTransactionCount > 0 && <p>{analytics.totals.voidedTransactionCount} voided record{analytics.totals.voidedTransactionCount === 1 ? "" : "s"} excluded.</p>}
            <p className="mt-2 text-xs">{analytics.limitations.message}</p>
          </div>
        </div>

        <details className="rounded-xl border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold">View period details</summary>
          <p className="mt-2 text-muted-foreground">{analytics.startDate} to {analytics.endDate} · {analytics.currency}</p>
        </details>
      </CardContent>
    </Card>
  );
}

function AnalyticsStat({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" | "neutral" }) {
  const toneClass = tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : "text-foreground";
  return <div className="rounded-xl border bg-card p-3"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className={`mt-1 truncate text-base font-bold tabular-nums ${toneClass}`}>{value}</p></div>;
}

function formatPeso(value: string | number) {
  return `₱${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  
}
