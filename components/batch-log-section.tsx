"use client";

// Self-contained "Quick Log" widget.
// Renders the 4+1 action buttons and manages all form dialogs internally.
// Import and drop onto any page that needs inline event logging.

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  HeartOff,
  HeartPulse,
  Loader2,
  PackageCheck,
  Thermometer,
  TriangleAlert,
  UserMinus,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { useCreateEvent } from "@/hooks/use-events";
import { useCreateFarmInput, useFarmProducts, useSexComposition } from "@/hooks/use-operations";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime, isFutureDate, todayIso } from "@/lib/format";
import type { BatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import type { TranslationKey } from "@/lib/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Domain constants ─────────────────────────────────────────────────────────

const LOSS_CATEGORIES = [
  { type: "HEALTH_DEATH" as const, label: "Health-related death", hint: "Use only when illness is the suspected reason." },
  { type: "ACCIDENTAL_DEATH" as const, label: "Accidental death", hint: "Injury or an accident, not a health cause." },
  { type: "SUSPECTED_PREDATION" as const, label: "Suspected predation", hint: "Evidence suggests a predator, but it is not confirmed." },
  { type: "CONFIRMED_PREDATION" as const, label: "Confirmed predation", hint: "Predator evidence has been confirmed." },
  { type: "MISSING" as const, label: "Missing bird", hint: "Counted out, but no death cause is known." },
  { type: "FOUND_RETURNED" as const, label: "Found and returned", hint: "A previously missing bird was found and returned." },
  { type: "TRANSFER_IN" as const, label: "Transfer in", hint: "Birds arrived from another batch or farm." },
  { type: "TRANSFER_OUT" as const, label: "Transfer out", hint: "Birds left this batch for another batch or farm." },
  { type: "SALE" as const, label: "Sale", hint: "Birds left the farm through a sale." },
  { type: "CULLING" as const, label: "Culling", hint: "Intentional removal; add the reason in notes." },
  { type: "COUNT_CORRECTION" as const, label: "Count correction", hint: "Use a signed adjustment only after checking the flock count." },
];

const HEALTH_SYMPTOMS = [
  "Lethargy / drooping",
  "Nasal discharge",
  "Eye discharge",
  "Loose droppings",
  "Gasping / difficulty breathing",
  "Ruffled feathers",
  "Not eating",
  "Swollen face or comb",
  "Pale comb or wattle",
  "Limping",
];

const MEDICINE_PURPOSES = [
  "Vaccination",
  "Disease treatment",
  "Deworming",
  "Vitamin supplement",
  "Antibiotic",
  "Other",
];

const BEHAVIOR_SIGNS = [
  "Less active than usual",
  "Aggression / fighting",
  "Pecking each other's feathers",
  "Huddling together",
  "Loud / unusual noise",
  "Not eating",
  "Walking strangely",
  "Staying away from flock",
  "Tail is down",
  "Shaking head",
];

// ─── Action button definitions ────────────────────────────────────────────────

type DialogType =
  | "MORTALITY"
  | "HEALTH_CONCERN"
  | "VACCINE_MEDICINE"
  | "BEHAVIOR_OBSERVATION"
  | "DAILY_VITALS";

const ACTION_BUTTONS = [
  {
    type: "MORTALITY" as DialogType,
    label: "Bird count change",
    icon: ArrowLeftRight,
    cardCls:
      "border-rose-300/70 bg-rose-50/70 text-rose-950 hover:bg-rose-100/80 dark:border-rose-400/25 dark:bg-rose-950/20 dark:text-rose-100 dark:hover:bg-rose-950/35",
  },
  {
    type: "HEALTH_CONCERN" as DialogType,
    label: "Health concern",
    icon: HeartPulse,
    cardCls:
      "border-amber-300/70 bg-amber-50/75 text-amber-950 hover:bg-amber-100/80 dark:border-amber-400/25 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-950/35",
  },
  {
    type: "VACCINE_MEDICINE" as DialogType,
    label: "Feed or medicine used",
    icon: PackageCheck,
    cardCls:
      "border-emerald-300/70 bg-emerald-50/75 text-emerald-950 hover:bg-emerald-100/80 dark:border-emerald-400/25 dark:bg-emerald-950/20 dark:text-emerald-100 dark:hover:bg-emerald-950/35",
  },
  {
    type: "BEHAVIOR_OBSERVATION" as DialogType,
    label: "Behavior observed",
    icon: Eye,
    cardCls:
      "border-teal-300/50 bg-teal-50/55 text-teal-950 hover:bg-teal-100/70 dark:border-teal-400/20 dark:bg-teal-950/15 dark:text-teal-100 dark:hover:bg-teal-950/30",
  },
] as const;

const DIALOG_META: Record<DialogType, { title: string }> = {
  MORTALITY: { title: "Population change" },
  HEALTH_CONCERN: { title: "Health concern" },
  VACCINE_MEDICINE: { title: "Product used" },
  BEHAVIOR_OBSERVATION: { title: "Behavior" },
  DAILY_VITALS: { title: "Optional measurements" },
};

const ACTION_LABEL_KEYS: Record<DialogType, TranslationKey> = {
  MORTALITY: "record.populationChange",
  HEALTH_CONCERN: "record.sickness",
  VACCINE_MEDICINE: "record.product",
  BEHAVIOR_OBSERVATION: "record.behavior",
  DAILY_VITALS: "record.optionalMeasurements",
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function NoAnimalsAlert({ population, allowPopulationRestore = false }: { population: number; allowPopulationRestore?: boolean }) {
  if (population > 0 || allowPopulationRestore) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>No birds alive</AlertTitle>
      <AlertDescription>
        This batch has 0 birds remaining. No events can be logged until the count is corrected.
      </AlertDescription>
    </Alert>
  );
}

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">{message}</p>;
}

