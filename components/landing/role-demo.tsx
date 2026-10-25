"use client";

import { useState } from "react";
import { BarChart3, Check, ClipboardPenLine, CloudCheck, History, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";

const roles = {
  handler: {
    label: "Handler",
    eyebrow: "Trabaho ngayon",
    title: "Tatlong gawain na lang.",
    subtitle: "Piliin. Itala. Markahan na tapos.",
    icon: ClipboardPenLine,
    stats: [["Ngayon", "3"], ["Late", "1"], ["Na-sync", "12"]],
    actions: ["Pakainin ang Batch 012", "Ibigay ang Newcastle vaccine", "Suriin ang inumin"],
    accent: "bg-[#f4bf55]",
  },
  manager: {
    label: "Manager",
    eyebrow: "Farm overview",
    title: "Alam kung ano ang dapat tingnan.",
    subtitle: "Batch, gastos, health, at alerts—magkakaugnay.",
    icon: BarChart3,
    stats: [["Buhay", "420"], ["Alerts", "2"], ["Net", "₱19k"]],
    actions: ["Review health concern", "Suriin ang batch cost", "Buksan ang weekly report"],
    accent: "bg-[#a9d6b1]",
  },
} as const;

export function RoleDemo() {
  const [role, setRole] = useState<keyof typeof roles>("handler");
  const active = roles[role];
  const Icon = active.icon;

  return (
    <section id="roles" className="scroll-mt-24 px-3 py-5 sm:px-5" aria-labelledby="roles-heading">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-[#eddfc9] lg:grid-cols-[0.75fr_1.25fr] sm:rounded-[2.75rem]">
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9b6811]">Dalawang role</p>
          <h2 id="roles-heading" className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
            Iba ang trabaho.
            <span className="block text-[#cc7d2e]">Iisa ang record.</span>
          </h2>
          <p className="mt-5 max-w-md text-base font-semibold leading-7 text-[#617267]">
            Simple para sa handler. Kumpleto para sa manager.
          </p>

          <div className="mt-7 inline-flex w-fit rounded-full border border-[#173d2a]/10 bg-white/55 p-1" role="group" aria-label="Pumili ng role">
            {(Object.keys(roles) as Array<keyof typeof roles>).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setRole(value)}
                aria-pressed={role === value}
                className={cn(
                  "min-h-11 rounded-full px-5 text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#173d2a]/25",
                  role === value ? "bg-[#173d2a] text-white shadow-lg" : "text-[#617267] hover:text-[#173d2a]",
                )}
              >
                {roles[value].label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-[31rem] overflow-hidden bg-[#173d2a] p-5 sm:p-9 lg:p-12">
          <div className="landing-paper-grid absolute inset-0 opacity-15" aria-hidden="true" />
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-[#f4bf55]/15 blur-3xl" aria-hidden="true" />
          <div key={role} className="relative mx-auto max-w-2xl animate-[landing-slide-in_360ms_ease-out] rounded-[2rem] bg-[#fffdf8] p-5 text-[#173d2a] shadow-[0_30px_70px_rgb(0_0_0_/_0.3)] motion-reduce:animate-none sm:p-7" aria-live="polite">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#617267]">{active.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{active.title}</h3>
                <p className="mt-2 text-sm font-semibold text-[#617267]">{active.subtitle}</p>
              </div>
              <span className={`${active.accent} flex size-12 shrink-0 items-center justify-center rounded-2xl`}><Icon className="size-6" aria-hidden="true" /></span>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2">
              {active.stats.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#edf3e8] p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#617267]">{label}</p>
                  <p className="mt-1 text-xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {active.actions.map((action, index) => (
                <div key={action} className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#173d2a]/10 bg-white px-4">
                  <span className={`${index === 0 ? active.accent : "bg-[#edf3e8]"} flex size-8 shrink-0 items-center justify-center rounded-xl`}>
                    {index === 1 ? <Syringe className="size-4" aria-hidden="true" /> : index === 2 ? <History className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                  </span>
                  <p className="text-sm font-bold">{action}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#4d735b]">
              <CloudCheck className="size-4" aria-hidden="true" />
              Parehong updated ang records
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
