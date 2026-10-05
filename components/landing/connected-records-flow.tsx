import { ArrowRight, CircleDollarSign, ClipboardCheck, HeartPulse, PackageCheck, UsersRound } from "lucide-react";

const records = [
  { icon: UsersRound, label: "Population" },
  { icon: HeartPulse, label: "Health events" },
  { icon: PackageCheck, label: "Products used" },
  { icon: CircleDollarSign, label: "Recorded finance" },
];

export function ConnectedRecordsFlow() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">One batch, connected records</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Hindi lang charts. May pinanggalingang record.</h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">Ang importanteng farm information ay nananatiling connected sa batch, petsa, at source record.</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              {records.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3"><Icon className="size-4 text-primary" aria-hidden="true" /><span className="text-xs font-semibold text-foreground">{label}</span></div>
              ))}
            </div>
            <ArrowRight className="mx-auto hidden size-5 text-warning md:block" aria-hidden="true" />
            <div className="rounded-2xl border-2 border-primary/30 bg-accent p-5 text-center shadow-[var(--shadow-interactive-lift)]"><div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ClipboardCheck className="size-5" aria-hidden="true" /></div><p className="mt-3 text-sm font-bold text-accent-foreground">Batch history</p><p className="mt-1 text-xs text-accent-foreground/75">Bisaya · Day 100</p></div>
            <ArrowRight className="mx-auto hidden size-5 text-warning md:block" aria-hidden="true" />
            <div className="rounded-2xl border border-success-border bg-success-muted p-5 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-success text-success-foreground"><ClipboardCheck className="size-5" aria-hidden="true" /></div><p className="mt-3 text-sm font-bold text-success">Manager review</p><p className="mt-1 text-xs text-success/80">Current report</p></div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground md:hidden"><span className="h-5 border-l-2 border-dashed border-warning" aria-hidden="true" /><span>Records feed the batch history</span></div>
        </div>
      </div>
    </section>
  );
}
