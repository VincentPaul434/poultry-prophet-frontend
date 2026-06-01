"use client";

// Shown to a manager whose farm has no name yet, prompting them to complete
// farm setup. Disappears automatically once a name is saved (the farm query
// updates) and can be dismissed for the current session.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Warehouse, X } from "lucide-react";
import { useFarm } from "@/hooks/use-farm";
import { useAuth } from "@/lib/auth-context";
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
      className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-6"
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Warehouse className="size-6" />
        </div>
        <div className="flex-1 space-y-3">
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
          <Button render={<Link href="/settings" />}>
            Go to Farm Settings
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
