"use client";

import { useQuery } from "@tanstack/react-query";
import { versionApi } from "@/lib/api";

export function useReleaseVersion(enabled = true) {
  return useQuery({
    queryKey: ["version"],
    queryFn: versionApi.get,
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}
