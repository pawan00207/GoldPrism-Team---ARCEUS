import { ContractNormalizationLab } from '@/components/goldprism/ContractNormalizationLab'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'

export default function NormalizationPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="01.5 / CONTRACT NORMALIZATION LAB"
        title="Compare four MCX gold contracts on one pure-gold scale."
        description="Archived MCX Bhavcopy marks normalized to a 10 g pure-gold equivalence basis, with step-by-step substitution and cross-contract spreads."
      />
      <ContractNormalizationLab />
    </SiteShell>
  )
}
