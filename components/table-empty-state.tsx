import type { ReactNode } from "react";

export function TableEmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center">
    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">{icon}</span>
    <div aria-live="polite"><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p></div>
    {action && <div className="mt-3">{action}</div>}
  </div>;
}
