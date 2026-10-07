"use client";

import { useQuery } from "@tanstack/react-query";
import { versionApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export function useReleaseVersion(enabled = true) {
  return useQuery({
    queryKey: qk.version,
    queryFn: versionApi.get,
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}
