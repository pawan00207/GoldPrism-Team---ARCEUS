import { BacktestReplayLab } from '@/components/goldprism/BacktestReplayLab'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'

export default function ReplayPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="02.7 / POINT-IN-TIME REPLAY"
        title="Inspect exactly what the model knew — before the next bar existed."
        description="Step through the 18-month MCX Bhavcopy history with strict trade_date ≤ as_of isolation, separate Training vs Sealed Holdout statistics, and a gated outcome reveal."
      />
      <BacktestReplayLab />
    </SiteShell>
  )
}
