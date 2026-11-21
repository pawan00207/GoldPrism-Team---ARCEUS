import { SiteShell, PageIntro } from '@/components/goldprism/SiteShell'
import { MarketCompetition } from '@/components/goldprism/MarketCompetition'

export default function MarketPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="Live market · price discovery"
        title="Three references. One gold gram."
        description="Compare live CoinGecko PAXG and XAUT prices with an MCX GOLDM quote when verified. If the live quote is unavailable, the latest supplied daily close is shown as a dated reference only."
      />
      <MarketCompetition />
    </SiteShell>
  )
}
