"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useBatches } from "@/hooks/use-batches";
import { useCreateFinanceTransaction, useFinanceAnalytics, useFinanceTransactions } from "@/hooks/use-operations";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError } from "@/lib/api-client";
import { todayIso } from "@/lib/format";
import type { FinanceAnalytics, FinanceTransactionType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const CATEGORIES = [
  "Feed",
  "Medicine / vitamin",
  "Eggs / incubation",
  "Utilities",
  "Labor",
  "Transport",
  "Equipment",
  "Bird sale",
  "Other",
];

export default function FinancePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data: batches } = useBatches();
  const { data: transactions, isLoading } = useFinanceTransactions();
  const create = useCreateFinanceTransaction();
  const [filterBatch, setFilterBatch] = useState("all");
  const selectedBatchId = filterBatch !== "all" && filterBatch !== "farm" ? Number(filterBatch) : undefined;
  const { data: financeAnalytics, isLoading: isAnalyticsLoading } = useFinanceAnalytics(selectedBatchId, undefined, undefined, filterBatch !== "farm");
  const [filterType, setFilterType] = useState<"ALL" | FinanceTransactionType>("ALL");
  const [formError, setFormError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const initialDraft = useMemo(() => ({ date: todayIso(), scope: "", type: "EXPENSE" as FinanceTransactionType, category: "", amount: "", description: "" }), []);
  const draft = useLocalDraft(user ? `pp_draft:finance:${user.userId}:${user.farmId ?? "none"}` : null, initialDraft);
  const { date, scope, type, category, amount, description } = draft.value;

  const batchNames = useMemo(() => new Map((batches ?? []).map((batch) => [batch.id, batch.name])), [batches]);
  const visibleTransactions = (transactions ?? []).filter((transaction) => {
    const batchMatches = filterBatch === "all"
      || (filterBatch === "farm" && transaction.batchId == null)
      || String(transaction.batchId) === filterBatch;
    return batchMatches && (filterType === "ALL" || transaction.type === filterType);
  });
  const posted = visibleTransactions.filter((transaction) => transaction.status === "POSTED");
  const income = posted.filter((transaction) => transaction.type === "INCOME").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expense = posted.filter((transaction) => transaction.type === "EXPENSE").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const summaryIncome = filterType === "ALL" ? Number(financeAnalytics?.totals.recordedIncome ?? income) : income;
  const summaryExpense = filterType === "ALL" ? Number(financeAnalytics?.totals.recordedExpense ?? expense) : expense;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const numericAmount = Number(amount);
    if (!scope) return setFormError("Choose a batch or explicitly select Farm-wide.");
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
      setLastSaved(`${type === "EXPENSE" ? "Expense" : "Income"} recorded for ${scope === "farm" ? "Farm-wide" : batchNames.get(Number(scope)) ?? "the selected batch"} on ${date}.`);
      draft.clearDraft();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Could not save the transaction.";
      setFormError(message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <WalletCards className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("finance.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("finance.notAccounting")}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Summary label={t("finance.income")} value={`₱${summaryIncome.toLocaleString()}`} tone="positive" />
        <Summary label={t("finance.expenses")} value={`₱${summaryExpense.toLocaleString()}`} tone="negative" />
        <Summary label={t("finance.net")} value={`₱${(summaryIncome - summaryExpense).toLocaleString()}`} tone="neutral" />

      </div>

      <FinanceAnalyticsCard analytics={financeAnalytics} isLoading={isAnalyticsLoading} selectedBatchName={selectedBatchId == null ? "All farm records" : batchNames.get(selectedBatchId) ?? `Batch ${selectedBatchId}`} />

      <Card className="overflow-hidden shadow-none">
        <div className="h-1.5 bg-primary" />
        <CardHeader>
          <CardTitle>{t("finance.record")}</CardTitle>
          <CardDescription>{t("finance.batchHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {draft.hasDraft && <p role="status" className="mb-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">Draft restored. Check the batch, date, and amount before saving.</p>}
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="grid gap-4 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="finance-scope">{t("finance.where")} <span className="text-destructive">*</span></Label>
                <NativeSelect id="finance-scope" required value={scope} onChange={(event) => draft.setValue((current) => ({ ...current, scope: event.target.value }))}>
                  <option value="">Choose a batch or {t("common.farmWide")}</option>
                  <option value="farm">{t("common.farmWide")}</option>
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
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("finance.history")}</h2>
            <p className="text-sm text-muted-foreground">Review recorded amounts by batch or farm-wide.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <NativeSelect aria-label="Filter transactions by batch" value={filterBatch} onChange={(event) => setFilterBatch(event.target.value)}>
              <option value="all">All locations</option>
              <option value="farm">Farm-wide</option>
              {(batches ?? []).map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </NativeSelect>
            <NativeSelect aria-label="Filter transactions by type" value={filterType} onChange={(event) => setFilterType(event.target.value as typeof filterType)}>
              <option value="ALL">All types</option>
              <option value="EXPENSE">Expenses</option>
              <option value="INCOME">Income</option>
            </NativeSelect>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading transactions…</p>}
        <div className="space-y-2">
          {visibleTransactions.map((transaction) => (
            <Card key={transaction.id} className="shadow-none">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={transaction.type === "EXPENSE" ? "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive" : "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-success-muted text-success"}>
                    {transaction.type === "EXPENSE" ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{transaction.category}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{transaction.batchId == null ? "Farm-wide" : batchNames.get(transaction.batchId) ?? `Batch ${transaction.batchId}`} · {transaction.transactionDate}</p>
                    {transaction.description && <p className="mt-1 truncate text-sm text-muted-foreground">{transaction.description}</p>}
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
        {!isLoading && visibleTransactions.length === 0 && <Card className="border-dashed shadow-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No transactions match this view.</CardContent></Card>}
      </section>
    </div>
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
  const points = values.map((value, index) => {
    const x = series.length <= 1 ? width / 2 : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = padding + ((maxValue - value) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  const zeroY = padding + ((maxValue - 0) / range) * (height - padding * 2);

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
        <div className="grid grid-cols-3 gap-2">
          <AnalyticsStat label="Income" value={formatPeso(analytics.totals.recordedIncome)} tone="positive" />
          <AnalyticsStat label="Expenses" value={formatPeso(analytics.totals.recordedExpense)} tone="negative" />
          <AnalyticsStat label="Net" value={formatPeso(analytics.totals.recordedNetCashFlow)} tone="neutral" />
        </div>

        {series.length > 0 ? (
          <div className="rounded-xl border bg-muted/20 p-2" role="img" aria-label="Cumulative recorded net cash flow trend">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" preserveAspectRatio="none">
              <line x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground/40" />
              <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-primary" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex justify-between px-2 text-[11px] text-muted-foreground"><span>{series[0]?.label}</span><span>{series[series.length - 1]?.label}</span></div>
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
