'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

const WEIGHT: [number, number, number, number] = [0.2, 0.7, 0.2, 1]

/**
 * Subtle scroll reveal for below-the-fold content: a 8 px rise and fade,
 * played once with the brand "weight" easing and never while numbers are
 * being read. Reduced motion (and SSR) renders the final state immediately.
 */
export function Reveal({
  children,
  delay = 0,
  y = 8,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  // SSR can't know the preference: the server renders no hidden style while
  // a client with no preference does, so the style attribute is expected to
  // differ at hydration (React keeps the client's, which is what we want).
  // Suppress that specific mismatch instead of a permanently hidden render.
  const hidden = reduced === false
  return (
    <motion.div
      className={className}
      initial={hidden ? { opacity: 0, y } : false}
      suppressHydrationWarning
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: WEIGHT }}
    >
      {children}
    </motion.div>
  )
}
