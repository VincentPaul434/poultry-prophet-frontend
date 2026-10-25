import { CloudCheck, CloudOff, Download, RefreshCw, Smartphone } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

const steps = [
  { icon: Download, title: "Kunin ang data", number: "01" },
  { icon: Smartphone, title: "Mag-record", number: "02" },
  { icon: CloudOff, title: "Nasa phone muna", number: "03" },
  { icon: CloudCheck, title: "Auto-sync", number: "04" },
];

export function OfflineWorkflow() {
  return (
    <section id="offline" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="offline-heading">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9b6811]">Para sa signal sa bukid</p>
              <h2 id="offline-heading" className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-6xl">
                Tala kahit
                <span className="block text-[#cc7d2e]">walang signal.</span>
              </h2>
            </div>
            <p className="max-w-xl text-base font-semibold leading-7 text-[#617267] sm:text-lg">
              Nasa phone muna. Kusang isi-sync pagbalik ng internet.
            </p>
          </div>
        </Reveal>

        <div className="relative mt-12">
          <div className="absolute left-[10%] right-[10%] top-16 hidden h-1 overflow-hidden rounded-full bg-[#173d2a]/12 md:block" aria-hidden="true">
            <span className="landing-flow-dot block h-full w-[18%] rounded-full bg-[#cc7d2e]" />
          </div>
          <ol className="relative grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {steps.map(({ icon: Icon, title, number }, index) => (
              <Reveal key={title} delay={index * 90}>
                <li className="group flex min-h-48 flex-col justify-between rounded-[1.75rem] border border-[#173d2a]/10 bg-white/75 p-5 transition-transform duration-300 hover:-translate-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-[#dcebd8] transition-colors group-hover:bg-[#f4bf55]">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-black text-[#173d2a]/35">{number}</span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight">{title}</h3>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delay={180} className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-full bg-[#f4bf55] px-4 py-3 text-sm font-black shadow-[0_12px_30px_rgb(155_104_17_/_0.16)]">
            <RefreshCw className="size-4 animate-spin [animation-duration:3s] motion-reduce:animate-none" aria-hidden="true" />
            3 tala • naghihintay mag-sync
          </div>
        </Reveal>
      </div>
    </section>
  );
}
