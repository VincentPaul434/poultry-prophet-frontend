"use client";

// Self-contained "Quick Log" widget.
// Renders the 4+1 action buttons and manages all form dialogs internally.
// Import and drop onto any page that needs inline event logging.

import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { useCreateEvent } from "@/hooks/use-events";
import { useCreateFarmInput, useFarmProducts } from "@/hooks/use-operations";
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
    emoji: "💀",
    label: "Population change",
    cardCls:
      "border-destructive/25 bg-destructive/5 hover:bg-destructive/10 active:scale-[0.97]",
  },
  {
    type: "HEALTH_CONCERN" as DialogType,
    emoji: "🤒",
    label: "Sickness",
    cardCls:
      "border-warning-border bg-warning-muted/70 hover:bg-warning-muted active:scale-[0.97]",
  },
  {
    type: "VACCINE_MEDICINE" as DialogType,
    emoji: "💊",
    label: "Product used",
    cardCls:
      "border-success-border bg-success-muted/70 hover:bg-success-muted active:scale-[0.97]",
  },
  {
    type: "BEHAVIOR_OBSERVATION" as DialogType,
    emoji: "👁️",
    label: "Behavior",
    cardCls:
      "border-border bg-muted/40 hover:bg-muted active:scale-[0.97]",
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
  const [salePurpose, setSalePurpose] = useState<"BREEDING" | "OTHER" | "NOT_SPECIFIED" | "">("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());
  const [formError, setFormError] = useState("");
  const [showDateOverride, setShowDateOverride] = useState(false);
  const isCountCorrection = lossType === "COUNT_CORRECTION";
  const addsPopulation = lossType === "FOUND_RETURNED" || lossType === "TRANSFER_IN";
  const canLogWithNoPopulation = isCountCorrection || addsPopulation;
  const selectedCategory = LOSS_CATEGORIES.find((item) => item.type === lossType);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!date || isFutureDate(date)) { setFormError("Choose a valid date."); return; }
    if (!lossType) { setFormError("Choose a population-change category."); return; }
    const n = Number(count);
    if (!Number.isInteger(n) || (isCountCorrection ? n === 0 : n < 1)) {
      setFormError(isCountCorrection ? "Enter a non-zero whole-number adjustment." : "Enter at least 1 bird."); return;
    }
    if (!addsPopulation && !isCountCorrection && n > population) {
      setFormError(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive.`); return;
    }
    try {
      await createEvent.mutateAsync({
        eventDate: date,
        eventType: lossType,
        title: selectedCategory?.label ?? lossType,
        affectedCount: isCountCorrection ? 0 : n,
        populationDelta: isCountCorrection ? n : null,
        tags: lossType === "SALE" && salePurpose ? `SALE_PURPOSE:${salePurpose}` : null,
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
        </div>
      )}
      </div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you observe?" className="resize-none rounded-lg" /></div>
      <InlineError message={formError} />
      <Button type="submit" variant="destructive" className="sticky bottom-0 z-10 h-11 w-full rounded-lg text-base font-bold" disabled={createEvent.isPending || (population <= 0 && !canLogWithNoPopulation)}>{createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save population event"}</Button>
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
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Concern level</Label><div className="grid grid-cols-3 gap-2">{[{ v: "MINOR", label: "Mild", emoji: "🟡" }, { v: "MODERATE", label: "Serious", emoji: "🟠" }, { v: "MAJOR", label: "Urgent", emoji: "🔴" }].map((item) => <button key={item.v} type="button" aria-pressed={severity === item.v} onClick={() => setSeverity(item.v)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-sm font-semibold", severity === item.v ? "border-warning bg-warning-muted text-warning-ink" : "border-border hover:bg-muted")}>{item.emoji} {item.label}</button>)}</div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Signs noticed</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{HEALTH_SYMPTOMS.map((item) => <TagPill key={item} label={item} selected={symptoms.includes(item)} onToggle={() => toggle(item)} />)}</div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you observe?" className="resize-none rounded-lg" /></div>
      <InlineError message={formError} /><Button type="submit" className="sticky bottom-0 z-10 h-11 w-full rounded-lg text-base font-bold" disabled={createEvent.isPending || population <= 0}>{createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save sickness report"}</Button>
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
  const [quantity, setQuantity] = useState("1");
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
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) { setFormError("Enter the quantity used."); return; }
    if (purposeRequired && !purpose) { setFormError("Choose what the product is for."); return; }
    const treated = allBirds ? population : Number(count);
    if (treated < 1 || treated > population) { setFormError(`Enter 1–${population} affected bird${population === 1 ? "" : "s"}.`); return; }
    try {
      await createInput.mutateAsync({
        batchId: Number(batchId),
        ...(showDateOverride ? { recordedAt: new Date(`${date}T12:00:00`).toISOString() } : {}),
        productType,
        brandName: productName.trim(),
        farmProductId,
        quantity: Number(quantity),
        unit: farmProducts?.find((item) => item.id === farmProductId)?.stockUnit ?? null,
        affectedBirdCount: treated,
        purpose: purpose || null,
        notes: [dose ? `Dose: ${dose}` : "", `Applied to ${treated} birds`, details].filter(Boolean).join(" · ") || null,
      });
      toast.success(farmProductId ? "Product saved; stock deduction queued." : "Product record saved."); onDone();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Failed to save. Check the connection and try again."); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <NoAnimalsAlert population={population} />
      {farmProducts && farmProducts.length > 0 && <div className="space-y-1.5"><Label className="text-sm font-semibold">Product from farm stock</Label><NativeSelect value={farmProductId ?? ""} onChange={(e) => { const value = e.target.value ? Number(e.target.value) : null; const selected = farmProducts.find((item) => item.id === value); setFarmProductId(value); if (selected) { setProductName(selected.brandName); setProductType(selected.productType); } }}><option value="">Product not listed</option>{farmProducts.map((item) => <option key={item.id} value={item.id}>{item.brandName} · {item.stockOnHand} {item.stockUnit}{item.lowStock ? " · low stock" : ""}</option>)}</NativeSelect></div>}
      <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2.5"><div className="space-y-1.5"><Label className="text-sm font-semibold">Product / brand</Label><Input required value={productName} onChange={(e) => { setProductName(e.target.value); setFarmProductId(null); }} placeholder="e.g. Baby Stag Booster" className="h-11 rounded-lg" /></div><div className="space-y-1.5"><Label className="text-sm font-semibold">Used</Label><Input required type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11 rounded-lg" /></div></div>
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Product type</Label><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{[{ v: "FEED", label: "Feed" }, { v: "VITAMIN", label: "Vitamin" }, { v: "MEDICINE", label: "Medicine" }, { v: "VACCINE", label: "Vaccine" }, { v: "OTHER", label: "Other" }].map((item) => <button key={item.v} type="button" aria-pressed={productType === item.v} onClick={() => setProductType(item.v as typeof productType)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold", productType === item.v ? "border-success bg-success-muted text-success" : "border-border hover:bg-muted")}>{item.label}</button>)}</div></div>
      {purposeRequired && <div className="space-y-1.5"><Label className="text-sm font-semibold">Purpose</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{MEDICINE_PURPOSES.map((item) => <button key={item} type="button" aria-pressed={purpose === item} onClick={() => setPurpose(item)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-left text-sm font-medium", purpose === item ? "border-success bg-success-muted text-success" : "border-border hover:bg-muted")}>{purpose === item ? "✓ " : ""}{item}</button>)}</div></div>}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"><EventDateControl id="product-event-date" date={date} onChange={setDate} showOverride={showDateOverride} onShowOverrideChange={(open) => { setShowDateOverride(open); if (!open) setDate(todayIso()); }} /><div className="space-y-1.5"><Label className="text-sm font-semibold">Applied to</Label><div className="flex h-11 gap-1.5"><button type="button" aria-pressed={allBirds} onClick={() => setAllBirds(true)} className={cn("min-w-0 flex-1 rounded-lg border px-2 text-xs font-semibold", allBirds ? "border-success bg-success-muted text-success" : "border-border")}>All {population}</button><button type="button" aria-pressed={!allBirds} onClick={() => setAllBirds(false)} className={cn("min-w-0 flex-1 rounded-lg border px-2 text-xs font-semibold", !allBirds ? "border-success bg-success-muted text-success" : "border-border")}>Some</button></div></div></div>
      {!allBirds && <Input type="number" min={1} max={population} value={count} onChange={(e) => setCount(e.target.value)} className="h-11 rounded-lg" placeholder={`1 – ${population}`} />}
      <details open={showDetails} onToggle={(e) => setShowDetails(e.currentTarget.open)} className="rounded-lg border px-3"><summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold">More details <span className="ml-1 font-normal text-muted-foreground">(optional)</span></summary><div className="space-y-2 pb-3"><Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose / quantity, if known" className="h-10 rounded-lg" /><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Notes" className="resize-none rounded-lg" /></div></details>
      <InlineError message={formError} /><Button type="submit" className="sticky bottom-0 z-10 h-11 w-full rounded-lg text-base font-bold" disabled={createInput.isPending || population <= 0}>{createInput.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save product record"}</Button>
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
      <div className="space-y-1.5"><Label className="text-sm font-semibold">Attention level</Label><div className="grid grid-cols-3 gap-2">{[{ v: "LOW", label: "Watch", emoji: "🟢" }, { v: "MEDIUM", label: "Check", emoji: "🟡" }, { v: "HIGH", label: "Now", emoji: "🔴" }].map((item) => <button key={item.v} type="button" aria-pressed={concern === item.v} onClick={() => setConcern(item.v)} className={cn("min-h-11 rounded-lg border px-2 py-2 text-sm font-semibold", concern === item.v ? "border-warning bg-warning-muted text-warning-ink" : "border-border hover:bg-muted")}>{item.emoji} {item.label}</button>)}</div></div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"><EventDateControl id="behavior-event-date" date={date} onChange={setDate} showOverride={showDateOverride} onShowOverrideChange={(open) => { setShowDateOverride(open); if (!open) setDate(todayIso()); }} /><div className="space-y-1.5"><Label className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you see?" className="h-11 rounded-lg" /></div></div>
      <InlineError message={formError} /><Button type="submit" className="sticky bottom-0 z-10 h-11 w-full rounded-lg text-base font-bold" disabled={createEvent.isPending || population <= 0}>{createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save behavior note"}</Button>
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
      <InlineError message={formError} /><Button type="submit" className="sticky bottom-0 z-10 h-11 w-full rounded-lg text-base font-bold" disabled={createRecord.isPending || population <= 0}>{createRecord.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save measurement"}</Button>
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
              const tags = ev.tags ? ev.tags.split(",").filter((tag) => Boolean(tag) && !tag.startsWith("SALE_PURPOSE:")) : [];
              return (
                <div key={ev.id} className="flex gap-3 rounded-2xl border bg-card p-3.5">
                  <span className="text-2xl shrink-0 mt-0.5">{EVENT_EMOJI[ev.eventType]}</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{ev.title}</span>
                      {ev.severityLabel && <Badge variant="outline" className="text-xs font-semibold">{ev.severityLabel}</Badge>}
                      {ev.affectedCount > 0 && <span className="text-xs text-muted-foreground">{ev.affectedCount} bird{ev.affectedCount !== 1 ? "s" : ""}</span>}
                      {ev.eventType === "SALE" && ev.salePurpose === "BREEDING" && <Badge variant="secondary" className="text-xs">Sold as breeder</Badge>}
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
              "flex min-h-20 items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              btn.cardCls
            )}
          >
            <span className="shrink-0 text-2xl" aria-hidden="true">{btn.emoji}</span>
            <span className="text-sm font-bold leading-tight">{t(ACTION_LABEL_KEYS[btn.type])}</span>
          </button>
        ))}
      </div>

      <details className="group mt-2 rounded-2xl border border-dashed border-success-border bg-success-muted/70">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
          <span className="flex items-center gap-3"><span className="text-2xl" aria-hidden="true">📊</span><span><span className="block text-sm font-bold">{t("record.optionalMeasurements")}</span><span className="block text-xs text-muted-foreground">{t("record.measurementHint")}</span></span></span>
          <span className="text-right"><VitalsStatus batchId={batchId} /><span className="mt-1 block text-xs font-semibold text-primary group-open:hidden">{t("record.open")}</span></span>
        </summary>
        <div className="border-t border-success-border/70 px-4 pb-4 pt-3"><button type="button" ref={(node) => { triggerRefs.current.DAILY_VITALS = node; }} onClick={() => setActiveDialog("DAILY_VITALS")} className="min-h-12 w-full rounded-xl border bg-background px-4 text-left text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">{t("record.addMeasurement")}</button></div>
      </details>

      {/* Dialogs */}
      <Dialog open={activeDialog !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="w-[min(100%-1rem,50rem)] max-h-[calc(100dvh-2rem)] overflow-hidden p-0 sm:max-w-3xl">
          {meta && (
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle className="text-lg">{meta.title}</DialogTitle>
              <p className="text-xs text-muted-foreground">{batchName ? `${batchName}${stageName ? ` · ${stageName.replace("-", " ")}` : ""}` : `Batch ${batchId}`} · Date defaults to now</p>
            </DialogHeader>
          )}
          <div className="min-h-0 overflow-y-auto px-5 py-4">
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
