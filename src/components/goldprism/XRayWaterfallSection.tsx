'use client'

import * as React from 'react'
import { Slider } from '@/components/ui/slider'
import {
  computeXRayWaterfall,
  DEFAULT_COST_HURDLE_BPS,
  XRayWaterfallResult,
} from '@/lib/goldprism/xray'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import {
  DataTag,
  Hallmark,
  SectionHead,
  SpectralRule,
  VerdictTag,
  normalizeVerdict,
} from '@/components/goldprism/brand'
import { WaterfallChart, type WaterfallBar } from '@/components/goldprism/waterfall'
import SplitFlapText from '@/components/kokonutui/split-flap-text'
import { bps, inr, inrPerG, signed } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

const CONTRACTS: Array<{ code: SupportedContractCode; label: string }> = [
  { code: 'GOLDM', label: 'GOLDM · 100g' },
  { code: 'GOLDTEN', label: 'GOLDTEN · 10g' },
  { code: 'GOLDGUINEA', label: 'GOLDGUINEA · 8g' },
  { code: 'GOLDPETAL', label: 'GOLDPETAL · 1g' },
]

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Deterministic ISO date rendering, so SSR and client agree. */
function certificateDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`
}

/** One ledger line: label, signed bps, then ₹/g. */
function workLine(
  marker: string,
  label: string,
  valueBps: number,
  valueInrPerG: number
): string {
  return `${marker} ${label.padEnd(14)}${signed(valueBps).padStart(8)} bps   ${inrPerG(valueInrPerG)}`
}

export function XRayWaterfallSection() {
  const [contractA, setContractA] = React.useState<SupportedContractCode>('GOLDTEN')
  const [priceA, setPriceA] = React.useState<number>(74080.0)
  const [expiryA, setExpiryA] = React.useState<string>('2026-04-28')

  const [contractB, setContractB] = React.useState<SupportedContractCode>('GOLDM')
  const [priceB, setPriceB] = React.useState<number>(73510.0)
  const [expiryB, setExpiryB] = React.useState<string>('2026-04-05')

  const [carryRate, setCarryRate] = React.useState<number>(0.065)
  const [settlementArtifact, setSettlementArtifact] = React.useState<number>(14.8)

  const result: XRayWaterfallResult = React.useMemo(() => {
    return computeXRayWaterfall({
      contractA,
      priceAQuoted: priceA,
      expiryA,
      contractB,
      priceBQuoted: priceB,
      expiryB,
      tradeDate: '2026-03-20',
      annualCarryRate: carryRate,
      settlementArtifactInrPerG: settlementArtifact,
    })
  }, [contractA, priceA, expiryA, contractB, priceB, expiryB, carryRate, settlementArtifact])

  /*
   * Deductions are shown as negative movements so the waterfall reconciles:
   * raw gap + (−basis) + (−carry) + (−artifact) = gross residual
   * gross residual + (−costs) = net edge
   */
  const waterfallBars: WaterfallBar[] = [
    {
      label: 'Raw gap',
      bps: result.rawSpreadBps,
      inr: result.rawSpreadInrPerG,
      kind: 'raw',
      working: `normalized ${inrPerG(result.priceANormalized)} − ${inrPerG(result.priceBNormalized)}`,
    },
    {
      label: 'Basis',
      bps: -result.structuralBasisBps,
      inr: -result.structuralBasisInrPerG,
      kind: 'basis',
      working: 'purity and contract-size difference',
    },
    {
      label: 'Carry',
      bps: -result.expiryCarryBps,
      inr: -result.expiryCarryInrPerG,
      kind: 'carry',
      working: `${(carryRate * 100).toFixed(1)}% annual carry across expiries`,
    },
    {
      label: 'Artifact',
      bps: -result.settlementArtifactBps,
      inr: -result.settlementArtifactInrPerG,
      kind: 'artifact',
      working: 'settle vs fill distortion',
    },
    {
      label: 'Residual',
      bps: result.grossResidualBps,
      inr: result.grossResidualInrPerG,
      kind: 'residual',
      working: 'raw gap minus named structure',
    },
    {
      label: 'Cost',
      bps: -result.transactionCostsBps,
      inr: -result.transactionCostsInrPerG,
      kind: 'cost',
      working: 'paired round-trip friction',
    },
    {
      label: 'Net edge',
      bps: result.netEdgeBps,
      inr: result.netEdgeInrPerG,
      kind: 'net',
      working: `judged against a ${DEFAULT_COST_HURDLE_BPS.toFixed(1)} bps hurdle`,
    },
  ]

  const verdict = normalizeVerdict(result.verdict)
  const tradable = verdict === 'TRADABLE'
  const totalCostInr =
    result.costBreakdownA.totalRoundTripInr + result.costBreakdownB.totalRoundTripInr

  const costRows = [
    {
      label: 'Brokerage',
      inr: result.costBreakdownA.brokerageInr + result.costBreakdownB.brokerageInr,
      note: '₹30 per lot per side, both legs',
    },
    {
      label: 'Exchange fee',
      inr: result.costBreakdownA.exchangeChargeInr + result.costBreakdownB.exchangeChargeInr,
      note: '0.0026% of turnover',
    },
    {
      label: 'CTT',
      inr: result.costBreakdownA.cttInr + result.costBreakdownB.cttInr,
      note: '0.01% on the sell leg only',
    },
    {
      label: 'GST',
      inr: result.costBreakdownA.gstInr + result.costBreakdownB.gstInr,
      note: '18% on fees',
    },
    {
      label: 'Stamp duty',
      inr: result.costBreakdownA.stampDutyInr + result.costBreakdownB.stampDutyInr,
      note: '0.002% on the buy side',
    },
    {
      label: 'Slippage',
      inr: result.costBreakdownA.slippageInr + result.costBreakdownB.slippageInr,
      note: '2 bps per leg, 4 bps round trip',
    },
  ]

  /*
   * Signed contributions, not double negatives. The engine stores the basis
   * component as the amount already subtracted, so the ledger flips its sign
   * to show what each component did to the raw gap. The columns then add
   * exactly: raw + basis + carry + artifact = gross residual.
   */
  const reconLedger = [
    workLine(' ', 'raw gap', result.rawSpreadBps, result.rawSpreadInrPerG),
    workLine(' ', 'basis', -result.structuralBasisBps, -result.structuralBasisInrPerG),
    workLine(' ', 'carry', -result.expiryCarryBps, -result.expiryCarryInrPerG),
    workLine(
      ' ',
      'artifact',
      -result.settlementArtifactBps,
      -result.settlementArtifactInrPerG
    ),
    workLine('=', 'gross residual', result.grossResidualBps, result.grossResidualInrPerG),
    '',
    workLine(' ', 'costs', -result.transactionCostsBps, -result.transactionCostsInrPerG),
    workLine('=', 'net edge', result.netEdgeBps, result.netEdgeInrPerG),
  ].join('\n')

  return (
    <section id="xray-waterfall" className="scroll-mt-16 border-b border-border bg-background">
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="01"
          eyebrow="Decision surface · X-Ray"
          title={
            <>
              Split the gap.
              <br />
              Judge only what is left.
            </>
          }
          description="Every MCX gold spread is opened into structural basis, expiry carry and settlement artifact. The residual is then charged the full round-trip cost of trading it."
          aside={
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DataTag synthetic detail="20 Mar 2026" />
                <span className="gp-tag gp-tag--neutral">
                  Config · {result.configHash}
                </span>
              </div>
              <p className="max-w-[20rem] font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground lg:text-right">
                Pair · {result.contractA} / {result.contractB}
                <br />
                Recon tolerance · {result.reconciliationOk ? 'within 0.01 ₹/g' : 'failed'}
              </p>
            </div>
          }
        />

        {/* ---------------- Pair controls ---------------- */}
        <div className="mt-10 border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="gp-label">Pair controls · quoted prices normalize to 999 fine</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Editable · results recompute on change
            </p>
          </div>

          <div className="grid gap-px bg-border md:grid-cols-2">
            <LegControl
              title="Leg A · far expiry"
              code={contractA}
              onCode={setContractA}
              price={priceA}
              onPrice={setPriceA}
              expiry={expiryA}
              onExpiry={setExpiryA}
              normalized={result.priceANormalized}
            />
            <LegControl
              title="Leg B · near expiry"
              code={contractB}
              onCode={setContractB}
              price={priceB}
              onPrice={setPriceB}
              expiry={expiryB}
              onExpiry={setExpiryB}
              normalized={result.priceBNormalized}
            />
          </div>

          <div className="grid gap-6 border-t border-border px-4 py-5 md:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <label className="gp-label" htmlFor="carry-rate">
                  Carry rate · repo proxy
                </label>
                <span className="gp-figure text-sm">{(carryRate * 100).toFixed(1)}%</span>
              </div>
              <Slider
                id="carry-rate"
                value={[carryRate * 100]}
                min={4}
                max={10}
                step={0.5}
                onValueChange={(val) => setCarryRate(val[0] / 100)}
                className="mt-4"
                aria-label="Annual carry rate, percent"
              />
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Applied to the average normalized price across the expiry gap
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-4">
                <label className="gp-label" htmlFor="settlement-artifact">
                  Settlement artifact
                </label>
                <span className="gp-figure text-sm">{inrPerG(settlementArtifact, 1)}</span>
              </div>
              <Slider
                id="settlement-artifact"
                value={[settlementArtifact]}
                min={0}
                max={30}
                step={1}
                onValueChange={(val) => setSettlementArtifact(val[0])}
                className="mt-4"
                aria-label="Settlement artifact, rupees per gram"
              />
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Thin or illiquid settle prices, reported per gram of 999-fine exposure
              </p>
            </div>
          </div>
        </div>

        {/* ---------------- Main 61.8 / aside 38.2 ---------------- */}
        <div className="gp-split mt-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
              <h3 className="gp-serif text-xl">Waterfall · signed components</h3>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                bps of leg A normalized price
              </p>
            </div>

            <div className="mt-6">
              <WaterfallChart bars={waterfallBars} tradable={tradable} />
            </div>

            <div className="mt-8 border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <p className="gp-label">Show the work · reconciliation</p>
                <span
                  className={cn(
                    'gp-tag',
                    result.reconciliationOk ? 'gp-tag--tradable' : 'gp-tag--blocked'
                  )}
                >
                  {result.reconciliationOk ? 'reconciled' : 'recon failed'}
                </span>
              </div>
              <div className="px-4 py-4">
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground">
                  {reconLedger}
                </pre>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>
                    Reconciliation error · {result.reconciliationError.toFixed(6)} ₹/g
                  </span>
                  <span>Tolerance · &lt; 0.01 ₹/g</span>
                </div>
              </div>
            </div>
          </div>

          {/* Assay certificate */}
          <aside className="min-w-0">
            <div className="gp-certificate">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="gp-label">Assay certificate</p>
                  <p className="mt-2 font-mono text-sm text-foreground">
                    No. {certificateDate(result.tradeDate)} · {result.contractA}/
                    {result.contractB}
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {result.expiryA} / {result.expiryB}
                  </p>
                </div>
                <Hallmark verdict={verdict} size={56} />
              </div>

              <dl className="mt-4 space-y-2.5 font-mono text-xs">
                <CertificateRow label="Raw gap" value={bps(result.rawSpreadBps)} />
                <CertificateRow label="Basis" value={bps(-result.structuralBasisBps)} />
                <CertificateRow label="Carry" value={bps(-result.expiryCarryBps)} />
                <CertificateRow
                  label="Artifact"
                  value={bps(-result.settlementArtifactBps)}
                />
                <div className="gp-double-rule flex items-end justify-between gap-4 pt-3">
                  <dt className="gp-label">= Residual</dt>
                  <dd className="gp-figure text-base">{bps(result.grossResidualBps)}</dd>
                </div>
              </dl>

              <SpectralRule className="my-4" />

              <dl className="space-y-2.5 font-mono text-xs">
                <CertificateRow
                  label="Trading cost"
                  value={bps(-result.transactionCostsBps)}
                />
                <div className="gp-double-rule flex items-end justify-between gap-4 pt-3">
                  <dt className="gp-label">= Net edge</dt>
                  <dd
                    className={cn(
                      'gp-figure text-xl',
                      tradable && result.netEdgeBps > 0 ? 'gp-gold-text' : 'text-foreground'
                    )}
                  >
                    {bps(result.netEdgeBps)}
                  </dd>
                </div>
              </dl>

              <dl className="mt-3 space-y-2 border-t border-border pt-3 font-mono text-[11px]">
                <CertificateRow
                  label="Required hurdle"
                  value={bps(DEFAULT_COST_HURDLE_BPS)}
                />
                <CertificateRow
                  label="Edge over hurdle"
                  value={bps(result.netEdgeBps - DEFAULT_COST_HURDLE_BPS)}
                />
              </dl>

              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="gp-label">Verdict</p>
                    <p className="gp-ledger mt-1 text-xl">{result.verdictTitle}</p>
                  </div>
                  <VerdictTag verdict={verdict} />
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                  {result.verdictMessage}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {result.reasonCodes.map((code) => (
                  <span
                    key={code}
                    className="border border-border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    {code}
                  </span>
                ))}
              </div>

              <p className="mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                Synthetic · historical fixture values. Not a live market quotation.
              </p>
            </div>
          </aside>
        </div>

        {/* ---------------- Verdict stamp ---------------- */}
        <div className="mt-12 border-y-[3px] border-double border-[var(--gp-slag-500)] py-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <Hallmark verdict={verdict} size={72} className="gp-verdict-punch" label={false} />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="gp-label">Final verdict</p>
                  <VerdictTag verdict={verdict} />
                </div>
                <p className="gp-ledger mt-2 text-2xl md:text-3xl">{result.verdictTitle}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {result.verdictMessage}
                </p>
              </div>
            </div>

            <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 md:text-right">
              <div>
                <dt className="gp-label">Net edge</dt>
                <dd className="mt-2 flex items-baseline justify-end gap-1.5">
                  <SplitFlapText
                    className="font-mono text-2xl"
                    length={5}
                    text={signed(result.netEdgeBps)}
                    tileClassName={
                      tradable && result.netEdgeBps > 0
                        ? 'text-[var(--gp-gold-ink)]'
                        : undefined
                    }
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    bps
                  </span>
                </dd>
              </div>
              <div>
                <dt className="gp-label">Per gram</dt>
                <dd className="gp-figure mt-2 text-2xl">{inrPerG(result.netEdgeInrPerG)}</dd>
              </div>
              <div className="col-span-2 border-t border-border pt-3">
                <dt className="gp-label">Edge against hurdle</dt>
                <dd className="gp-figure mt-2 text-sm">
                  {bps(result.netEdgeBps - DEFAULT_COST_HURDLE_BPS)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ---------------- Cost table ---------------- */}
        <div className="gp-split mt-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
              <h3 className="gp-serif text-xl">Cost of the round trip</h3>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Both legs · one lot each
              </p>
            </div>

            <table className="gp-table mt-4">
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col" className="gp-num">
                    ₹ · both legs
                  </th>
                  <th scope="col" className="hidden sm:table-cell">
                    Basis
                  </th>
                </tr>
              </thead>
              <tbody>
                {costRows.map((row) => (
                  <tr key={row.label}>
                    <td className="text-foreground">{row.label}</td>
                    <td className="gp-num text-foreground">{inr(row.inr)}</td>
                    <td className="hidden text-muted-foreground sm:table-cell">{row.note}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total friction</td>
                  <td className="gp-num">{inr(totalCostInr)}</td>
                  <td className="hidden text-muted-foreground sm:table-cell">
                    {bps(result.transactionCostsBps)} · {inrPerG(result.transactionCostsInrPerG)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="min-w-0">
            <div className="border border-border bg-card p-4">
              <p className="gp-label">How to read the verdict</p>
              <ul className="mt-4 space-y-3 text-[12px] leading-relaxed text-muted-foreground">
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 bg-[var(--gp-slag-800)]" aria-hidden="true" />
                  <span>Grey bars are structure we can name. They are explained away, not edge.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 gp-hatch border border-[var(--gp-slag-500)]" aria-hidden="true" />
                  <span>Hatched bars are not clean measurements: grey hatch marks cost drag, and the same hatch marks synthetic or estimated inputs.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 bg-[var(--gp-gold-500)]" aria-hidden="true" />
                  <span>Gold appears only when the residual survives the cost hurdle.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-[var(--gp-slag-500)]" aria-hidden="true" />
                  <span>One verdict per screen. A quiet day is not an error.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function LegControl({
  title,
  code,
  onCode,
  price,
  onPrice,
  expiry,
  onExpiry,
  normalized,
}: {
  title: string
  code: SupportedContractCode
  onCode: (code: SupportedContractCode) => void
  price: number
  onPrice: (price: number) => void
  expiry: string
  onExpiry: (expiry: string) => void
  normalized: number
}) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="gp-label">{title}</p>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {inrPerG(normalized, 2)} · 999
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="gp-label" htmlFor={`contract-${title}`}>
            Contract
          </label>
          <select
            id={`contract-${title}`}
            value={code}
            onChange={(e) => onCode(e.target.value as SupportedContractCode)}
            className="gp-field gp-select mt-1 text-sm"
          >
            {CONTRACTS.map((contract) => (
              <option key={contract.label} value={contract.code}>
                {contract.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="gp-label" htmlFor={`price-${title}`}>
            Quoted price
          </label>
          <input
            id={`price-${title}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={price}
            onChange={(e) => onPrice(parseFloat(e.target.value) || 0)}
            className="gp-field mt-1 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="gp-label" htmlFor={`expiry-${title}`}>
            Expiry
          </label>
          <input
            id={`expiry-${title}`}
            type="date"
            value={expiry}
            onChange={(e) => onExpiry(e.target.value)}
            className="gp-field mt-1 text-sm"
          />
        </div>
      </div>
    </div>
  )
}

function CertificateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <dt className="gp-label">{label}</dt>
      <dd className="gp-figure text-foreground">{value}</dd>
    </div>
  )
}
