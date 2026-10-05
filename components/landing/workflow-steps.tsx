import { ClipboardPenLine, Database, FileCheck2 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: ClipboardPenLine,
    title: "Record",
    description: "I-record ng handler ang actual na nangyari sa tamang batch.",
  },
  {
    number: "02",
    icon: Database,
    title: "Organize",
    description: "Pinagdudugtong ng system ang history, products, population, at finance records.",
  },
  {
    number: "03",
    icon: FileCheck2,
    title: "Review",
    description: "Tinitingnan ng manager ang batch history bago gumawa ng farm decision.",
  },
];

export function WorkflowSteps() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-border bg-card/60 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Paano ito gumagana</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            From daily records to a clearer batch review.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Simple ang flow: i-record ang nangyari, ayusin ang history, at tulungan ang manager na makita ang importanteng facts.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map(({ number, icon: Icon, title, description }) => (
            <li key={number} className="relative rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold tabular-nums text-primary/70">{number}</span>
              </div>
              <h3 className="mt-5 text-base font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