function EventDateControl({
  id,
  date,
  onChange,
  showOverride,
  onShowOverrideChange,
}: {
  id: string;
  date: string;
  onChange: (value: string) => void;
  showOverride: boolean;
  onShowOverrideChange: (open: boolean) => void;
}) {
  const today = todayIso();
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">When / Kailan</p>
          <p className="text-sm font-semibold">{date === today ? "Ngayon · Today" : formatDate(date)}</p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => onShowOverrideChange(!showOverride)}
        >
          {showOverride ? "Use today" : "Ibang date"}
        </button>
      </div>
      {showOverride && (
        <div>
          <Label htmlFor={id} className="sr-only">Different date</Label>
          <Input id={id} type="date" required max={today} value={date} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg" />
        </div>
      )}
    </div>
  );
}

function TagPill({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all active:scale-95",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted"
      )}
    >
      {selected && <CheckCircle2 className="size-3.5 shrink-0" />}
      {label}
    </button>
  );
}

export function VitalsStatus({ batchId }: { batchId: string }) {
  const { data: records } = useRecords(batchId, 14);
  const latest = records?.[0];
  const added = latest
    ? [latest.temperatureC, latest.feedIntakeG, latest.waterIntakeMl].filter((value) => value !== null && value !== undefined).length
    : 0;
  const { t } = useLocale();
  return (
    <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
      {added > 0 ? `${added} ${t("record.measurementsAdded")}` : t("record.measurementsAdd")}
    </span>
  );
}

// ─── Form: population event ───────────────────────────────────────────────────

type SexChoice = "MALE" | "FEMALE" | "UNCLASSIFIED" | "MIXED" | "";

function MortalityForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createEvent = useCreateEvent(batchId);
  const { data: sexComposition } = useSexComposition(Number(batchId));
  const [count, setCount] = useState("1");
  const [lossType, setLossType] = useState<(typeof LOSS_CATEGORIES)[number]["type"] | "">("");
  const [salePurpose, setSalePurpose] = useState<"BREEDING" | "OTHER" | "NOT_SPECIFIED" | "">("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleBuyer, setSaleBuyer] = useState("");
  const [saleReference, setSaleReference] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());
  const [sexChoice, setSexChoice] = useState<SexChoice>("");
  const [maleSplit, setMaleSplit] = useState("");
  const [femaleSplit, setFemaleSplit] = useState("");
  const [unclassifiedSplit, setUnclassifiedSplit] = useState("");
  const [formError, setFormError] = useState("");
  const [showDateOverride, setShowDateOverride] = useState(false);
  const isCountCorrection = lossType === "COUNT_CORRECTION";
  const addsPopulation = lossType === "FOUND_RETURNED" || lossType === "TRANSFER_IN";
  const canLogWithNoPopulation = isCountCorrection || addsPopulation;
  const selectedCategory = LOSS_CATEGORIES.find((item) => item.type === lossType);
  const hasSexBaseline = Boolean(sexComposition);
  const sexProjectionReady = hasSexBaseline && (!sexComposition?.projectionStatus || sexComposition.projectionStatus === "VALID");
  const allocationAmount = Math.abs(Number(count) || 0);
  const allocationSign = isCountCorrection ? (Number(count) < 0 ? -1 : 1) : (addsPopulation ? 1 : -1);

  function buildSexAllocation(n: number) {
    if (!sexProjectionReady) return null;
    if (!sexChoice) return null;
    if (sexChoice === "MIXED") {
      const male = Number(maleSplit);
      const female = Number(femaleSplit);
      const unclassified = Number(unclassifiedSplit);
      if (![male, female, unclassified].every((value) => Number.isInteger(value) && value >= 0)) return null;
      if (male + female + unclassified !== Math.abs(n)) return null;
      return { maleDelta: male * allocationSign, femaleDelta: female * allocationSign, unclassifiedDelta: unclassified * allocationSign };
    }
    return {
      maleDelta: sexChoice === "MALE" ? allocationSign * Math.abs(n) : 0,
      femaleDelta: sexChoice === "FEMALE" ? allocationSign * Math.abs(n) : 0,
      unclassifiedDelta: sexChoice === "UNCLASSIFIED" ? allocationSign * Math.abs(n) : 0,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!date || isFutureDate(date)) { setFormError("Choose a valid date."); return; }
    if (!lossType) { setFormError("Choose a population-change category."); return; }
    if (lossType === "SALE" && (!saleAmount || !Number.isFinite(Number(saleAmount)) || Number(saleAmount) <= 0)) {
      setFormError("Enter the total amount received for this sale."); return;
    }
    const n = Number(count);
    if (!Number.isInteger(n) || (isCountCorrection ? n === 0 : n < 1)) {
      setFormError(isCountCorrection ? "Enter a non-zero whole-number adjustment." : "Enter at least 1 bird."); return;
    }
    if (!addsPopulation && !isCountCorrection && n > population) {
      setFormError(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive.`); return;
    }
    if (hasSexBaseline && !sexProjectionReady) {
      setFormError(sexComposition?.projectionMessage ?? "Sex composition needs review before this event can be assigned."); return;
    }
    if (sexProjectionReady) {
      if (!sexChoice) { setFormError("Choose whether the affected birds were male, female, unclassified, or mixed."); return; }
      const sexAllocation = buildSexAllocation(n);
      if (!sexAllocation) { setFormError("Sex allocation must equal the number of birds in this event."); return; }
      const available = sexChoice === "MALE" ? sexComposition?.maleCount : sexChoice === "FEMALE" ? sexComposition?.femaleCount : sexChoice === "UNCLASSIFIED" ? sexComposition?.unclassifiedCount : undefined;
      if (!addsPopulation && available !== undefined && Math.abs(n) > available) {
        setFormError(`Only ${available} ${sexChoice.toLowerCase()} bird${available === 1 ? "" : "s"} are currently recorded.`); return;
      }
      const saleDetails = lossType === "SALE" ? {
        amount: Number(saleAmount), currency: "PHP", buyer: saleBuyer.trim() || null, reference: saleReference.trim() || null,
      } : null;
      try {
        await createEvent.mutateAsync({
          eventDate: date, eventType: lossType, title: selectedCategory?.label ?? lossType,
          affectedCount: isCountCorrection ? 0 : n, populationDelta: isCountCorrection ? n : null,
          sexAllocation, tags: lossType === "SALE" && salePurpose ? `SALE_PURPOSE:${salePurpose}` : null,
          saleDetails,
          details: details || null,
        });
        toast.success(isCountCorrection ? "Population count corrected" : "Population event recorded"); onDone();
      } catch (err) { setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again."); }
      return;
    }
    const saleDetails = lossType === "SALE" ? {
      amount: Number(saleAmount), currency: "PHP", buyer: saleBuyer.trim() || null, reference: saleReference.trim() || null,
    } : null;
    try {
      await createEvent.mutateAsync({
        eventDate: date,
        eventType: lossType,
        title: selectedCategory?.label ?? lossType,
        affectedCount: isCountCorrection ? 0 : n,
        populationDelta: isCountCorrection ? n : null,
        tags: lossType === "SALE" && salePurpose ? `SALE_PURPOSE:${salePurpose}` : null,
        saleDetails,
        details: details || null,
      });
      toast.success(isCountCorrection ? "Population count corrected" : "Population event recorded");
      onDone();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <NoAnimalsAlert population={population} allowPopulationRestore={canLogWithNoPopulation} />
      <div className="grid grid-cols-2 gap-2.5">
        <EventDateControl id="population-event-date" date={date} onChange={setDate} showOverride={showDateOverride} onShowOverrideChange={(open) => { setShowDateOverride(open); if (!open) setDate(todayIso()); }} />
        <div className="space-y-1.5"><Label className="text-sm font-semibold">{isCountCorrection ? "Signed adjustment" : "How many?"}</Label><Input type="number" min={isCountCorrection ? undefined : 1} max={!isCountCorrection && !addsPopulation ? population : undefined} step={1} required value={count} onChange={(e) => setCount(e.target.value)} placeholder={isCountCorrection ? "+2 or -1" : undefined} className="h-11 rounded-lg text-center text-base font-bold" /></div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">What happened?</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LOSS_CATEGORIES.map((category) => <button key={category.type} type="button" aria-pressed={lossType === category.type} onClick={() => setLossType(category.type)} className={cn("min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors", lossType === category.type ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-muted")}>{lossType === category.type ? "✓ " : ""}{category.label}</button>)}
        </div>
        {selectedCategory && <p className="text-xs text-muted-foreground">{selectedCategory.hint}</p>}
      {lossType === "SALE" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Sale purpose <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <NativeSelect value={salePurpose} onChange={(event) => setSalePurpose(event.target.value as typeof salePurpose)}>
            <option value="">Not specified</option>
            <option value="BREEDING">Sold as breeder</option>
            <option value="OTHER">Other purpose</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">This describes the sale only. It does not change the batch stage.</p>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Total amount received <span className="font-normal text-muted-foreground">(PHP) *</span></Label>
            <Input type="number" min="0.01" step="0.01" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} placeholder="e.g. 2500" className="h-11" />
            <p className="text-xs text-muted-foreground">Enter the total for all birds in this sale, not a per-bird price. It creates one auditable income record.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-sm font-semibold">Buyer <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={saleBuyer} onChange={(event) => setSaleBuyer(event.target.value)} placeholder="Buyer or customer" className="h-11" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-semibold">Reference <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={saleReference} onChange={(event) => setSaleReference(event.target.value)} placeholder="Receipt or note" className="h-11" /></div>
          </div>
        </div>
      )}
      </div>
      {lossType && (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <Label className="text-sm font-semibold">Which birds were affected?</Label>
          {sexProjectionReady ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["MALE", "FEMALE", "UNCLASSIFIED", "MIXED"] as const).map((choice) => (
                  <button key={choice} type="button" aria-pressed={sexChoice === choice} onClick={() => setSexChoice(choice)} className={cn("rounded-lg border px-2 py-2 text-xs font-semibold", sexChoice === choice ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                    {choice === "UNCLASSIFIED" ? "Unclassified" : choice[0] + choice.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              {sexChoice === "MIXED" && <div className="grid grid-cols-3 gap-2"><Input aria-label="Male allocation" type="number" min={0} max={allocationAmount} step={1} value={maleSplit} onChange={(e) => setMaleSplit(e.target.value)} placeholder="Male" className="h-9 text-center text-xs" /><Input aria-label="Female allocation" type="number" min={0} max={allocationAmount} step={1} value={femaleSplit} onChange={(e) => setFemaleSplit(e.target.value)} placeholder="Female" className="h-9 text-center text-xs" /><Input aria-label="Unclassified allocation" type="number" min={0} max={allocationAmount} step={1} value={unclassifiedSplit} onChange={(e) => setUnclassifiedSplit(e.target.value)} placeholder="Unclassified" className="h-9 text-center text-xs" /></div>}
              <p className="text-xs text-muted-foreground">Current: {sexComposition?.maleCount} male · {sexComposition?.femaleCount} female · {sexComposition?.unclassifiedCount} unclassified</p>
            </>
          ) : hasSexBaseline ? <p className="text-xs text-warning-ink">{sexComposition?.projectionMessage ?? "Sex composition needs review."}</p>
            : <p className="text-xs text-muted-foreground">Record the whole-batch male/female count first. This event will update the total population only.</p>}
        </div>
      )}
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you observe?" className="resize-none rounded-lg" /></div>
      <InlineError message={formError} />
      <Button type="submit" variant="destructive" className="h-11 w-full rounded-lg text-base font-bold" disabled={createEvent.isPending || (population <= 0 && !canLogWithNoPopulation)}>{createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save population event"}</Button>
    </form>
  );
}

// ─── Form: Health concern ─────────────────────────────────────────────────────

function HealthForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createEvent = useCreateEvent(batchId);
  const [count, setCount] = useState("1");
  const [severity, setSeverity] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());
  const [formError, setFormError] = useState("");
  const [showDateOverride, setShowDateOverride] = useState(false);
  const toggle = (value: string) => setSymptoms((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFormError("");
    if (!date || isFutureDate(date)) { setFormError("Choose a valid date."); return; }
    const n = Number(count);
    if (n < 1 || n > population) { setFormError(`Enter 1–${population} affected bird${population === 1 ? "" : "s"}.`); return; }
    if (!severity || symptoms.length === 0) { setFormError("Choose the concern level and at least one symptom."); return; }
    try {
      await createEvent.mutateAsync({ eventDate: date, eventType: "HEALTH_CONCERN", title: symptoms[0], severityLabel: severity, affectedCount: n, details: details || null, tags: symptoms.join(",") });
      toast.success("Sickness report saved"); onDone();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again."); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <NoAnimalsAlert population={population} />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"><EventDateControl id="health-event-date" date={date} onChange={setDate} showOverride={showDateOverride} onShowOverrideChange={(open) => { setShowDateOverride(open); if (!open) setDate(todayIso()); }} /><div className="space-y-1.5"><Label className="text-sm font-semibold">Affected birds</Label><Input type="number" min={1} max={population} required value={count} onChange={(e) => setCount(e.target.value)} className="h-11 rounded-lg text-center font-bold" /></div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Concern level</Label><div className="grid grid-cols-3 gap-2">{[{ v: "MINOR", label: "Mild" }, { v: "MODERATE", label: "Serious" }, { v: "MAJOR", label: "Urgent" }].map((item) => <button key={item.v} type="button" aria-pressed={severity === item.v} onClick={() => setSeverity(item.v)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-sm font-semibold", severity === item.v ? "border-warning bg-warning-muted text-warning-ink" : "border-border hover:bg-muted")}>{item.label}</button>)}</div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Signs noticed</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{HEALTH_SYMPTOMS.map((item) => <TagPill key={item} label={item} selected={symptoms.includes(item)} onToggle={() => toggle(item)} />)}</div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you observe?" className="resize-none rounded-lg" /></div>
      <InlineError message={formError} /><Button type="submit" className="h-11 w-full rounded-lg text-base font-bold" disabled={createEvent.isPending || population <= 0}>{createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save sickness report"}</Button>
    </form>
  );
}

// ─── Form: Treatment ──────────────────────────────────────────────────────────

function TreatmentForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createInput = useCreateFarmInput();
  const { data: farmProducts } = useFarmProducts(false);
  const [farmProductId, setFarmProductId] = useState<number | null>(null);
  const [productType, setProductType] = useState<"FEED" | "VITAMIN" | "MEDICINE" | "VACCINE" | "OTHER">("MEDICINE");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purpose, setPurpose] = useState("");
  const [dose, setDose] = useState("");
  const [allBirds, setAllBirds] = useState(true);
  const [count, setCount] = useState(String(population));
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());
  const [showDetails, setShowDetails] = useState(false);
  const [formError, setFormError] = useState("");
  const purposeRequired = productType !== "FEED" && productType !== "OTHER";
  const [showDateOverride, setShowDateOverride] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFormError("");
    if (!date || isFutureDate(date)) { setFormError("Choose a valid date."); return; }
    if (!productName.trim() || !productType) { setFormError("Enter the product name and choose its type."); return; }
    if (farmProductId && (!quantity || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0)) { setFormError("Enter the units used so stock and batch cost can be updated."); return; }
    if (!farmProductId && quantity && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0)) { setFormError("Enter a quantity greater than zero, or leave it blank if it was not measured."); return; }
    if (purposeRequired && !purpose) { setFormError("Choose what the product is for."); return; }
    const treated = allBirds ? population : Number(count);
    if (treated < 1 || treated > population) { setFormError(`Enter 1–${population} affected bird${population === 1 ? "" : "s"}.`); return; }
    try {
      const result = await createInput.mutateAsync({
        batchId: Number(batchId),
        ...(showDateOverride ? { recordedAt: new Date(`${date}T12:00:00`).toISOString() } : {}),
        productType,
        brandName: productName.trim(),
        farmProductId,
        quantity: quantity ? Number(quantity) : null,
        unit: farmProducts?.find((item) => item.id === farmProductId)?.stockUnit ?? null,
        affectedBirdCount: treated,
        purpose: purpose || null,
        notes: [dose ? `Dose: ${dose}` : "", `Applied to ${treated} birds`, details].filter(Boolean).join(" · ") || null,
      });
      const queued = "queued" in result && result.queued;
      toast.success(queued ? "Saved on this phone; it will sync when online." : "Product record saved to this batch."); onDone();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again."); }
  }
  const selectedProduct = farmProducts?.find((item) => item.id === farmProductId);
  const estimatedCost = selectedProduct?.averageUnitCost != null && quantity && Number(quantity) > 0
    ? Number(quantity) * Number(selectedProduct.averageUnitCost) : null;
  return (
    <form onSubmit={submit} className="space-y-3">
      <NoAnimalsAlert population={population} />
      {farmProducts && farmProducts.length > 0 && <div className="space-y-1.5"><Label className="text-sm font-semibold">Product from farm stock</Label><NativeSelect value={farmProductId ?? ""} onChange={(e) => { const value = e.target.value ? Number(e.target.value) : null; const selected = farmProducts.find((item) => item.id === value); setFarmProductId(value); if (selected) { setProductName(selected.brandName); setProductType(selected.productType); } }}><option value="">Product not listed</option>{farmProducts.map((item) => <option key={item.id} value={item.id}>{item.brandName} · {item.stockOnHand} {item.stockUnit}{item.lowStock ? " · low stock" : ""}</option>)}</NativeSelect></div>}
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2.5"><div className="space-y-1.5"><Label className="text-sm font-semibold">Product / brand</Label><Input required value={productName} onChange={(e) => { setProductName(e.target.value); setFarmProductId(null); }} placeholder="e.g. Baby Stag Booster" className="h-11 rounded-lg" /></div><div className="space-y-1.5"><Label className="text-sm font-semibold">Units used {farmProductId ? <span className="font-normal text-destructive">required</span> : <span className="font-normal text-muted-foreground">optional</span>}</Label><Input required={Boolean(farmProductId)} type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={selectedProduct?.stockUnit ?? "If known"} className="h-11 rounded-lg" />{selectedProduct && <p className="text-[11px] text-muted-foreground">Available: {selectedProduct.stockOnHand} {selectedProduct.stockUnit}{estimatedCost != null ? ` · Estimated batch cost ₱${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : " · Cost unavailable"}</p>}</div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Product type</Label><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{[{ v: "FEED", label: "Feed" }, { v: "VITAMIN", label: "Vitamin" }, { v: "MEDICINE", label: "Medicine" }, { v: "VACCINE", label: "Vaccine" }, { v: "OTHER", label: "Other" }].map((item) => <button key={item.v} type="button" aria-pressed={productType === item.v} onClick={() => setProductType(item.v as typeof productType)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold", productType === item.v ? "border-success bg-success-muted text-success" : "border-border hover:bg-muted")}>{item.label}</button>)}</div></div>
      {purposeRequired && <div className="space-y-1.5"><Label className="text-sm font-semibold">Purpose</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{MEDICINE_PURPOSES.map((item) => <button key={item} type="button" aria-pressed={purpose === item} onClick={() => setPurpose(item)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-left text-sm font-medium", purpose === item ? "border-success bg-success-muted text-success" : "border-border hover:bg-muted")}>{purpose === item ? "✓ " : ""}{item}</button>)}</div></div>}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"><EventDateControl id="product-event-date" date={date} onChange={setDate} showOverride={showDateOverride} onShowOverrideChange={(open) => { setShowDateOverride(open); if (!open) setDate(todayIso()); }} /><div className="space-y-1.5"><Label className="text-sm font-semibold">Applied to</Label><div className="flex h-11 gap-1.5"><button type="button" aria-pressed={allBirds} onClick={() => setAllBirds(true)} className={cn("min-w-0 flex-1 rounded-lg border px-2 text-xs font-semibold", allBirds ? "border-success bg-success-muted text-success" : "border-border")}>All {population}</button><button type="button" aria-pressed={!allBirds} onClick={() => setAllBirds(false)} className={cn("min-w-0 flex-1 rounded-lg border px-2 text-xs font-semibold", !allBirds ? "border-success bg-success-muted text-success" : "border-border")}>Some</button></div></div></div>
      {!allBirds && <Input type="number" min={1} max={population} value={count} onChange={(e) => setCount(e.target.value)} className="h-11 rounded-lg" placeholder={`1 – ${population}`} />}
      <details open={showDetails} onToggle={(e) => setShowDetails(e.currentTarget.open)} className="rounded-lg border px-3"><summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold">More details <span className="ml-1 font-normal text-muted-foreground">(optional)</span></summary><div className="space-y-2 pb-3"><Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose guidance or application note" className="h-10 rounded-lg" /><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Notes" className="resize-none rounded-lg" /></div></details>
      <InlineError message={formError} /><Button type="submit" className="h-11 w-full rounded-lg text-base font-bold" disabled={createInput.isPending || population <= 0}>{createInput.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save product record"}</Button>
    </form>
  );
}

// ─── Form: Behavior ───────────────────────────────────────────────────────────

function BehaviorForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createEvent = useCreateEvent(batchId);
  const [signs, setSigns] = useState<string[]>([]);
  const [concern, setConcern] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());
  const [formError, setFormError] = useState("");
  const [showDateOverride, setShowDateOverride] = useState(false);
  const toggle = (value: string) => setSigns((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFormError("");
    if (!date || isFutureDate(date)) { setFormError("Choose a valid date."); return; }
    if (signs.length === 0 || !concern) { setFormError("Choose the signs and attention level."); return; }
    try { await createEvent.mutateAsync({ eventDate: date, eventType: "BEHAVIOR_OBSERVATION", title: signs[0], severityLabel: concern, affectedCount: 0, details: details || null, tags: signs.join(",") }); toast.success("Behavior observation saved"); onDone(); }
    catch (err) { setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again."); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <NoAnimalsAlert population={population} />
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Signs noticed</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{BEHAVIOR_SIGNS.map((item) => <TagPill key={item} label={item} selected={signs.includes(item)} onToggle={() => toggle(item)} />)}</div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Attention level</Label><div className="grid grid-cols-3 gap-2">{[{ v: "LOW", label: "Watch" }, { v: "MEDIUM", label: "Check" }, { v: "HIGH", label: "Now" }].map((item) => <button key={item.v} type="button" aria-pressed={concern === item.v} onClick={() => setConcern(item.v)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-sm font-semibold", concern === item.v ? "border-warning bg-warning-muted text-warning-ink" : "border-border hover:bg-muted")}>{item.label}</button>)}</div></div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"><EventDateControl id="behavior-event-date" date={date} onChange={setDate} showOverride={showDateOverride} onShowOverrideChange={(open) => { setShowDateOverride(open); if (!open) setDate(todayIso()); }} /><div className="space-y-1.5"><Label className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you see?" className="h-11 rounded-lg" /></div></div>
      <InlineError message={formError} /><Button type="submit" className="h-11 w-full rounded-lg text-base font-bold" disabled={createEvent.isPending || population <= 0}>{createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save behavior note"}</Button>
    </form>
  );
}

// ─── Form: Daily vitals ───────────────────────────────────────────────────────

function VitalsForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createRecord = useCreateRecord(batchId);
  const [form, setForm] = useState({ recordDate: todayIso(), temperatureC: "", feedIntakeG: "", waterIntakeMl: "", feedQuality: "MEASURED", waterQuality: "MEASURED", behaviorNotes: "" });
  const [formError, setFormError] = useState("");
  const [showDateOverride, setShowDateOverride] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFormError("");
    if (!form.recordDate || isFutureDate(form.recordDate)) { setFormError("Choose a valid date."); return; }
    if (form.temperatureC === "" && form.feedIntakeG === "" && form.waterIntakeMl === "" && !form.behaviorNotes.trim()) { setFormError("Enter at least one measurement or note."); return; }
    try {
      await createRecord.mutateAsync({ recordDate: form.recordDate, temperatureC: form.temperatureC === "" ? null : Number(form.temperatureC), feedIntakeG: form.feedIntakeG === "" ? null : Number(form.feedIntakeG), waterIntakeMl: form.waterIntakeMl === "" ? null : Number(form.waterIntakeMl), behaviorNotes: form.behaviorNotes || null, temperatureQuality: form.temperatureC === "" ? "UNAVAILABLE" : "MEASURED", feedQuality: form.feedIntakeG === "" ? "UNAVAILABLE" : form.feedQuality as "MEASURED" | "ESTIMATED" | "UNAVAILABLE", waterQuality: form.waterIntakeMl === "" ? "UNAVAILABLE" : form.waterQuality as "MEASURED" | "ESTIMATED" | "UNAVAILABLE" });
      toast.success("Measurement record saved"); onDone();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again."); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <NoAnimalsAlert population={population} />
      <p className="rounded-lg border border-success-border bg-success-muted px-3 py-2 text-xs text-success">Optional lang: record only what the farm actually measures. Hindi kailangan araw-araw.</p>
      <EventDateControl id="measurement-date" date={form.recordDate} onChange={(value) => set("recordDate", value)} showOverride={showDateOverride} onShowOverrideChange={(open) => { setShowDateOverride(open); if (!open) set("recordDate", todayIso()); }} />
      <div className="grid grid-cols-2 gap-2.5"><div className="space-y-1.5"><Label className="text-sm font-semibold">Temperature °C <span className="font-normal text-muted-foreground">(if measured)</span></Label><Input type="number" step="0.1" min={0} max={60} value={form.temperatureC} onChange={(e) => set("temperatureC", e.target.value)} className="h-11 rounded-lg" placeholder="Not measured" /></div><div className="space-y-1.5"><Label className="text-sm font-semibold">Feed grams <span className="font-normal text-muted-foreground">(if measured)</span></Label><Input type="number" step="0.1" min={0} value={form.feedIntakeG} onChange={(e) => set("feedIntakeG", e.target.value)} className="h-11 rounded-lg" placeholder="Not measured" /></div><div className="space-y-1.5"><Label className="text-sm font-semibold">Water ml <span className="font-normal text-muted-foreground">(if measured)</span></Label><Input type="number" step="0.1" min={0} value={form.waterIntakeMl} onChange={(e) => set("waterIntakeMl", e.target.value)} className="h-11 rounded-lg" placeholder="Not measured" /></div><div className="space-y-1.5"><Label className="text-sm font-semibold">Note <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={form.behaviorNotes} onChange={(e) => set("behaviorNotes", e.target.value)} placeholder="e.g. cold / normal" className="h-11 rounded-lg" /></div></div>
      <InlineError message={formError} /><Button type="submit" className="h-11 w-full rounded-lg text-base font-bold" disabled={createRecord.isPending || population <= 0}>{createRecord.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save measurement"}</Button>
    </form>
  );
}

// ─── Event timeline (exported for history page) ───────────────────────────────

export function EventTimeline({ events }: { events: BatchEvent[] }) {
  const { t } = useLocale();
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ClipboardList className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold">{t("record.noActivity")}</p>
        <p className="text-xs text-muted-foreground">{t("record.noActivityHint")}</p>
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) =>
    b.eventDate.localeCompare(a.eventDate)
    || b.createdAt.localeCompare(a.createdAt)
    || b.id - a.id,
  );
  const byDate = sortedEvents.reduce<Record<string, BatchEvent[]>>((acc, e) => {
    if (!acc[e.eventDate]) acc[e.eventDate] = [];
    acc[e.eventDate].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEvents]) => (
          <section key={date} aria-labelledby={`activity-date-${date}`}>
            <h3 id={`activity-date-${date}`} className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {formatDate(date)}
            </h3>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {dayEvents.map((ev) => {
                const Icon = eventIcon(ev);
                const sex = formatSexDelta(ev);
                const quantity = ev.affectedCount > 0 ? `${ev.affectedCount} bird${ev.affectedCount !== 1 ? "s" : ""}` : null;
                const syncNeedsReview = ev.syncStatus === "CONFLICT" || ev.syncStatus === "REJECTED" || ev.syncStatus === "AUTH_REQUIRED";
                const tags = ev.tags ? ev.tags.split(",").filter((tag) => Boolean(tag) && !tag.startsWith("SALE_PURPOSE:")) : [];
                const secondary = [sex, ev.handlerName, formatDateTime(ev.createdAt)].filter(Boolean).join(" · ");
                return (
                  <div key={ev.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-2.5 border-b px-3 py-3 last:border-b-0 sm:gap-3 sm:px-4">
                    <span className="mt-0.5 flex size-8 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{ev.title}</p>
                        {syncNeedsReview && <Badge variant="warning" className="shrink-0 px-1.5 text-[10px]">{ev.syncStatus === "AUTH_REQUIRED" ? t("status.signInToSync") : t("status.needsReview")}</Badge>}
                        {!syncNeedsReview && ev.syncStatus && <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{t("record.pendingSync")}</span>}
                      </div>
                      <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground" title={secondary}>{secondary || "—"}</p>
                      {(ev.details || tags.length > 0 || ev.severityLabel || (ev.eventType === "SALE" && ev.saleAmount != null)) && (
                        <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground" title={ev.details ?? undefined}>
                          {ev.details ?? tags.join(" · ") ?? ""}
                          {ev.severityLabel ? `${ev.details || tags.length ? " · " : ""}${ev.severityLabel}` : ""}
                          {ev.eventType === "SALE" && ev.saleAmount != null ? `${ev.details || tags.length || ev.severityLabel ? " · " : ""}₱${Number(ev.saleAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}
                        </p>
                      )}
                    </div>
                    <span className="pt-0.5 text-right text-xs font-semibold tabular-nums text-foreground">{quantity ?? ""}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}

function eventIcon(event: BatchEvent): LucideIcon {
  switch (event.eventType) {
    case "TRANSFER_IN": return UserPlus;
    case "TRANSFER_OUT":
    case "SALE":
    case "MISSING":
    case "CULLING": return UserMinus;
    case "HEALTH_CONCERN": return HeartPulse;
    case "HEALTH_DEATH": return HeartOff;
    case "ACCIDENTAL_DEATH":
    case "SUSPECTED_PREDATION":
    case "CONFIRMED_PREDATION": return TriangleAlert;
    case "VACCINE_MEDICINE": return PackageCheck;
    case "BEHAVIOR_OBSERVATION": return Eye;
    case "MORTALITY":
    case "COUNT_CORRECTION":
    case "FOUND_RETURNED":
    default: return ArrowLeftRight;
  }
}

function formatSexDelta(event: BatchEvent) {
  return [
    event.maleDelta ? `${Math.abs(event.maleDelta)} male` : "",
    event.femaleDelta ? `${Math.abs(event.femaleDelta)} female` : "",
    event.unclassifiedDelta ? `${Math.abs(event.unclassifiedDelta)} unclassified` : "",
  ].filter(Boolean).join(" · ");
}

// ─── Main export: the quick-log widget ───────────────────────────────────────

export function BatchLogSection({
  batchId,
  population,
  batchName,
  stageName,
}: {
  batchId: string;
  population: number;
  batchName?: string;
  stageName?: string;
}) {
  const { t } = useLocale();
  const [activeDialog, setActiveDialog] = useState<DialogType | null>(null);
  const triggerRefs = useRef<Partial<Record<DialogType, HTMLButtonElement | null>>>({});
  const close = () => {
    const closingDialog = activeDialog;
    setActiveDialog(null);
    if (closingDialog) {
      window.requestAnimationFrame(() => triggerRefs.current[closingDialog]?.focus());
    }
  };
  const meta = activeDialog ? DIALOG_META[activeDialog] : null;

  return (
    <>
      {/* Four common recording choices. */}
      <div className="grid grid-cols-2 gap-2">
        {ACTION_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            type="button"
            ref={(node) => { triggerRefs.current[btn.type] = node; }}
            onClick={() => setActiveDialog(btn.type)}
            className={cn(
              "flex min-h-[4.5rem] items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              btn.cardCls
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background/60" aria-hidden="true">
              <btn.icon className="size-[18px]" />
            </span>
            <span className="leading-tight">{t(ACTION_LABEL_KEYS[btn.type])}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        ref={(node) => { triggerRefs.current.DAILY_VITALS = node; }}
        onClick={() => setActiveDialog("DAILY_VITALS")}
        className="mt-2 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-success-muted text-success" aria-hidden="true"><Thermometer className="size-4" /></span>
          <span className="truncate text-sm font-semibold">{t("record.measurements")}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground"><VitalsStatus batchId={batchId} /><span aria-hidden="true" className="text-base leading-none">›</span></span>
      </button>

      {/* Dialogs */}
      <Dialog open={activeDialog !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="w-[min(100%-1rem,50rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 sm:max-w-3xl">
          {meta && (
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle className="text-lg">{meta.title}</DialogTitle>
              <p className="text-xs text-muted-foreground">{batchName ? `${batchName}${stageName ? ` · ${stageName.replace("-", " ")}` : ""}` : `Batch ${batchId}`} · Date defaults to now</p>
            </DialogHeader>
          )}
          <div className="px-4 py-4 sm:px-5">
          {activeDialog === "MORTALITY" && <MortalityForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "HEALTH_CONCERN" && <HealthForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "VACCINE_MEDICINE" && <TreatmentForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "BEHAVIOR_OBSERVATION" && <BehaviorForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "DAILY_VITALS" && <VitalsForm batchId={batchId} population={population} onDone={close} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
