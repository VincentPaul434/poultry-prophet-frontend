"use client";

import { Archive, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Legacy score thresholds remain in the database for audit/history, but are no longer editable
 * or used by the active batch-review workflow. Keeping this page prevents an old deep link from
 * implying that BHI/BSI/WFR still drive a farm decision.
 */
export function ThresholdsSection() {
  return (
    <div className="space-y-5">
      <Card className="border-dashed shadow-none">
        <CardContent className="flex items-start gap-3 p-5 sm:p-6">
          <Archive className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="space-y-2">
            <p className="font-semibold">Legacy indicator thresholds are archived</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The active workflow no longer uses unsupported BHI, BSI, WFR, CRS, or 0–100 cut-lines. Existing values are retained for historical audit only. Use the Batch Selection Review report to inspect recorded events, interventions, population changes, data availability, and manager notes.
            </p>
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />Missing records are shown as unavailable; they are never converted into a score.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
