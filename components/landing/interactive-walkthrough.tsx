"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CloudCheck,
  CloudOff,
  ClipboardCheck,
  ClipboardPenLine,
  PackageCheck,
  RefreshCw,
  Save,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DemoEvent = "health" | "population" | "product";

const steps = [
  {
    title: "I-record ang nangyari",
    short: "Piliin ang batch at ilagay ang actual na observation.",
    icon: ClipboardPenLine,
  },
  {
    title: "Inaayos at sini-sync",
    short: "Mananatili ang record sa phone hanggang bumalik ang connection.",
    icon: RefreshCw,
  },
  {
    title: "I-review bago magdesisyon",
    short: "Makikita ng manager ang importanteng history ng batch.",
    icon: ClipboardCheck,
  },
];

const eventOptions: Array<{ value: DemoEvent; label: string; detail: string }> = [
  { value: "health", label: "Health observation", detail: "1 health record" },
  { value: "population", label: "Population change", detail: "1 count update" },
  { value: "product", label: "Product used", detail: "1 product record" },
];

const eventResults: Record<DemoEvent, { saved: string; detail: string; updated: string; count: string }> = {
  health: {
    saved: "Health observation saved",
    detail: "Added to Batch Bisaya history.",
    updated: "Health records updated",
    count: "Manager report now shows 3 health events.",
  },
  population: {
    saved: "Population change saved",
    detail: "Added to Batch Bisaya history.",
    updated: "Population history updated",
    count: "Manager report now shows the latest count.",
  },
  product: {
    saved: "Product used saved",
    detail: "Added to Batch Bisaya history.",
    updated: "Product history updated",
    count: "Manager report now shows 3 product records.",
  },
};

function RecordScreen({ event }: { event: DemoEvent }) {
  const labels: Record<DemoEvent, string> = {
    health: "Health observation",
    population: "Population change",
    product: "Product used",
  };

  return (
    <div className="mx-auto max-w-[320px] rounded-[2rem] border-[6px] border-foreground bg-foreground p-1.5 shadow-[var(--shadow-overlay)]">
      <div className="overflow-hidden rounded-[1.5rem] bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-bold text-foreground">Record activity</span>
          </div>
          <span className="size-2 rounded-full bg-success" role="img" aria-label="Online" />
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Batch</p>
            <div className="mt-1 flex items-center justify-between rounded-xl border border-primary/40 bg-accent px-3 py-2.5">
              <span className="text-sm font-semibold text-foreground">Bisaya</span>
              <span className="text-xs text-primary">Ranging · Day 100</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ano ang nangyari?</p>
            <div className="mt-1 rounded-xl border border-warning bg-warning-muted px-3 py-2.5 ring-3 ring-warning/15">
              <span className="text-sm font-semibold text-warning-ink">{labels[event]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Date</p>
              <p className="text-xs font-semibold text-foreground">Today · automatic</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 text-xs text-muted-foreground">Short note from the handler</p>
          </div>
          <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground">
            <Save className="size-4" aria-hidden="true" />
            Save record
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncScreen() {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-overlay)] sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Connection status</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground">Saved, then synced.</h3>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-success-muted text-success"><CloudCheck className="size-5" aria-hidden="true" /></span>
      </div>
      <ol className="mt-5 space-y-3">
        <li className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Save className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">Saved on phone</p><p className="text-xs text-muted-foreground">Record is kept while offline.</p></div>
          <Check className="size-4 text-success" aria-hidden="true" />
        </li>
        <li className="flex items-center gap-3 rounded-2xl border border-warning-border bg-warning-muted p-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-background text-warning-ink"><CloudOff className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-warning-ink">Waiting for internet</p><p className="text-xs text-warning-ink/80">Nothing is lost while the signal is weak.</p></div>
          <RefreshCw className="size-4 text-warning-ink" aria-hidden="true" />
        </li>
        <li className="flex items-center gap-3 rounded-2xl border border-success-border bg-success-muted p-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-background text-success"><CloudCheck className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-success">Online · Synced</p><p className="text-xs text-success/80">Batch history is updated.</p></div>
          <Check className="size-4 text-success" aria-hidden="true" />
        </li>
      </ol>
    </div>
  );
}

