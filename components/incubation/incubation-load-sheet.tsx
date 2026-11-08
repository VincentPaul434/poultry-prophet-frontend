"use client";

import { useState } from "react";
import { CalendarDays, Egg, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { todayIso } from "@/lib/format";
import type { CreateIncubationCycleRequest } from "@/lib/types";

type LoadDraft = CreateIncubationCycleRequest;

const initialDraft = (): LoadDraft => ({
  cycleName: "",
  incubatorCode: "",
  loadedDate: todayIso(),
  eggsLoaded: 0,
  expectedHatchDate: null,
  eggSource: null,
  bloodline: null,
  notes: null,
});

export function IncubationLoadSheet({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; onSubmit: (draft: CreateIncubationCycleRequest) => Promise<void> }) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<LoadDraft>(initialDraft);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function setValue<K extends keyof LoadDraft>(key: K, value: LoadDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const eggsLoaded = Number(draft.eggsLoaded);
    if (!draft.cycleName.trim() || !draft.incubatorCode.trim()) return toast.error("Enter the load name and incubator.");
    if (!Number.isInteger(eggsLoaded) || eggsLoaded < 1) return toast.error("Enter a whole number of eggs greater than zero.");
    await onSubmit({
      ...draft,
      cycleName: draft.cycleName.trim(),
      incubatorCode: draft.incubatorCode.trim(),
      eggsLoaded,
      expectedHatchDate: draft.expectedHatchDate || null,
      eggSource: draft.eggSource?.trim() || null,
      bloodline: draft.bloodline?.trim() || null,
      notes: draft.notes?.trim() || null,
    });
    setDraft(initialDraft());
    setDetailsOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[90dvh] rounded-t-3xl p-0" : "w-[min(92vw,32rem)] p-0 sm:max-w-lg"}>
        <SheetHeader className="border-b px-5 py-5 pr-14">
          <SheetTitle className="flex items-center gap-2"><Egg className="size-5 text-primary" aria-hidden="true" />{t("incubation.loadEggs")}</SheetTitle>
          <SheetDescription>{t("incubation.loadDescription")}</SheetDescription>
        </SheetHeader>
        <form id="incubation-load-form" onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="cycle-name">{t("incubation.loadReference")} <span className="text-destructive">*</span></Label><Input id="cycle-name" required value={draft.cycleName} onChange={(event) => setValue("cycleName", event.target.value)} placeholder="September Load 1" /></div>
              <div className="space-y-2"><Label htmlFor="incubator-code">{t("incubation.incubator")} <span className="text-destructive">*</span></Label><Input id="incubator-code" required value={draft.incubatorCode} onChange={(event) => setValue("incubatorCode", event.target.value)} placeholder="Incubator 1" /></div>
            </div>
            <div className="grid gap-4 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="loaded-date">{t("incubation.dateLoaded")} <span className="text-destructive">*</span></Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="loaded-date" required type="date" max={todayIso()} value={draft.loadedDate} onChange={(event) => setValue("loadedDate", event.target.value)} className="pl-9" /></div></div>
              <div className="space-y-2"><Label htmlFor="eggs-loaded">{t("incubation.eggsLoaded")} <span className="text-destructive">*</span></Label><Input id="eggs-loaded" required type="number" min="1" step="1" inputMode="numeric" value={draft.eggsLoaded || ""} onChange={(event) => setValue("eggsLoaded", Number(event.target.value))} placeholder="200" className="h-11 text-lg font-semibold" /></div>
            </div>
            <details open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)} className="rounded-2xl border px-4">
              <summary className="cursor-pointer list-none py-4 text-sm font-semibold"><span className="flex items-center justify-between gap-3">{t("incubation.optionalDetails")}<span className="text-xs font-normal text-muted-foreground">{t("incubation.moreDetails")}</span></span></summary>
              <div className="grid gap-4 border-t py-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="expected-hatch-date">{t("incubation.expectedDate")}</Label><Input id="expected-hatch-date" type="date" min={draft.loadedDate} value={draft.expectedHatchDate ?? ""} onChange={(event) => setValue("expectedHatchDate", event.target.value || null)} /></div>
                <div className="space-y-2"><Label htmlFor="egg-source">{t("incubation.eggSource")}</Label><Input id="egg-source" value={draft.eggSource ?? ""} onChange={(event) => setValue("eggSource", event.target.value)} placeholder="Farm or source" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="bloodline">{t("incubation.bloodline")}</Label><Input id="bloodline" value={draft.bloodline ?? ""} onChange={(event) => setValue("bloodline", event.target.value)} placeholder="If known" /></div>
              </div>
            </details>
          </div>
        </form>
        <SheetFooter className="border-t bg-popover/95 px-5 py-4">
          <Button type="submit" form="incubation-load-form" disabled={pending} className="min-h-11 w-full">{pending ? <Loader2 className="animate-spin" /> : null}{t("incubation.saveLoad")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
