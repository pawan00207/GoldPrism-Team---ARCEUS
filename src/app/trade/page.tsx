import * as React from 'react'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'
import { TradeExecutionDesk } from '@/components/goldprism/TradeExecutionDesk'

export default function TradePage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="01.2 / ONE-CLICK EXECUTION"
        title="Understand the spread. Execute in one click."
        description="Live global spot and COMEX parity feed mapped onto MCX contract specs. Every order shows exact grams, SPAN margin proxy, statutory round-trip fees, and X-Ray edge before you click."
      />
      <React.Suspense
        fallback={
          <div className="mx-auto max-w-[1360px] px-4 py-8 font-mono text-xs text-muted-foreground">
            Loading live parity feed and execution desk…
          </div>
        }
      >
        <TradeExecutionDesk />
      </React.Suspense>
    </SiteShell>
  )
}
