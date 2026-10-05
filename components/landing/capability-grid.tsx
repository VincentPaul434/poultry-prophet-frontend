import {
  ClipboardList,
  CloudCog,
  PackageCheck,
  WalletCards,
} from "lucide-react";

const capabilities = [
  {
    icon: ClipboardList,
    title: "Daily batch records",
    description: "Population changes, health observations, medicine, feed, and other farm events.",
  },
  {
    icon: CloudCog,
    title: "Batch history and review",
    description: "A traceable summary that keeps important facts connected to the batch and date.",
  },
  {
    icon: PackageCheck,
    title: "Products and inventory",
    description: "See what was used and keep product deductions connected to the farm record.",
  },
  {
    icon: WalletCards,
    title: "Recorded farm finance",
    description: "Track batch expenses, recorded income, and cash flow without pretending it is full accounting.",
  },
];

export function CapabilityGrid() {
  return (
    <section id="features" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Built for the farm workflow</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              The records your team already needs, connected in one place.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Hindi kailangan ng maraming bagong routine. Start with what the handler already sees and records.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {capabilities.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-[var(--shadow-interactive-lift)]">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-base font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
