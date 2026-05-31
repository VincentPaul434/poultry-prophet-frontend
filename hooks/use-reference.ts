"use client";

// Reference / config data: lifecycle stages, handlers and thresholds.
// These change rarely, so they get long staleTimes.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { handlerApi, inviteApi, lifecycleApi, thresholdApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { CreateInviteRequest, Threshold, UpdateThresholdRequest } from "@/lib/types";

export function useLifecycleStages() {
  return useQuery({
    queryKey: qk.lifecycleStages,
    queryFn: lifecycleApi.list,
    // Essentially static reference data — never goes stale during a session.
    staleTime: Infinity,
  });
}

export function useHandlers(enabled = true) {
  return useQuery({
    queryKey: qk.handlers,
    queryFn: handlerApi.list,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useThresholds() {
  return useQuery({
    queryKey: qk.thresholds,
    queryFn: thresholdApi.list,
    staleTime: 5 * 60_000,
  });
}

export function usePendingInvites(enabled = true) {
  return useQuery({
    queryKey: qk.invitesPending,
    queryFn: inviteApi.pending,
    // Short staleTime: a handler may be invited mid-session, so check fairly often.
    staleTime: 60_000,
    enabled,
  });
}

export function useDeclineInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => inviteApi.decline(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.invitesPending });
    },
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInviteRequest) => inviteApi.create(body),
    onSuccess: () => {
      // The invitee isn't a handler until they accept, but refresh so the
      // list reflects any server-side changes once it does.
      queryClient.invalidateQueries({ queryKey: qk.handlers });
    },
  });
}

export function useUpdateThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateThresholdRequest }) =>
      thresholdApi.update(id, body),
    onSuccess: (updated: Threshold) => {
      queryClient.setQueryData<Threshold[]>(qk.thresholds, (prev) =>
        prev?.map((t) => (t.id === updated.id ? updated : t))
      );
    },
  });
}
