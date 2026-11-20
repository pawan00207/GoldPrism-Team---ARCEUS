import { BacktestReplayLab } from '@/components/goldprism/BacktestReplayLab'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'

export default function ReplayPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="02.7 / POINT-IN-TIME REPLAY"
        title="Inspect exactly what the model knew — before the next bar existed."
        description="Select a published session, inspect the evidence available that day, then reveal what happened to the same contracts after modeled entry."
      />
      <BacktestReplayLab />
    </SiteShell>
  )
}
