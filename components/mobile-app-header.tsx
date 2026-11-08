"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
  return (
    <header data-testid="mobile-app-header" className="relative flex min-h-12 shrink-0 items-center justify-center border-b bg-card px-4 py-2 md:hidden">
      {isManager ? (
        <SidebarTrigger className="absolute left-4 top-1/2 size-11 -translate-y-1/2" />
      ) : (
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <SyncStatusIndicator compact />
        </div>
      )}

      <div className="flex min-w-0 items-center justify-center px-12">
        <p className="truncate text-sm font-semibold tracking-tight">
          {farmName} <span className="font-normal text-muted-foreground">· {roleLabel}</span>
        </p>
      </div>

      {isManager ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <SyncStatusIndicator />
        </div>
      ) : (
        <button
          type="button"
          onClick={onProfileClick}
          className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          aria-label="Open profile menu"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>
        </button>
      )}
    </header>
  );
}
