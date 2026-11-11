'use client'

import * as React from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { useTheme } from 'next-themes'
import { themes, defaultThemeSlug } from '../astryx-themes'

/**
 * Bridges the app's next-themes mode into Astryx.
 *
 * next-themes writes a `.dark` / `.light` class on <html> before paint, while
 * Astryx's Theme writes `data-theme` and a color-scheme class. Reading the
 * resolved mode during the first client render would disagree with the server
 * markup, so mode stays on "system" until after mount; globals.css already
 * maps the <html> class onto color-scheme, so the first frame is correct.
 */
export function AstryxThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const mode = mounted
    ? resolvedTheme === 'dark'
      ? 'dark'
      : 'light'
    : 'system'

  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      {children}
    </Theme>
  )
}
