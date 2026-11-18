'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/goldprism/brand'

/** Where the cut-out mascot lives. Both the logo mark and the copilot FAB use it. */
export const MASCOT_SRC = '/mascot.png'

/**
 * Mascot mark with graceful fallback: when `public/mascot.png` is absent or
 * fails to load, the GoldPrism ingot mark renders instead — the site never
 * ships a broken image.
 */
export function Mascot({
  className,
  alt = 'GoldPrism',
  tone = 'paper',
}: {
  className?: string
  alt?: string
  tone?: 'paper' | 'dark'
}) {
  const [failed, setFailed] = React.useState(false)
  if (failed) {
    return <BrandMark className={className} tone={tone} title={alt} />
  }
  return (
    <img
      src={MASCOT_SRC}
      alt={alt}
      className={cn('select-none object-contain', className)}
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}
