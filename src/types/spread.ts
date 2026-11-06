/**
 * Spread and Waterfall type definitions — GoldPrism
 */

export type XRayVerdict = 'TRADABLE' | 'WATCH' | 'NO EDGE' | 'BLOCKED';

export interface XRayWaterfallParams {
  contractA: 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';
  priceAQuoted: number;
  expiryA: string;
  lotsA?: number;
  contractB: 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';
  priceBQuoted: number;
  expiryB: string;
  lotsB?: number;
  tradeDate: string;
  annualCarryRate?: number;
  settlementArtifactInrPerG?: number;
  dataQualityOk?: boolean;
  liquidityOk?: boolean;
  trustFlags?: string[];
}

export interface XRayWaterfallResult {
  contractA: string;
  contractB: string;
  expiryA: string;
  expiryB: string;
  tradeDate: string;
  priceAQuoted: number;
  priceBQuoted: number;
  priceANormalized: number;
  priceBNormalized: number;
  rawSpreadInrPerG: number;
  structuralBasisInrPerG: number;
  expiryCarryInrPerG: number;
  settlementArtifactInrPerG: number;
  grossResidualInrPerG: number;
  transactionCostsInrPerG: number;
  netEdgeInrPerG: number;
  rawSpreadBps: number;
  structuralBasisBps: number;
  expiryCarryBps: number;
  settlementArtifactBps: number;
  grossResidualBps: number;
  transactionCostsBps: number;
  netEdgeBps: number;
  reconciliationSum: number;
  reconciliationError: number;
  reconciliationOk: boolean;
  verdict: XRayVerdict;
  verdictTitle: string;
  verdictMessage: string;
  reasonCodes: string[];
  trustFlags: string[];
  configHash: string;
  timestamp: string;
}
