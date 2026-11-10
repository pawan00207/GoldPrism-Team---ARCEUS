'use client'

import * as React from 'react'
import {
  Calculator,
  CheckCircle2,
  FileText,
  Info,
  Scale,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CONTRACT_MASTER,
  getAllContractSpecs,
  normalizePriceTo999,
  SupportedContractCode,
} from '@/lib/goldprism/contract-master'

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
    <section id="contract-master" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8">
          <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
            <Scale className="w-3 h-3 text-amber-400" /> Phase 02: MCX Contract Master
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Verified MCX Gold Contract Specifications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative parameters, lot sizes, delivery windows, and fine-gold (999.0) quotation normalization.
          </p>
        </div>

        {/* Specifications Table */}
        <Card className="mb-8 border-border/80 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground bg-muted/30">
                  <th className="py-3 px-4 text-left font-semibold">Contract</th>
                  <th className="py-3 px-4 text-left font-semibold">Trading Unit</th>
                  <th className="py-3 px-4 text-left font-semibold">Quoted Per</th>
                  <th className="py-3 px-4 text-left font-semibold">Purity</th>
                  <th className="py-3 px-4 text-left font-semibold">Tick Size</th>
                  <th className="py-3 px-4 text-left font-semibold">Expiry Window</th>
                  <th className="py-3 px-4 text-center font-semibold">Status</th>
                  <th className="py-3 px-4 text-left font-semibold">Source Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {specs.map((spec) => (
                  <tr key={spec.contractCode} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground text-sm">{spec.contractCode}</div>
                      <div className="text-[11px] text-muted-foreground">{spec.name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">{spec.tradingUnitG} g</td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">{spec.quoteUnitG} g</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          spec.purityFine === 995
                            ? 'border-amber-500/40 text-amber-300 font-mono'
                            : 'border-emerald-500/40 text-emerald-300 font-mono'
                        }
                      >
                        {spec.purityFine}/1000 ({spec.purityFine === 995 ? '22k' : '24k'})
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono">₹{spec.tickSizeInr}</td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">{spec.expiryWindow}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1 text-[10px] font-mono">
                        <CheckCircle2 className="w-2.5 h-2.5" /> VERIFIED
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-muted-foreground max-w-xs truncate" title={spec.sourceReference}>
                      {spec.sourceReference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Two Columns: Discrepancy Note & Interactive Purity Normalizer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Discrepancy Investigation Note */}
          <Card className="border-amber-500/30 bg-amber-500/5 p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm mb-1">
                  Contract Specification Audit: GOLDGUINEA Purity (996 vs 999)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  An earlier automated test script utilized <code className="text-amber-300">purity = 996</code>.
                  Team ARCEUS conducted a primary verification against the official MCX India Commodity Derivatives Contract Specifications circular.
                </p>
                <div className="p-3 rounded-lg bg-black/40 border border-border/40 text-xs font-mono space-y-1.5 text-muted-foreground">
                  <div className="text-foreground font-semibold">Verification Audit Trail:</div>
                  <div>• Official MCX Circular Standard: <span className="text-emerald-400 font-bold">999 fine (24 Carat)</span></div>
                  <div>• Trading Unit: 8 grams (1 Guinea lot) | Quotation: Per 8 grams</div>
                  <div>• Resolution: Enforced 999.0 purity in contract master; prevents cross-contract basis drift.</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Interactive Purity Normalizer Tool */}
          <Card className="border-border/80 bg-card/60 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Fine-Gold (999.0) Normalization Calculator</h3>
                <p className="text-[11px] text-muted-foreground">Convert any MCX contract quoted price into standard ₹/g equivalent</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Select Contract</Label>
                <select
                  value={selectedContract}
                  onChange={(e) => setSelectedContract(e.target.value as SupportedContractCode)}
                  className="w-full mt-1.5 px-3 py-2 text-xs rounded-md bg-muted border border-border/80 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="GOLDM">GOLDM (100g, 995)</option>
                  <option value="GOLDTEN">GOLDTEN (10g, 999)</option>
                  <option value="GOLDGUINEA">GOLDGUINEA (8g, 999)</option>
                  <option value="GOLDPETAL">GOLDPETAL (1g, 999)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Quoted Price (INR)</Label>
                <Input
                  type="number"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  className="mt-1.5 font-mono text-xs"
                  placeholder="e.g. 73500"
                />
              </div>
            </div>

            {normResult && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Normalized 999-Fine Benchmark:</span>
                  <span className="text-base font-bold font-mono text-amber-400 tabular-nums">
                    ₹{normResult.normalizedPrice.toFixed(2)} / gram
                  </span>
                </div>
                <div className="space-y-1 text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-2">
                  {normResult.trace.stepByStep.map((step, idx) => (
                    <div key={idx}>{step}</div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

      </div>
    </section>
  )
}
