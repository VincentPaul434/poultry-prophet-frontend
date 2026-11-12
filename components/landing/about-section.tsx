import Image from "next/image";
import Link from "next/link";
import { Check, ClipboardCheck, CloudOff, NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    icon: NotebookPen,
    title: "Mabilis na pag-record",
    text: "Ilang tap lang para sa obserbasyon, gamot, patay, o paggamit ng feeds.",
  },
  {
    icon: ClipboardCheck,
    title: "Review na may pinagmulan",
    text: "Bawat numero sa report ay nakaturo sa orihinal na tala.",
  },
];

const CHECKS = [
  "Hindi nawawala ang entry kahit offline",
  "May audit trail ang bawat pagtatama",
  "Hiwalay at protektado ang data ng bawat farm",
];

export function AboutSection() {
  return (
    <section id="tungkol" aria-labelledby="about-title" className="scroll-mt-[72px] bg-(--pp-paper) py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1320px] items-center gap-16 px-4 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <Reveal>
        <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[560px]">
          <div className="absolute left-0 top-0 h-[68%] w-[62%] overflow-hidden rounded-2xl">
            <Image
              src="/landing/about-owner.webp"
              alt="May-ari ng farm na sinusuri ang records sa tablet"
              fill
              sizes="(min-width: 1024px) 340px, 60vw"
              className="object-cover"
            />
          </div>
          <div className="absolute bottom-0 right-0 h-[60%] w-[64%] overflow-hidden rounded-2xl ring-8 ring-(--pp-paper)">
            <Image
              src="/landing/about-feeding.webp"
              alt="Handler na nagpapakain ng manok sa tabi ng kulungan"
              fill
              sizes="(min-width: 1024px) 360px, 62vw"
              className="object-cover"
            />
          </div>
          <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute -left-6 bottom-[10%] w-[34%]" fill="none">
            <path d="M8 40 C 40 160, 120 10, 190 150" stroke="var(--pp-lime)" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <Card className="absolute right-[2%] top-[6%] w-36 rounded-2xl border-0 bg-white py-0 shadow-[0_18px_40px_rgb(20_51_32/0.14)] sm:right-[6%] sm:top-[14%] sm:w-44">
            <CardContent className="flex flex-col items-start gap-1.5 p-4 sm:gap-2 sm:p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-(--pp-lime) text-(--pp-green) sm:size-10">
                <CloudOff className="size-4 sm:size-5" aria-hidden="true" />
              </span>
              <p className="text-xl font-semibold tracking-[-0.02em] text-(--pp-ink) sm:text-2xl">Offline</p>
              <p className="text-[13px] leading-5 text-(--pp-ink)/70 sm:text-sm">Nagre-record kahit walang signal</p>
            </CardContent>
          </Card>
        </div>
        </Reveal>

        <Reveal delay={120}>
          <Badge variant="outline" className="h-8 rounded-full border-(--pp-green)/25 bg-(--pp-mist) px-4 text-sm font-normal text-(--pp-green)">
            Tungkol sa Poultry Prophet
          </Badge>
          <h2 id="about-title" className="mt-5 text-balance text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-(--pp-green)">
            Bawat batch, may malinaw at buong kasaysayan
          </h2>

          <div className="mt-9 grid gap-7 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-(--pp-green)/20 bg-(--pp-mist) text-(--pp-green)">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.01em] text-(--pp-ink)">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-6 text-(--pp-ink)/70">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-9 max-w-[62ch] text-[15px] leading-7 text-(--pp-ink)/75">
            Ang handler ang nagtatala sa farm; ang manager ang nagre-review at nagpapasya. Pinagsasama ng Poultry
            Prophet ang health history, imbentaryo, at gastos ng bawat batch sa iisang malinaw na report, para ang
            desisyon ay nakabase sa totoong tala.
          </p>

          <ul className="mt-7 grid gap-3">
            {CHECKS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[15px] text-(--pp-ink)">
                <span className="flex size-6 items-center justify-center rounded-full bg-(--pp-lime) text-(--pp-green)">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <Link
            href="/register"
            className={cn(buttonVariants(), "mt-10 h-12 rounded-full border border-(--pp-green) bg-(--pp-lime) px-7 text-base font-medium text-(--pp-green) hover:bg-(--pp-lime-strong)")}
          >
            Gumawa ng account
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

