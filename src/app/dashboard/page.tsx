import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'
import { CommandDashboard } from '@/components/goldprism/CommandDashboard'

export default function DashboardPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="COMMAND CENTER · LOGIN & LIVE WORKSPACE"
        title="Sign in, inspect every live signal, and execute in one click."
        description="Real-time market parity feed, live X-Ray decomposition, 10g contract normalization, best-vehicle matching, cloud-synced paper ledger, and Gemini Trade Copilot on one unified dashboard."
      />
      <CommandDashboard />
    </SiteShell>
  )
}
