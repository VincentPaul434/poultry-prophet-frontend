"use client";

// Self-contained "Quick Log" widget.
// Renders the 4+1 action buttons and manages all form dialogs internally.
// Import and drop onto any page that needs inline event logging.

import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { useBatchEvents, useCreateEvent } from "@/hooks/use-events";
import { useCreateFarmInput } from "@/hooks/use-operations";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime, isFutureDate, todayIso } from "@/lib/format";
import type { BatchEvent, EventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import type { TranslationKey } from "@/lib/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    emoji: "💀",
    label: "Population change",
    cardCls:
      "border-red-200 bg-red-50/80 hover:bg-red-100 active:scale-[0.97] dark:border-red-900 dark:bg-red-950/40",
  },
  {
    type: "HEALTH_CONCERN" as DialogType,
    emoji: "🤒",
    label: "Sickness",
    cardCls:
      "border-amber-200 bg-amber-50/80 hover:bg-amber-100 active:scale-[0.97] dark:border-amber-900 dark:bg-amber-950/40",
  },
  {
    type: "VACCINE_MEDICINE" as DialogType,
    emoji: "💊",
    label: "Product used",
    cardCls:
      "border-blue-200 bg-blue-50/80 hover:bg-blue-100 active:scale-[0.97] dark:border-blue-900 dark:bg-blue-950/40",
  },
  {
    type: "BEHAVIOR_OBSERVATION" as DialogType,
    emoji: "👁️",
    label: "Behavior",
    cardCls:
      "border-violet-200 bg-violet-50/80 hover:bg-violet-100 active:scale-[0.97] dark:border-violet-900 dark:bg-violet-950/40",
  },
] as const;

