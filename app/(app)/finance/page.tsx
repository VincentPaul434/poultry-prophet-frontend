"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useBatches } from "@/hooks/use-batches";
import { useCreateFinanceTransaction, useFinanceTransactions } from "@/hooks/use-operations";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError } from "@/lib/api-client";
import { todayIso } from "@/lib/format";
import type { FinanceTransactionType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function FinancePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data: batches } = useBatches();
  const { data: transactions, isLoading } = useFinanceTransactions();
  const create = useCreateFinanceTransaction();
  const [filterBatch, setFilterBatch] = useState("all");
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
        <Summary label={t("finance.income")} value={`₱${income.toLocaleString()}`} tone="positive" />
        <Summary label={t("finance.expenses")} value={`₱${expense.toLocaleString()}`} tone="negative" />
        <Summary label={t("finance.net")} value={`₱${(income - expense).toLocaleString()}`} tone="neutral" />
      </div>

      <Card className="overflow-hidden shadow-sm">
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
                <select id="finance-scope" required className={selectClass} value={scope} onChange={(event) => draft.setValue((current) => ({ ...current, scope: event.target.value }))}>
                  <option value="">Choose a batch or {t("common.farmWide")}</option>
                  <option value="farm">{t("common.farmWide")}</option>
                  {(batches ?? []).map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">{t("finance.batchHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-date">{t("common.date")}</Label>
                <Input id="finance-date" required type="date" value={date} onChange={(event) => draft.setValue((current) => ({ ...current, date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-type">{t("common.type")}</Label>
                <select id="finance-type" className={selectClass} value={type} onChange={(event) => draft.setValue((current) => ({ ...current, type: event.target.value as FinanceTransactionType }))}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="finance-category">{t("finance.category")}</Label>
                <select id="finance-category" required className={selectClass} value={category} onChange={(event) => draft.setValue((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">Choose a category</option>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
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
            {lastSaved && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">Saved: {lastSaved}</p>}
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
            <select aria-label="Filter transactions by batch" className={selectClass} value={filterBatch} onChange={(event) => setFilterBatch(event.target.value)}>
              <option value="all">All locations</option>
              <option value="farm">Farm-wide</option>
              {(batches ?? []).map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </select>
            <select aria-label="Filter transactions by type" className={selectClass} value={filterType} onChange={(event) => setFilterType(event.target.value as typeof filterType)}>
              <option value="ALL">All types</option>
              <option value="EXPENSE">Expenses</option>
              <option value="INCOME">Income</option>
            </select>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading transactions…</p>}
        <div className="space-y-2">
          {visibleTransactions.map((transaction) => (
            <Card key={transaction.id} className="shadow-none">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={transaction.type === "EXPENSE" ? "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}>
                    {transaction.type === "EXPENSE" ? <ArrowDownLeft className="size-4" aria-hidden="true" /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{transaction.category}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{transaction.batchId == null ? "Farm-wide" : batchNames.get(transaction.batchId) ?? `Batch ${transaction.batchId}`} · {transaction.transactionDate}</p>
                    {transaction.description && <p className="mt-1 truncate text-sm text-muted-foreground">{transaction.description}</p>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={transaction.type === "EXPENSE" ? "font-bold text-red-700 dark:text-red-300" : "font-bold text-emerald-700 dark:text-emerald-300"}>{transaction.type === "EXPENSE" ? "−" : "+"} ₱{Number(transaction.amount).toLocaleString()}</p>
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
  return <Card className="shadow-none"><CardContent className="p-3 sm:p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={tone === "positive" ? "mt-1 truncate text-lg font-bold text-emerald-700 dark:text-emerald-300 sm:text-xl" : tone === "negative" ? "mt-1 truncate text-lg font-bold text-red-700 dark:text-red-300 sm:text-xl" : "mt-1 truncate text-lg font-bold sm:text-xl"}>{value}</p></CardContent></Card>;
}
