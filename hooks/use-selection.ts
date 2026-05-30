"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { selectionApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { SelectionDecisionRequest, SelectionRow } from "@/lib/types";

export function useSelectionView(batchId: number | string, enabled = true) {
  return useQuery({
    queryKey: qk.batches.selection(batchId),
    queryFn: () => selectionApi.view(batchId),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 60_000,
  });
}

export function useSelectionDecision(batchId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      birdId,
      body,
    }: {
      birdId: number | string;
      body: SelectionDecisionRequest;
    }) => selectionApi.decide(batchId, birdId, body),
    onSuccess: (row: SelectionRow) => {
      // Patch the single decided row in place, then refetch in the background to
      // pick up any re-ranking the backend applied.
      queryClient.setQueryData(qk.batches.selection(batchId), (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        const view = prev as { rows: SelectionRow[] };
        return {
          ...view,
          rows: view.rows.map((r) => (r.birdId === row.birdId ? row : r)),
        };
      });
      queryClient.invalidateQueries({ queryKey: qk.batches.selection(batchId) });
    },
  });
}
