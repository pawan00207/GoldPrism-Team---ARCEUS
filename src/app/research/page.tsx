import { BacktestLabSection } from '@/components/goldprism/BacktestLabSection'
import { BestVehicleSection } from '@/components/goldprism/BestVehicleSection'
import { ContractLifecycleSection } from '@/components/goldprism/ContractLifecycleSection'
import { ContractMasterSection } from '@/components/goldprism/ContractMasterSection'
import { DataHealthSection } from '@/components/goldprism/DataHealthSection'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'
import { TermStructureSection } from '@/components/goldprism/TermStructureSection'
import { TraderIntelligenceSection } from '@/components/goldprism/TraderIntelligenceSection'
import ScrollIndex from '@/components/kokonutui/scroll-index'

export default function ResearchPage() {
  return (
    <SiteShell>
      <ScrollIndex scroller="window" fixedRail offset={80} selector="h2">
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
      </ScrollIndex>
    </SiteShell>
  )
}
