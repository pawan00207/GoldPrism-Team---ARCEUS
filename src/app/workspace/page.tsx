import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'
import { Dashboard } from '@/components/sections/dashboard'
import { Agent } from '@/components/sections/agent'
import { AlphaZoo } from '@/components/sections/alpha-zoo'
import { PaperTrading } from '@/components/sections/paper-trading'
import { ShadowAccount } from '@/components/sections/shadow-account'
import { Swarm } from '@/components/sections/swarm'
import { StrategyBuilder } from '@/components/sections/strategy-builder'

export default function WorkspacePage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="04 / RESEARCH WORKSPACE"
        title="Tools for the work after the signal."
        description="A separate workspace for exploration, factor research, paper execution, agent-assisted analysis, and strategy construction."
      />
      <Dashboard />
      <Agent />
      <AlphaZoo />
      <PaperTrading />
      <ShadowAccount />
      <Swarm />
      <StrategyBuilder />
    </SiteShell>
  )
}
