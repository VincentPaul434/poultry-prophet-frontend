"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/**
 * Keeps signed-in users out of the sign-in and registration pages. A user whose
 * session expired (authRequired) still reaches them so they can sign in again.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, authRequired, isLoading } = useAuth();
  const router = useRouter();
  const hasLiveSession = isAuthenticated && !authRequired;

  useEffect(() => {
    if (!isLoading && hasLiveSession) router.replace("/dashboard");
  }, [hasLiveSession, isLoading, router]);

  if (isLoading || hasLiveSession) {
    return (
      <div className="flex min-h-svh items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
        <span className="sr-only">Sandali lang…</span>
      </div>
    );
  }

  return <>{children}</>;
}
