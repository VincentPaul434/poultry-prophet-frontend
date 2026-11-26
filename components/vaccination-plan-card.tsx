"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, Check, CheckCircle2, Loader2, Plus, Syringe, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAssignVaccinationProgram, useCreateVaccinationProgram, useFarmInputs, useFarmProducts, useRecordVaccination, useReplaceVaccinationProgram, useSkipVaccination, useVaccinationPlan, useVaccinationPrograms } from "@/hooks/use-operations";
import { ApiError } from "@/lib/api-client";
import { OfflineStorageError } from "@/lib/offline-db";
import { formatDate } from "@/lib/format";
import type { Batch, FarmInputLog, HandlerTask, VaccinationPlanItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/locale-provider";
import { DemoStockNotice } from "@/components/demo-stock-notice";
import { StockConfirmationNotice } from "@/components/stock-confirmation-notice";

type AgeUnit = "DAY" | "WEEK";
type DraftStep = { key: string; vaccineName: string; farmProductId: number | null; age: string; unit: AgeUnit };

function makeStep(index: number): DraftStep { return { key: `step-${Date.now()}-${index}`, vaccineName: "", farmProductId: null, age: String((index + 1) * 7), unit: "DAY" }; }
function initialSteps() { return [0, 1, 2, 3].map(makeStep); }
function stageForAge(age: number) { if (age <= 30) return "Brooding"; if (age <= 120) return "Ranging"; return "Pre-conditioning"; }
function stepAgeDays(step: DraftStep) { const age = Number(step.age) || 0; return step.unit === "WEEK" ? age * 7 : age; }
function itemStage(item: VaccinationPlanItem) { return item.stageName ? item.stageName.replace("-", " ") : stageForAge(item.ageDay); }
function stateLabel(item: VaccinationPlanItem) { if (item.status === "COMPLETED") return "Done"; if (item.status === "SKIPPED") return "Skipped"; if (item.displayState === "DUE_TODAY") return "Due today"; if (item.displayState === "OVERDUE") return "Overdue"; return "Upcoming"; }

export function VaccinationPlanCard({ batch, canEditSchedule, canReviewLegacy }: { batch: Batch; canEditSchedule: boolean; canReviewLegacy: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const { data: plan, isLoading } = useVaccinationPlan(batch.id);
  const { data: recordedInputs } = useFarmInputs(batch.id, undefined, true);
  const { data: programs } = useVaccinationPrograms(canEditSchedule);
  const { data: products, isLoading: productsLoading, isError: productsError } = useFarmProducts(false, canEditSchedule);
  const vaccines = (products ?? []).filter((product) => product.active && product.productType === "VACCINE");
  const assign = useAssignVaccinationProgram();
  const replace = useReplaceVaccinationProgram();
  const create = useCreateVaccinationProgram();
  const [programId, setProgramId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>(initialSteps);
  const [error, setError] = useState("");
  const openItems = useMemo(() => (plan ?? []).filter((item) => item.status === "SCHEDULED"), [plan]);
  const hasPlan = Boolean(plan && plan.length > 0);
  const hasUnlinkedOpen = (plan ?? []).some((item) => item.status === "SCHEDULED" && !item.farmProductId);
  const canChangeSchedule = canEditSchedule && (canReviewLegacy || !hasUnlinkedOpen);
  const recordedVaccines = useMemo(() => (recordedInputs ?? []).filter((input) => input.productType === "VACCINE"), [recordedInputs]);

  async function assignSelected(id: number) {
    try { const saved = await assign.mutateAsync({ batchId: batch.id, body: { programId: id } }); toast.success("queued" in saved ? "Schedule saved on this phone; it will sync when online." : "Vaccination schedule added to this batch"); return true; }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not assign the schedule."); return false; }
  }
  async function replaceSelected(id: number) {
    try { const saved = await replace.mutateAsync({ batchId: batch.id, body: { programId: id } }); toast.success("queued" in saved ? "Schedule saved on this phone; it will sync when online." : "Vaccination schedule updated"); return true; }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not change the schedule."); return false; }
  }
  function updateStep(key: string, changes: Partial<DraftStep>) { setSteps((current) => current.map((step) => step.key === key ? { ...step, ...changes } : step)); }
  function addStep() { setSteps((current) => [...current, makeStep(current.length)]); }
  function removeStep(key: string) { setSteps((current) => current.length <= 1 ? current : current.filter((step) => step.key !== key)); }
  function openScheduleEditor() {
    setError("");
    if (hasPlan) {
      setName("Updated farm schedule");
      const editableItems = (plan ?? []).filter((item) => item.status === "SCHEDULED");
      setSteps(editableItems.length > 0
        ? editableItems.map((item) => ({ key: `edit-${item.id}`, vaccineName: item.vaccineName, farmProductId: item.farmProductId ?? null, age: String(item.ageDay), unit: "DAY" }))
        : initialSteps());
    } else {
      setName("");
      setSteps(initialSteps());
    }
    setShowCreate(true);
  }

  async function createAndAssign(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!name.trim()) return setError("Add a name for this vaccination schedule.");
    const normalized = steps.map((step) => ({ ...step, ageNumber: Number(step.age) }));
    if (normalized.some((step) => !step.farmProductId || !step.vaccineName.trim() || !Number.isInteger(step.ageNumber) || step.ageNumber < 0)) return setError("Choose an inventory vaccine and a valid age for every step.");
    try {
      const created = await create.mutateAsync({ body: { name: name.trim(), items: normalized.map((step) => ({ vaccineName: step.vaccineName.trim(), farmProductId: step.farmProductId, ageOffsetValue: step.ageNumber, ageOffsetUnit: step.unit, reminderLeadDays: 1 })) }, batchId: batch.id, replace: hasPlan });
      if ("queued" in created) {
        toast.success("Schedule saved on this phone; it will sync when online.");
        setShowCreate(false); setName(""); setSteps(initialSteps()); return;
      }
      if (!(hasPlan ? await replaceSelected(created.id) : await assignSelected(created.id))) return;
      setShowCreate(false); setName(""); setSteps(initialSteps());
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create the schedule."); }
  }

  return <section className="space-y-3 py-1">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-bold"><Syringe className="size-4 text-primary" /> {displayText("Vaccination schedule")}</h2><div className="flex items-center gap-2">{hasPlan && <Badge variant="outline">{openItems.length} {displayText("open")}</Badge>}{canChangeSchedule && hasPlan && <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={openScheduleEditor}>{displayText("Change schedule")}</Button>}</div></div>
    <StockConfirmationNotice products={vaccines} />
    {(plan ?? []).some((item) => item.status === "SCHEDULED" && !item.farmProductId) && <p role="status" className="rounded-lg border border-warning-border bg-warning-muted/50 p-3 text-sm">{displayText("Some scheduled vaccines need a product link before they can be recorded.")} {canReviewLegacy ? displayText("Choose Change schedule to review and link them.") : displayText("Ask a manager to review the schedule.")}</p>}
    {(plan ?? []).some((item) => item.status === "COMPLETED" && !item.farmProductId) && <p className="text-sm text-muted-foreground">{displayText("Earlier unlinked vaccination records remain unchanged and may have no stock cost.")}</p>}
    {canReviewLegacy && recordedVaccines.some((input) => !input.farmProductId || input.inventoryStatus === "UNTRACKED" || input.inventoryStatus === "LEGACY") && <details className="rounded-lg border p-3 text-sm"><summary className="min-h-11 cursor-pointer font-semibold">{displayText("Review older untracked vaccine records")}</summary><p className="mt-2 text-muted-foreground">{displayText("These historical records have not changed. Stock and costs were not automatically adjusted.")}</p><ul className="mt-2 divide-y">{recordedVaccines.filter((input) => !input.farmProductId || input.inventoryStatus === "UNTRACKED" || input.inventoryStatus === "LEGACY").map((input) => <li key={input.id} className="py-2"><span className="font-medium">{input.brandName}</span> · {formatDate(input.recordedAt)} · {input.quantity == null ? displayText("Not measured") : `${input.quantity} ${input.unit ?? ""}`}</li>)}</ul></details>}
    {isLoading ? <p className="text-sm text-muted-foreground">{displayText("Loading schedule…")}</p> : ((plan && plan.length > 0) || recordedVaccines.length > 0) ? <VaccinationTimeline plan={plan ?? []} recordedInputs={recordedVaccines} readOnly={batch.status === "ARCHIVED"} /> : canEditSchedule ? <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{displayText("Set the farm schedule once. Dates are automatic: hatch date + day age.")}</p>
        {programs && programs.length > 0 && <div className="flex gap-2"><NativeSelect aria-label={displayText("Vaccination schedule")} value={programId} onChange={(event) => setProgramId(event.target.value)}><option value="">{displayText("Choose saved schedule")}</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name} · {program.items.length} {displayText("steps")}</option>)}</NativeSelect><Button className="h-10 shrink-0" disabled={!programId || assign.isPending} onClick={() => assignSelected(Number(programId))}>{displayText("Assign")}</Button></div>}
        <Button variant="outline" className="h-10 w-full" onClick={openScheduleEditor}><Plus className="size-4" /> {displayText("Set vaccination schedule")}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div> : <p className="text-sm text-muted-foreground">{displayText("No schedule yet. A farm team member can set it; handlers mark each vaccine done.")}</p>}
      <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{hasPlan ? "Change batch vaccination schedule" : "Set batch vaccination schedule"}</DialogTitle><DialogDescription>{displayText("Enter each vaccine and the bird age. The date is calculated from this batch&apos;s hatch date; no date needs to be entered manually.")}</DialogDescription></DialogHeader><form onSubmit={createAndAssign} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor={`program-name-${batch.id}`}>{displayText("Schedule name")}</Label><Input id={`program-name-${batch.id}`} value={name} onChange={(event) => setName(event.target.value)} placeholder={displayText("Standard chick vaccination")} /></div>
        <div className="space-y-2">{!productsLoading && !productsError && vaccines.length === 0 && <p role="status" className="text-sm text-muted-foreground">No vaccines are in the farm inventory. Ask a manager to add a vaccine in Products.</p>}{productsError && <p role="alert" className="text-sm text-destructive">Could not load vaccines. Connect to the internet and try again.</p>}<div className="flex items-center justify-between"><div><p className="text-sm font-semibold">{displayText("Vaccine steps")}</p><p className="text-xs text-muted-foreground">{displayText("Add as many farm-specific steps as needed. Step order is kept in the batch timeline.")}</p></div><Badge variant="outline">{steps.length} {steps.length === 1 ? "step" : "steps"}</Badge></div><div className="space-y-2">
          {steps.map((step, index) => <div key={step.key} className="rounded-xl border bg-muted/20 p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{displayText("Step")}{" "}{index + 1} · {stageForAge(stepAgeDays(step))}</p>{steps.length > 1 && <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Remove step ${index + 1}`} onClick={() => removeStep(step.key)}><Trash2 className="size-4" /></Button>}</div><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem]"><div className="space-y-1"><Label className="text-xs" htmlFor={`${step.key}-vaccine`}>{displayText("Vaccine name")}</Label><NativeSelect id={`${step.key}-vaccine`} value={step.farmProductId ?? ""} onChange={(event) => { const product = vaccines.find((item) => item.id === Number(event.target.value)); updateStep(step.key, { farmProductId: product?.id ?? null, vaccineName: product?.brandName ?? "" }); }}><option value="">{productsLoading ? "Loading vaccines…" : productsError ? "Vaccines unavailable" : "Choose a vaccine"}</option>{step.farmProductId && !vaccines.some((product) => product.id === step.farmProductId) && <option value={step.farmProductId} disabled>{step.vaccineName} — unavailable</option>}{vaccines.map((product) => <option key={product.id} value={product.id}>{product.brandName} · {product.stockOnHand} {product.stockUnit}</option>)}</NativeSelect></div><div className="space-y-1"><Label className="text-xs" htmlFor={`${step.key}-age`}>{displayText("Age")}</Label><Input id={`${step.key}-age`} type="number" min="0" step="1" value={step.age} onChange={(event) => updateStep(step.key, { age: event.target.value })} /></div><div className="space-y-1"><Label className="text-xs" htmlFor={`${step.key}-unit`}>{displayText("Unit")}</Label><NativeSelect id={`${step.key}-unit`} value={step.unit} onChange={(event) => updateStep(step.key, { unit: event.target.value as AgeUnit })}><option value="DAY">{displayText("day age")}</option><option value="WEEK">{displayText("week age")}</option></NativeSelect></div></div></div>)}
        </div><Button type="button" variant="outline" className="h-10 w-full" onClick={addStep}><Plus className="size-4" /> {displayText("Add another vaccine step")}</Button></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={create.isPending || assign.isPending || replace.isPending}>{(create.isPending || assign.isPending || replace.isPending) && <Loader2 className="animate-spin" />} {hasPlan ? "Save new schedule" : `Save and assign to ${batch.name}`}</Button>
      </form></DialogContent></Dialog>
  </section>;
}

