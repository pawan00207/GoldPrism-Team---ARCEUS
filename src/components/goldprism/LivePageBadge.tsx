'use client'

import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag } from '@/components/goldprism/brand'

export function LivePageBadge() {
  const { feed, loading } = useLiveFeed()
  const isLive = feed?.status === 'LIVE_PARITY'

  let detail: string
  if (feed?.status === 'LIVE_PARITY' && feed?.asOf) {
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
