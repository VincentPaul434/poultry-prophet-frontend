"use client";

// Alert Thresholds content. Managers can edit the min/max ranges that trigger
// alerts; handlers see them read-only.

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useThresholds, useUpdateThreshold } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import type { Threshold } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const THRESHOLD_LABELS: Record<string, { label: string; hint: string; icon: string }> = {
  BHI: { label: "Brooding Health", hint: "Overall health during brooding stage (0–100)", icon: "🌡️" },
  BSI: { label: "Behaviour Stress", hint: "Stress level from bird behavior signals (0–100)", icon: "😤" },
  WFR: { label: "Water vs. Feed", hint: "Ratio of water to feed intake", icon: "💧" },
  CRS: { label: "Readiness Score", hint: "Conditioning readiness for selection (0–100)", icon: "🏆" },
};

export function ThresholdsSection() {
  const { isManager } = useAuth();
  const thresholds = useThresholds();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isManager
          ? "Set the ranges that trigger alerts. Outside these limits = alert sent."
          : "Alert ranges set by your manager."}
      </p>

      {thresholds.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}
      {thresholds.isError && (
        <p className="text-sm text-destructive">Failed to load thresholds.</p>
      )}
      {thresholds.data?.map((t) => (
        // Keyed on the saved values so a server update re-initialises the inputs
        // without syncing via an effect.
        <ThresholdCard
          key={`${t.id}:${t.minValue}:${t.maxValue}`}
          threshold={t}
          editable={isManager}
        />
      ))}
    </div>
  );
}

function ThresholdCard({ threshold, editable }: { threshold: Threshold; editable: boolean }) {
  const update = useUpdateThreshold();
  const [min, setMin] = useState(String(threshold.minValue));
  const [max, setMax] = useState(String(threshold.maxValue));

  const dirty = min !== String(threshold.minValue) || max !== String(threshold.maxValue);
  const meta = THRESHOLD_LABELS[threshold.indicator] ?? {
    label: threshold.indicator,
    hint: "",
    icon: "📊",
  };

  async function save() {
    if (Number(min) > Number(max)) { toast.error("Min cannot be greater than max."); return; }
    try {
      await update.mutateAsync({ id: threshold.id, body: { minValue: Number(min), maxValue: Number(max) } });
      toast.success(`${meta.label} threshold saved`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <p className="text-sm font-bold">{meta.label}</p>
            <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
          </div>
        </div>
        {threshold.farmId == null && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
            Global
          </span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Min</label>
          <Input
            type="number"
            step="0.1"
            className="h-11 rounded-xl text-center font-bold"
            value={min}
            disabled={!editable}
            onChange={(e) => setMin(e.target.value)}
          />
        </div>
        <div className="pb-3 text-muted-foreground font-bold">–</div>
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Max</label>
          <Input
            type="number"
            step="0.1"
            className="h-11 rounded-xl text-center font-bold"
            value={max}
            disabled={!editable}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
        {editable && (
          <Button
            size="sm"
            className="h-11 rounded-xl px-4 font-semibold"
            onClick={save}
            disabled={!dirty || update.isPending}
          >
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
