import { GoldResearchAnalyst } from '@/components/goldprism/GoldResearchAnalyst'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'

export default function AnalystPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="03.5 / GOLD RESEARCH ANALYST"
        title="Quantitative explanations strictly grounded in engine artifacts."
        description="Powered by deterministic GoldPrism engine tool calls, automated number-grounding validation, and downloadable research reports."
      />
      <GoldResearchAnalyst />
    </SiteShell>
  )
}
