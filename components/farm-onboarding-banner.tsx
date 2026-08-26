"use client";

// Shown to a manager whose farm has no name yet, prompting them to complete
// farm setup. Disappears automatically once a name is saved (the farm query
// updates) and can be dismissed for the current session.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Warehouse, X } from "lucide-react";
import { useFarm } from "@/hooks/use-farm";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function FarmOnboardingBanner() {
  const { isManager } = useAuth();
  // Only a manager owns/configures the farm profile.
  const { data: farm } = useFarm(isManager);
  const [dismissed, setDismissed] = useState(false);

  const needsSetup = !!farm && !farm.name?.trim();
  if (!isManager || !needsSetup || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Farm setup"
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-amber-400/15 blur-2xl" />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute top-3 right-3 rounded-full bg-background/80 p-1 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary shadow-sm">
          <Warehouse className="size-6" />
        </div>
        <div className="flex-1 space-y-3">
          <Badge
            variant="secondary"
            className="w-fit rounded-full px-2 text-[10px] uppercase tracking-[0.2em]"
          >
            Setup required
          </Badge>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Complete Your Farm Setup
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Your farm profile is not yet configured. Set up your farm information to
              start managing batches, monitoring records, and accessing predictive
              analytics.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={<Link href="/settings/farm" />}
            className="rounded-full px-4 text-sm font-semibold"
          >
            Go to Farm Settings
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
