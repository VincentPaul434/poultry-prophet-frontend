import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    image: "/landing/role-owner.webp",
    alt: "May-ari ng gamefowl farm",
    role: "May-ari",
    text: "Nakikita ang kalagayan, gastos, at kita ng buong farm.",
  },
  {
    image: "/landing/role-manager.webp",
    alt: "Farm manager na may hawak na clipboard",
    role: "Manager / Breeder",
    text: "Nagre-review ng batch report at nag-aapruba ng benta.",
    featured: true,
  },
  {
    image: "/landing/role-handler.webp",
    alt: "Farm handler na may dalang feeds",
    role: "Handler",
    text: "Nagtatala ng araw-araw na gawain, kahit offline.",
  },
];

export function RolesSection() {
  return (
    <section id="para-kanino" aria-labelledby="roles-title" className="scroll-mt-[72px] bg-(--pp-mist) py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <Reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Badge variant="outline" className="h-8 rounded-full border-(--pp-green)/25 bg-white/60 px-4 text-sm font-normal text-(--pp-green)">
              Para kanino
            </Badge>
            <h2 id="roles-title" className="mt-5 max-w-xl text-balance text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-(--pp-green)">
              Isang sistema para sa buong farm team
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-7 text-(--pp-ink)/70">
            Iba-iba ang nakikita at magagawa ng bawat papel, kaya ang handler ay nakatuon sa trabaho at ang manager
            sa desisyon.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3 md:items-center">
          {ROLES.map((item, index) => (
            <Reveal key={item.role} delay={index * 110}>
            <figure
              className={cn(
                "relative overflow-hidden rounded-2xl",
                item.featured ? "aspect-[4/5.4]" : "aspect-[4/5]",
              )}
            >
              <Image src={item.image} alt={item.alt} fill sizes="(min-width: 768px) 30vw, 100vw" className="object-cover" />
              <Card className="absolute inset-x-4 bottom-4 gap-0 rounded-xl border-0 bg-white/95 py-0 shadow-[0_10px_30px_rgb(20_51_32/0.18)]">
                <CardContent className="p-4">
                  <figcaption>
                    <p className="text-base font-semibold text-(--pp-ink)">{item.role}</p>
                    <p className="mt-1 text-sm leading-5 text-(--pp-ink)/70">{item.text}</p>
                  </figcaption>
                </CardContent>
              </Card>
            </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
