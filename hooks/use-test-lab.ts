"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { testLabApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { GenerateTestBatchRequest } from "@/lib/types";

export function useTestLabStatus(enabled = true) {
  return useQuery({
    queryKey: qk.testLabStatus,
    queryFn: testLabApi.status,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useGenerateTestBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateTestBatchRequest) => testLabApi.generate(body),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: qk.batches.all });
      queryClient.invalidateQueries({ queryKey: qk.tasks });
      queryClient.invalidateQueries({ queryKey: qk.inputs });
      queryClient.invalidateQueries({ queryKey: qk.finance });
      queryClient.invalidateQueries({ queryKey: qk.operationsAnalytics() });
      queryClient.removeQueries({ queryKey: qk.batches.detail(created.batchId) });
    },
  });
}
