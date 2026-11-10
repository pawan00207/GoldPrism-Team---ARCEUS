'use client'

import * as React from 'react'
import {
  CONTRACT_MASTER,
  getAllContractSpecs,
  normalizePriceTo999,
  SupportedContractCode,
} from '@/lib/goldprism/contract-master'
import { SectionHead } from '@/components/goldprism/brand'
import { inr, inrPerG } from '@/lib/goldprism/format'

export function ContractMasterSection() {
  const specs = getAllContractSpecs()
  const [selectedContract, setSelectedContract] = React.useState<SupportedContractCode>('GOLDM')
  const [inputPrice, setInputPrice] = React.useState<string>('73500')

  const priceNum = parseFloat(inputPrice) || 0
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
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="02.2"
          eyebrow="Market structure · Contract master"
          title="A gram is not a gram until it is 999."
          description="Authoritative lot sizes, quoted units, delivery windows and purity. Every price is normalized to one fine-gold benchmark before any spread is compared."
          aside={
            <p className="max-w-[19rem] font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground lg:text-right">
              Source · MCX India commodity derivatives contract specifications
            </p>
          }
        />

        {/* ---------------- Specification table ---------------- */}
        <div className="mt-10 border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
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
        <div className="gp-split mt-10">
          <div className="min-w-0 border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="gp-label">Contract specification audit</p>
              <span className="gp-tag gp-tag--watch">Resolved</span>
            </div>

            <div className="px-4 py-5">
              <h3 className="gp-serif text-2xl">
                GOLDGUINEA purity: 996 or 999?
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                An earlier automated test script assumed a purity of 996. The contract master
                records the verified specification against the official MCX India commodity
                derivatives contract specifications circular.
              </p>

              <dl className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-3">
                <div className="bg-card p-4">
                  <dt className="gp-label">Official standard</dt>
                  <dd className="mt-2 font-mono text-sm text-foreground">999 fine · 24 carat</dd>
                </div>
                <div className="bg-card p-4">
                  <dt className="gp-label">Trading unit</dt>
                  <dd className="mt-2 font-mono text-sm text-foreground">8 g · 1 guinea lot</dd>
                </div>
                <div className="bg-card p-4">
                  <dt className="gp-label">Quotation</dt>
                  <dd className="mt-2 font-mono text-sm text-foreground">Per 8 g</dd>
                </div>
              </dl>

              <div className="mt-5 border-l-2 border-[var(--gp-gold-500)] pl-4">
                <p className="gp-label">Resolution</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  999.0 purity is enforced in the contract master. This prevents cross-contract
                  basis drift when GOLDM, GOLDTEN, GOLDGUINEA and GOLDPETAL are compared as if
                  they were the same metal.
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="gp-label">Fine-gold normalizer</p>
              <h3 className="gp-serif mt-1 text-xl">Convert to ₹/g at 999.</h3>
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
                    onChange={(e) =>
                      setSelectedContract(e.target.value as SupportedContractCode)
                    }
                    className="gp-field gp-select mt-1 text-sm"
                  >
                    <option value="GOLDM">GOLDM · 100g · 995</option>
                    <option value="GOLDTEN">GOLDTEN · 10g · 999</option>
                    <option value="GOLDGUINEA">GOLDGUINEA · 8g · 999</option>
                    <option value="GOLDPETAL">GOLDPETAL · 1g · 999</option>
                  </select>
                </div>

                <div>
                  <label className="gp-label" htmlFor="normalizer-price">
                    Quoted price
                  </label>
                  <input
                    id="normalizer-price"
                    type="number"
                    inputMode="decimal"
                    value={inputPrice}
                    onChange={(e) => setInputPrice(e.target.value)}
                    className="gp-field mt-1 text-sm"
                    placeholder="e.g. 73500"
                  />
                </div>
              </div>

              {normResult ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="gp-label">Normalized 999-fine benchmark</p>
                  <p className="gp-figure mt-2 text-3xl">{inrPerG(normResult.normalizedPrice)}</p>

                  <div className="mt-4 space-y-1.5 border-t border-border pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {normResult.trace.stepByStep.map((step, idx) => (
                      <p key={idx}>{step}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
                  Enter a positive quoted price to normalize it.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
