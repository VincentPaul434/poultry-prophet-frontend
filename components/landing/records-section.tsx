import { Boxes, HeartPulse, Layers, ReceiptText, RefreshCw, Syringe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "@/components/landing/reveal";

const RECORDS = [
  { icon: Layers, title: "Batch at populasyon", text: "Pagsilang, paglipat, pagkamatay, at bentang ibon sa bawat batch." },
  { icon: HeartPulse, title: "Araw-araw na obserbasyon", text: "Kalagayan, timbang, at mga palatandaang dapat bantayan." },
  { icon: Syringe, title: "Bakuna at gamot", text: "Iskedyul, paalala, at kung kailan at ano ang naibigay." },
  { icon: Boxes, title: "Imbentaryo", text: "Feeds at gamot na awtomatikong nababawas, walang negatibong stock." },
  { icon: ReceiptText, title: "Gastos at kita", text: "Nakatalang gastos at benta, hiwalay ayon sa currency." },
  { icon: RefreshCw, title: "Offline sync", text: "Naka-queue ang entry sa device at ligtas na naipapadala pagbalik ng signal." },
];

export function RecordsSection() {
  return (
    <section id="mga-tala" aria-labelledby="records-title" className="scroll-mt-[72px] bg-(--pp-green) py-24 text-white sm:py-28">
      <div className="mx-auto grid max-w-[1320px] gap-14 px-4 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <Badge variant="outline" className="h-8 rounded-full border-white/25 bg-white/10 px-4 text-sm font-normal text-white">
            Ano ang nire-record
          </Badge>
          <h2 id="records-title" className="mt-5 text-balance text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
            Lahat ng mahalagang tala ng farm, magkakaugnay
          </h2>
          <p className="mt-6 max-w-[48ch] text-[15px] leading-7 text-white/75">
            Hindi na hiwa-hiwalay na notebook at chat. Bawat entry ay nakakabit sa batch nito, kaya madaling makita
            ang buong kuwento kapag oras na ng review.
          </p>
        </Reveal>

        <ul className="grid sm:grid-cols-2 sm:gap-x-12">
          {RECORDS.map(({ icon: Icon, title, text }, index) => (
            <li key={title}>
              {index > 0 && <Separator className={index === 1 ? "bg-white/15 sm:hidden" : "bg-white/15"} />}
              <Reveal delay={(index % 2) * 90 + Math.floor(index / 2) * 60} className="flex gap-4 py-7">
                <Icon className="mt-1 size-6 shrink-0 text-(--pp-lime)" aria-hidden="true" />
                <div>
                  <h3 className="text-lg font-medium tracking-[-0.01em]">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-6 text-white/70">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
