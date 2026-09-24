import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageBackLinkProps =
  | {
      destination: "dashboard" | "settings";
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
} as const;

/** A deterministic back link for pages inside the authenticated app. */
export function PageBackLink(props: PageBackLinkProps) {
  const destination =
    props.destination === "batch"
      ? { href: `/batches/${props.batchId}`, label: "batch overview" }
      : DESTINATIONS[props.destination];

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 gap-1.5 text-muted-foreground", props.className)}
      nativeButton={false}
      render={<Link href={destination.href} />}
      aria-label={`Back to ${destination.label}`}
    >
      <ArrowLeft className="size-4" />
      Back to {destination.label}
    </Button>
  );
}
