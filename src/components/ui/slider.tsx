"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-40 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-[var(--gp-slag-500)] relative grow overflow-hidden data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-foreground absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-3 shrink-0 rounded-none border-2 border-[var(--gp-slag-900)] bg-background transition-[box-shadow] hover:shadow-[0_0_0_2px_var(--background),0_0_0_3px_var(--gp-slag-900)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--gp-slag-900)] disabled:pointer-events-none disabled:opacity-40 dark:border-[var(--gp-paper)] dark:hover:shadow-[0_0_0_2px_var(--background),0_0_0_3px_var(--gp-paper)] dark:focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--gp-paper)]"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
