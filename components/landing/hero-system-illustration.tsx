import { BarChart3, Check, Cloud, History, Smartphone, WifiOff } from "lucide-react";

const records = [
  { label: "Benta", value: "10 inahin", tone: "bg-[#fbe8b8] text-[#714b08]" },
  { label: "Bakuna", value: "Newcastle", tone: "bg-[#dff0df] text-[#20543a]" },
  { label: "Kalusugan", value: "1 obserbasyon", tone: "bg-[#f7ddd1] text-[#8a3f20]" },
];

export function HeroSystemIllustration() {
  return (
    <div className="relative mx-auto aspect-[1/1.04] w-full max-w-[620px]" aria-label="Mula sa tala ng handler papunta sa batch report ng manager">
      <div className="absolute inset-[10%] rounded-full bg-white/8 blur-2xl" aria-hidden="true" />
      <div className="absolute left-[34%] top-[46%] h-1 w-[35%] overflow-hidden rounded-full bg-white/18" aria-hidden="true">
        <span className="landing-flow-dot block h-full w-1/4 rounded-full bg-[#f4bf55]" />
      </div>

      <div className="absolute left-[2%] top-[7%] w-[55%] -rotate-3">
        <div className="landing-float rounded-[2.2rem] border border-white/20 bg-[#fffdf8] p-3 text-[#173d2a] shadow-[0_28px_60px_rgb(0_0_0_/_0.26)] sm:p-4">
          <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[#173d2a]/15" />
          <div className="rounded-[1.65rem] bg-[#edf3e8] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#52705d]">Handler</p>
                <p className="mt-1 text-base font-black">Mag-record</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-[#173d2a] text-white"><Smartphone className="size-5" aria-hidden="true" /></span>
            </div>
            <div className="mt-4 space-y-2">
              {records.map((record) => (
                <div key={record.label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                  <span className={"rounded-full px-2 py-1 text-[9px] font-black uppercase " + record.tone}>{record.label}</span>
                  <span className="text-[11px] font-bold">{record.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#173d2a] px-3 py-2.5 text-[11px] font-bold text-white">
              <WifiOff className="size-3.5 text-[#f4bf55]" aria-hidden="true" />
              Naka-save sa phone
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[2%] top-[50%] w-[58%] rotate-2">
        <div className="landing-float-slow rounded-[2rem] border border-white/20 bg-[#f4bf55] p-3 text-[#173d2a] shadow-[0_28px_60px_rgb(0_0_0_/_0.25)] sm:p-4">
          <div className="rounded-[1.5rem] bg-[#fff8e7] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7b5b19]">Manager</p>
                <p className="mt-1 text-base font-black">Batch report</p>
              </div>
              <BarChart3 className="size-5" aria-hidden="true" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-bold text-[#6b786e]">Bilang</p><p className="mt-1 text-lg font-black">190</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-bold text-[#6b786e]">Kita</p><p className="mt-1 text-lg font-black">₱5k</p></div>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#dfeedd] px-3 py-2.5 text-[11px] font-bold">
              <History className="size-3.5" aria-hidden="true" />
              Kumpletong history
            </div>
          </div>
        </div>
      </div>

      <div className="landing-pulse-ring absolute left-[44%] top-[39%] z-10 flex items-center gap-2 rounded-full border-4 border-[#173d2a] bg-[#f4bf55] px-3 py-2 text-[10px] font-black text-[#173d2a] shadow-xl">
        <Cloud className="size-3.5" aria-hidden="true" />
        Auto-sync
      </div>
      <div className="landing-float absolute right-[5%] top-[9%] flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-2 text-[10px] font-bold text-white backdrop-blur">
        <Check className="size-3.5 text-[#f4bf55]" aria-hidden="true" />
        Naka-link sa batch
      </div>
    </div>
  );
}

