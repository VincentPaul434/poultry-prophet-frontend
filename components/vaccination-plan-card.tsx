"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, Check, CheckCircle2, Loader2, Plus, Syringe, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAssignVaccinationProgram, useCreateVaccinationProgram, useFarmInputs, useFarmProducts, useRecordVaccination, useReplaceVaccinationProgram, useVaccinationPlan, useVaccinationPrograms } from "@/hooks/use-operations";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Batch, FarmInputLog, HandlerTask, VaccinationPlanItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AgeUnit = "DAY" | "WEEK";
type DraftStep = { key: string; vaccineName: string; age: string; unit: AgeUnit };

function makeStep(index: number): DraftStep { return { key: `step-${Date.now()}-${index}`, vaccineName: "", age: String((index + 1) * 7), unit: "DAY" }; }
function initialSteps() { return [0, 1, 2, 3].map(makeStep); }
function stageForAge(age: number) { if (age <= 30) return "Brooding"; if (age <= 120) return "Ranging"; return "Pre-conditioning"; }
function stepAgeDays(step: DraftStep) { const age = Number(step.age) || 0; return step.unit === "WEEK" ? age * 7 : age; }
function itemStage(item: VaccinationPlanItem) { return item.stageName ? item.stageName.replace("-", " ") : stageForAge(item.ageDay); }
function stateLabel(item: VaccinationPlanItem) { if (item.status === "COMPLETED") return "Done"; if (item.status === "SKIPPED") return "Skipped"; if (item.displayState === "DUE_TODAY") return "Due today"; if (item.displayState === "OVERDUE") return "Overdue"; return "Upcoming"; }

export function VaccinationPlanCard({ batch, canEditSchedule }: { batch: Batch; canEditSchedule: boolean }) {
  const { data: plan, isLoading } = useVaccinationPlan(batch.id);
  const { data: recordedInputs } = useFarmInputs(batch.id, undefined, true);
  const { data: programs } = useVaccinationPrograms(canEditSchedule);
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
  const recordedVaccines = useMemo(() => (recordedInputs ?? []).filter((input) => input.productType === "VACCINE"), [recordedInputs]);

  async function assignSelected(id: number) {
    try { await assign.mutateAsync({ batchId: batch.id, body: { programId: id } }); toast.success("Vaccination schedule added to this batch"); return true; }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not assign the schedule."); return false; }
  }
  async function replaceSelected(id: number) {
    try { await replace.mutateAsync({ batchId: batch.id, body: { programId: id } }); toast.success("Vaccination schedule updated"); return true; }
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
        ? editableItems.map((item) => ({ key: `edit-${item.id}`, vaccineName: item.vaccineName, age: String(item.ageDay), unit: "DAY" }))
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
    if (normalized.some((step) => !step.vaccineName.trim() || !Number.isInteger(step.ageNumber) || step.ageNumber < 0)) return setError("Complete the vaccine name and age for every step.");
    try {
      const created = await create.mutateAsync({ name: name.trim(), items: normalized.map((step) => ({ vaccineName: step.vaccineName.trim(), ageOffsetValue: step.ageNumber, ageOffsetUnit: step.unit, reminderLeadDays: 1 })) });
      if (!(hasPlan ? await replaceSelected(created.id) : await assignSelected(created.id))) return;
      setShowCreate(false); setName(""); setSteps(initialSteps());
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create the schedule."); }
  }

  return <section className="space-y-3 py-1">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-bold"><Syringe className="size-4 text-primary" /> Vaccination schedule</h2><div className="flex items-center gap-2">{hasPlan && <Badge variant="outline">{openItems.length} open</Badge>}{canEditSchedule && hasPlan && <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={openScheduleEditor}>Change schedule</Button>}</div></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Loading schedule…</p> : ((plan && plan.length > 0) || recordedVaccines.length > 0) ? <VaccinationTimeline plan={plan ?? []} recordedInputs={recordedVaccines} /> : canEditSchedule ? <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Set the farm schedule once. Dates are automatic: hatch date + day age.</p>
        {programs && programs.length > 0 && <div className="flex gap-2"><NativeSelect aria-label="Vaccination schedule" value={programId} onChange={(event) => setProgramId(event.target.value)}><option value="">Choose saved schedule</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name} · {program.items.length} steps</option>)}</NativeSelect><Button className="h-10 shrink-0" disabled={!programId || assign.isPending} onClick={() => assignSelected(Number(programId))}>Assign</Button></div>}
        <Button variant="outline" className="h-10 w-full" onClick={openScheduleEditor}><Plus className="size-4" /> Set vaccination schedule</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div> : <p className="text-sm text-muted-foreground">No schedule yet. A farm team member can set it; handlers mark each vaccine done.</p>}
      <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{hasPlan ? "Change batch vaccination schedule" : "Set batch vaccination schedule"}</DialogTitle><DialogDescription>Enter each vaccine and the bird age. The date is calculated from this batch&apos;s hatch date; no date needs to be entered manually.</DialogDescription></DialogHeader><form onSubmit={createAndAssign} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor={`program-name-${batch.id}`}>Schedule name</Label><Input id={`program-name-${batch.id}`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Standard chick vaccination" /></div>
        <div className="space-y-2"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Vaccine steps</p><p className="text-xs text-muted-foreground">Add as many farm-specific steps as needed. Step order is kept in the batch timeline.</p></div><Badge variant="outline">{steps.length} {steps.length === 1 ? "step" : "steps"}</Badge></div><div className="space-y-2">
          {steps.map((step, index) => <div key={step.key} className="rounded-xl border bg-muted/20 p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Step {index + 1} · {stageForAge(stepAgeDays(step))}</p>{steps.length > 1 && <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Remove step ${index + 1}`} onClick={() => removeStep(step.key)}><Trash2 className="size-4" /></Button>}</div><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem]"><div className="space-y-1"><Label className="text-xs" htmlFor={`${step.key}-vaccine`}>Vaccine name</Label><Input id={`${step.key}-vaccine`} value={step.vaccineName} onChange={(event) => updateStep(step.key, { vaccineName: event.target.value })} placeholder="Vaccine / product" /></div><div className="space-y-1"><Label className="text-xs" htmlFor={`${step.key}-age`}>Age</Label><Input id={`${step.key}-age`} type="number" min="0" step="1" value={step.age} onChange={(event) => updateStep(step.key, { age: event.target.value })} /></div><div className="space-y-1"><Label className="text-xs" htmlFor={`${step.key}-unit`}>Unit</Label><NativeSelect id={`${step.key}-unit`} value={step.unit} onChange={(event) => updateStep(step.key, { unit: event.target.value as AgeUnit })}><option value="DAY">day age</option><option value="WEEK">week age</option></NativeSelect></div></div></div>)}
        </div><Button type="button" variant="outline" className="h-10 w-full" onClick={addStep}><Plus className="size-4" /> Add another vaccine step</Button></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={create.isPending || assign.isPending || replace.isPending}>{(create.isPending || assign.isPending || replace.isPending) && <Loader2 className="animate-spin" />} {hasPlan ? "Save new schedule" : `Save and assign to ${batch.name}`}</Button>
      </form></DialogContent></Dialog>
  </section>;
}

