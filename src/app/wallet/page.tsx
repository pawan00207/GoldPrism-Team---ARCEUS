import { SiteShell, PageIntro } from '@/components/goldprism/SiteShell'
import { GoldTokenWallet } from '@/components/goldprism/GoldTokenWallet'

export default function WalletPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="GoldPrism wallet · demo settlement"
        title="Pay. Mint. Spend."
        description="A persistent, browser-local gGOLD demo wallet priced from live PAXG. Payments and blockchain references are simulated; no real money moves."
      />
      <GoldTokenWallet />
    </SiteShell>
  )
}
