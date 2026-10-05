import {
  ArrowUpRight,
  ClipboardCheck,
  CloudOff,
  FileText,
  Leaf,
  WalletCards,
} from "lucide-react";

function MiniStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-label="Example Poultry Prophet batch review screen using demo data">
      <div className="absolute -left-3 top-10 hidden items-center gap-2 rounded-full border border-success-border bg-success-muted px-3 py-2 text-xs font-semibold text-success shadow-sm sm:flex">
        <CloudOff className="size-3.5" aria-hidden="true" />
        Offline-ready
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-[var(--shadow-overlay)] sm:p-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Leaf className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Batch review</p>
              <p className="text-[11px] text-muted-foreground">Demo data · Bisaya</p>
            </div>
          </div>
          <span className="rounded-full border border-success-border bg-success-muted px-2 py-1 text-[10px] font-semibold text-success">
            Ready to review
          </span>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-foreground">Bisaya</p>
            <p className="text-xs text-muted-foreground">Ranging · Day 100</p>
          </div>
          <span className="rounded-lg bg-muted px-2.5 py-1.5 text-right text-[10px] font-semibold text-muted-foreground">
            Recorded
            <span className="block text-foreground">Sep 2026</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Population" value="100 / 200" note="birds alive" />
          <MiniStat label="Health events" value="2" note="recorded" />
          <MiniStat label="Products" value="3" note="used records" />
          <MiniStat label="Net cash" value="₱0" note="recorded" />
        </div>

        <div className="mt-3 rounded-xl border border-border bg-muted/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
              <p className="text-xs font-semibold text-foreground">Review before selection</p>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Check the recorded batch history together with the handler&apos;s observation.
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate text-xs font-medium text-foreground">Current batch report</span>
          </div>
          <WalletCards className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
