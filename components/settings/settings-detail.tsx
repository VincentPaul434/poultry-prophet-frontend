"use client";

// Shared shell for a single settings section. Renders the breadcrumb and the
// section header, guards manager-only sections, and fades the content in. The
// detail route pages just wrap their content in this.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBackLink } from "@/components/page-back-link";
import { PageHeader } from "@/components/page-header";
import { getSection, type SettingsSectionKey } from "./sections";
import { useLocale } from "@/components/locale-provider";

export function SettingsDetailShell({
  section,
  children,
}: {
  section: SettingsSectionKey;
  children: React.ReactNode;
}) {
  const meta = getSection(section);
  const { t } = useLocale();
  const { isManager, isLoading } = useAuth();
  const router = useRouter();

  const blocked = meta.managerOnly && !isManager;

  // A handler who deep-links to a manager-only section is sent back to the hub.
  useEffect(() => {
    if (!isLoading && blocked) router.replace("/settings");
  }, [isLoading, blocked, router]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <PageBackLink destination="settings" />
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (blocked) return null;

  const Icon = meta.icon;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 duration-300 animate-in fade-in slide-in-from-bottom-2">
      <PageBackLink destination="settings" />

      <PageHeader
        icon={Icon}
        title={section === "preferences" ? t("settings.preferences") : meta.title}
        description={section === "preferences" ? t("settings.preferencesDescription") : meta.description}
        titleClassName="text-2xl sm:text-3xl"
        descriptionClassName="mt-1 max-w-2xl leading-relaxed"
        className="rounded-2xl border bg-card p-5 sm:p-6"
      />

      {children}
    </div>
  );
}
