import { SiteShell, PageIntro } from '@/components/goldprism/SiteShell'
import { GoldTokenWallet } from '@/components/goldprism/GoldTokenWallet'

export default function WalletPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="GoldPrism wallet · Razorpay test mode"
        title="Pay. Credit. Spend."
        description="Razorpay test payments are verified server-side before crediting this persistent browser-local demo wallet. gGOLD is not a real or on-chain token."
      />
      <GoldTokenWallet />
    </SiteShell>
  )
}
