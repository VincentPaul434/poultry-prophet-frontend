import { BarChart3, ClipboardList, History, Syringe, WalletCards } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

const views = [
  {
    icon: ClipboardList,
    number: "01",
    eyebrow: "Handler",
    title: "Gawin. I-record. Tapos.",
    tags: ["Gawain", "Record", "Bakuna"],
    color: "bg-[#f4bf55]",
  },
  {
    icon: BarChart3,
    number: "02",
    eyebrow: "Manager",
    title: "Suriin bago magdesisyon.",
    tags: ["Batch", "Finance", "Report"],
    color: "bg-[#dcebd8]",
  },
  {
    icon: History,
    number: "03",
    eyebrow: "Traceability",
    title: "Balikan ang buong kuwento.",
    tags: ["Event", "Alert", "Audit"],
    color: "bg-[#f5d8c9]",
  },
];

export function CapabilityGrid() {
  return (
    <section id="features" className="scroll-mt-24 bg-[#fffdf8] px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="features-heading">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9b6811]">Simple sa bawat role</p>
              <h2 id="features-heading" className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
                Isang sistema.
                <span className="block text-[#cc7d2e]">Tamang view sa tamang tao.</span>
              </h2>
            </div>
            <div className="flex gap-2 text-[#173d2a]/65" aria-hidden="true">
              <Syringe className="size-5" />
              <WalletCards className="size-5" />
              <History className="size-5" />
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {views.map(({ icon: Icon, number, eyebrow, title, tags, color }, index) => (
            <Reveal key={eyebrow} delay={index * 100}>
              <article className={`${color} group min-h-[21rem] rounded-[2.25rem] p-6 transition-transform duration-300 hover:-translate-y-2 sm:p-7`}>
                <div className="flex items-start justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/65"><Icon className="size-6" aria-hidden="true" /></span>
                  <span className="text-6xl font-black tracking-[-0.08em] text-[#173d2a]/10">{number}</span>
                </div>
                <p className="mt-12 text-xs font-black uppercase tracking-[0.18em] text-[#173d2a]/55">{eyebrow}</p>
                <h3 className="mt-2 text-2xl font-black leading-tight tracking-tight">{title}</h3>
                <div className="mt-6 flex flex-wrap gap-2">
                  {tags.map((tag) => <span key={tag} className="rounded-full bg-white/60 px-3 py-2 text-xs font-black">{tag}</span>)}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
