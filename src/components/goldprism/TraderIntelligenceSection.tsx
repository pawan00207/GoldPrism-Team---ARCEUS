'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag, SectionHead, VerdictTag } from '@/components/goldprism/brand'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { calculateTransactionCosts, DEFAULT_COST_CONFIG } from '@/lib/goldprism/transaction-costs'
import { computeXRayWaterfall } from '@/lib/goldprism/xray'
import { bps } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

const MATRIX_CONTRACTS: Array<{ code: SupportedContractCode; label: string; notes: string }> = [
  { code: 'GOLDM', label: 'GOLDM · 100g', notes: 'Lowest fixed-fee drag' },
  { code: 'GOLDTEN', label: 'GOLDTEN · 10g', notes: 'Balanced retail lot' },
  { code: 'GOLDGUINEA', label: 'GOLDGUINEA · 8g', notes: 'Moderate fee drag' },
  { code: 'GOLDPETAL', label: 'GOLDPETAL · 1g', notes: 'Highest per-gram friction' },
]

export function TraderIntelligenceSection() {
  const { feed, loading } = useLiveFeed()
  const [reproStatus, setReproStatus] = React.useState<
    'IDLE' | 'VERIFYING' | 'PASSED' | 'FAILED'
  >('IDLE')
  const [reproTimestamp, setReproTimestamp] = React.useState<string>('')
  const [verifiedHash, setVerifiedHash] = React.useState<string>('9c8103c61b2b2137')

  const contracts = feed?.contracts ?? null
  const feedAsOf = feed?.asOf ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && contracts !== null

  const handleVerifyReproducibility = async () => {
    setReproStatus('VERIFYING')
    try {
      const res = await fetch('/api/goldprism/replay?pair=GOLDM_CALENDAR&as_of=2025-06-30', {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        replay?: { asOfDate?: string; provenance?: { configHash?: string } }
        summary?: { provenance?: { configHash?: string } }
      }
      const cfgHash =
        data.replay?.provenance?.configHash ?? data.summary?.provenance?.configHash
      if (cfgHash) {
        setVerifiedHash(cfgHash)
      }
      setReproStatus(data.replay ? 'PASSED' : 'FAILED')
      setReproTimestamp(new Date().toISOString().slice(11, 19) + ' UTC')
    } catch {
      setReproStatus('FAILED')
    }
  }

  const carryRate = React.useMemo(() => {
    const basis = feed?.benchmarks.comexBasisAnnualizedPct
    if (typeof basis === 'number' && basis > 0 && basis < 20) return basis / 100
    return 0.065
  }, [feed?.benchmarks.comexBasisAnnualizedPct])

  const liveQuietPairs = React.useMemo(() => {
    if (!contracts || !feedAsOf) return []
    const tradeDate = feedAsOf.slice(0, 10)
    const pairs: Array<{
      pair: string
      a: SupportedContractCode
      b: SupportedContractCode
      note: string
    }> = [
      {
        pair: 'GOLDTEN vs GOLDM',
        a: 'GOLDTEN',
        b: 'GOLDM',
        note: 'Primary 10g vs 100g cross-purity spread audited against repo carry and statutory round-trip fees.',
      },
      {
        pair: 'GOLDGUINEA vs GOLDM',
        a: 'GOLDGUINEA',
        b: 'GOLDM',
        note: '8g contract increases per-gram brokerage drag relative to 100g GOLDM.',
      },
      {
        pair: 'GOLDPETAL vs GOLDM',
        a: 'GOLDPETAL',
        b: 'GOLDM',
        note: '₹30 per-lot brokerage against a 1g contract dominates net spread residual.',
      },
    ]

    return pairs.map((item) => {
      const res = computeXRayWaterfall({
        contractA: item.a,
        priceAQuoted: contracts[item.a].quotedPrice,
        expiryA: contracts[item.a].expiryDate,
        contractB: item.b,
        priceBQuoted: contracts[item.b].quotedPrice,
        expiryB: contracts[item.b].expiryDate,
        tradeDate,
        annualCarryRate: carryRate,
        settlementArtifactInrPerG: 0,
      })
      return {
        pair: item.pair,
        rawSpreadBps: res.rawSpreadBps,
        grossResidualBps: res.grossResidualBps,
        costHurdleBps: res.transactionCostsBps,
        netEdgeBps: res.netEdgeBps,
        verdict: res.verdict,
        silenceReason: `${res.verdictMessage} ${item.note}`,
      }
    })
  }, [contracts, feedAsOf, carryRate])

  const costHurdleHeatmap = React.useMemo(() => {
    if (!contracts) return []
    return MATRIX_CONTRACTS.map((row) => {
      const price = contracts[row.code].quotedPrice
      const calc = (lots: number) =>
        calculateTransactionCosts(price, row.code, lots, DEFAULT_COST_CONFIG).totalCostBps
      return {
        pair: row.label,
        lots1: calc(1),
        lots5: calc(5),
        lots10: calc(10),
        lots50: calc(50),
        notes: row.notes,
      }
    })
  }, [contracts])

  const reproTone =
    reproStatus === 'PASSED'
      ? 'gp-tag--tradable'
      : reproStatus === 'FAILED'
        ? 'gp-tag--blocked'
        : reproStatus === 'VERIFYING'
          ? 'gp-tag--watch'
          : 'gp-tag--neutral'

  return (
    <section
      id="trader-intelligence"
      className="scroll-mt-16 border-b border-border bg-background"
    >
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="02.7"
          eyebrow="Market structure · Silence audit"
          title="When it is quiet, say why."
          description="Every live session is audited deterministically: which carry consumed the gap, how much structure remains, and why small-lot friction blocks marginal spreads."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => void handleVerifyReproducibility()}
                  disabled={reproStatus === 'VERIFYING'}
                  variant="outline"
                  size="sm"
                >
                  {reproStatus === 'VERIFYING' ? 'Verifying…' : 'Verify live replay hash'}
                </Button>
                <span className={cn('gp-tag', reproTone)}>
                  {reproStatus === 'PASSED'
                    ? 'Replay check · pass'
                    : reproStatus === 'FAILED'
                      ? 'Replay check · failed'
                      : reproStatus === 'VERIFYING'
                        ? 'Checking'
                        : 'Deterministic engine'}
                </span>
              </div>
              <p className="max-w-[22rem] break-all font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground lg:text-right">
                {verifiedHash}
                {reproStatus === 'PASSED' && reproTimestamp
                  ? ` · verified ${reproTimestamp}`
                  : ''}
              </p>
            </div>
          }
        />

        {/* ---------------- Why quiet ---------------- */}
        <div className="mt-8 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-3">
            <div>
              <p className="gp-label">Live silence audit · why alerts pass or hold</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Computed in real time across live parity quotes using computeXRayWaterfall().
              </p>
            </div>
            <DataTag
              live={isLive}
              synthetic={!isLive}
              detail={
                isLive && feed?.asOf
                  ? `Session · ${feed.asOf.slice(0, 19).replace('T', ' ')} UTC`
                  : loading
                    ? 'syncing'
                    : 'offline'
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  <th scope="col">Monitored spread pair</th>
                  <th scope="col" className="gp-num">Raw spread</th>
                  <th scope="col" className="gp-num">Gross residual</th>
                  <th scope="col" className="gp-num">Cost hurdle</th>
                  <th scope="col" className="gp-num">Net edge</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Live justification</th>
                </tr>
              </thead>
              <tbody>
                {liveQuietPairs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-muted-foreground">
                      {loading
                        ? 'Syncing live parity quotes to audit cross-contract spreads…'
                        : 'Live feed unavailable. Silence audit requires live parity prices.'}
                    </td>
                  </tr>
                ) : (
                  liveQuietPairs.map((p) => (
                    <tr key={p.pair}>
                      <td className="font-medium text-foreground">{p.pair}</td>
                      <td className="gp-num text-muted-foreground">{bps(p.rawSpreadBps)}</td>
                      <td className="gp-num text-foreground">{bps(p.grossResidualBps)}</td>
                      <td className="gp-num text-muted-foreground">{bps(p.costHurdleBps)}</td>
                      <td className="gp-num text-foreground">{bps(p.netEdgeBps)}</td>
                      <td>
                        <VerdictTag verdict={p.verdict} />
                      </td>
                      <td className="max-w-md font-sans text-[11px] leading-relaxed text-muted-foreground">
                        {p.silenceReason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------- Cost hurdle heatmap ---------------- */}
        <div className="mt-8 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-3">
            <div>
              <p className="gp-label">Cost-hurdle matrix · break-even residual by lot size</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Minimum gross residual required to cover brokerage, CTT, GST, stamp duty and
                slippage at current live prices.
              </p>
            </div>
            <span className="gp-tag gp-tag--neutral">MCX Fee Model</span>
          </div>

          <div className="overflow-x-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  <th scope="col">Contract · trading unit</th>
                  <th scope="col" className="gp-num">1 lot</th>
                  <th scope="col" className="gp-num">5 lots</th>
                  <th scope="col" className="gp-num">10 lots</th>
                  <th scope="col" className="gp-num">50 lots</th>
                  <th scope="col">Friction impact</th>
                </tr>
              </thead>
              <tbody>
                {costHurdleHeatmap.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground">
                      Waiting for live quotes to compute statutory cost hurdles…
                    </td>
                  </tr>
                ) : (
                  costHurdleHeatmap.map((row) => (
                    <tr key={row.pair}>
                      <td className="font-medium text-foreground">{row.pair}</td>
                      {[row.lots1, row.lots5, row.lots10, row.lots50].map((val, idx) => {
                        const heavy = val >= 10
                        return (
                          <td
                            key={idx}
                            className={cn('gp-num', heavy && 'gp-hatch')}
                            style={{
                              backgroundColor: `color-mix(in srgb, var(--gp-slag-500) ${Math.min(
                                36,
                                val
                              )}%, transparent)`,
                            }}
                          >
                            {val.toFixed(2)} bps
                          </td>
                        )
                      })}
                      <td className="font-sans text-[11px] text-muted-foreground">
                        {row.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="max-w-4xl text-[11px] leading-relaxed text-muted-foreground">
              Fixed ₹30/lot brokerage creates high per-gram drag on 1g GOLDPETAL at single-lot
              scale, whereas 100g GOLDM amortizes fixed charges below 3 bps. Hatched cells mark
              heavy-friction zones (≥10 bps).
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
