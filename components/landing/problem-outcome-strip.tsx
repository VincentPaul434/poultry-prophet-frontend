import { ArrowRight, Coins, NotebookPen, WifiOff } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

const changes = [
  { icon: NotebookPen, before: "Kalat-kalat na notes", after: "Isang batch history", color: "bg-[#f4bf55]" },
  { icon: WifiOff, before: "Walang signal", after: "Tala pa rin", color: "bg-[#dcebd8]" },
  { icon: Coins, before: "Hula sa gastos", after: "Kita ang records", color: "bg-[#f5d8c9]" },
];

export function ProblemOutcomeStrip() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="outcomes-heading">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9b6811]">Dati → Ngayon</p>
            <h2 id="outcomes-heading" className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
              Mula kalat-kalat,
              <span className="block text-[#cc7d2e]">papunta sa malinaw.</span>
            </h2>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {changes.map(({ icon: Icon, before, after, color }, index) => (
            <Reveal key={before} delay={index * 100}>
              <article className={`${color} group min-h-56 rounded-[2rem] p-6 transition-transform duration-300 hover:-translate-y-2 sm:p-7`}>
                <div className="flex items-start justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/65">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="text-5xl font-black text-[#173d2a]/12">0{index + 1}</span>
                </div>
                <div className="mt-8 flex items-center gap-3">
                  <span className="text-sm font-bold text-[#173d2a]/55 line-through decoration-2">{before}</span>
                  <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
                <h3 className="mt-2 text-2xl font-black tracking-tight">{after}</h3>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