function VaccinationTimeline({ plan, recordedInputs }: { plan: VaccinationPlanItem[]; recordedInputs: FarmInputLog[] }) {
  const linkedInputIds = new Set(plan.map((item) => item.completedInputLogId).filter((id): id is number => id != null));
  const additionalVaccines = recordedInputs.filter((input) => !linkedInputIds.has(input.id));
  const completed = plan.filter((item) => item.status === "COMPLETED").length;
  const totalSteps = plan.length + additionalVaccines.length;
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><CalendarCheck className="size-4 shrink-0 text-primary" aria-hidden="true" /><p className="truncate text-xs text-muted-foreground">Dates follow this batch&apos;s hatch date; logged vaccines use their actual record date.</p></div><Badge variant="outline" className="shrink-0 text-[10px]">{completed + additionalVaccines.length}/{totalSteps} done</Badge></div>
    <div className="overflow-x-auto pb-1" aria-label={`${completed + additionalVaccines.length} of ${totalSteps} vaccination steps completed`}>
      <div className="relative px-2" style={{ minWidth: `max(100%, ${Math.max(totalSteps * 6, 24)}rem)` }}>
        {totalSteps > 1 && <div className="pointer-events-none absolute left-[7%] right-[7%] top-3.5 h-0.5 rounded-full bg-border" aria-hidden="true" />}
        <ol className="relative flex items-start">
          {plan.map((item, index) => <TimelineStep key={item.id} item={item} index={index} />)}
          {additionalVaccines.map((input, index) => <RecordedVaccineStep key={`input-${input.id}`} input={input} index={plan.length + index} />)}
        </ol>
      </div>
    </div>
  </div>;
}

function RecordedVaccineStep({ input, index }: { input: FarmInputLog; index: number }) {
  const name = input.productName || input.brandName || "Vaccine";
  return <li className="min-w-24 flex-1 px-1 text-center">
    <div className="relative mx-auto flex size-7 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground" title="Recorded from product log"><Check className="size-3.5" aria-label="Recorded" /></div>
    <div className="mx-auto mt-1.5 min-w-0 max-w-28"><p className="truncate text-[10px] font-bold" title={name}>{name}</p><p className="truncate text-[9px] text-muted-foreground">Record {index + 1}</p><p className="truncate text-[9px] text-muted-foreground">{formatDate(input.recordedAt)}</p><p className="truncate text-[9px] font-semibold text-primary">Recorded</p></div>
  </li>;
}

