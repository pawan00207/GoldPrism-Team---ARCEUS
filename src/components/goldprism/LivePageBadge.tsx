'use client'

import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag } from '@/components/goldprism/brand'

export function LivePageBadge() {
  const { feed, loading } = useLiveFeed()
  const isLive = feed?.status === 'LIVE_PARITY'

  return (
    <DataTag
      live={isLive}
      synthetic={!isLive}
      detail={
        isLive && feed?.asOf
          ? `${feed.asOf.slice(0, 16).replace('T', ' ')} UTC`
          : loading
            ? 'connecting'
            : 'feed offline'
      }
    />
  )
}
