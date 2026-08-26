"use client";

// Self-contained "Quick Log" widget.
// Renders the 4+1 action buttons and manages all form dialogs internally.
// Import and drop onto any page that needs inline event logging.

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { useCreateEvent } from "@/hooks/use-events";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime, todayIso } from "@/lib/format";
import type { BatchEvent, EventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Domain constants ─────────────────────────────────────────────────────────

const MORTALITY_CAUSES = [
  "Suspected disease",
  "Injury / fighting",
  "Heat stress",
  "Unknown",
  "Natural (weak / runts)",
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

type DialogType = EventType | "DAILY_VITALS";

const ACTION_BUTTONS = [
  {
    type: "MORTALITY" as DialogType,
    emoji: "💀",
    label: "Deaths",
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
    emoji: "💉",
    label: "Medicine",
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

const DIALOG_META: Record<DialogType, { title: string; description: string }> = {
  MORTALITY: { title: "💀 Bird Deaths", description: "Record birds that died and what you think caused it." },
  HEALTH_CONCERN: { title: "🤒 Sickness Report", description: "Describe what the sick birds look like — the more detail the better." },
  VACCINE_MEDICINE: { title: "💉 Medicine Given", description: "Record what was given to the flock." },
  BEHAVIOR_OBSERVATION: { title: "👁️ Strange Behavior", description: "Note anything unusual about how the birds are acting." },
  DAILY_VITALS: { title: "📊 Daily Readings", description: "Log today's temperature, feed, and water. Do this every day during brooding." },
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function NoAnimalsAlert({ population }: { population: number }) {
  if (population > 0) return null;
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

function TagPill({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
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
  const today = todayIso();
  if (!last) return <span className="text-[11px] text-amber-600 font-medium">No readings yet</span>;
  if (last.recordDate === today) return <span className="text-[11px] text-emerald-600 font-medium">✅ Logged today</span>;
  return <span className="text-[11px] text-amber-600 font-medium">⚠️ Last: {formatDate(last.recordDate)}</span>;
}

// ─── Form: Mortality ──────────────────────────────────────────────────────────

function MortalityForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createEvent = useCreateEvent(batchId);
  const [count, setCount] = useState("1");
  const [cause, setCause] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cause) { toast.error("Please select a cause"); return; }
    const n = Number(count);
    if (n < 1) { toast.error("At least 1 bird"); return; }
    if (n > population) { toast.error(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive`); return; }
    try {
      await createEvent.mutateAsync({ eventDate: date, eventType: "MORTALITY", title: cause, affectedCount: n, details: details || null });
      toast.success(`${n} death${n !== 1 ? "s" : ""} recorded`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-semibold">When did it happen?</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">How many? <span className="font-normal text-muted-foreground">(max {population})</span></Label>
          <Input type="number" min={1} max={population} required value={count} onChange={(e) => setCount(e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">What do you think caused it?</Label>
        <div className="grid grid-cols-1 gap-2">
          {MORTALITY_CAUSES.map((c) => (
            <button key={c} type="button" onClick={() => setCause(c)}
              className={cn("rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all",
                cause === c ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400" : "border-border hover:border-primary/30 hover:bg-muted")}>
              {cause === c ? "✓ " : ""}{c}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Where it happened, what you noticed before…" className="rounded-xl resize-none" />
      </div>
      <Button type="submit" variant="destructive" className="w-full h-12 rounded-xl text-base font-bold" disabled={createEvent.isPending || population <= 0}>
        {createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Bird Deaths"}
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
  const toggle = (s: string) => setSymptoms((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(count);
    if (n < 1) { toast.error("At least 1 bird"); return; }
    if (n > population) { toast.error(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive`); return; }
    if (!severity) { toast.error("How serious is it?"); return; }
    if (symptoms.length === 0) { toast.error("Select at least one symptom"); return; }
    try {
      await createEvent.mutateAsync({ eventDate: date, eventType: "HEALTH_CONCERN", title: symptoms[0], severityLabel: severity, affectedCount: n, details: details || null, tags: symptoms.join(",") });
      toast.success("Sickness report saved");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-semibold">Date noticed</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
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
            <button key={s.v} type="button" onClick={() => setSeverity(s.v)}
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
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold bg-amber-600 hover:bg-amber-700 text-white" disabled={createEvent.isPending || population <= 0}>
        {createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Sickness Report"}
      </Button>
    </form>
  );
}

// ─── Form: Treatment ──────────────────────────────────────────────────────────

function TreatmentForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createEvent = useCreateEvent(batchId);
  const [medicineName, setMedicineName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [dose, setDose] = useState("");
  const [allBirds, setAllBirds] = useState(true);
  const [count, setCount] = useState(String(population));
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(todayIso());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!medicineName.trim()) { toast.error("What medicine or vaccine?"); return; }
    if (!purpose) { toast.error("What is it for?"); return; }
    const treated = allBirds ? population : Number(count);
    if (treated < 1) { toast.error("At least 1 bird must be treated"); return; }
    if (treated > population) { toast.error(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive`); return; }
    try {
      const tags = [purpose, dose ? `Dose: ${dose}` : ""].filter(Boolean).join(",");
      await createEvent.mutateAsync({ eventDate: date, eventType: "VACCINE_MEDICINE", title: medicineName.trim(), severityLabel: purpose, affectedCount: treated, details: details || null, tags: tags || null });
      toast.success("Treatment recorded");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
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
            <button key={p} type="button" onClick={() => setPurpose(p)}
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
          <button type="button" onClick={() => setAllBirds(true)} className={cn("flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all", allBirds ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50" : "border-border hover:bg-muted")}>
            All {population} birds
          </button>
          <button type="button" onClick={() => setAllBirds(false)} className={cn("flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all", !allBirds ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50" : "border-border hover:bg-muted")}>
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
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
      </div>
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-700 text-white" disabled={createEvent.isPending || population <= 0}>
        {createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Treatment"}
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
  const toggle = (s: string) => setSigns((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (signs.length === 0) { toast.error("Choose at least one behavior you noticed"); return; }
    if (!concern) { toast.error("How worried are you?"); return; }
    try {
      await createEvent.mutateAsync({ eventDate: date, eventType: "BEHAVIOR_OBSERVATION", title: signs[0], severityLabel: concern, affectedCount: 0, details: details || null, tags: signs.join(",") });
      toast.success("Behavior observation saved");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
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
            <button key={c.v} type="button" onClick={() => setConcern(c.v)}
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
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
      </div>
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold bg-violet-600 hover:bg-violet-700 text-white" disabled={createEvent.isPending || population <= 0}>
        {createEvent.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Behavior Note"}
      </Button>
    </form>
  );
}

// ─── Form: Daily vitals ───────────────────────────────────────────────────────

function VitalsForm({ batchId, population, onDone }: { batchId: string; population: number; onDone: () => void }) {
  const createRecord = useCreateRecord(batchId);
  const [form, setForm] = useState({ recordDate: todayIso(), temperatureC: "", mortalityCount: "0", feedIntakeG: "", waterIntakeMl: "", behaviorNotes: "" });
  const set = <K extends keyof typeof form>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const deaths = Number(form.mortalityCount);
    if (deaths > population) { toast.error(`Only ${population} bird${population === 1 ? "" : "s"} are currently alive`); return; }
    try {
      await createRecord.mutateAsync({ recordDate: form.recordDate || null, temperatureC: Number(form.temperatureC), mortalityCount: deaths, feedIntakeG: Number(form.feedIntakeG), waterIntakeMl: Number(form.waterIntakeMl), behaviorNotes: form.behaviorNotes || null });
      toast.success("Daily vitals saved!");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <NoAnimalsAlert population={population} />
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300">
        📊 Daily readings help compute your flock's health scores. Log every day during brooding.
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Date</Label>
        <Input type="date" value={form.recordDate} onChange={(e) => set("recordDate", e.target.value)} className="h-12 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-semibold">🌡️ Temperature (°C)</Label>
          <Input type="number" step="0.1" min={0} max={60} required value={form.temperatureC} onChange={(e) => set("temperatureC", e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" placeholder="—" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">💀 Deaths today <span className="font-normal text-muted-foreground">(max {population})</span></Label>
          <Input type="number" min={0} max={population} required value={form.mortalityCount} onChange={(e) => set("mortalityCount", e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">🍽️ Feed eaten (grams)</Label>
          <Input type="number" step="0.1" min={0} required value={form.feedIntakeG} onChange={(e) => set("feedIntakeG", e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" placeholder="—" />
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">💧 Water drunk (ml)</Label>
          <Input type="number" step="0.1" min={0} required value={form.waterIntakeMl} onChange={(e) => set("waterIntakeMl", e.target.value)} className="h-12 rounded-xl text-center text-lg font-bold" placeholder="—" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea rows={2} value={form.behaviorNotes} onChange={(e) => set("behaviorNotes", e.target.value)} className="rounded-xl resize-none" />
      </div>
      <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold" disabled={createRecord.isPending || population <= 0}>
        {createRecord.isPending ? <Loader2 className="size-5 animate-spin" /> : "Save — Daily Reading"}
      </Button>
    </form>
  );
}

// ─── Event timeline (exported for history page) ───────────────────────────────

export const EVENT_EMOJI: Record<EventType, string> = {
  MORTALITY: "💀",
  HEALTH_CONCERN: "🤒",
  VACCINE_MEDICINE: "💉",
  BEHAVIOR_OBSERVATION: "👁️",
};

const TYPE_CONFIG: Record<EventType, {
  label: string;
  stripe: string;
  activeChip: string;
  typeLabel: string;
  countBadge: string;
}> = {
  MORTALITY: {
    label: "Deaths",
    stripe: "bg-red-500",
    activeChip: "bg-red-500 text-white border-red-500",
    typeLabel: "text-red-600 dark:text-red-400",
    countBadge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
  },
  HEALTH_CONCERN: {
    label: "Sickness",
    stripe: "bg-amber-500",
    activeChip: "bg-amber-500 text-white border-amber-500",
    typeLabel: "text-amber-600 dark:text-amber-400",
    countBadge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  VACCINE_MEDICINE: {
    label: "Medicine",
    stripe: "bg-blue-500",
    activeChip: "bg-blue-500 text-white border-blue-500",
    typeLabel: "text-blue-600 dark:text-blue-400",
    countBadge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  },
  BEHAVIOR_OBSERVATION: {
    label: "Behavior",
    stripe: "bg-violet-500",
    activeChip: "bg-violet-500 text-white border-violet-500",
    typeLabel: "text-violet-600 dark:text-violet-400",
    countBadge: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
  },
};

function relativeDate(dateStr: string): string {
  const today = todayIso();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return formatDate(dateStr);
}

export function EventTimeline({ events }: { events: BatchEvent[] }) {
  const [filter, setFilter] = useState<EventType | "ALL">("ALL");

  if (events.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="text-4xl">📋</p>
        <p className="text-sm font-semibold text-muted-foreground">No events logged yet</p>
        <p className="text-xs text-muted-foreground">Events logged for this batch will appear here</p>
      </div>
    );
  }

  const eventTypes = Object.keys(TYPE_CONFIG) as EventType[];
  const filtered = filter === "ALL" ? events : events.filter((e) => e.eventType === filter);

  const byDate = filtered.reduce<Record<string, BatchEvent[]>>((acc, e) => {
    if (!acc[e.eventDate]) acc[e.eventDate] = [];
    acc[e.eventDate].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-4">

      {/* ── Filter chips ───────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            filter === "ALL"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          All
          <span className={cn(
            "rounded-full px-1.5 text-[10px] font-bold leading-4",
            filter === "ALL" ? "bg-white/20" : "bg-muted"
          )}>
            {events.length}
          </span>
        </button>

        {eventTypes.map((type) => {
          const cfg = TYPE_CONFIG[type];
          const count = events.filter((e) => e.eventType === type).length;
          if (count === 0) return null;
          const active = filter === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? cfg.activeChip
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {EVENT_EMOJI[type]} {cfg.label}
              <span className={cn(
                "rounded-full px-1.5 text-[10px] font-bold leading-4",
                active ? "bg-black/20" : "bg-muted"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Empty filtered state ───────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No {TYPE_CONFIG[filter as EventType]?.label.toLowerCase()} events logged yet.
          </p>
        </div>
      )}

      {/* ── Events grouped by date ─────────────────────────────────── */}
      {Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEvents]) => (
          <div key={date} className="space-y-2">

            {/* Date divider */}
            <div className="flex items-center gap-2 px-0.5">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {relativeDate(date)}
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground">
                {dayEvents.length}
              </span>
            </div>

            {/* Cards */}
            {dayEvents.map((ev) => {
              const cfg = TYPE_CONFIG[ev.eventType];
              const tags = ev.tags ? ev.tags.split(",").filter(Boolean) : [];
              return (
                <div key={ev.id} className="relative overflow-hidden rounded-2xl border bg-card">
                  {/* Left accent stripe */}
                  <div className={cn("absolute inset-y-0 left-0 w-1", cfg.stripe)} />

                  <div className="flex gap-3 p-3.5 pl-5">
                    {/* Type icon */}
                    <div className="mt-0.5 shrink-0 text-xl">{EVENT_EMOJI[ev.eventType]}</div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-1">

                      {/* Row 1 — type label + logged-at time */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wide", cfg.typeLabel)}>
                          {cfg.label}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDateTime(ev.createdAt)}
                        </span>
                      </div>

                      {/* Row 2 — title + birds affected */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold leading-snug">{ev.title}</p>
                        {ev.affectedCount > 0 && (
                          <span className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                            cfg.countBadge
                          )}>
                            {ev.affectedCount} bird{ev.affectedCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Row 3 — tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Row 4 — notes */}
                      {ev.details && (
                        <p className="text-xs leading-snug text-muted-foreground">{ev.details}</p>
                      )}

                      {/* Row 5 — severity + handler */}
                      <div className="flex items-center gap-2 pt-0.5">
                        {ev.severityLabel && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-semibold">
                            {ev.severityLabel}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{ev.handlerName}</span>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
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
  const [activeDialog, setActiveDialog] = useState<DialogType | null>(null);
  const close = () => setActiveDialog(null);
  const meta = activeDialog ? DIALOG_META[activeDialog] : null;

  return (
    <>
      {/* 4-button grid: Deaths | Sickness / Medicine | Behavior */}
      <div className="grid grid-cols-2 gap-2">
        {ACTION_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            type="button"
            onClick={() => setActiveDialog(btn.type)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all",
              btn.cardCls
            )}
          >
            <span className="text-2xl shrink-0">{btn.emoji}</span>
            <span className="text-sm font-bold leading-tight">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Daily vitals — full-width, dashed border to signal "routine" */}
      <button
        type="button"
        onClick={() => setActiveDialog("DAILY_VITALS")}
        className="mt-2 flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/80 px-4 py-3.5 text-left transition-all hover:bg-emerald-100 active:scale-[0.99] dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-sm font-bold">Daily Readings</p>
            <p className="text-xs text-muted-foreground">Temperature · Feed · Water</p>
          </div>
        </div>
        <VitalsStatus batchId={batchId} />
      </button>

      {/* Dialogs */}
      <Dialog open={activeDialog !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
          {meta && (
            <DialogHeader>
              <DialogTitle className="text-lg">{meta.title}</DialogTitle>
              <DialogDescription>{meta.description}</DialogDescription>
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