const DIALOG_META: Record<DialogType, { title: string }> = {
  MORTALITY: { title: "📉 Population change" },
  HEALTH_CONCERN: { title: "🤒 Health concern" },
  VACCINE_MEDICINE: { title: "💊 Product used" },
  BEHAVIOR_OBSERVATION: { title: "👁️ Behavior" },
  DAILY_VITALS: { title: "📊 Optional measurements" },
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

function TagPill({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all active:scale-95",
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
  const { data: records } = useRecords(batchId, 1);
  const last = records?.[0];
  if (!last) return <span className="text-xs text-muted-foreground font-medium">No optional measurements yet</span>;
  return <span className="text-xs text-muted-foreground font-medium">Last measured: {formatDate(last.recordDate)}</span>;
}

// ─── Form: population event ───────────────────────────────────────────────────

function MortalityForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createEvent = useCreateEvent(batchId);
  const [count, setCount] = useState("1");
  const [lossType, setLossType] = useState<(typeof LOSS_CATEGORIES)[number]["type"] | "">("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [formError, setFormError] = useState("");
  const isCountCorrection = lossType === "COUNT_CORRECTION";
  const addsPopulation = lossType === "FOUND_RETURNED" || lossType === "TRANSFER_IN";
  const canLogWithNoPopulation = isCountCorrection || addsPopulation;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!date) { setFormError("Choose a date."); return; }
    if (isFutureDate(date)) { setFormError("The date cannot be in the future."); return; }
    if (!lossType) { setFormError("Choose a population-change category."); return; }
    const n = Number(count);
    if (!Number.isInteger(n) || (isCountCorrection ? n === 0 : n < 1)) {
      setFormError(isCountCorrection ? "Enter a non-zero whole-number adjustment." : "Enter at least 1 bird.");
      return;
    }
    if (!addsPopulation && !isCountCorrection && n > population) {
      setFormError(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive.`);
      return;
    }
    try {
      const category = LOSS_CATEGORIES.find((item) => item.type === lossType);
      await createEvent.mutateAsync({
        eventDate: date,
        eventType: lossType,
        title: category?.label ?? lossType,
        affectedCount: isCountCorrection ? 0 : n,
        populationDelta: isCountCorrection ? n : null,
        details: details || null,
      });
      toast.success(isCountCorrection ? "Population count corrected" : "Population event recorded");
      onDone();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} allowPopulationRestore={canLogWithNoPopulation} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-semibold">When did it happen?</Label>
          <Input type="date" required max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">
            {isCountCorrection ? "Signed population adjustment" : "How many?"}
            {!isCountCorrection && !addsPopulation && <span className="font-normal text-muted-foreground"> (max {population})</span>}
          </Label>
          <Input
            type="number"
            min={isCountCorrection ? undefined : 1}
            max={!isCountCorrection && !addsPopulation ? population : undefined}
            step={1}
            required
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder={isCountCorrection ? "+2 or -1" : undefined}
            className="h-12 rounded-xl text-center text-lg font-bold"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">What happened?</Label>
        <p className="text-sm text-muted-foreground">Choose the closest description. This keeps health-related deaths separate from other changes.</p>
        <div className="grid grid-cols-1 gap-2">
          {LOSS_CATEGORIES.slice(0, 6).map((category) => (
            <button key={category.type} type="button" aria-pressed={lossType === category.type} onClick={() => setLossType(category.type)}
              className={cn("rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all",
                lossType === category.type ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400" : "border-border hover:border-primary/30 hover:bg-muted")}>
              <span className="block">{lossType === category.type ? "✓ " : ""}{category.label}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{category.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowMoreCategories((value) => !value)} className="min-h-11 w-full rounded-xl border border-dashed px-4 text-left text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60" aria-expanded={showMoreCategories}>
          {showMoreCategories ? "Hide less common changes" : "More population changes"}
        </button>
        {showMoreCategories && <div className="grid grid-cols-1 gap-2">
          {LOSS_CATEGORIES.slice(6).map((category) => (
            <button key={category.type} type="button" aria-pressed={lossType === category.type} onClick={() => setLossType(category.type)} className={cn("rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all", lossType === category.type ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400" : "border-border hover:border-primary/30 hover:bg-muted")}>
              <span className="block">{lossType === category.type ? "✓ " : ""}{category.label}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{category.hint}</span>
            </button>
          ))}
        </div>}
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Evidence / notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Where it happened, what you observed, or what needs review…" className="rounded-xl resize-none" />
      </div>
      <InlineError message={formError} />
      <Button type="submit" variant="destructive" className="w-full h-12 rounded-xl text-base font-bold" disabled={createEvent.isPending || (population <= 0 && !canLogWithNoPopulation)}>
        {createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Population event"}
      </Button>
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
  const toggle = (s: string) => setSymptoms((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!date) { setFormError("Choose a date."); return; }
    if (isFutureDate(date)) { setFormError("The date cannot be in the future."); return; }
    const n = Number(count);
    if (n < 1) { setFormError("Enter at least 1 bird."); return; }
    if (n > population) { setFormError(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive.`); return; }
    if (!severity) { setFormError("Choose how serious the concern is."); return; }
    if (symptoms.length === 0) { setFormError("Select at least one symptom."); return; }
    try {
      await createEvent.mutateAsync({ eventDate: date, eventType: "HEALTH_CONCERN", title: symptoms[0], severityLabel: severity, affectedCount: n, details: details || null, tags: symptoms.join(",") });
      toast.success("Sickness report saved");
      onDone();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-semibold">Date noticed</Label>
          <Input type="date" required max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">How many? <span className="font-normal text-muted-foreground">(max {population})</span></Label>
          <Input type="number" min={1} max={population} required value={count} onChange={(e) => setCount(e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">How serious is it?</Label>
        <div className="grid grid-cols-3 gap-2">
          {[{ v: "MINOR", label: "Mild", emoji: "🟡" }, { v: "MODERATE", label: "Serious", emoji: "🟠" }, { v: "MAJOR", label: "Urgent!", emoji: "🔴" }].map((s) => (
            <button key={s.v} type="button" aria-pressed={severity === s.v} onClick={() => setSeverity(s.v)}
              className={cn("rounded-xl border py-3 text-sm font-semibold transition-all", severity === s.v ? "border-amber-500 bg-amber-50 dark:bg-amber-950/50" : "border-border hover:bg-muted")}>
              <div className="text-xl mb-0.5">{s.emoji}</div>{s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">What symptoms do you see?</Label>
        <div className="flex flex-wrap gap-2">
          {HEALTH_SYMPTOMS.map((s) => <TagPill key={s} label={s} selected={symptoms.includes(s)} onToggle={() => toggle(s)} />)}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Which pen, how long you've noticed it…" className="rounded-xl resize-none" />
      </div>
      <InlineError message={formError} />
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold bg-amber-600 hover:bg-amber-700 text-white" disabled={createEvent.isPending || population <= 0}>
        {createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Sickness Report"}
      </Button>
    </form>
  );
}

// ─── Form: Treatment ──────────────────────────────────────────────────────────

function TreatmentForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createInput = useCreateFarmInput();
  const [medicineName, setMedicineName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [dose, setDose] = useState("");
  const [allBirds, setAllBirds] = useState(true);
  const [count, setCount] = useState(String(population));
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());
  const [formError, setFormError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!date) { setFormError("Choose a date."); return; }
    if (isFutureDate(date)) { setFormError("The date cannot be in the future."); return; }
    if (!medicineName.trim()) { setFormError("Enter the medicine, vitamin, vaccine, or feed name."); return; }
    if (!purpose) { setFormError("Choose what the product is for."); return; }
    const treated = allBirds ? population : Number(count);
    if (treated < 1) { setFormError("At least 1 bird must be treated."); return; }
    if (treated > population) { setFormError(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive.`); return; }
    try {
      const productType = purpose === "Vaccination" ? "VACCINE" : purpose === "Vitamin supplement" ? "VITAMIN" : "MEDICINE";
      await createInput.mutateAsync({
        batchId: Number(batchId),
        recordedAt: new Date(`${date}T12:00:00`).toISOString(),
        productType,
        brandName: medicineName.trim(),
        purpose,
        notes: [dose ? `Dose: ${dose}` : "", `Applied to ${treated} birds`, details].filter(Boolean).join(" · ") || null,
      });
      toast.success("Product record saved");
      onDone();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} />
      <div className="space-y-2">
        <Label className="font-semibold">Medicine or vaccine name</Label>
        <Input required value={medicineName} onChange={(e) => setMedicineName(e.target.value)} placeholder="e.g. Newcastle vaccine, Tetracycline" className="h-12 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">What is it for?</Label>
        <div className="grid grid-cols-2 gap-2">
          {MEDICINE_PURPOSES.map((p) => (
            <button key={p} type="button" aria-pressed={purpose === p} onClick={() => setPurpose(p)}
              className={cn("rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-all",
                purpose === p ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50" : "border-border hover:bg-muted")}>
              {purpose === p ? "✓ " : ""}{p}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Dose per bird <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 0.5 ml" className="h-11 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Treated birds</Label>
        <div className="flex gap-2">
          <button type="button" aria-pressed={allBirds} onClick={() => setAllBirds(true)} className={cn("flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all", allBirds ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50" : "border-border hover:bg-muted")}>
            All {population} birds
          </button>
          <button type="button" aria-pressed={!allBirds} onClick={() => setAllBirds(false)} className={cn("flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all", !allBirds ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50" : "border-border hover:bg-muted")}>
            Specific #
          </button>
        </div>
        {!allBirds && (
          <Input type="number" min={1} max={population} value={count} onChange={(e) => setCount(e.target.value)} className="h-11 rounded-xl" placeholder={`1 – ${population}`} />
        )}
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Batch number, why you gave it…" className="rounded-xl resize-none" />
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Date given</Label>
        <Input type="date" required max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
      </div>
      <InlineError message={formError} />
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-700 text-white" disabled={createInput.isPending || population <= 0}>
        {createInput.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Product record"}
      </Button>
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
  const toggle = (s: string) => setSigns((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!date) { setFormError("Choose a date."); return; }
    if (isFutureDate(date)) { setFormError("The date cannot be in the future."); return; }
    if (signs.length === 0) { setFormError("Choose at least one behavior you noticed."); return; }
    if (!concern) { setFormError("Choose how much attention this needs."); return; }
    try {
      await createEvent.mutateAsync({ eventDate: date, eventType: "BEHAVIOR_OBSERVATION", title: signs[0], severityLabel: concern, affectedCount: 0, details: details || null, tags: signs.join(",") });
      toast.success("Behavior observation saved");
      onDone();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} />
      <div className="space-y-2">
        <Label className="font-semibold">What behaviors did you notice?</Label>
        <p className="text-xs text-muted-foreground">Tap all that you saw</p>
        <div className="flex flex-wrap gap-2">
          {BEHAVIOR_SIGNS.map((s) => <TagPill key={s} label={s} selected={signs.includes(s)} onToggle={() => toggle(s)} />)}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">How worried are you?</Label>
        <div className="grid grid-cols-3 gap-2">
          {[{ v: "LOW", label: "Just watching", emoji: "🟢" }, { v: "MEDIUM", label: "Needs check", emoji: "🟡" }, { v: "HIGH", label: "Check now!", emoji: "🔴" }].map((c) => (
            <button key={c.v} type="button" aria-pressed={concern === c.v} onClick={() => setConcern(c.v)}
              className={cn("rounded-xl border py-3 text-sm font-semibold transition-all", concern === c.v ? "border-violet-500 bg-violet-50 dark:bg-violet-950/50" : "border-border hover:bg-muted")}>
              <div className="text-xl mb-0.5">{c.emoji}</div>{c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Which birds, which area, when you first saw it…" className="rounded-xl resize-none" />
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Date</Label>
        <Input type="date" required max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
      </div>
      <InlineError message={formError} />
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold bg-violet-600 hover:bg-violet-700 text-white" disabled={createEvent.isPending || population <= 0}>
        {createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Behavior Note"}
      </Button>
    </form>
  );
}

// ─── Form: Daily vitals ───────────────────────────────────────────────────────

function VitalsForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createRecord = useCreateRecord(batchId);
  const { data: events, isLoading: eventsLoading, isError: eventsError } = useBatchEvents(batchId, 100);
  const [form, setForm] = useState({ recordDate: todayIso(), temperatureC: "", feedIntakeG: "", waterIntakeMl: "", feedQuality: "MEASURED", waterQuality: "MEASURED", behaviorNotes: "" });
  const [formError, setFormError] = useState("");
  const set = <K extends keyof typeof form>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const deathsLogged = events
    ?.filter((event) =>
      event.eventType === "HEALTH_DEATH" &&
      event.eventDate === form.recordDate
    )
    .reduce((total, event) => total + event.affectedCount, 0) ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.recordDate) { setFormError("Choose a date."); return; }
    if (isFutureDate(form.recordDate)) { setFormError("The date cannot be in the future."); return; }
    if (form.temperatureC === "") { setFormError("Enter temperature only when you have a measurement to record."); return; }
    try {
      await createRecord.mutateAsync({ recordDate: form.recordDate, temperatureC: Number(form.temperatureC), feedIntakeG: form.feedIntakeG === "" ? null : Number(form.feedIntakeG), waterIntakeMl: form.waterIntakeMl === "" ? null : Number(form.waterIntakeMl), behaviorNotes: form.behaviorNotes || null, temperatureQuality: "MEASURED", feedQuality: form.feedIntakeG === "" ? "UNAVAILABLE" : form.feedQuality as "MEASURED" | "ESTIMATED" | "UNAVAILABLE", waterQuality: form.waterIntakeMl === "" ? "UNAVAILABLE" : form.waterQuality as "MEASURED" | "ESTIMATED" | "UNAVAILABLE" });
      toast.success("Daily vitals saved!");
      onDone();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} />
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300">
        Optional measurements are stored only when the farm genuinely measures them. They do not need to be entered every day.
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Date</Label>
        <Input type="date" required max={todayIso()} value={form.recordDate} onChange={(e) => set("recordDate", e.target.value)} className="h-12 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-semibold">🌡️ Temperature (°C)</Label>
          <Input type="number" step="0.1" min={0} max={60} required value={form.temperatureC} onChange={(e) => set("temperatureC", e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" placeholder="—" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">💀 Deaths logged for this date</Label>
          <Input type="text" readOnly aria-readonly="true" value={eventsLoading ? "Loading…" : eventsError ? "Unavailable" : deathsLogged} className="h-12 rounded-xl bg-muted text-center text-lg font-bold" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">🍽️ Feed used (grams) <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="number" step="0.1" min={0} value={form.feedIntakeG} onChange={(e) => set("feedIntakeG", e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" placeholder="Leave blank if not measured" />
          <select aria-label="Feed amount quality" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.feedQuality} onChange={(e) => set("feedQuality", e.target.value)}><option value="MEASURED">Measured</option><option value="ESTIMATED">Estimated</option><option value="UNAVAILABLE">Not measured</option></select>
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">💧 Water used (ml) <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="number" step="0.1" min={0} value={form.waterIntakeMl} onChange={(e) => set("waterIntakeMl", e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" placeholder="Leave blank if estimated" />
          <select aria-label="Water amount quality" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.waterQuality} onChange={(e) => set("waterQuality", e.target.value)}><option value="MEASURED">Measured</option><option value="ESTIMATED">Estimated</option><option value="UNAVAILABLE">Not measured</option></select>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea rows={2} value={form.behaviorNotes} onChange={(e) => set("behaviorNotes", e.target.value)} className="rounded-xl resize-none" />
      </div>
      <InlineError message={formError} />
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold" disabled={createRecord.isPending || population <= 0}>
        {createRecord.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Measurement record"}
      </Button>
    </form>
  );
}

// ─── Event timeline (exported for history page) ───────────────────────────────

export const EVENT_EMOJI: Record<EventType, string> = {
  MORTALITY: "💀",
  HEALTH_DEATH: "🤒",
  ACCIDENTAL_DEATH: "⚠️",
  SUSPECTED_PREDATION: "🦊",
  CONFIRMED_PREDATION: "🦊",
  MISSING: "❓",
  FOUND_RETURNED: "↩️",
  TRANSFER_OUT: "➡️",
  TRANSFER_IN: "⬅️",
  SALE: "🏷️",
  CULLING: "✂️",
  COUNT_CORRECTION: "🧮",
  HEALTH_CONCERN: "🤒",
  VACCINE_MEDICINE: "💉",
  BEHAVIOR_OBSERVATION: "👁️",
};

export function EventTimeline({ events }: { events: BatchEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="text-4xl">📋</p>
        <p className="text-sm font-semibold text-muted-foreground">No events logged yet</p>
        <p className="text-xs text-muted-foreground">Tap a quick-log button to record something</p>
      </div>
    );
  }

  const byDate = events.reduce<Record<string, BatchEvent[]>>((acc, e) => {
    if (!acc[e.eventDate]) acc[e.eventDate] = [];
    acc[e.eventDate].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(byDate).map(([date, dayEvents]) => (
        <div key={date}>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {formatDate(date)}
          </p>
          <div className="space-y-2">
            {dayEvents.map((ev) => {
              const tags = ev.tags ? ev.tags.split(",").filter(Boolean) : [];
              return (
                <div key={ev.id} className="flex gap-3 rounded-2xl border bg-card p-3.5">
                  <span className="text-2xl shrink-0 mt-0.5">{EVENT_EMOJI[ev.eventType]}</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{ev.title}</span>
                      {ev.severityLabel && <Badge variant="outline" className="text-xs font-semibold">{ev.severityLabel}</Badge>}
                      {ev.affectedCount > 0 && <span className="text-xs text-muted-foreground">{ev.affectedCount} bird{ev.affectedCount !== 1 ? "s" : ""}</span>}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t}</span>)}
                      </div>
                    )}
                    {ev.details && <p className="text-xs text-muted-foreground">{ev.details}</p>}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-xs font-semibold text-primary/70">{ev.handlerName}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(ev.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main export: the quick-log widget ───────────────────────────────────────

export function BatchLogSection({
  batchId,
  population,
}: {
  batchId: string;
  population: number;
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
              "flex min-h-20 items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              btn.cardCls
            )}
          >
            <span className="shrink-0 text-2xl" aria-hidden="true">{btn.emoji}</span>
            <span className="text-sm font-bold leading-tight">{t(ACTION_LABEL_KEYS[btn.type])}</span>
          </button>
        ))}
      </div>

      <details className="group mt-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
          <span className="flex items-center gap-3"><span className="text-2xl" aria-hidden="true">📊</span><span><span className="block text-sm font-bold">{t("record.optionalMeasurements")}</span><span className="block text-xs text-muted-foreground">{t("record.measurementHint")}</span></span></span>
          <span className="text-right"><VitalsStatus batchId={batchId} /><span className="mt-1 block text-xs font-semibold text-primary group-open:hidden">{t("record.open")}</span></span>
        </summary>
        <div className="border-t border-emerald-200/70 px-4 pb-4 pt-3 dark:border-emerald-800/70"><button type="button" ref={(node) => { triggerRefs.current.DAILY_VITALS = node; }} onClick={() => setActiveDialog("DAILY_VITALS")} className="min-h-12 w-full rounded-xl border bg-background px-4 text-left text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">{t("record.addMeasurement")}</button></div>
      </details>

      {/* Dialogs */}
      <Dialog open={activeDialog !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
          {meta && (
            <DialogHeader>
              <DialogTitle className="text-lg">{meta.title}</DialogTitle>
            </DialogHeader>
          )}
          {activeDialog === "MORTALITY" && <MortalityForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "HEALTH_CONCERN" && <HealthForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "VACCINE_MEDICINE" && <TreatmentForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "BEHAVIOR_OBSERVATION" && <BehaviorForm batchId={batchId} population={population} onDone={close} />}
          {activeDialog === "DAILY_VITALS" && <VitalsForm batchId={batchId} population={population} onDone={close} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
