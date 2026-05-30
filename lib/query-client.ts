import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

// Factory so the server and each browser tab get isolated caches (and tests can
// spin up a throwaway client). Defaults encode the app-wide caching policy;
// individual hooks override staleTime where the data's freshness needs differ.
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30s — no refetch within that window.
        staleTime: 30_000,
        // Keep unused data cached for 5 min before garbage collection.
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        // Don't hammer the server on auth/permission errors; retry transient ones once.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
