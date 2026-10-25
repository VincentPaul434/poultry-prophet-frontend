import Link from "next/link";
import { ArrowRight, Bird } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

export function LandingCta() {
  return (
    <section className="px-3 pb-5 sm:px-5" aria-labelledby="cta-heading">
      <Reveal>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#cc7d2e] px-6 py-16 text-[#fffdf8] sm:rounded-[2.75rem] sm:px-10 sm:py-24">
          <div className="absolute -right-16 -top-16 size-72 rounded-full border-[48px] border-[#f4bf55]/25" aria-hidden="true" />
          <div className="absolute -bottom-28 -left-20 size-80 rounded-full bg-[#173d2a]/14" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#173d2a] text-white shadow-xl">
              <Bird className="size-7" aria-hidden="true" />
            </span>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#fff4d5]">Simulan sa isang malinaw na tala</p>
            <h2 id="cta-heading" className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              Handa na ang farm mo?
            </h2>
            <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Link href="/register" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#f4bf55] px-6 text-sm font-black text-[#173d2a] shadow-xl transition-transform hover:-translate-y-1">
                Gumawa ng account
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition-colors hover:bg-white/18">
                Mag-sign in
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
