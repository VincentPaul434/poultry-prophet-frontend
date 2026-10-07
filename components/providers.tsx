"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { makeQueryClient } from "@/lib/query-client";
import { LocaleProvider } from "@/components/locale-provider";
import { OfflineSyncProvider } from "@/lib/offline-sync-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export function Providers({ children }: { children: ReactNode }) {
  // useState ensures one QueryClient per browser session (survives re-renders,
  // not shared across requests on the server).
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark"]}>
        <LocaleProvider>
          <AuthProvider>
            <OfflineSyncProvider>{children}</OfflineSyncProvider>
          </AuthProvider>
          <ServiceWorkerRegistration />
        </LocaleProvider>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
    </QueryClientProvider>
  );
}
