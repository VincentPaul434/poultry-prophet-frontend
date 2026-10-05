"use client";

// Shown to a manager whose farm has no name yet, prompting them to complete
// farm setup. Disappears automatically once a name is saved (the farm query
// updates) and can be dismissed for the current session.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Warehouse, X } from "lucide-react";
import { useFarm } from "@/hooks/use-farm";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function FarmOnboardingBanner() {
  const { isManager } = useAuth();
  const { t } = useLocale();
  // Only a manager owns/configures the farm profile.
  const { data: farm } = useFarm(isManager);
  const [dismissed, setDismissed] = useState(false);

  const needsSetup = !!farm && !farm.name?.trim();
  if (!isManager || !needsSetup || dismissed) return null;

  return (
    <div
      role="region"
      aria-label={t("farmSetup.ariaLabel")}
      className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("common.dismiss")}
        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Warehouse className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight">{t("farmSetup.title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("farmSetup.description")}</p>
        </div>
        <Button className="min-h-11 shrink-0 rounded-xl" render={<Link href="/settings/farm" />}>
            {t("farmSetup.action")}
            <ArrowRight className="size-4" />
        </Button>
        </div>
    </div>
  );
}
