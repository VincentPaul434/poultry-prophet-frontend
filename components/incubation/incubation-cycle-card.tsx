"use client";

import { Button } from "@/components/ui/button";

import { AlertTriangle, CalendarClock, ChevronRight, Egg, FlaskConical } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, todayIso } from "@/lib/format";
import type { IncubationCycle } from "@/lib/types";
import { cn } from "@/lib/utils";

function statusLabel(status: IncubationCycle["status"], t: ReturnType<typeof useLocale>["t"]) {
  const labels = {
    LOADED: t("incubation.loaded"),
    INCUBATING: t("incubation.incubating"),
    HATCHING: t("incubation.hatching"),
    COMPLETED: t("incubation.completed"),
    CANCELLED: t("incubation.cancelled"),
  } satisfies Record<IncubationCycle["status"], string>;
  return labels[status];
}

function statusClass(status: IncubationCycle["status"]) {
  if (status === "COMPLETED") return "bg-success-muted text-success";
  if (status === "CANCELLED") return "bg-destructive/10 text-destructive";
  return "bg-warning-muted text-warning-ink";
}

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000));
}

function activeProgress(cycle: IncubationCycle) {
  if (!cycle.expectedHatchDate) return null;
  const total = daysBetween(cycle.loadedDate, cycle.expectedHatchDate);
  if (total == null || total === 0) return { elapsed: 0, total: 0, percent: 100 };
  const end = cycle.expectedHatchDate < todayIso() ? cycle.expectedHatchDate : todayIso();
  const elapsed = Math.min(total, daysBetween(cycle.loadedDate, end) ?? 0);
  return { elapsed, total, percent: Math.min(100, Math.round((elapsed / total) * 100)) };
}

export function IncubationCycleCard({ cycle, onOpen }: { cycle: IncubationCycle; onOpen: (cycle: IncubationCycle) => void }) {
  const { t } = useLocale();
  const active = cycle.status !== "COMPLETED" && cycle.status !== "CANCELLED";
  const due = active && Boolean(cycle.expectedHatchDate && cycle.expectedHatchDate <= todayIso());
  const progress = activeProgress(cycle);
  const context = [cycle.incubatorCode, cycle.bloodline].filter(Boolean).join(" · ");
  const label = `${cycle.cycleName}. ${statusLabel(cycle.status, t)}. ${cycle.eggsLoaded} ${t("incubation.eggs")}.`;

  return (
    <Card className={cn("overflow-hidden rounded-2xl shadow-none transition-colors hover:border-primary/40", due && "border-warning/60")}>
      <Button variant="ghost"
        type="button"
        className="w-full text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        onClick={() => onOpen(cycle)}
        aria-label={`${t("incubation.openDetails")}: ${label}`}
        data-testid="incubation-cycle-card"
      >
        <div className={cn("h-1 w-full", due ? "bg-warning" : cycle.status === "COMPLETED" ? "bg-success" : cycle.status === "CANCELLED" ? "bg-destructive/60" : "bg-primary")} />
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary/10 text-primary" : cycle.status === "COMPLETED" ? "bg-success-muted text-success" : "bg-muted text-muted-foreground")} aria-hidden="true">
              {active ? <Egg className="size-5" /> : <FlaskConical className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{cycle.cycleName}</h2>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{context || `${t("incubation.loaded")} ${formatDate(cycle.loadedDate)}`}</p>
                </div>
                <Badge className={cn("shrink-0 rounded-full border-0 text-[11px]", statusClass(cycle.status))}>{statusLabel(cycle.status, t)}</Badge>
              </div>
              {due && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-warning-ink"><AlertTriangle className="size-3.5" aria-hidden="true" />{t("incubation.dueReview")}</p>}
            </div>
            <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>

          {active ? (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-end justify-between gap-3">
                <div><p className="text-lg font-bold tabular-nums">{cycle.eggsLoaded} <span className="text-xs font-medium text-muted-foreground">{t("incubation.eggs")}</span></p><p className="text-xs text-muted-foreground">{formatDate(cycle.loadedDate)}</p></div>
                <div className="text-right"><p className="text-sm font-semibold tabular-nums">{progress ? `${t("incubation.day")} ${progress.elapsed} / ${progress.total}` : "—"}</p><p className="text-xs text-muted-foreground">{cycle.expectedHatchDate ? `${t("incubation.expected")}: ${formatDate(cycle.expectedHatchDate)}` : ""}</p></div>
              </div>
              {progress && <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className={cn("h-full rounded-full transition-[width] duration-300", due ? "bg-warning" : "bg-primary")} style={{ width: `${progress.percent}%` }} /></div>}
            </div>
          ) : (
            <div className="grid grid-cols-3 divide-x border-y py-2.5 text-center">
              <div className="px-2"><p className="text-base font-bold tabular-nums">{cycle.hatchedCount ?? "—"}/{cycle.eggsLoaded}</p><p className="text-[11px] text-muted-foreground">{t("incubation.hatched")}</p></div>
              <div className="px-2"><p className="text-base font-bold tabular-nums">{cycle.hatchRatePercent == null ? "—" : `${cycle.hatchRatePercent}%`}</p><p className="text-[11px] text-muted-foreground">{t("incubation.hatchRate")}</p></div>
              <div className="px-2"><p className="text-base font-bold tabular-nums">{cycle.durationDays == null ? "—" : `${cycle.durationDays}d`}</p><p className="text-[11px] text-muted-foreground">{t("incubation.day")}</p></div>
            </div>
          )}

          {!active && <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />{t("incubation.actualDate")}: {formatDate(cycle.actualHatchDate)}</span>
            <span className="shrink-0 font-semibold text-primary">{t("incubation.openDetails")}</span>
          </div>}
        </div>
      </Button>
    </Card>
  );
}
