import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-(--pp-green-deep) text-white">
      <Image
        src="/landing/hero.webp"
        alt="Isang farm handler na nagre-record sa phone sa gitna ng gamefowl farm"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[70%_center] animate-in fade-in zoom-in-105 duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(14_38_23/0.92)_0%,rgb(14_38_23/0.7)_42%,rgb(14_38_23/0.15)_75%),linear-gradient(0deg,rgb(14_38_23/0.75)_0%,transparent_45%)]"
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 760"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full md:block"
        fill="none"
      >
        <path
          className="pp-draw"
          pathLength={1}
          d="M-40 715 C 180 765, 360 650, 540 680 S 790 760, 845 560 S 860 170, 1010 -20"
          stroke="var(--pp-lime)"
          strokeOpacity="0.85"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      <div className="mx-auto flex min-h-[min(86svh,780px)] max-w-[1320px] flex-col justify-center px-4 pb-36 pt-16 sm:px-8 sm:pb-44">
        <div className="max-w-2xl">
          <Badge
            variant="outline"
            className="h-8 rounded-full border-white/30 bg-white/10 px-4 text-sm font-normal text-white backdrop-blur-sm animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          >
            Farm records para sa gamefowl breeders
          </Badge>
          <h1
            id="hero-title"
            className="mt-6 text-balance text-[clamp(2.6rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.035em] animate-in fade-in slide-in-from-bottom-5 fill-mode-both delay-100 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          >
            Malinaw na tala, mula kulungan hanggang report
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-white/80 animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-200 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
            Mag-record ng batch, kalusugan, gamot, at gastos kahit walang signal. Pagbalik ng internet, kusang
            magsi-sync at handa na para sa review ng manager.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-300 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <Link
              href="/register"
              className={cn(buttonVariants(), "h-12 rounded-full border border-(--pp-lime) bg-(--pp-lime) px-7 text-base font-medium text-(--pp-green) hover:bg-(--pp-lime-strong)")}
            >
              Magsimula nang libre
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
            <a
              href="#tungkol"
              className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-full border-white/50 bg-transparent px-7 text-base font-normal text-white hover:bg-white/10 hover:text-white")}
            >
              Alamin kung paano
            </a>
          </div>
        </div>
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-[0.18em] select-none text-center text-[clamp(5rem,19vw,17rem)] font-bold leading-none tracking-[-0.03em] text-white/20 mix-blend-overlay [-webkit-text-stroke:1px_rgb(255_255_255/0.35)] animate-in fade-in slide-in-from-bottom-8 fill-mode-both delay-500 duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        MANUKAN
      </p>
    </section>
  );
}

