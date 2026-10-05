import { ClipboardPenLine, Eye, ShieldCheck } from "lucide-react";

export function RoleSummary() {
  return (
    <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
        <article className="rounded-2xl border border-border bg-card p-6 sm:p-7">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ClipboardPenLine className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">Para sa handler</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">Mabilis na pag-record sa batch.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Malalaki at direct ang actions para sa araw-araw na trabaho. May malinaw na status kung na-save na o naghihintay pa ng connection.
          </p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 sm:p-7">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Eye className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">Para sa manager</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">Mas malinaw na review bago magdesisyon.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Makikita ang batch history, population, health-related records, products, at finances sa isang reviewable summary.
          </p>
        </article>
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-6xl items-start gap-3 px-4 sm:px-6 lg:px-8">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
          Ang Poultry Prophet ay decision-support tool lamang. Hindi ito nagdi-diagnose ng disease, pumipili ng individual bird, o nagpo-predict ng future performance.
        </p>
      </div>
    </section>
  );
}
