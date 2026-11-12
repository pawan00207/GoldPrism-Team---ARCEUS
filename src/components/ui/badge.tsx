import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[2px] border px-1.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-slag-900)] transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-[var(--gp-slag-500)] bg-[var(--gp-slag-900)] text-[var(--gp-paper)] [a&]:hover:bg-[var(--gp-gold-500)] [a&]:hover:border-[var(--gp-gold-500)] [a&]:hover:text-[var(--gp-slag-900)]",
        secondary:
          "border-border bg-card text-foreground [a&]:hover:bg-[var(--gp-gold-500)] [a&]:hover:text-[var(--gp-slag-900)]",
        destructive:
          "border-[var(--gp-blocked)] text-[var(--gp-blocked-ink)] [a&]:hover:bg-[var(--gp-blocked)] [a&]:hover:text-[var(--gp-paper)]",
        outline:
          "border-[var(--gp-slag-500)] bg-transparent text-foreground [a&]:hover:bg-[var(--gp-gold-500)] [a&]:hover:text-[var(--gp-slag-900)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
