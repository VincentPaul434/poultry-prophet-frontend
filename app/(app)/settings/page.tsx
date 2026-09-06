"use client";

// Settings hub: a card per category. Manager-only categories are hidden from
// handlers. Each card links to its own /settings/<section> route.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SETTINGS_SECTIONS } from "@/components/settings/sections";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  const { isManager } = useAuth();
  const sections = SETTINGS_SECTIONS.filter((s) => !s.managerOnly || isManager);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Manage your account and farm configuration.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <Card key={s.key} className="group transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
            <Link href={s.href} className="block h-full">
              <CardContent className="flex h-full min-h-52 flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-xl">
                    {s.emoji}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <div className="mt-auto space-y-2">
                  <h2 className="text-lg font-bold">{s.title}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
