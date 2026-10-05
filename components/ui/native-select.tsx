import * as React from "react"

import { cn } from "@/lib/utils"

type NativeSelectProps = React.ComponentProps<"select"> & {
  error?: boolean
}

/**
 * Native selects remain intentional here: they are familiar on low-end phones,
 * work reliably with touch and offline pages, and keep the same field language
 * as Input without introducing another interaction model.
 */
function NativeSelect({ className, error = false, ...props }: NativeSelectProps) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base text-foreground transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
        error
          ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
          : "border-input",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
