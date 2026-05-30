"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// Client-side gate for authenticated areas. Waits for the auth context to
// hydrate from localStorage, then redirects unauthenticated users to /login.
// Optionally restricts to managers.
export function RouteGuard({
  children,
  managerOnly = false,
}: {
  children: ReactNode;
  managerOnly?: boolean;
}) {
  const { isAuthenticated, isManager, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (managerOnly && !isManager) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, isManager, managerOnly, router]);

  if (isLoading || !isAuthenticated || (managerOnly && !isManager)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
