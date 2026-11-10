import { BacktestLabSection } from '@/components/goldprism/BacktestLabSection'
import { BestVehicleSection } from '@/components/goldprism/BestVehicleSection'
import { ContractLifecycleSection } from '@/components/goldprism/ContractLifecycleSection'
import { ContractMasterSection } from '@/components/goldprism/ContractMasterSection'
import { DataHealthSection } from '@/components/goldprism/DataHealthSection'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'
import { TermStructureSection } from '@/components/goldprism/TermStructureSection'
import { TraderIntelligenceSection } from '@/components/goldprism/TraderIntelligenceSection'

export default function ResearchPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="02 / MARKET STRUCTURE"
        title="The evidence behind every decision."
        description="A research sequence for validating the data, normalizing the contracts, matching the exposure, and testing whether an apparent edge survives reality."
      />
      <DataHealthSection />
      <ContractMasterSection />
      <BestVehicleSection />
      <TermStructureSection />
      <ContractLifecycleSection />
      <BacktestLabSection />
      <TraderIntelligenceSection />
    </SiteShell>
  )
}
