import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends Omit<ComponentProps<"header">, "title"> {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
  variant?: "default" | "ledger";
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
  titleClassName,
  descriptionClassName,
  variant = "default",
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", variant === "ledger" && "gap-3 sm:items-end sm:gap-6", className)}
      {...props}
    >
      <div className={cn("flex min-w-0 gap-3", Icon ? "items-center" : "items-start")}>
        {Icon && (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className={cn("text-2xl font-bold tracking-tight sm:text-3xl", variant === "ledger" && "ledger-heading text-[2rem] leading-none sm:text-5xl", titleClassName)}>{title}</h1>
          {description && (
            <p className={cn("text-sm text-muted-foreground", descriptionClassName)}>{description}</p>
          )}
        </div>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </header>
  );
}

export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("ledger-page mx-auto w-full max-w-6xl", className)} {...props} />;
}
