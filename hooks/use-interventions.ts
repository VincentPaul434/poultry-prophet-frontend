"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { interventionApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { AssignInterventionRequest, InterventionActionRequest } from "@/lib/types";

function invalidateInterventions(queryClient: ReturnType<typeof useQueryClient>, interventionId?: number) {
  queryClient.invalidateQueries({ queryKey: ["interventions"] });
  queryClient.invalidateQueries({ queryKey: qk.batches.all });
  if (interventionId != null) {
    queryClient.invalidateQueries({ queryKey: ["intervention", interventionId] });
  }
}

export function useInterventions(status?: string, enabled = true) {
  return useQuery({
    queryKey: qk.interventionsFarm(status),
    queryFn: () => interventionApi.list(status),
    enabled,
    staleTime: 10_000,
  });
}

export function useBatchInterventions(batchId: number | string, status?: string, enabled = true) {
  return useQuery({
    queryKey: qk.batches.interventions(batchId, status),
    queryFn: () => interventionApi.listForBatch(batchId, status),
    enabled: enabled && batchId != null && batchId !== "",
    staleTime: 10_000,
  });
}

export function useInterventionHistory(id: number, enabled = true) {
  return useQuery({
    queryKey: ["intervention", id, "history"],
    queryFn: () => interventionApi.history(id),
    enabled: enabled && id > 0,
  });
}

function useInterventionMutation<T>(mutationFn: (args: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateInterventions(queryClient),
  });
}

export function useClaimIntervention() {
  return useInterventionMutation<{ id: number }>(({ id }) => interventionApi.claim(id));
}

export function useStartIntervention() {
  return useInterventionMutation<{ id: number }>(({ id }) => interventionApi.start(id));
}

export function useCompleteIntervention() {
  return useInterventionMutation<{ id: number; body?: InterventionActionRequest }>(({ id, body }) =>
    interventionApi.complete(id, body)
  );
}

export function useEscalateIntervention() {
  return useInterventionMutation<{ id: number; body: InterventionActionRequest }>(({ id, body }) =>
    interventionApi.escalate(id, body)
  );
}

export function useAssignIntervention() {
  return useInterventionMutation<{ id: number; body: AssignInterventionRequest }>(({ id, body }) =>
    interventionApi.assign(id, body)
  );
}

export function useDismissIntervention() {
  return useInterventionMutation<{ id: number; body: InterventionActionRequest }>(({ id, body }) =>
    interventionApi.dismiss(id, body)
  );
}
