"use client";

import { useState } from "react";
import { ArrowRight, Check, CircleDollarSign, HeartPulse, PackageCheck, Sparkles, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";

type ProcessScenario = "sale" | "product" | "health" | "vaccine";

const scenarios = {
  sale: {
    label: "Benta",
    icon: CircleDollarSign,
    input: "10 inahin ang naibenta",
    context: "₱5,000 • Batch Bisaya",
    steps: ["Suriin ang bilang", "Bawas sa inahin", "Ipasok ang kita"],
    outputs: [["Populasyon", "−10"], ["Kita", "+₱5,000"], ["History", "Naka-link"]],
  },
  product: {
    label: "Gamit",
    icon: PackageCheck,
    input: "4 bitamina ang ginamit",
    context: "₱75 bawat unit",
    steps: ["Suriin ang stock", "Bawas ng 4 unit", "Kwentahin ang cost"],
    outputs: [["Stock", "−4"], ["Batch cost", "₱300"], ["History", "Naka-save"]],
  },
  health: {
    label: "Kalusugan",
    icon: HeartPulse,
    input: "Namamaga ang mukha",
    context: "Obserbasyon • Walang namatay",
    steps: ["Iuri ang concern", "I-save sa history", "Suriin ang alert"],
    outputs: [["Populasyon", "Walang bawas"], ["Health", "+1 event"], ["Review", "May follow-up"]],
  },
  vaccine: {
    label: "Bakuna",
    icon: Syringe,
    input: "Newcastle vaccine naibigay",
    context: "Aktuwal na petsa naitala",
    steps: ["Itugma sa schedule", "Itala ang gumawa", "I-update ang timeline"],
    outputs: [["Schedule", "Tapos"], ["Timeline", "+1 event"], ["Report", "Updated"]],
  },
} as const;

const scenarioOrder: ProcessScenario[] = ["sale", "product", "health", "vaccine"];

export function SystemProcessDemo() {
  const [selected, setSelected] = useState<ProcessScenario>("sale");
  const scenario = scenarios[selected];
  const Icon = scenario.icon;

  return (
    <section id="process" className="scroll-mt-24 px-3 py-5 sm:px-5" aria-labelledby="process-heading">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#173d2a] px-5 py-14 text-white shadow-[0_28px_80px_rgb(23_61_42_/_0.18)] sm:rounded-[2.75rem] sm:px-9 sm:py-20 lg:px-14">
        <div className="absolute -right-32 -top-32 size-96 rounded-full bg-[#f4bf55]/12 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4bf55]">Tala → Proseso → Resulta</p>
              <h2 id="process-heading" className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
                Hindi lang sine-save.
                <span className="block text-[#a9d6b1]">Pinoproseso ang data.</span>
              </h2>
            </div>

            <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Mga halimbawa ng proseso">
              {scenarioOrder.map((key) => {
                const item = scenarios[key];
                const ItemIcon = item.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={selected === key}
                    onClick={() => setSelected(key)}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#f4bf55]/60",
                      selected === key
                        ? "border-[#f4bf55] bg-[#f4bf55] text-[#173d2a]"
                        : "border-white/15 bg-white/8 text-white/75 hover:bg-white/14 hover:text-white",
                    )}
                  >
                    <ItemIcon className="size-4" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={selected}
            className="mt-10 grid gap-3 animate-[landing-slide-in_360ms_ease-out] lg:grid-cols-[0.9fr_auto_1fr_auto_1.3fr] lg:items-stretch motion-reduce:animate-none"
            aria-live="polite"
          >
            <article className="rounded-[1.75rem] bg-[#fffdf8] p-5 text-[#173d2a] sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6b7c71]">01 • Tala</span>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f4bf55]"><Icon className="size-5" aria-hidden="true" /></span>
              </div>
              <h3 className="mt-8 text-2xl font-black tracking-tight">{scenario.input}</h3>
              <p className="mt-2 text-sm font-semibold text-[#6b7c71]">{scenario.context}</p>
            </article>

            <div className="hidden items-center justify-center lg:flex"><ArrowRight className="size-6 text-[#f4bf55]" aria-hidden="true" /></div>

            <article className="rounded-[1.75rem] bg-[#f4bf55] p-5 text-[#173d2a] sm:p-6">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]"><Sparkles className="size-4" aria-hidden="true" />02 • Proseso</div>
              <ol className="mt-6 space-y-3">
                {scenario.steps.map((step, index) => (
                  <li key={step} className="flex items-center gap-3 rounded-xl bg-white/45 px-3 py-3 text-sm font-bold">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#173d2a] text-xs text-white">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </article>

            <div className="hidden items-center justify-center lg:flex"><ArrowRight className="size-6 text-[#a9d6b1]" aria-hidden="true" /></div>

            <article className="rounded-[1.75rem] bg-[#dcebd8] p-5 text-[#173d2a] sm:p-6">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]"><Check className="size-4" aria-hidden="true" />03 • Resulta</div>
              <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {scenario.outputs.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/75 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#617267]">{label}</p>
                    <p className="mt-2 text-lg font-black leading-tight">{value}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <p className="mt-5 text-xs font-medium text-white/45">Halimbawa lamang—walang totoong farm record na binabago.</p>
        </div>
      </div>
    </section>
  );
}
