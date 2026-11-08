import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BatchMetricStripItem {
  value: ReactNode;
  label: string;
  note?: string;
  title?: string;
  ariaLabel?: string;
  warning?: boolean;
}

/** A compact, role-neutral summary for a batch card. */
export function BatchMetricStrip({ items }: { items: BatchMetricStripItem[] }) {
  return (
    <div className={cn(
      "grid overflow-hidden rounded-xl border bg-card/60 divide-x",
      items.length === 2 ? "grid-cols-2" : "grid-cols-3",
    )}>
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 px-2 py-3 text-center"
          role="group"
          title={item.title}
          aria-label={item.ariaLabel ?? item.label}
        >
          <div className="flex min-w-0 items-center justify-center gap-1">
            <span className={cn(
              "whitespace-nowrap text-sm font-bold tabular-nums sm:text-base",
              item.value === "—" && "text-muted-foreground",
            )}>
              {item.value}
            </span>
            {item.warning && (
              <AlertCircle className="size-3.5 shrink-0 text-warning-ink" aria-hidden="true" />
            )}
          </div>
          <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          {item.note && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}
