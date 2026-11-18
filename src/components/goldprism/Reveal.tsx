'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const WEIGHT: [number, number, number, number] = [0.2, 0.7, 0.2, 1]

/**
 * Subtle scroll reveal: 10px rise + fade, played once with the brand "weight"
 * easing. Reduced motion (and SSR) renders the final state immediately.
 */
export function Reveal({
  children,
  delay = 0,
  y = 10,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const hidden = reduced === false
  return (
    <motion.div
      className={className}
      initial={hidden ? { opacity: 0, y } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: WEIGHT }}
      suppressHydrationWarning
    >
      {children}
    </motion.div>
  )
}