function TimelineStep({ item, index }: { item: VaccinationPlanItem; index: number }) {
  const done = item.status === "COMPLETED";
  const overdue = item.displayState === "OVERDUE";
  const dueToday = item.displayState === "DUE_TODAY";
  return <li className="min-w-24 flex-1 px-1 text-center">
    <div className={`relative mx-auto flex size-7 items-center justify-center rounded-full border-2 bg-card ${done ? "border-primary bg-primary text-primary-foreground" : overdue ? "border-destructive text-destructive" : dueToday ? "border-warning text-warning-ink" : "border-border text-muted-foreground"}`} title={done ? "Completed" : stateLabel(item)}>
      {done ? <Check className="size-3.5" aria-label="Completed" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
    </div>
    <div className="mx-auto mt-1.5 min-w-0 max-w-28">
      <p className="truncate text-[10px] font-bold" title={item.vaccineName}>{item.vaccineName}</p>
      <p className="truncate text-[9px] capitalize text-muted-foreground" title={`${itemStage(item)} · Day ${item.ageDay}`}>{itemStage(item)} · D{item.ageDay}</p>
      <p className="truncate text-[9px] text-muted-foreground">{formatDate(item.dueDate)}</p>
      <p className={`truncate text-[9px] ${done ? "font-semibold text-primary" : overdue ? "font-semibold text-destructive" : dueToday ? "font-semibold text-warning-ink" : "text-muted-foreground"}`}>{done ? "Done" : stateLabel(item)}</p>
      {item.status === "SCHEDULED" && <div className="mt-1"><VaccinationConfirmButton item={item} compact /></div>}
    </div>
  </li>;
}

export function VaccinationConfirmButton({ item, compact = false }: { item: VaccinationPlanItem; compact?: boolean }) {
  const record = useRecordVaccination(); const { data: products } = useFarmProducts(false); const selectedProduct = products?.find((product) => product.id === item.farmProductId); const [open, setOpen] = useState(false); const [quantity, setQuantity] = useState(item.farmProductId ? "1" : ""); const [notes, setNotes] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); try { const result = await record.mutateAsync({ plan: item, body: { recordedAt: new Date().toISOString(), quantity: quantity ? Number(quantity) : null, unit: selectedProduct?.stockUnit ?? null, notes: notes || null } }); toast.success("queued" in result && result.queued ? "Saved on this phone; it will sync when online." : `${item.vaccineName} recorded`); setOpen(false); } catch (err) { setError(err instanceof ApiError ? err.message : "Could not record vaccination."); } }
  if (item.status !== "SCHEDULED") return <Badge variant={item.status === "COMPLETED" ? "default" : "secondary"}>{item.status === "COMPLETED" ? "Done" : item.status}</Badge>;
  return <><Button size="sm" className={compact ? "h-7 rounded-md px-2 text-[10px]" : "h-9"} aria-label={`Mark ${item.vaccineName} done`} onClick={() => setOpen(true)}><CheckCircle2 className="size-3" /> Done</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)] sm:max-w-md"><DialogHeader><DialogTitle>Record {item.vaccineName}</DialogTitle><DialogDescription>{itemStage(item)} · Day {item.ageDay} · Due {formatDate(item.dueDate)}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-3"><p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">Confirm only after this vaccine was given. The vaccine name comes from the schedule.</p>{selectedProduct ? <div className="space-y-1"><Label htmlFor={`quantity-${item.id}`}>Units used ({selectedProduct.stockUnit})</Label><Input id={`quantity-${item.id}`} required type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><p className="text-xs text-muted-foreground">Available: {selectedProduct.stockOnHand} {selectedProduct.stockUnit}. Cost is calculated automatically.</p></div> : <p className="rounded-lg border border-warning-border bg-warning-muted/60 px-3 py-2 text-sm text-warning-ink">This vaccine is not linked to farm inventory. It will be recorded without stock deduction or batch cost.</p>}<div className="space-y-1"><Label htmlFor={`notes-${item.id}`}>Notes <span className="font-normal text-muted-foreground">optional</span></Label><Input id={`notes-${item.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything to remember" /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={record.isPending}>{record.isPending && <Loader2 className="size-4 animate-spin" />} Confirm done</Button></form></DialogContent></Dialog></>;
}

export function VaccinationTaskAction({ task }: { task: HandlerTask }) { const { data: plan } = useVaccinationPlan(task.batchId ?? 0, Boolean(task.batchId && task.sourceId)); const item = plan?.find((entry) => entry.id === task.sourceId); return item ? <VaccinationConfirmButton item={item} /> : <Badge variant="outline">Open batch</Badge>; }
