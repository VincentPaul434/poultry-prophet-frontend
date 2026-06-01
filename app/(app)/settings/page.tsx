"use client";

// Settings hub: a card per category. Manager-only categories are hidden from
// handlers. Each card links to its own /settings/<section> route.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SETTINGS_SECTIONS } from "@/components/settings/sections";

export default function SettingsPage() {
  const { isManager } = useAuth();
  const sections = SETTINGS_SECTIONS.filter((s) => !s.managerOnly || isManager);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your account and farm configuration.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className="group flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-xl">
                {s.emoji}
              </span>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold">{s.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
