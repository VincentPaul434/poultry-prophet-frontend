"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardPageHeader({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></div>
        <div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>{description && <p className="truncate text-sm text-muted-foreground">{description}</p>}</div>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </header>
  );
}
