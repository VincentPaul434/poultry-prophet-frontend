"use client";

// Shared shell for a single settings section. Renders the breadcrumb and the
// section header, guards manager-only sections, and fades the content in. The
// detail route pages just wrap their content in this.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { getSection, type SettingsSectionKey } from "./sections";

export function SettingsDetailShell({
  section,
  children,
}: {
  section: SettingsSectionKey;
  children: React.ReactNode;
}) {
  const meta = getSection(section);
  const { isManager, isLoading } = useAuth();
  const router = useRouter();

  const blocked = meta.managerOnly && !isManager;

  // A handler who deep-links to a manager-only section is sent back to the hub.
  useEffect(() => {
    if (!isLoading && blocked) router.replace("/settings");
  }, [isLoading, blocked, router]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (blocked) return null;

  const Icon = meta.icon;

  return (
    <div className="mx-auto max-w-xl space-y-6 duration-300 animate-in fade-in slide-in-from-bottom-2">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link
          href="/settings"
          className="font-medium transition-colors hover:text-foreground"
        >
          Settings
        </Link>
        <ChevronRight className="size-4 shrink-0" />
        <span className="font-medium text-foreground">{meta.title}</span>
      </nav>

      {/* Section header */}
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {children}
    </div>
  );
}
