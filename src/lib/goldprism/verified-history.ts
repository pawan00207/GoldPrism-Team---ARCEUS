import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatasetProvenance, HistoricalBhavcopyRow } from './historical-store';
import { contractSpecs, type ContractSymbol } from './contract-specs';

const root = path.join(process.cwd(), 'research', 'data', 'verified');
const manifestPath = path.join(root, 'manifest.json');
type Corpus = { rows: HistoricalBhavcopyRow[]; provenance: DatasetProvenance };
let cached: { manifest: string; fileStamp: string; corpus: Corpus } | undefined;

/** Only the manifest pointer is mutable. Its checksum identifies the exact research input. */
export function loadVerifiedHistory(): Corpus | null {
  if (!fs.existsSync(manifestPath)) return null;
  const rawManifest = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  if (manifest.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
      !['CLOSE', 'SETTLEMENT'].includes(manifest.priceBasis)) {
    throw new Error('Historical data manifest is invalid.');
  }
  const corpusPath = path.join(process.cwd(), 'research', 'data', 'verified', manifest.sha256 + '.json');
  const stat = fs.statSync(corpusPath);
  const fileStamp = [stat.mtimeMs, stat.ctimeMs, stat.size].join('/');
  if (cached?.manifest === rawManifest && cached.fileStamp === fileStamp) return cached.corpus;
  const bytes = fs.readFileSync(corpusPath);
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) {
    throw new Error('Historical data checksum mismatch. Rebuild the archive before replaying.');
  }
  const records = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(records) || !records.length || records.length !== manifest.totalRecords) {
    throw new Error('Historical data row count differs from the manifest.');
  }
  const rows: HistoricalBhavcopyRow[] = records.map((r) => {
    const symbol = r.symbol as ContractSymbol;
    const spec = contractSpecs[symbol];
    if (!spec || !Number.isFinite(r.mark) || r.mark <= 0) throw new Error('Invalid historical price record.');
    return {
      symbol, rawDate: r.tradeDate, tradeDate: r.tradeDate, expiryDate: r.expiryDate,
      expiryCode: r.expiryCode, open: r.open, high: r.high, low: r.low, close: r.close,
      // The compatibility field holds the observed mark. The manifest identifies its price basis.
      settle: r.mark, volume: r.volume, contracts: r.volume, openInterest: r.openInterest,
      purity: spec.purityFinePerThousand, tradingUnitG: spec.tradingUnitGrams,
      quoteUnitG: spec.quotedPerGrams, shortHistoryFlag: symbol === 'GOLDTEN',
    };
  });
  const days = [...new Set(rows.map((r) => r.tradeDate))].sort();
  const trainDays = days.filter((d) => d < manifest.holdoutStartDate);
  const corpus: Corpus = { rows, provenance: {
    datasetName: manifest.datasetName, sha256Hash: manifest.sha256,
    dateRangeStart: days[0], dateRangeEnd: days[days.length - 1], tradingDaysCount: days.length,
    totalRecords: rows.length, networkStatus: 'Frozen end-of-day archive',
    priceBasis: manifest.priceBasis, provenanceStatus: manifest.provenanceStatus,
    fetchTimestamp: manifest.createdAt,
    trainingEndDate: trainDays[trainDays.length - 1] ?? '', holdoutStartDate: manifest.holdoutStartDate,
    holdoutEndDate: days[days.length - 1], holdoutBoundarySource: 'Historical evaluation split in acquisition manifest (retrospective)',
    configHash: manifest.configHash,
  } };
  cached = { manifest: rawManifest, fileStamp, corpus };
  return corpus;
}
