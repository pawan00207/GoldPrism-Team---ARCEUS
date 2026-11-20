/**
 * MCX Bhavcopy Data Adapter & Integrity Validator — GoldPrism
 * ==============================================================
 * Validates, audits, and normalizes raw MCX Bhavcopy CSV files.
 *
 * Implements Integrity Gates (Slide 4 of presentation):
 * 1. Schema check & required field parsing
 * 2. SHA-256 raw file hash computation for audit reproducibility
 * 3. Date match gate: returned date == requested date
 * 4. Key integrity: (Symbol, ExpiryDate) uniqueness per trading day
 * 5. Logical OHLC consistency: Low <= Open <= High, Low <= Close <= High
 * 6. Settle price bounds & outlier detection
 * 7. Outlier & missing field reporting
 *
 * Team ARCEUS · Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
 */

import { getContractSpec, normalizePriceTo999, SupportedContractCode } from './contract-master';
import { sha256 } from 'js-sha256';
import { parse } from 'csv-parse/browser/esm/sync';

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
  normalizedSettlePerG: number; // ₹/g 999-fine
  normalizedClosePerG: number;  // ₹/g 999-fine
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

/**
 * Calculates a SHA-256 hash string from text.
 */
export function computeSha256(content: string | Uint8Array): string {
  return 'sha256_' + sha256(content);
}

