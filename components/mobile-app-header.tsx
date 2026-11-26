"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PoultryProphetMark } from "@/components/poultry-prophet-mark";
import { cn } from "@/lib/utils";

function initials(name: string | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type MobileAppHeaderProps = {
  farmName: string;
  roleLabel: string;
  isManager: boolean;
  fullName?: string;
  onProfileClick?: () => void;
};

export function MobileAppHeader({ farmName, roleLabel, isManager, fullName, onProfileClick }: MobileAppHeaderProps) {
  const { display: displayText } = useDisplayLocale();
  return (
    <header
      data-testid="mobile-app-header"
      className={cn("relative min-h-14 shrink-0 items-center border-b bg-card px-2 py-1 md:hidden", isManager ? "flex justify-center" : "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-2")}
    >
      <div className={cn(isManager && "absolute left-2 top-1/2 -translate-y-1/2")}>
        {isManager ? (
          <SidebarTrigger className="size-11" />
        ) : (
          <span
            data-testid="mobile-app-logo"
            role="img"
            aria-label={displayText("Poultry Prophet")}
            className="flex size-11 items-center justify-center rounded-xl bg-primary"
          >
            <PoultryProphetMark className="h-6 w-5" tone="light" />
          </span>
        )}
      </div>

      <div
        data-testid="mobile-farm-identity"
        className={cn("min-w-0 text-center", isManager ? "max-w-[calc(100%-8rem)]" : "w-full")}
      >
        <p className="truncate text-sm font-semibold leading-5 tracking-tight">{farmName}</p>
        <p className="truncate text-[11px] leading-4 text-muted-foreground">{roleLabel}</p>
      </div>

      <div className={cn("flex items-center gap-1", isManager && "absolute right-2 top-1/2 -translate-y-1/2")}>
        {isManager ? (
          <SyncStatusIndicator compact iconOnly />
        ) : (
          <>
            <SyncStatusIndicator compact iconOnly />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onProfileClick}
              className="flex size-11 items-center justify-center rounded-full border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              aria-label={displayText("Open profile menu")}
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                  {initials(fullName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
