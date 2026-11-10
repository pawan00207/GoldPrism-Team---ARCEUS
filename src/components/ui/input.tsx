import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-none border-0 border-b border-[var(--gp-slag-500)] bg-transparent px-0 py-1 font-mono text-sm tabular-nums text-foreground shadow-none outline-none transition-[border-color,border-width]",
        "placeholder:text-[var(--gp-meta-ink)]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-mono file:text-[11px] file:font-medium file:uppercase file:tracking-wider",
        "focus-visible:border-b-2 focus-visible:border-[var(--gp-slag-900)] focus-visible:ring-0 dark:focus-visible:border-[var(--gp-paper)]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:[background-image:repeating-linear-gradient(135deg,transparent_0,transparent_4px,color-mix(in_srgb,var(--gp-slag-500)_18%,transparent)_4px,color-mix(in_srgb,var(--gp-slag-500)_18%,transparent)_5px)]",
        "aria-invalid:border-[var(--gp-blocked)] aria-invalid:border-b-2",
        className
      )}
      {...props}
    />
  )
}

export { Input }
