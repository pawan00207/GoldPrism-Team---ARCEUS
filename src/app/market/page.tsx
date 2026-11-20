import { SiteShell, PageIntro } from '@/components/goldprism/SiteShell'
import { MarketCompetition } from '@/components/goldprism/MarketCompetition'

export default function MarketPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="Live market · price discovery"
        title="Three references. One gold gram."
        description="Compare MCX's clearly labeled simulated reference against live CoinGecko PAXG and XAUT prices. Quotes refresh every 30 seconds."
      />
      <MarketCompetition />
    </SiteShell>
  )
}
