import { ClipboardCheck, HandCoins, Smartphone } from "lucide-react";

const benefits = [
  { icon: Smartphone, title: "Mabilis mag-record", detail: "Direct actions sa tamang batch" },
  { icon: ClipboardCheck, title: "Reviewable history", detail: "Records connected by date" },
  { icon: HandCoins, title: "Kasama ang finance", detail: "Products, expenses, at income" },
];

export function BenefitStrip() {
  return (
    <section className="border-b border-border bg-card/70" aria-label="Key benefits">
      <div className="mx-auto grid w-full max-w-6xl divide-y divide-border px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
        {benefits.map(({ icon: Icon, title, detail }) => (
          <div key={title} className="flex items-center gap-3 py-4 md:px-6 md:py-5 first:md:pl-0 last:md:pr-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
