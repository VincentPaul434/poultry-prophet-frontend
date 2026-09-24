"use client";

import { useState } from "react";
import { CalendarDays, Check, Egg, Hash, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useCompleteIncubation,
  useCreateIncubationBatch,
  useCreateIncubationCycle,
  useIncubationCycles,
} from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import type { IncubationCycle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoadForm = {
  cycleName: string;
  incubatorCode: string;
  loadedDate: string;
  eggsLoaded: string;
  expectedHatchDate: string;
  eggSource: string;
  bloodline: string;
};

const EMPTY_FORM: LoadForm = {
  cycleName: "",
  incubatorCode: "",
  loadedDate: todayIso(),
  eggsLoaded: "",
  expectedHatchDate: "",
  eggSource: "",
  bloodline: "",
};

function statusTone(status: IncubationCycle["status"]) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "CANCELLED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export default function IncubationPage() {
  const { isManager } = useAuth();
  const { t } = useLocale();
  const { data: cycles, isLoading } = useIncubationCycles();
  const create = useCreateIncubationCycle();
  const complete = useCompleteIncubation();
  const createBatch = useCreateIncubationBatch();
  const [form, setForm] = useState<LoadForm>(EMPTY_FORM);
  const [showDetails, setShowDetails] = useState(false);
  const [hatch, setHatch] = useState<Record<number, HatchValue>>({});

  const fail = (error: unknown) =>
    toast.error(error instanceof ApiError ? error.message : "Could not save the record");

  function updateForm<K extends keyof LoadForm>(key: K, value: LoadForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const eggsLoaded = Number(form.eggsLoaded);
    if (!Number.isInteger(eggsLoaded) || eggsLoaded < 1) {
      toast.error("Enter a whole number of eggs greater than zero.");
      return;
    }

    try {
      await create.mutateAsync({
        cycleName: form.cycleName.trim(),
        incubatorCode: form.incubatorCode.trim(),
        loadedDate: form.loadedDate,
        eggsLoaded,
        expectedHatchDate: form.expectedHatchDate || null,
        eggSource: form.eggSource.trim() || null,
        bloodline: form.bloodline.trim() || null,
      });
      toast.success("Egg load recorded");
      setForm({ ...EMPTY_FORM, loadedDate: todayIso() });
      setShowDetails(false);
    } catch (error) {
      fail(error);
    }
  }

  async function completeCycle(id: number) {
    const value = hatch[id];
    if (!value) return;
    if (!value.actualHatchDate || value.hatchedCount === "" || value.unhatchedCount === "" || value.removedDamagedCount === "") {
      toast.error("Enter the hatch date and all three hatch counts.");
      return;
    }
    const hatched = Number(value.hatchedCount);
    const unhatched = Number(value.unhatchedCount);
    const removed = Number(value.removedDamagedCount);
    if (![hatched, unhatched, removed].every((count) => Number.isInteger(count) && count >= 0)) {
      toast.error("Enter whole numbers for all hatch results.");
      return;
    }

    try {
      await complete.mutateAsync({
        id,
        body: {
          actualHatchDate: value.actualHatchDate,
          hatchedCount: hatched,
          unhatchedCount: unhatched,
          removedDamagedCount: removed,
        },
      });
      toast.success("Hatch results saved");
    } catch (error) {
      fail(error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Egg className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("incubation.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("incubation.loadEggs")}</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden border-primary/20 shadow-sm">
        <div className="h-1.5 bg-primary" />
        <CardHeader className="gap-1 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{t("incubation.loadEggs")}</CardTitle>
              <CardDescription className="mt-1">Record this when the eggs go into the incubator.</CardDescription>
            </div>
              <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
              <Hash className="size-3.5" /> {t("incubation.requiredFields")}: 4
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cycle-name">{t("incubation.loadReference")}</Label>
                <Input id="cycle-name" required value={form.cycleName} onChange={(event) => updateForm("cycleName", event.target.value)} placeholder="Example: September Load 1" />
                <p className="text-xs text-muted-foreground">A short name the farm can recognize.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incubator-code">{t("incubation.incubator")}</Label>
                <Input id="incubator-code" required value={form.incubatorCode} onChange={(event) => updateForm("incubatorCode", event.target.value)} placeholder="Example: Incubator 1" />
                <p className="text-xs text-muted-foreground">Use the farm’s existing name or number.</p>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl bg-muted/40 p-4 sm:grid-cols-[1fr_1fr_1.2fr]">
              <div className="space-y-2">
                <Label htmlFor="loaded-date">{t("incubation.dateLoaded")}</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="loaded-date" required type="date" max={todayIso()} value={form.loadedDate} onChange={(event) => updateForm("loadedDate", event.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="eggs-loaded">{t("incubation.eggsLoaded")}</Label>
                <Input id="eggs-loaded" required autoFocus type="number" min="1" step="1" inputMode="numeric" value={form.eggsLoaded} onChange={(event) => updateForm("eggsLoaded", event.target.value)} className="h-12 text-lg font-semibold" placeholder="0" />
              </div>
              <div className="flex items-end">
                <Button disabled={create.isPending} type="submit" className="h-12 w-full sm:w-auto">
                  {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  {t("common.save")} egg load
                </Button>
              </div>
            </div>

            <details open={showDetails} onToggle={(event) => setShowDetails(event.currentTarget.open)} className="rounded-2xl border px-4">
              <summary className="cursor-pointer list-none py-4 text-sm font-semibold">
                <span className="flex items-center justify-between gap-3">
                  {t("incubation.optionalDetails")}
                  <span className="text-xs font-normal text-muted-foreground">Add later if known</span>
                </span>
              </summary>
              <div className="grid gap-4 border-t py-4 sm:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="expected-hatch-date">{t("incubation.expectedDate")}</Label><Input id="expected-hatch-date" type="date" value={form.expectedHatchDate} onChange={(event) => updateForm("expectedHatchDate", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="egg-source">{t("incubation.eggSource")}</Label><Input id="egg-source" value={form.eggSource} onChange={(event) => updateForm("eggSource", event.target.value)} placeholder="Farm or source" /></div>
                <div className="space-y-2"><Label htmlFor="bloodline">{t("incubation.bloodline")}</Label><Input id="bloodline" value={form.bloodline} onChange={(event) => updateForm("bloodline", event.target.value)} placeholder="If known" /></div>
              </div>
            </details>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t("incubation.title")}</h2>
            <p className="text-sm text-muted-foreground">Hatch updates stay with the original load.</p>
          </div>
          {cycles && <Badge variant="outline" className="rounded-full">{cycles.length} total</Badge>}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading incubation records…</p>}
        {!isLoading && cycles?.length === 0 && (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <Egg className="size-8 text-muted-foreground" />
              <p className="font-medium">{t("common.noRecords")}</p>
              <p className="text-sm text-muted-foreground">The first record will appear here after the handler saves it.</p>
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {cycles?.map((cycle) => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              isManager={isManager}
              hatch={hatch[cycle.id]}
              setHatch={(value) => setHatch((current) => ({ ...current, [cycle.id]: value }))}
              onComplete={() => completeCycle(cycle.id)}
              onCreateBatch={async () => {
                try {
                  await createBatch.mutateAsync(cycle.id);
                  toast.success("Batch created from hatch results");
                } catch (error) {
                  fail(error);
                }
              }}
              completePending={complete.isPending}
              createBatchPending={createBatch.isPending}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

type HatchValue = {
  actualHatchDate: string;
  hatchedCount: string;
  unhatchedCount: string;
  removedDamagedCount: string;
};

function CycleCard({
  cycle,
  isManager,
  hatch,
  setHatch,
  onComplete,
  onCreateBatch,
  completePending,
  createBatchPending,
}: {
  cycle: IncubationCycle;
  isManager: boolean;
  hatch?: HatchValue;
  setHatch: (value: HatchValue) => void;
  onComplete: () => void;
  onCreateBatch: () => void;
  completePending: boolean;
  createBatchPending: boolean;
}) {
  const { t } = useLocale();
  const [showHatchForm, setShowHatchForm] = useState(false);
  const hatchValue = hatch ?? { actualHatchDate: todayIso(), hatchedCount: "", unhatchedCount: "", removedDamagedCount: "" };
  const setValue = (key: keyof HatchValue, value: string) => setHatch({ ...hatchValue, [key]: value });
  const isOpen = cycle.status !== "COMPLETED" && cycle.status !== "CANCELLED";
  const resultTotal = [hatchValue.hatchedCount, hatchValue.unhatchedCount, hatchValue.removedDamagedCount].reduce((total, value) => total + (value === "" ? 0 : Number(value)), 0);
  const hasAllResults = hatchValue.hatchedCount !== "" && hatchValue.unhatchedCount !== "" && hatchValue.removedDamagedCount !== "";
  const resultsReconcile = hasAllResults && resultTotal === cycle.eggsLoaded;

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{cycle.cycleName}</CardTitle>
            <CardDescription className="mt-1">{cycle.incubatorCode} · loaded {formatDate(cycle.loadedDate)}</CardDescription>
          </div>
          <Badge className={cn("shrink-0 rounded-full border-0", statusTone(cycle.status))}>{cycle.status}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{cycle.eggsLoaded}</p><p className="text-xs text-muted-foreground">{t("incubation.eggs")}</p></div>
          <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{cycle.hatchedCount ?? "—"}</p><p className="text-xs text-muted-foreground">{t("incubation.hatched")}</p></div>
          <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{cycle.hatchedCount == null ? "—" : `${cycle.hatchRatePercent}%`}</p><p className="text-xs text-muted-foreground">{t("incubation.hatchRate")}</p></div>
        </div>
      </CardHeader>
      {isManager && isOpen && (
        <details open={showHatchForm} onToggle={(event) => setShowHatchForm(event.currentTarget.open)} className="border-t">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
            <span>{t("incubation.hatchResult")}</span><span className="text-xs font-normal text-muted-foreground">{showHatchForm ? "Hide" : t("record.open")}</span>
          </summary>
          <CardContent className="space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">Hatched + unhatched + removed/damaged must equal {cycle.eggsLoaded} loaded eggs.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`hatch-date-${cycle.id}`}>{t("incubation.actualDate")}</Label><Input id={`hatch-date-${cycle.id}`} type="date" max={todayIso()} value={hatchValue.actualHatchDate} onChange={(event) => setValue("actualHatchDate", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor={`hatched-${cycle.id}`}>{t("incubation.hatched")}</Label><Input id={`hatched-${cycle.id}`} type="number" min="0" step="1" value={hatchValue.hatchedCount} onChange={(event) => setValue("hatchedCount", event.target.value)} placeholder="0" /></div>
              <div className="space-y-1.5"><Label htmlFor={`unhatched-${cycle.id}`}>{t("incubation.unhatched")}</Label><Input id={`unhatched-${cycle.id}`} type="number" min="0" step="1" value={hatchValue.unhatchedCount} onChange={(event) => setValue("unhatchedCount", event.target.value)} placeholder="0" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`removed-${cycle.id}`}>{t("incubation.removed")}</Label><Input id={`removed-${cycle.id}`} type="number" min="0" step="1" value={hatchValue.removedDamagedCount} onChange={(event) => setValue("removedDamagedCount", event.target.value)} placeholder="0" /></div>
            </div>
            {hasAllResults && <p className={resultsReconcile ? "rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-950/30 dark:text-red-200"}>{resultTotal} of {cycle.eggsLoaded} eggs accounted for{resultsReconcile ? "" : " — check the counts"}.</p>}
            <Button onClick={onComplete} disabled={completePending || !resultsReconcile} className="w-full">
              {completePending ? <Loader2 className="animate-spin" /> : <Check />}
              {t("incubation.saveResults")}
            </Button>
          </CardContent>
        </details>
      )}
      {isManager && cycle.status === "COMPLETED" && !cycle.createdBatchId && (
        <CardContent className="border-t pt-4">
          <Button variant="outline" onClick={onCreateBatch} disabled={createBatchPending} className="w-full">
            {createBatchPending ? <Loader2 className="animate-spin" /> : <Plus />}
            {t("incubation.createBatch")}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
