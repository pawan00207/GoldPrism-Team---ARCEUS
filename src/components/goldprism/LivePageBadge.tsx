'use client'

import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag } from '@/components/goldprism/brand'

export function LivePageBadge() {
  const { feed, mcxSnapshot, pricesSource, loading } = useLiveFeed()
  const isMcxLive = mcxSnapshot?.status === 'MCX_LIVE'
  const isMcxStale = mcxSnapshot?.status === 'MCX_STALE'
  const isLive = isMcxLive || feed?.status === 'LIVE_PARITY'

  let detail: string
  if (isMcxLive && mcxSnapshot?.bhavcopyDate) {
    detail = `MCX bhavcopy · ${mcxSnapshot.bhavcopyDate}`
  } else if (isMcxStale && mcxSnapshot?.bhavcopyDate) {
    detail = `MCX bhavcopy (stale) · ${mcxSnapshot.bhavcopyDate}`
  } else if (feed?.status === 'LIVE_PARITY' && feed?.asOf) {
    detail = `parity model · ${feed.asOf.slice(0, 16).replace('T', ' ')} UTC`
  } else {
    detail = loading ? 'connecting' : 'feed offline'
  }

  return (
    <DataTag
      live={isLive}
      synthetic={!isLive}
      detail={detail}
    />
  )
}
