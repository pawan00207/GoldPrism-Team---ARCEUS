import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] border font-mono text-[11px] font-medium uppercase tracking-[0.1em] transition-colors disabled:pointer-events-none disabled:opacity-40 disabled:[background-image:repeating-linear-gradient(135deg,transparent_0,transparent_4px,color-mix(in_srgb,var(--gp-slag-500)_20%,transparent)_4px,color-mix(in_srgb,var(--gp-slag-500)_20%,transparent)_5px)] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-slag-900)] dark:focus-visible:outline-[var(--gp-paper)]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--gp-slag-900)] bg-[var(--gp-slag-900)] text-[var(--gp-paper)] hover:bg-[var(--gp-gold-500)] hover:border-[var(--gp-gold-500)] hover:text-[var(--gp-slag-900)] dark:border-[var(--gp-paper)] dark:bg-[var(--gp-paper)] dark:text-[var(--gp-crucible)] dark:hover:bg-[var(--gp-gold-500)] dark:hover:border-[var(--gp-gold-500)] dark:hover:text-[var(--gp-slag-900)]",
        destructive:
          "border-[var(--gp-blocked)] bg-[var(--gp-blocked)] text-[var(--gp-paper)] hover:bg-[var(--gp-oxide-600)]",
        outline:
          "border-[var(--gp-slag-500)] bg-transparent text-foreground hover:bg-[var(--gp-gold-500)] hover:border-[var(--gp-gold-500)] hover:text-[var(--gp-slag-900)]",
        secondary:
          "border-border bg-card text-foreground hover:bg-[var(--gp-gold-500)] hover:border-[var(--gp-gold-500)] hover:text-[var(--gp-slag-900)]",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-[var(--gp-gold-100)] hover:text-[var(--gp-slag-900)]",
        link: "border-transparent bg-transparent p-0 text-foreground underline-offset-4 decoration-[var(--gp-gold-500)] decoration-2 underline hover:text-[var(--gp-gold-text)]",
      },
      size: {
        default: "h-11 px-4 has-[>svg]:px-3",
        sm: "h-10 gap-1.5 px-3 text-[10px] has-[>svg]:px-2.5",
        lg: "h-12 px-6 has-[>svg]:px-4",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
