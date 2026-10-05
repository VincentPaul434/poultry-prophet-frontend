import { ArrowRight, ClipboardPenLine, FileCheck2, FolderOpen } from "lucide-react";

const journey = [
  { icon: ClipboardPenLine, label: "Handler logs", value: "Health observation" },
  { icon: FolderOpen, label: "Batch history", value: "Bisaya · 3 events" },
  { icon: FileCheck2, label: "Manager reviews", value: "Current report" },
];

export function RecordJourneyPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]" aria-label="Record journey from handler entry to manager review">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-overlay)] sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Mula record hanggang review</p>
            <p className="mt-1 text-sm text-muted-foreground">One event becomes part of a useful batch history.</p>
          </div>
          <span className="rounded-full border border-success-border bg-success-muted px-2 py-1 text-[10px] font-semibold text-success">Demo data</span>
        </div>

        <ol className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          {journey.map(({ icon: Icon, label, value }, index) => (
            <li key={label} className="contents">
              <div className="rounded-2xl border border-border bg-background p-4 transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-[var(--shadow-interactive-lift)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold tabular-nums text-primary/70">0{index + 1}</span>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
              </div>
              {index < journey.length - 1 && (
                <span className="mx-auto flex size-8 items-center justify-center text-warning md:mx-0">
                  <ArrowRight className="hidden size-5 md:block" aria-hidden="true" />
                  <span className="block h-5 border-l-2 border-dashed border-warning md:hidden" aria-hidden="true" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
