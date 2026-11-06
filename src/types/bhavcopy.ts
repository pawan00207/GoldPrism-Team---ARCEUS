/**
 * Bhavcopy schema type definitions — GoldPrism
 */

export interface BhavcopyRow {
  symbol: string;
  date: string;
  expiryDate: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  settlePrice: number;
  contracts: number;
  volume: number;
  openInterest: number;
  rawLineIndex: number;
}

export interface NormalizedBhavcopyRecord extends BhavcopyRow {
  purityFine: number;
  quoteUnitG: number;
  tradingUnitG: number;
  normalizedSettlePerG: number;
  normalizedClosePerG: number;
  trustStatus: 'VERIFIED' | 'THIN_SETTLE' | 'FLAGGED';
  flags: string[];
}

export interface RejectedRow {
  lineIndex: number;
  symbol: string;
  date: string;
  expiryDate: string;
  reasonCode: string;
  reasonDescription: string;
  rawRow: string;
}

export interface IngestionResult {
  sourceProvider: string;
  originalFileName: string;
  sha256Hash: string;
  retrievalTimestamp: string;
  requestedDate: string | null;
  totalRowsRaw: number;
  totalRowsValidated: number;
  totalRowsRejected: number;
  status: 'PASSED' | 'FAILED' | 'PARTIAL';
  statusSummary: string;
  rejectedRows: RejectedRow[];
  validatedRecords: NormalizedBhavcopyRecord[];
  availableContracts: string[];
  uniqueExpiries: string[];
  dataMode: 'USER_UPLOAD' | 'HISTORICAL_FIXTURE' | 'SIMULATED' | 'VERIFIED_EXTERNAL';
}
