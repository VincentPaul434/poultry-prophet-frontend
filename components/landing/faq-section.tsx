import Image from "next/image";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/landing/reveal";

const FAQS = [
  {
    q: "Gumagana ba kahit walang internet?",
    a: "Oo. Naka-save muna sa device ang mga entry at awtomatikong ipinapadala pagbalik ng signal, na may proteksyon laban sa dobleng tala.",
  },
  {
    q: "Sino ang puwedeng gumamit sa isang farm?",
    a: "Ang manager o may-ari at ang mga handler. May sariling access ang bawat papel, at hindi nakikita ng ibang farm ang inyong data.",
  },
  {
    q: "Ano ang laman ng batch report?",
    a: "Ang health history, populasyon, gamot at feeds na nagamit, imbentaryo, at nakatalang gastos at kita, kasama ang pinagmulang tala ng bawat numero.",
  },
  {
    q: "Nagda-diagnose ba ito ng sakit o pumipili ng manok?",
    a: "Hindi. Tumutulong ito sa pagtingin ng ebidensya, pero ang diagnosis at pagpili ay nananatili sa karanasan ng tao.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-[72px] bg-(--pp-paper) py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <Reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Badge variant="outline" className="h-8 rounded-full border-(--pp-green)/25 bg-(--pp-mist) px-4 text-sm font-normal text-(--pp-green)">
              FAQ
            </Badge>
            <h2 id="faq-title" className="mt-5 text-balance text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-(--pp-green)">
              Mga madalas itanong
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-7 text-(--pp-ink)/70">
            Bago magsimula, narito ang mga sagot sa mga karaniwang tanong ng mga farm owner at handler.
          </p>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
          <Accordion defaultValue={[FAQS[0].q]} className="gap-4">
            {FAQS.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={item.q}
                className="rounded-3xl border border-(--pp-green)/20 bg-white px-6 transition-colors not-last:border-b data-open:border-(--pp-lime-strong) data-open:bg-(--pp-lime)"
              >
                <AccordionTrigger className="gap-4 py-5 text-base font-medium text-(--pp-ink) hover:no-underline **:data-[slot=accordion-trigger-icon]:size-7 **:data-[slot=accordion-trigger-icon]:rounded-full **:data-[slot=accordion-trigger-icon]:bg-(--pp-mist) **:data-[slot=accordion-trigger-icon]:p-1.5 **:data-[slot=accordion-trigger-icon]:text-(--pp-green)">
                  <span className="flex items-baseline gap-4">
                    <span className="w-6 text-sm tabular-nums text-(--pp-green)/60">{String(index + 1).padStart(2, "0")}</span>
                    {item.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pl-10 text-[15px] leading-7 text-(--pp-ink)/80">
                  <p>{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          </Reveal>

          <Reveal delay={140} className="h-full">
          <div className="relative h-full min-h-80 overflow-hidden rounded-2xl">
            <Image
              src="/landing/faq.webp"
              alt="Dalawang farm worker na sinusuri ang tala sa phone at notebook"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
