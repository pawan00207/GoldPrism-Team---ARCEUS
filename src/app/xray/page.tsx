import { XRayWaterfallSection } from '@/components/goldprism/XRayWaterfallSection'
import { PageIntro, SiteShell } from '@/components/goldprism/SiteShell'

export default function XRayPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="01 / DECISION SURFACE"
        title="See what is really inside the spread."
        description="The X-Ray separates the visible gap into economic basis, expiry carry, settlement artifact, transaction costs, and the residual edge."
      />
      <XRayWaterfallSection />
    </SiteShell>
  )
}
