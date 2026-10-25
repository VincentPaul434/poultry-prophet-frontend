import { Check, MessageCircleMore } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

const findings = [
  "History ng bakuna",
  "Bilang ng lalaki at babae",
  "Finance at event history",
];

export function ValidationTrust() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="validation-heading">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <article className="relative min-h-[27rem] overflow-hidden rounded-[2.25rem] bg-[#f4bf55] p-7 sm:p-10">
            <MessageCircleMore className="absolute -bottom-8 -right-6 size-64 text-[#173d2a]/7" aria-hidden="true" />
            <p className="relative text-xs font-black uppercase tracking-[0.2em] text-[#71500e]">Mula sa MVP validation</p>
            <h2 id="validation-heading" className="relative mt-5 max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.05em] sm:text-6xl">
              “Ito ang kailangan naming makita.”
            </h2>
            <p className="relative mt-6 max-w-xl text-base font-bold leading-7 text-[#173d2a]/65">
              Ang feedback ng farm team ang humubog sa workflow.
            </p>
          </article>
        </Reveal>

        <div className="grid gap-3">
          {findings.map((finding, index) => (
            <Reveal key={finding} delay={index * 90}>
              <article className="flex min-h-28 items-center gap-4 rounded-[1.75rem] border border-[#173d2a]/10 bg-white/75 p-5 sm:p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#dcebd8]">
                  <Check className="size-5" aria-hidden="true" />
                </span>
                <p className="text-lg font-black tracking-tight sm:text-xl">{finding}</p>
              </article>
            </Reveal>
          ))}
          <p className="px-2 pt-2 text-xs font-semibold leading-5 text-[#617267]">
            Ginagabayan ng feedback ang sistema—hindi nito pinapalitan ang karanasan ng farm at beterinaryo.
          </p>
        </div>
      </div>
    </section>
  );
}
