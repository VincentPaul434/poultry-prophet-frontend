"use client";

import { useState } from "react";
import { useCreateFinanceTransaction, useCorrectFinanceExpense, useFinanceTransactionPage } from "@/hooks/use-operations";
import type { CreateFinancialTransactionRequest, FinancialTransaction } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";
import { todayIso } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManagerIntentRecovery, useManagerIntentRecovery } from "@/components/manager-intent-recovery";

type CorrectionPayload = { transactionDate: string; category: string; amount: number; reason: string; expectedUpdatedAt: string };

export function BatchExpenses({ batchId, readOnly }: { batchId: number; readOnly: boolean }) {
  const { display } = useLocale();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(0);
  const create = useCreateFinanceTransaction();
  const correct = useCorrectFinanceExpense();
  const recovery = useManagerIntentRecovery<CreateFinancialTransactionRequest>("FINANCE_CREATE");
  const pendingExpenses = recovery.intents.filter((intent) => intent.targetId === String(batchId));
  const correctionRecovery = useManagerIntentRecovery<CorrectionPayload>("FINANCE_CORRECTION");
  const pendingCorrections = correctionRecovery.intents.filter((intent) => intent.contextId == null || intent.contextId === String(batchId));
  const { data, isLoading, isError, isFetching } = useFinanceTransactionPage({ page, size: 10, batchId, type: "EXPENSE", status: "POSTED" });
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const number = Number(amount);
    if (!category.trim() || !date || !Number.isFinite(number) || number <= 0) { setError(display("Enter a category, date, and amount greater than zero.")); return; }
    try {
      if (editing) {
        if (!editing.updatedAt || !reason.trim()) { setError(display("Add a reason for the correction.")); return; }
        await correct.mutateAsync({ id: editing.id, batchId, body: { transactionDate: date, category: category.trim(), amount: number, reason: reason.trim(), expectedUpdatedAt: editing.updatedAt } });
      } else {
        if (!recovery.ready || pendingExpenses.length > 0) { setError(display("Review the previous request before saving another.")); return; }
        await create.mutateAsync({ batchId, transactionDate: date, type: "EXPENSE", category: category.trim(), amount: number, currency: "PHP" });
      }
      setOpen(false); setEditing(null); setReason(""); setCategory(""); setAmount("");
    } catch (failure) { setError(failure instanceof ApiError && failure.status === 409 && editing ? display("This expense changed. Refresh and review it before trying again.") : display("The request may have been saved. Close this window and retry the original details.")); }
  }
  return <section className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5" aria-label={display("Batch expenses")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{display("Batch expenses")}</h2>{!readOnly && <Button type="button" disabled={!recovery.ready || pendingExpenses.length > 0} onClick={() => { setEditing(null); setReason(""); setCategory(""); setAmount(""); setDate(todayIso()); setError(""); setOpen(true); }}>{display("Add expense")}</Button>}</div>
    {!readOnly && <ManagerIntentRecovery intents={pendingExpenses} ready={recovery.ready} isError={recovery.isError} busy={create.isPending} describe={(intent) => `${intent.payload.category} · ${intent.payload.currency ?? "PHP"} ${intent.payload.amount} · ${intent.payload.transactionDate}`} retry={(intent) => create.mutateAsync(intent.payload)} />}
    <ManagerIntentRecovery intents={pendingCorrections} ready={correctionRecovery.ready} isError={correctionRecovery.isError} busy={correct.isPending} describe={(intent) => `${display("Edit expense")} · ${intent.payload.category} · ${intent.payload.amount} · ${intent.payload.transactionDate}`} retry={(intent) => correct.mutateAsync({ id: Number(intent.targetId), batchId, body: intent.payload })} />
    {isLoading ? <p>{display("Loading expenses…")}</p> : isError ? <p role="alert">{display("Could not load expenses.")}</p> : !data?.items?.length ? <p className="text-sm text-muted-foreground">{display("No batch expenses recorded.")}</p> : <ul className="divide-y">{data.items.map((item) => <li key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span>{item.category} · {item.transactionDate}</span><span className="flex shrink-0 items-center gap-2">{item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{!readOnly && item.sourceType === "MANUAL" && item.updatedAt && <Button type="button" variant="outline" size="sm" disabled={!correctionRecovery.ready || pendingCorrections.some((intent) => intent.targetId === String(item.id))} aria-label={`${display("Edit expense")} ${item.category}`} onClick={() => { setEditing(item); setCategory(item.category); setAmount(String(item.amount)); setDate(item.transactionDate); setReason(""); setError(""); setOpen(true); }}>{display("Edit")}</Button>}</span></li>)}</ul>}
    {data && (data.totalPages > 1 || page > 0) && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{display("Page")} {data.page + 1} {display("of")} {Math.max(data.totalPages, 1)}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={isFetching || !data.hasPrevious} onClick={() => setPage((current) => Math.max(0, current - 1))}>{display("Previous")}</Button><Button type="button" variant="outline" size="sm" disabled={isFetching || !data.hasNext} onClick={() => setPage((current) => current + 1)}>{display("Next")}</Button></div></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? display("Edit batch expense") : display("Add batch expense")}</DialogTitle><DialogDescription>{editing ? display("The original expense will be voided and a corrected record created.") : display("Record an expense for this batch. Product stock purchases belong in inventory.")}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-3"><Label htmlFor="batch-expense-category">{display("Category")}</Label><Input id="batch-expense-category" value={category} onChange={(event) => setCategory(event.target.value)} required /><Label htmlFor="batch-expense-amount">{editing && editing.currency !== "PHP" ? `Amount (${editing.currency})` : display("Amount (PHP)")}</Label><Input id="batch-expense-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /><Label htmlFor="batch-expense-date">{display("Date")}</Label><Input id="batch-expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />{editing && <><Label htmlFor="batch-expense-reason">{display("Reason for correction")}</Label><Input id="batch-expense-reason" required value={reason} onChange={(event) => setReason(event.target.value)} /></>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={create.isPending || correct.isPending}>{editing ? display("Save correction") : display("Save expense")}</Button></form></DialogContent></Dialog>
  </section>;
}
