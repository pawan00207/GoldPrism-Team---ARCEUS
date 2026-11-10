import { DataAuditMethodologySection } from '@/components/goldprism/DataAuditMethodologySection'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'
import { ReportsExportSection } from '@/components/goldprism/ReportsExportSection'

export default function MethodologyPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="03 / AUDIT TRAIL"
        title="A result you can inspect, not just believe."
        description="GoldPrism records the provenance, integrity gates, normalization rules, reconciliation tolerance, and exportable manifest behind the interface."
      />
      <DataAuditMethodologySection />
      <ReportsExportSection />
    </SiteShell>
  )
}