function ReviewScreen() {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-overlay)] sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Manager review</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground">Bisaya · Current report</h3>
        </div>
        <span className="rounded-full border border-success-border bg-success-muted px-2 py-1 text-[10px] font-semibold text-success">Recorded data</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-background p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Population</p><p className="mt-1 text-xl font-bold text-foreground">100 / 200</p><p className="text-xs text-muted-foreground">birds alive</p></div>
        <div className="rounded-2xl border border-border bg-background p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Health records</p><p className="mt-1 text-xl font-bold text-foreground">3</p><p className="text-xs text-muted-foreground">in this batch</p></div>
        <div className="rounded-2xl border border-border bg-background p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Products</p><p className="mt-1 text-xl font-bold text-foreground">3</p><p className="text-xs text-muted-foreground">used records</p></div>
        <div className="rounded-2xl border border-border bg-background p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Net cash</p><p className="mt-1 text-xl font-bold text-foreground">₱0</p><p className="text-xs text-muted-foreground">recorded</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-accent p-3">
        <div className="flex items-center gap-2"><ClipboardCheck className="size-4 text-primary" aria-hidden="true" /><span className="text-xs font-semibold text-accent-foreground">Open full report</span></div>
        <ArrowRight className="size-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Based on recorded data and handler observations.</p>
    </div>
  );
}

function StepScreen({ step, event }: { step: number; event: DemoEvent }) {
  if (step === 0) return <RecordScreen event={event} />;
  if (step === 1) return <SyncScreen />;
  return <ReviewScreen />;
}

export function InteractiveWalkthrough() {
  const [activeStep, setActiveStep] = useState(0);
  const [event, setEvent] = useState<DemoEvent>("health");
  const selectedResult = eventResults[event];

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-walkthrough-step]"));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const nextStep = Number((visible.target as HTMLElement).dataset.walkthroughStep);
        if (Number.isInteger(nextStep)) setActiveStep(nextStep);
      },
      { threshold: [0.55], rootMargin: "-18% 0px -45% 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="walkthrough" className="scroll-mt-24 border-y border-border bg-card/60 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Paano gumagana</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Mula record hanggang review.</h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">Makikita mo ang actual flow bago mo kailangang gamitin ang system.</p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <ol className="space-y-4">
              {steps.map(({ title, short, icon: Icon }, index) => (
                <li key={title} data-walkthrough-step={index}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-current={activeStep === index ? "step" : undefined}
                    className={cn(
                      "group w-full rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      activeStep === index
                        ? "border-primary/40 bg-background shadow-[var(--shadow-interactive-lift)]"
                        : "border-border bg-transparent hover:border-primary/25 hover:bg-background/70",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200", activeStep === index ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-foreground">0{index + 1} · {title}</span>
                          {activeStep === index && <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Now</span>}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{short}</span>
                      </span>
                    </span>
                  </button>
                  <div className="mt-4 md:hidden">
                    <StepScreen step={index} event={event} />
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="hidden md:block">
            <div className="sticky top-28">
              <StepScreen step={activeStep} event={event} />
              <p className="mt-4 text-center text-xs text-muted-foreground">Based on a sample farm flow. No real data is saved.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-3xl border border-border bg-background p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Interactive demo</p>
              <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">Subukan ang isang sample record.</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Piliin ang event. Demo data lang ito at walang ise-save.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"><PackageCheck className="size-3.5" aria-hidden="true" />No data is saved</span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {eventOptions.map(({ value, label, detail }) => (
              <button
                type="button"
                key={value}
                onClick={() => setEvent(value)}
                aria-pressed={event === value}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  event === value ? "border-primary/50 bg-accent shadow-[var(--shadow-interactive-lift)]" : "border-border bg-card hover:border-primary/30",
                )}
              >
                <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-foreground">{label}</span>{event === value && <Check className="size-4 text-primary" aria-hidden="true" />}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-2xl border border-success-border bg-success-muted p-4"><p className="text-xs font-bold text-success">{selectedResult.saved}</p><p className="mt-1 text-xs text-success/80">{selectedResult.detail}</p></div>
            <ArrowRight className="mx-auto hidden size-5 text-warning md:block" aria-hidden="true" />
            <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-bold text-foreground">{selectedResult.updated}</p><p className="mt-1 text-xs text-muted-foreground">{selectedResult.count}</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
