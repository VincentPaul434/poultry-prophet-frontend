import { ClipboardCheck, RefreshCw, Zap } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

const benefits = [
  { icon: Zap, title: "Tala agad", detail: "Sa tamang batch", color: "bg-[#f4bf55]" },
  { icon: RefreshCw, title: "Sync kusa", detail: "Pagbalik ng internet", color: "bg-[#dcebd8]" },
  { icon: ClipboardCheck, title: "Suri malinaw", detail: "History, gastos, bakuna", color: "bg-[#f5d8c9]" },
];

export function BenefitStrip() {
  return (
    <section className="bg-[#f7f1e7] px-4 py-10 sm:px-6 sm:py-14" aria-label="Pangunahing benepisyo">
      <div className="mx-auto grid w-full max-w-6xl gap-3 md:grid-cols-3">
        {benefits.map(({ icon: Icon, title, detail, color }, index) => (
          <Reveal key={title} delay={index * 90}>
            <div className="flex items-center gap-4 rounded-[1.75rem] border border-[#173d2a]/10 bg-white/75 p-4 shadow-[0_12px_35px_rgb(23_61_42_/_0.07)]">
              <span className={"flex size-12 shrink-0 items-center justify-center rounded-2xl text-[#173d2a] " + color}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-black tracking-tight text-[#173d2a]">{title}</p>
                <p className="text-sm font-medium text-[#617267]">{detail}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
