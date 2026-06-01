"use client";

// The caller's own farm profile. Backs the onboarding banner (is the farm named
// yet?) and the farm setup form on the settings page.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Farm, UpdateFarmRequest } from "@/lib/types";

export function useFarm(enabled = true) {
  return useQuery({
    queryKey: qk.farm,
    queryFn: farmApi.current,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateFarmRequest) => farmApi.update(body),
    onSuccess: (updated: Farm) => {
      queryClient.setQueryData<Farm>(qk.farm, updated);
    },
  });
}
