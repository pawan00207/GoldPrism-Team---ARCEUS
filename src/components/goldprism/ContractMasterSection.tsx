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
import { Badge } from '@astryxdesign/core/Badge'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import type { TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'

interface ContractSpecRow extends Record<string, unknown> {
  id: string
  code: string
  name: string
  tradingUnit: string
  quoteUnit: string
  purity: number
  tick: string
  expiry: string
  status: string
  source: string
}

const SPEC_COLUMNS: TableColumn<ContractSpecRow>[] = [
  {
    key: 'code',
    header: 'Contract',
    width: proportional(2, { minWidth: 150 }),
    renderCell: (row) => (
      <VStack gap={0}>
        <Text type="inherit" weight="semibold">
          {row.code}
        </Text>
        <Text type="inherit" size="2xs" color="secondary">
          {row.name}
        </Text>
      </VStack>
    ),
  },
  { key: 'tradingUnit', header: 'Trading unit', width: pixel(104), align: 'end' },
  { key: 'quoteUnit', header: 'Quoted per', width: pixel(104), align: 'end' },
  {
    key: 'purity',
    header: 'Purity',
    width: proportional(1),
    // Only the exception earns a badge; 999 is the norm.
    renderCell: (row) =>
      row.purity === 995 ? (
        <Badge variant="warning" label="995 · near 24k" />
      ) : (
        <Text type="inherit" color="secondary">
          999 · 24k
        </Text>
      ),
  },
  { key: 'tick', header: 'Tick size', width: pixel(92), align: 'end' },
  {
    key: 'expiry',
    header: 'Expiry window',
    width: proportional(1, { minWidth: 120 }),
  },
  { key: 'status', header: 'Status', width: pixel(92) },
  {
    key: 'source',
    header: 'Source reference',
    width: proportional(2, { minWidth: 160 }),
    renderCell: (row) => (
      <Text type="inherit" size="2xs" color="secondary" maxLines={1}>
        {row.source}
      </Text>
    ),
  },
]

export function ContractMasterSection() {
  const specs = getAllContractSpecs()
  const [selectedContract, setSelectedContract] = React.useState<SupportedContractCode>('GOLDM')
  const [inputPrice, setInputPrice] = React.useState<string>('73500')

  const specRows: ContractSpecRow[] = specs.map((spec) => ({
    id: spec.contractCode,
    code: spec.contractCode,
    name: spec.name,
    tradingUnit: `${spec.tradingUnitG} g`,
    quoteUnit: `${spec.quoteUnitG} g`,
    purity: spec.purityFine,
    tick: inr(spec.tickSizeInr, 0),
    expiry: spec.expiryWindow,
    status: 'Verified',
    source: spec.sourceReference,
  }))

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

          <Table
            data={specRows}
            columns={SPEC_COLUMNS}
            idKey="id"
            density="compact"
            dividers="grid"
            hasHover
          />
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
                <Selector
                  label="Contract"
                  value={selectedContract}
                  onChange={(value) =>
                    setSelectedContract(value as SupportedContractCode)
                  }
                  options={[
                    { value: 'GOLDM', label: 'GOLDM · 100g · 995' },
                    { value: 'GOLDTEN', label: 'GOLDTEN · 10g · 999' },
                    { value: 'GOLDGUINEA', label: 'GOLDGUINEA · 8g · 999' },
                    { value: 'GOLDPETAL', label: 'GOLDPETAL · 1g · 999' },
                  ]}
                />

                <TextInput
                  label="Quoted price"
                  inputMode="decimal"
                  value={inputPrice}
                  onChange={setInputPrice}
                  placeholder="e.g. 73500"
                />
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
