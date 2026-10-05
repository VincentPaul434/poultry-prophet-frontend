"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, ClipboardPenLine, CloudCheck, FileText, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const roles = {
  handler: {
    label: "Handler",
    title: "Mabilis na pag-record sa batch.",
    description: "Malalaki at direct ang actions para sa araw-araw na trabaho.",
    items: ["Open batch", "Record what happened", "Check assigned tasks", "Confirm synchronization"],
    icon: ClipboardPenLine,
  },
  manager: {
    label: "Manager",
    title: "Mas malinaw na review bago magdesisyon.",
    description: "Makikita ang importanteng history nang hindi naghahanap sa maraming record.",
    items: ["Review batch history", "Check population and health records", "Review products and finances", "Open the batch report"],
    icon: ClipboardCheck,
  },
} as const;

export function RoleDemo() {
  const [role, setRole] = useState<keyof typeof roles>("handler");
  const active = roles[role];
  const Icon = active.icon;

  return (
    <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[0.85fr_1.15fr] md:items-center lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Para sa farm team</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Iba ang trabaho, iisa ang record.</h2>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">Handler ang nagre-record. Manager ang nagre-review. Pareho silang nakakakita ng tamang farm context.</p>
          <div className="mt-6 inline-flex rounded-2xl border border-border bg-card p-1" role="group" aria-label="Choose a role to preview">
            {(Object.keys(roles) as Array<keyof typeof roles>).map((value) => (
              <button type="button" key={value} onClick={() => setRole(value)} aria-pressed={role === value} className={cn("min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50", role === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{roles[value].label}</button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-overlay)] sm:p-7">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Icon className="size-6" aria-hidden="true" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{active.label} view</p><h3 className="mt-1 text-xl font-bold tracking-tight text-foreground">{active.title}</h3><p className="mt-2 text-sm text-muted-foreground">{active.description}</p></div>
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {active.items.map((item) => <li key={item} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-medium text-foreground"><CheckCircle2 className="size-4 text-primary" aria-hidden="true" />{item}</li>)}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5"><CloudCheck className="size-3.5 text-primary" aria-hidden="true" />Sync status</span><span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5"><FileText className="size-3.5 text-primary" aria-hidden="true" />Batch records</span><span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5"><WalletCards className="size-3.5 text-primary" aria-hidden="true" />Farm context</span></div>
        </div>
      </div>
    </section>
  );
}
