"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { Button } from "@/components/ui/button";

const colors = ["#28784b", "#b44a45", "#a66a08", "#367a96", "#7856a0", "#757d34", "#b15e83", "#4d6867"];
const label = (type: string) => type.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export function EventTypeChart({ distribution, selected, loading, error, onSelect, onRetry }: { distribution: Record<string, number>; selected: string; loading: boolean; error: boolean; onSelect: (type: string) => void; onRetry: () => void }) {
  const { display: displayText } = useDisplayLocale();
  const entries = Object.entries(distribution).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return <section aria-label={displayText("Events by type")} className="rounded-2xl border bg-card p-4">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{displayText("Events by type")}</h2><p className="mt-1 text-xs text-muted-foreground">{displayText("Select a type to see its records. Counts are event entries, not birds.")}</p></div>{selected !== "ALL" && <Button size="sm" variant="outline" onClick={() => onSelect("ALL")}>{displayText("All types")}</Button>}</div>
    {loading ? <p role="status" className="py-10 text-sm text-muted-foreground">{displayText("Loading event types…")}</p> : error ? <div role="alert" className="space-y-2 py-6"><p className="text-sm">{displayText("Could not load event types.")}</p><Button variant="outline" onClick={onRetry}>{displayText("Try again")}</Button></div> : total === 0 ? <p className="py-10 text-sm text-muted-foreground">{displayText("No events in this period.")}</p> : <>
      <div className="relative mx-auto my-5 size-48"><svg viewBox="0 0 200 200" className="size-full overflow-visible" aria-label={`${total} events by type`}>
        {entries.map(([type, count], index) => { const share = count / total * 100; const start = entries.slice(0, index).reduce((sum, [, n]) => sum + n, 0) / total * 100; return <circle key={type} cx="100" cy="100" r="76" fill="none" stroke={colors[index % colors.length]} strokeWidth={selected === type ? 43 : 38} pathLength="100" strokeDasharray={`${share} ${100-share}`} strokeDashoffset={-start} transform="rotate(-90 100 100)" role="button" tabIndex={0} aria-label={`${label(type)}: ${count} events, ${Math.round(share)}%`} aria-pressed={selected === type} onClick={() => onSelect(type)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(type); } }} className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"><title>{label(type)}: {count} {displayText("events")}</title></circle>; })}
      </svg><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl tabular-nums">{total}</strong><span className="text-xs text-muted-foreground">{displayText("events")}</span></div></div>
      <p className="mb-3 text-sm"><strong>{label(entries[0][0])}</strong> {displayText("is most common ·")}{" "}{Math.round(entries[0][1] / total * 100)}%</p>
      <div className="space-y-1">{entries.map(([type,count], index) => <button type="button" key={type} aria-pressed={selected === type} onClick={() => onSelect(type)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === type ? "bg-primary/10 font-semibold" : "hover:bg-muted"}`}><span className="size-2.5 shrink-0 rounded-full" style={{backgroundColor: colors[index % colors.length]}} aria-hidden="true"/><span className="min-w-0 flex-1 break-words">{label(type)}</span><span className="shrink-0 tabular-nums">{count} <span className="ml-2 text-xs text-muted-foreground">{Math.round(count / total * 100)}%</span></span></button>)}</div>
    </>}
  </section>;
}