function VaccinationTimeline({ plan, recordedInputs, readOnly }: { plan: VaccinationPlanItem[]; recordedInputs: FarmInputLog[]; readOnly: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const linkedInputIds = new Set(plan.map((item) => item.completedInputLogId).filter((id): id is number => id != null));
  const additionalVaccines = recordedInputs.filter((input) => !linkedInputIds.has(input.id));
  const completed = plan.filter((item) => item.status === "COMPLETED").length;
  const totalSteps = plan.length + additionalVaccines.length;
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><CalendarCheck className="size-4 shrink-0 text-primary" aria-hidden="true" /><p className="truncate text-xs text-muted-foreground">{displayText("Dates follow this batch&apos;s hatch date; logged vaccines use their actual record date.")}</p></div><Badge variant="outline" className="shrink-0 text-xs">{completed + additionalVaccines.length}/{totalSteps} {displayText("done")}</Badge></div>
    <div className="overflow-x-auto pb-1" aria-label={`${completed + additionalVaccines.length} of ${totalSteps} vaccination steps completed`}>
      <div className="relative px-2" style={{ minWidth: `max(100%, ${Math.max(totalSteps * 7, 28)}rem)` }}>
        {totalSteps > 1 && <div className="pointer-events-none absolute left-[7%] right-[7%] top-3.5 h-0.5 rounded-full bg-border" aria-hidden="true" />}
        <ol className="relative flex items-start">
          {plan.map((item, index) => <TimelineStep key={item.id} item={item} index={index} readOnly={readOnly} />)}
          {additionalVaccines.map((input, index) => <RecordedVaccineStep key={`input-${input.id}`} input={input} index={plan.length + index} />)}
        </ol>
      </div>
    </div>
  </div>;
}

function RecordedVaccineStep({ input, index }: { input: FarmInputLog; index: number }) {
  const { display: displayText } = useDisplayLocale();
  const name = input.productName || input.brandName || "Vaccine";
  return <li className="min-w-28 flex-1 px-1 text-center">
    <div className="relative mx-auto flex size-7 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground" title={displayText("Recorded from product log")}><Check className="size-3.5" aria-label={displayText("Recorded")} /></div>
    <div className="mx-auto mt-1.5 min-w-0 max-w-32"><p className="truncate text-xs font-bold leading-4" title={name}>{name}</p><p className="truncate text-xs leading-4 text-muted-foreground">{displayText("Record")}{" "}{index + 1}</p><p className="truncate text-xs leading-4 text-muted-foreground">{formatDate(input.recordedAt)}</p><p className="truncate text-xs font-semibold leading-4 text-primary">{displayText("Recorded")}</p></div>
  </li>;
}

function TimelineStep({ item, index, readOnly }: { item: VaccinationPlanItem; index: number; readOnly: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const done = item.status === "COMPLETED";
  const overdue = item.displayState === "OVERDUE";
  const dueToday = item.displayState === "DUE_TODAY";
  return <li className="min-w-28 flex-1 px-1 text-center">
    <div className={`relative mx-auto flex size-7 items-center justify-center rounded-full border-2 bg-card ${done ? "border-primary bg-primary text-primary-foreground" : overdue ? "border-destructive text-destructive" : dueToday ? "border-warning text-warning-ink" : "border-border text-muted-foreground"}`} title={done ? "Completed" : stateLabel(item)}>
      {done ? <Check className="size-3.5" aria-label={displayText("Completed")} /> : <span className="text-xs font-bold">{index + 1}</span>}
    </div>
    <div className="mx-auto mt-1.5 min-w-0 max-w-32">
      <p className="truncate text-xs font-bold leading-4" title={item.vaccineName}>{item.vaccineName}</p>
      <p className="truncate text-xs capitalize leading-4 text-muted-foreground" title={`${itemStage(item)} · Day ${item.ageDay}`}>{itemStage(item)} · D{item.ageDay}</p>
      <p className="truncate text-xs leading-4 text-muted-foreground">{formatDate(item.dueDate)}</p>
      <p className={`truncate text-xs leading-4 ${done ? "font-semibold text-primary" : overdue ? "font-semibold text-destructive" : dueToday ? "font-semibold text-warning-ink" : "text-muted-foreground"}`}>{done ? "Done" : stateLabel(item)}</p>
      {!readOnly && item.status === "SCHEDULED" && <div className="mt-1"><VaccinationConfirmButton item={item} compact /></div>}
    </div>
  </li>;
}

export function VaccinationConfirmButton({ item, compact = false }: { item: VaccinationPlanItem; compact?: boolean }) {
  const { display: displayText } = useDisplayLocale();
  const record = useRecordVaccination(); const { data: products } = useFarmProducts(false); const selectedProduct = products?.find((product) => product.id === item.farmProductId); const [open, setOpen] = useState(false); const [quantity, setQuantity] = useState(""); const [notes, setNotes] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (!selectedProduct || !item.farmProductId) { setError(displayText("A manager must link an active inventory vaccine before recording this dose.")); return; } try { const result = await record.mutateAsync({ plan: item, body: { recordedAt: new Date().toISOString(), quantity: quantity ? Number(quantity) : null, unit: selectedProduct?.stockUnit ?? null, notes: notes || null } }); toast.success("queued" in result && result.queued ? "Saved on this phone; it will sync when online." : `${item.vaccineName} recorded`); setOpen(false); } catch (err) { setError(err instanceof ApiError || err instanceof OfflineStorageError ? err.message : "Could not record vaccination."); } }
  if (item.status !== "SCHEDULED") return <Badge variant={item.status === "COMPLETED" ? "default" : "secondary"}>{item.status === "COMPLETED" ? "Done" : item.status}</Badge>;
  return <><Button size="sm" className={compact ? "h-11 w-full rounded-lg px-2 text-xs" : "h-11"} aria-label={`${compact ? "Record" : "Record vaccination"} ${item.vaccineName}`} onClick={() => setOpen(true)}><CheckCircle2 className="size-3" />{compact ? "Record" : "Record vaccination"}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)] sm:max-w-md"><DialogHeader><DialogTitle>{displayText("Record")}{" "}{item.vaccineName}</DialogTitle><DialogDescription>{itemStage(item)} {displayText("· Day")}{" "}{item.ageDay} {displayText("· Due")}{" "}{formatDate(item.dueDate)}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-3"><p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{displayText("Confirm only after this vaccine was given. The vaccine name comes from the schedule.")}</p>{selectedProduct ? <div className="space-y-1"><Label htmlFor={`quantity-${item.id}`}>{displayText("Units used (")}{selectedProduct.stockUnit})</Label><Input id={`quantity-${item.id}`} required type="number" min={selectedProduct?.allowFractionalQuantity === false ? "1" : "0.001"} step={selectedProduct?.allowFractionalQuantity === false ? "1" : "0.001"} value={quantity} onChange={(event) => setQuantity(event.target.value)} /><p className="text-xs text-muted-foreground">{displayText(selectedProduct.stockIsCached || selectedProduct.hasPendingInventoryUse ? "Last confirmed:" : "Available:")}{" "}{selectedProduct.stockOnHand} {selectedProduct.stockUnit}{displayText(". Cost is calculated automatically.")}</p><DemoStockNotice demoStockHistory={selectedProduct.demoStockHistory} /><StockConfirmationNotice products={[selectedProduct]} /></div> : <p className="rounded-lg border border-warning-border bg-warning-muted/60 px-3 py-2 text-sm text-warning-ink">{displayText("A manager must link an active inventory vaccine before recording this dose.")}</p>}<div className="space-y-1"><Label htmlFor={`notes-${item.id}`}>{displayText("Notes")}{" "}<span className="font-normal text-muted-foreground">{displayText("optional")}</span></Label><Input id={`notes-${item.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={displayText("Anything to remember")} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={record.isPending || !selectedProduct || !item.farmProductId}>{record.isPending && <Loader2 className="size-4 animate-spin" />} {displayText("Record vaccination")}</Button></form></DialogContent></Dialog></>;
}

export function VaccinationTaskAction({ task }: { task: HandlerTask }) {
  const { display: displayText } = useDisplayLocale();
  const router = useRouter();
  const { t } = useLocale();
  const { data: plan, isLoading } = useVaccinationPlan(task.batchId ?? 0, Boolean(task.batchId && task.sourceId));
  const item = plan?.find((entry) => entry.id === task.sourceId);
  if (item) return <VaccinationConfirmButton item={item} />;
  if (isLoading) return <Button type="button" variant="outline" disabled>{displayText("Checking schedule…")}</Button>;
  return <div className="flex flex-col items-end gap-1"><span className="text-xs text-warning-ink">{t("tasks.needsManagerReview")}</span><Button type="button" variant="outline" onClick={() => task.batchId && router.push(`/batches/${task.batchId}`)}>{displayText("Open batch")}</Button></div>;
}

export function VaccinationManagerAction({ task, onOrphanClose }: { task: HandlerTask; onOrphanClose: () => void }) {
  const { display: displayText } = useDisplayLocale();
  const { t } = useLocale();
  const { data: plan, isLoading } = useVaccinationPlan(task.batchId ?? 0, Boolean(task.batchId && task.sourceId));
  const item = plan?.find((entry) => entry.id === task.sourceId);
  const skip = useSkipVaccination();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (isLoading) return <Button type="button" variant="outline" disabled>{displayText("Checking schedule…")}</Button>;
  if (!item || item.status === "SKIPPED" || item.status === "CANCELLED") return <Button type="button" variant="outline" onClick={onOrphanClose}>{t("tasks.closeOrphanAction")}</Button>;
  if (item.status !== "SCHEDULED") return <Badge variant="outline">{item.status}</Badge>;
  const scheduledItem = item;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return setError("Add a reason before skipping this reminder.");
    setError("");
    try {
      await skip.mutateAsync({ id: scheduledItem.id, batchId: scheduledItem.batchId, reason: reason.trim() });
      toast.success("Vaccination reminder skipped");
      setOpen(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not skip vaccination reminder."); }
  }
  return <><Button type="button" variant="outline" onClick={() => setOpen(true)}>{t("tasks.skipVaccination")}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)] sm:max-w-md"><DialogHeader><DialogTitle>{t("tasks.skipVaccination")}</DialogTitle><DialogDescription>{displayText("Use this only when the scheduled vaccine was not administered.")}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-3"><Label htmlFor={`skip-vaccine-${scheduledItem.id}`}>{displayText("Reason")}</Label><Textarea id={`skip-vaccine-${scheduledItem.id}`} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder={displayText("Why was this reminder skipped?")} rows={3} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={skip.isPending}>{skip.isPending && <Loader2 className="size-4 animate-spin" />} {t("tasks.skipVaccination")}</Button></form></DialogContent></Dialog></>;
}