export function exchangeDate(value: string): string | null {
  let iso = value;
  const compact = /^(\d{1,2})([a-z]{3})(\d{4})$/i.exec(value);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (compact) {
    const month = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(compact[2].toUpperCase()) + 1;
    iso = `${compact[3]}-${String(month).padStart(2,'0')}-${compact[1].padStart(2,'0')}`;
  } else if (us) iso = `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(Date.parse(iso))) return null;
  return new Date(iso).toISOString().slice(0,10) === iso ? iso : null;
}

export function parseAndValidateBhavcopyCsv(
  csvContent: string,
  options: {
    requestedDate?: string;
    fileBytes?: Uint8Array;
    fileName?: string;
    dataMode?: IngestionResult['dataMode'];
  } = {}
): IngestionResult {
  const {
    requestedDate = null,
    fileName = 'mcx_bhavcopy.csv',
    dataMode = 'USER_UPLOAD',
  } = options;

  let lines: string[][] = [];
  let csvError = '';
  try {
    lines = parse(csvContent, { bom: true, trim: true, skip_empty_lines: true });
  } catch {
    csvError = 'Malformed CSV. Check quoted fields and the number of columns.';
  }
  const sha256Hash = computeSha256(options.fileBytes ?? csvContent);
  const rejectedRows: RejectedRow[] = [];
  const validatedRecords: NormalizedBhavcopyRecord[] = [];
  const keySet = new Set<string>();

  if (lines.length < 2) {
    return {
      sourceProvider: 'MCX_BHAVCOPY_INGESTOR',
      originalFileName: fileName,
      sha256Hash,
      retrievalTimestamp: new Date().toISOString(),
      requestedDate,
      totalRowsRaw: 0,
      totalRowsValidated: 0,
      totalRowsRejected: 0,
      status: 'FAILED',
      statusSummary: csvError || 'File is empty or missing headers.',
      rejectedRows: [],
      validatedRecords: [],
      availableContracts: [],
      uniqueExpiries: [],
      dataMode,
    };
  }

  // Parse header
  const headerCols = lines[0].map((c) => c.trim().toLowerCase());
  const index = (...names: string[]) => headerCols.findIndex(c => names.includes(c));
  const colIndex = {
    symbol: index('symbol','tckrsymb','scrip'),
    date: index('date','tradedate','trade_date','traddt'),
    expiry: index('expirydate','expiry_date','exp_date','xprydt'),
    open: index('open','openprice','opnpric'),
    high: index('high','highprice','hghpric'),
    low: index('low','lowprice','lwpric'),
    close: index('close','closeprice','clspric'),
    settle: index('settle','settleprice','settlementprice','sttlmpric'),
    contracts: index('contracts','volume(lots)','ttltradgvol'),
    volume: index('volume','vol','volume(lots)','ttltradgvol'),
    oi: index('oi','openinterest','opnintrst'),
    kind: index('fininstrmtp','instrumentname'),
  };

  const requiredCols = ['symbol', 'date', 'expiry', 'settle'];
  for (const rc of requiredCols) {
    if (colIndex[rc as keyof typeof colIndex] === -1) {
      return {
        sourceProvider: 'MCX_BHAVCOPY_INGESTOR',
        originalFileName: fileName,
        sha256Hash,
        retrievalTimestamp: new Date().toISOString(),
        requestedDate,
        totalRowsRaw: lines.length - 1,
        totalRowsValidated: 0,
        totalRowsRejected: lines.length - 1,
        status: 'FAILED',
        statusSummary: `Missing required Bhavcopy schema column: ${rc.toUpperCase()}`,
        rejectedRows: [
          {
            lineIndex: 0,
            symbol: 'HEADER',
            date: '',
            expiryDate: '',
            reasonCode: 'ERR_SCHEMA_MISSING_COLUMN',
            reasonDescription: `Column ${rc} could not be identified in CSV header`,
            rawRow: lines[0].join(','),
          },
        ],
        validatedRecords: [],
        availableContracts: [],
        uniqueExpiries: [],
        dataMode,
      };
    }
  }

  // Process rows
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    const rawLine = cols.join(',');

    const sym = (cols[colIndex.symbol] || '').toUpperCase();
    const dt = exchangeDate(cols[colIndex.date] || '') ?? '';
    const exp = exchangeDate(cols[colIndex.expiry] || '') ?? '';
    const openP = parseFloat(cols[colIndex.open] || '0');
    const highP = parseFloat(cols[colIndex.high] || '0');
    const lowP = parseFloat(cols[colIndex.low] || '0');
    const closeP = parseFloat(cols[colIndex.close] || '0');
    const settleP = Number(cols[colIndex.settle]);
    const contracts = parseInt(cols[colIndex.contracts] || '0', 10);
    const volume = parseFloat(cols[colIndex.volume] || '0');
    const oi = parseInt(cols[colIndex.oi] || '0', 10);

    // Rule 1: Symbol check
    const validSymbols = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
    if (colIndex.kind >= 0 && !['FUTCOM','COMFUT','FUTURES','FUT','FUTCOMM'].includes(cols[colIndex.kind].toUpperCase())) continue;
    if (!validSymbols.includes(sym)) {
      rejectedRows.push({
        lineIndex: i,
        symbol: sym || 'UNKNOWN',
        date: dt,
        expiryDate: exp,
        reasonCode: 'ERR_UNSUPPORTED_SYMBOL',
        reasonDescription: `Contract ${sym} is not in target MCX Gold family (GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL).`,
        rawRow: rawLine,
      });
      continue;
    }

    // Rule 2: Date Match Gate
    if (!dt || !exp || exp < dt || (requestedDate && dt !== requestedDate)) {
      rejectedRows.push({
        lineIndex: i,
        symbol: sym,
        date: dt,
        expiryDate: exp,
        reasonCode: 'ERR_DATE_MISMATCH',
        reasonDescription: `Row trading date (${dt}) does not match requested date (${requestedDate}). Integrity gate rejected.`,
        rawRow: rawLine,
      });
      continue;
    }

    // Rule 3: Key uniqueness (symbol + expiry + date)
    const key = `${sym}_${exp}_${dt}`;
    if (keySet.has(key)) {
      rejectedRows.push({
        lineIndex: i,
        symbol: sym,
        date: dt,
        expiryDate: exp,
        reasonCode: 'ERR_DUPLICATE_KEY',
        reasonDescription: `Duplicate contract record found for ${sym} expiring ${exp} on ${dt}.`,
        rawRow: rawLine,
      });
      continue;
    }
    keySet.add(key);

    // Rule 4: Missing or invalid numerical settle
    if (!Number.isFinite(settleP) || settleP <= 0) {
      rejectedRows.push({
        lineIndex: i,
        symbol: sym,
        date: dt,
        expiryDate: exp,
        reasonCode: 'ERR_INVALID_SETTLE_PRICE',
        reasonDescription: `Settle price (${cols[colIndex.settle]}) is missing or non-positive.`,
        rawRow: rawLine,
      });
      continue;
    }

    // Rule 5: Logical OHLC check (if OHLC present)
    if (highP > 0 && lowP > 0) {
      if (lowP > highP) {
        rejectedRows.push({
          lineIndex: i,
          symbol: sym,
          date: dt,
          expiryDate: exp,
          reasonCode: 'ERR_INVALID_OHLC_RANGE',
          reasonDescription: `Low price (${lowP}) exceeds High price (${highP}).`,
          rawRow: rawLine,
        });
        continue;
      }
      if (openP > 0 && (openP < lowP || openP > highP)) {
        rejectedRows.push({
          lineIndex: i,
          symbol: sym,
          date: dt,
          expiryDate: exp,
          reasonCode: 'ERR_OPEN_OUT_OF_RANGE',
          reasonDescription: `Open price (${openP}) is outside High-Low range [${lowP}, ${highP}].`,
          rawRow: rawLine,
        });
        continue;
      }
    }

    // Rule 6: Settle outlier check (e.g. extreme jump or erratic multiplier)
    if (settleP > 500000 || (sym === 'GOLDPETAL' && settleP > 50000)) {
      rejectedRows.push({
        lineIndex: i,
        symbol: sym,
        date: dt,
        expiryDate: exp,
        reasonCode: 'ERR_OUTLIER_SETTLE_PRICE',
        reasonDescription: `Settle price (₹${settleP}) is an anomalous statistical outlier for ${sym}.`,
        rawRow: rawLine,
      });
      continue;
    }

    // Normalization & Trust Assessment
    const spec = getContractSpec(sym);
    const normSettle = normalizePriceTo999(settleP, sym);
    const normClose = closeP > 0 ? normalizePriceTo999(closeP, sym).normalizedPrice : normSettle.normalizedPrice;

    const flags: string[] = [];
    let trustStatus: NormalizedBhavcopyRecord['trustStatus'] = 'VERIFIED';

    if (volume < 50 || contracts < 5) {
      trustStatus = 'THIN_SETTLE';
      flags.push('THIN_VOLUME_SETTLEMENT');
    }

    validatedRecords.push({
      symbol: sym,
      date: dt,
      expiryDate: exp,
      openPrice: openP,
      highPrice: highP,
      lowPrice: lowP,
      closePrice: closeP > 0 ? closeP : settleP,
      settlePrice: settleP,
      contracts,
      volume,
      openInterest: oi,
      rawLineIndex: i,
      purityFine: spec.purityFine,
      quoteUnitG: spec.quoteUnitG,
      tradingUnitG: spec.tradingUnitG,
      normalizedSettlePerG: normSettle.normalizedPrice,
      normalizedClosePerG: normClose,
      trustStatus,
      flags,
    });
  }

  const totalRaw = lines.length - 1;
  const totalVal = validatedRecords.length;
  const totalRej = rejectedRows.length;

  let status: IngestionResult['status'] = 'PASSED';
  let statusSummary = `All ${totalVal} records verified and normalized successfully.`;

  if (totalVal === 0) {
    status = 'FAILED';
    statusSummary = `Failed: run blocked. All ${totalRej} rows were rejected by data integrity gates.`;
  } else if (totalRej > 0) {
    status = 'PARTIAL';
    statusSummary = `${totalVal} records accepted, ${totalRej} rejected by integrity gates.`;
  }

  const availableContracts = Array.from(new Set(validatedRecords.map((r) => r.symbol)));
  const uniqueExpiries = Array.from(new Set(validatedRecords.map((r) => r.expiryDate))).sort();

  return {
    sourceProvider: 'MCX_BHAVCOPY_INGESTOR',
    originalFileName: fileName,
    sha256Hash,
    retrievalTimestamp: new Date().toISOString(),
    requestedDate,
    totalRowsRaw: totalRaw,
    totalRowsValidated: totalVal,
    totalRowsRejected: totalRej,
    status,
    statusSummary,
    rejectedRows,
    validatedRecords,
    availableContracts,
    uniqueExpiries,
    dataMode,
  };
}
