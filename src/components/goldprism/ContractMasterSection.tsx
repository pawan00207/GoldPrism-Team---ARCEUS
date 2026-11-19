'use client'

import * as React from 'react'
import {
  CONTRACT_MASTER,
  getAllContractSpecs,
  normalizePriceTo999,
  SupportedContractCode,
} from '@/lib/goldprism/contract-master'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag, SectionHead } from '@/components/goldprism/brand'
import { inr, inrPerG } from '@/lib/goldprism/format'

export function ContractMasterSection() {
  const { feed, loading } = useLiveFeed()
  const specs = getAllContractSpecs()
  const [selectedContract, setSelectedContract] = React.useState<SupportedContractCode>('GOLDM')
  const [manualPrice, setManualPrice] = React.useState<string>('')
  const [manualOverride, setManualOverride] = React.useState<boolean>(false)

  const liveQuote = feed?.contracts?.[selectedContract] ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && liveQuote !== null

  const activePriceStr = manualOverride
    ? manualPrice
    : liveQuote
      ? String(Math.round(liveQuote.quotedPrice))
      : ''

  const priceNum = parseFloat(activePriceStr) || 0
  const normResult = React.useMemo(() => {
    if (priceNum <= 0) return null
    try {
      return normalizePriceTo999(priceNum, selectedContract)
    } catch {
      return null
    }
  }, [priceNum, selectedContract])

  return (
    <section id="contract-master" className="scroll-mt-16 border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="02.2"
          eyebrow="Market structure · Contract master"
          title="A gram is not a gram until it is 999."
          description="Authoritative lot sizes, quoted units, delivery windows and purity. Every price is normalized to one fine-gold benchmark before any spread is compared."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <DataTag
                live={isLive && !manualOverride}
                synthetic={manualOverride || !isLive}
                detail={
                  manualOverride
                    ? 'User what-if override'
                    : isLive && feed?.asOf
                      ? `Live ${feed.asOf.slice(0, 19).replace('T', ' ')} UTC`
                      : loading
                        ? 'syncing'
                        : 'offline'
                }
              />
              <p className="max-w-[19rem] font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground lg:text-right">
                Source · MCX India commodity derivatives contract specifications
              </p>
            </div>
          }
        />

        {/* ---------------- Specification table ---------------- */}
        <div className="mt-8 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
            <p className="gp-label">Verified contract specifications</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {specs.length} contracts · 999-fine benchmark
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  <th scope="col">Contract</th>
                  <th scope="col" className="gp-num">Trading unit</th>
                  <th scope="col" className="gp-num">Quoted per</th>
                  <th scope="col">Purity</th>
                  <th scope="col" className="gp-num">Tick size</th>
                  <th scope="col">Expiry window</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source reference</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.contractCode}>
                    <td>
                      <div className="font-medium text-foreground">{spec.contractCode}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {spec.name}
                      </div>
                    </td>
                    <td className="gp-num text-foreground">{spec.tradingUnitG} g</td>
                    <td className="gp-num text-muted-foreground">{spec.quoteUnitG} g</td>
                    <td>
                      <span
                        className={
                          spec.purityFine === 995
                            ? 'gp-tag gp-tag--watch'
                            : 'gp-tag gp-tag--neutral'
                        }
                      >
                        {spec.purityFine}/1000 · {spec.purityFine === 995 ? 'near 24k' : '24k'}
                      </span>
                    </td>
                    <td className="gp-num">{inr(spec.tickSizeInr, 0)}</td>
                    <td className="text-muted-foreground">{spec.expiryWindow}</td>
                    <td>
                      <span className="gp-tag gp-tag--tradable">Verified</span>
                    </td>
                    <td
                      className="max-w-[18rem] truncate text-[10px] text-muted-foreground"
                      title={spec.sourceReference}
                    >
                      {spec.sourceReference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------- Audit note + normalizer ---------------- */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,61.8%)_minmax(0,38.2%)]">
          <div className="min-w-0 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
              <p className="gp-label">Contract specification audit</p>
              <span className="gp-tag gp-tag--watch">Resolved</span>
            </div>

            <div className="px-4 py-5">
              <h3 className="gp-serif text-xl">
                GOLDGUINEA purity: 996 or 999?
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                An earlier automated test script assumed a purity of 996. The contract master
                records the verified specification against the official MCX India commodity
                derivatives contract specifications circular.
              </p>

              <dl className="mt-5 grid gap-px overflow-hidden rounded-[4px] border border-border bg-border sm:grid-cols-3">
                <div className="bg-card p-3.5">
                  <dt className="gp-label">Official standard</dt>
                  <dd className="mt-1.5 font-mono text-sm text-foreground">999 fine · 24 carat</dd>
                </div>
                <div className="bg-card p-3.5">
                  <dt className="gp-label">Trading unit</dt>
                  <dd className="mt-1.5 font-mono text-sm text-foreground">8 g · 1 guinea lot</dd>
                </div>
                <div className="bg-card p-3.5">
                  <dt className="gp-label">Quotation</dt>
                  <dd className="mt-1.5 font-mono text-sm text-foreground">Per 8 g</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-[4px] border border-[var(--gp-gold-500)]/40 bg-background/70 p-4">
                <p className="gp-label">Resolution</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  999.0 purity is enforced in the contract master. This prevents cross-contract
                  basis drift when GOLDM, GOLDTEN, GOLDGUINEA and GOLDPETAL are compared as if
                  they were the same metal.
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
              <div>
                <p className="gp-label">Fine-gold normalizer</p>
                <h3 className="gp-serif mt-0.5 text-lg">Convert to ₹/g at 999.</h3>
              </div>
              {manualOverride ? (
                <button
                  type="button"
                  onClick={() => {
                    setManualOverride(false)
                    setManualPrice('')
                  }}
                  className="gp-button min-h-0 px-2.5 py-1 text-[10px]"
                >
                  Use Live Quote
                </button>
              ) : null}
            </div>

            <div className="px-4 py-5">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="gp-label" htmlFor="normalizer-contract">
                    Contract
                  </label>
                  <select
                    id="normalizer-contract"
                    value={selectedContract}
                    onChange={(e) => {
                      setSelectedContract(e.target.value as SupportedContractCode)
                      setManualOverride(false)
                    }}
                    className="gp-field gp-select mt-1 text-sm"
                  >
                    <option value="GOLDM">GOLDM · 100g · 995</option>
                    <option value="GOLDTEN">GOLDTEN · 10g · 999</option>
                    <option value="GOLDGUINEA">GOLDGUINEA · 8g · 999</option>
                    <option value="GOLDPETAL">GOLDPETAL · 1g · 999</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="gp-label" htmlFor="normalizer-price">
                      Quoted price {manualOverride ? '(what-if)' : '(live)'}
                    </label>
                    <label className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={manualOverride}
                        onChange={(e) => {
                          const next = e.target.checked
                          setManualOverride(next)
                          if (next && liveQuote && !manualPrice) {
                            setManualPrice(String(Math.round(liveQuote.quotedPrice)))
                          }
                        }}
                      />
                      Manual what-if
                    </label>
                  </div>
                  <input
                    id="normalizer-price"
                    type="number"
                    inputMode="decimal"
                    readOnly={!manualOverride}
                    value={activePriceStr}
                    onChange={(e) => {
                      setManualOverride(true)
                      setManualPrice(e.target.value)
                    }}
                    className="gp-field mt-1 text-sm"
                    placeholder={loading ? 'Syncing live price…' : 'Enter what-if quote'}
                  />
                </div>
              </div>

              {normResult ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="gp-label">Normalized 999-fine benchmark</p>
                  <p className="gp-figure mt-2 text-2xl">{inrPerG(normResult.normalizedPrice)}</p>

                  <div className="mt-4 space-y-1.5 border-t border-border pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {normResult.trace.stepByStep.map((step, idx) => (
                      <p key={idx}>{step}</p>
                    ))}
                  </div>
                  {liveQuote && !manualOverride ? (
                    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      Source · {liveQuote.source} · as_of {liveQuote.asOf.slice(0, 19).replace('T', ' ')} UTC
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
                  {loading
                    ? 'Connecting to public global gold and FX feeds…'
                    : 'Live quote unavailable. Toggle "Manual what-if" above to run a hypothetical calculation.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
