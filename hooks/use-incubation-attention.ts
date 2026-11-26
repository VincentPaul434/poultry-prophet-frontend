"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";

export interface IncubationAttention {
  cycleId: number;
  cycleName: string;
  expectedHatchDate: string | null;
  actualHatchDate: string | null;
  hatchedCount: number | null;
  kind: "HATCH_DUE_TODAY" | "HATCH_OVERDUE" | "BATCH_NEEDED";
  asOfDate: string;
}

export function useIncubationAttention(enabled = true) {
  return useQuery({
    queryKey: [...qk.incubation, "attention"],
    queryFn: async () => {
      const { data } = await apiClient.get<IncubationAttention[]>("/incubation-cycles/attention");
      if (!Array.isArray(data)) throw new Error("Incubation reminders are unavailable.");
      return data;
    },
    enabled,
    staleTime: 15_000,
  });
}
