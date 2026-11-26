"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageBackLinkProps =
  | {
      destination: "dashboard" | "settings" | "tasks" | "incubation" | "alerts";
      className?: string;
    }
  | {
      destination: "batch";
      batchId: string | number;
      className?: string;
    };

const DESTINATIONS = {
  dashboard: { href: "/dashboard", label: "dashboard" },
  settings: { href: "/settings", label: "settings" },
  tasks: { href: "/tasks", label: "tasks" },
  incubation: { href: "/incubation", label: "incubation" },
  alerts: { href: "/alerts", label: "alerts" },
} as const;

/** A deterministic back link for pages inside the authenticated app. */
export function PageBackLink(props: PageBackLinkProps) {
  const { language } = useLocale();
  const destination =
    props.destination === "batch"
      ? { href: `/batches/${props.batchId}`, label: "batch overview" }
      : DESTINATIONS[props.destination];

  const labels = { dashboard: "pangunahing pahina", settings: "mga setting", tasks: "mga gawain", incubation: "pagpapapisa", alerts: "mga babala", batch: "buod ng pangkat" };
  const text = language === "taglish" ? `Bumalik sa ${labels[props.destination]}` : `Back to ${destination.label}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 gap-1.5 text-muted-foreground", props.className)}
      nativeButton={false}
      render={<Link href={destination.href} />}
      aria-label={text}
    >
      <ArrowLeft className="size-4" />
      {text}
    </Button>
  );
}
