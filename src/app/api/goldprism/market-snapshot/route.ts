import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  auditContractSpecsConsistency,
  compareNormalizedContracts,
  contractSpecs,
  ContractSymbol,
} from '@/lib/goldprism/contract-specs';
import {
  getSnapshotAsOf,
  loadDatasetProvenance,
} from '@/lib/goldprism/historical-store';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const rawDate = req.nextUrl.searchParams.get('date') ?? undefined;
    const parsed = QuerySchema.safeParse({ date: rawDate });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const provenance = loadDatasetProvenance();
    const targetDate = parsed.data.date ?? provenance.dateRangeEnd;
    const snapshot = getSnapshotAsOf(targetDate);
    const specAudit = auditContractSpecsConsistency();

    if (snapshot.marketStatus === 'DATA_UNAVAILABLE' || !snapshot.resolvedTradeDate) {
      return NextResponse.json({
        status: 'DATA_UNAVAILABLE',
        message: `Data unavailable for ${targetDate}. Available MCX Bhavcopy history spans ${provenance.dateRangeStart} to ${provenance.dateRangeEnd}.`,
        requestedDate: targetDate,
        resolvedTradeDate: null,
        asOf: targetDate,
        source: provenance.datasetName,
      priceBasis: provenance.priceBasis,
      provenanceStatus: provenance.provenanceStatus,
        sha256Hash: provenance.sha256Hash,
        networkStatus: provenance.networkStatus,
        contractSpecs,
        specAudit,
        contracts: [],
        comparison: [],
      });
    }

    // Pick nearest active expiry per contract symbol for the official quote snapshot
    const symbols: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
    const contractQuotes = symbols.map((sym) => {
      const rows = snapshot.recordsOnResolvedDate
        .filter((r) => r.symbol === sym)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const near = rows[0] ?? null;
      return {
        symbol: sym,
        spec: contractSpecs[sym],
        available: Boolean(near),
        unavailableReason: near
          ? null
          : `No archived row for ${sym} on ${snapshot.resolvedTradeDate}`,
        record: near
          ? {
              symbol: near.symbol,
              tradeDate: near.tradeDate,
              expiryDate: near.expiryDate,
              expiryCode: near.expiryCode,
              open: near.open,
              high: near.high,
              low: near.low,
              close: near.close,
              settle: near.settle,
              volume: near.volume,
              openInterest: near.openInterest,
            }
          : null,
      };
    });

    const comparisonInputs = contractQuotes
      .filter((c) => c.available && c.record)
      .map((c) => ({
        symbol: c.symbol,
        quotedPrice: c.record!.settle,
        expiryDate: c.record!.expiryDate,
        asOf: c.record!.tradeDate,
        source: `${provenance.datasetName} (${provenance.sha256Hash.slice(0, 12)})`,
      }));

    const comparison =
      comparisonInputs.length > 0
        ? compareNormalizedContracts(comparisonInputs, 'GOLDM')
        : [];

    return NextResponse.json({
      status: 'OFFLINE_SNAPSHOT',
      marketBanner: `Historical ${provenance.priceBasis.toLowerCase()} · ${snapshot.resolvedTradeDate} · ${provenance.datasetName}`,
      requestedDate: targetDate,
      resolvedTradeDate: snapshot.resolvedTradeDate,
      staleDays: snapshot.staleDays,
      asOf: snapshot.resolvedTradeDate,
      source: provenance.datasetName,
      priceBasis: provenance.priceBasis,
      provenanceStatus: provenance.provenanceStatus,
      sha256Hash: provenance.sha256Hash,
      networkStatus: provenance.networkStatus,
      dateRange: {
        start: provenance.dateRangeStart,
        end: provenance.dateRangeEnd,
      },
      contractSpecs,
      specAudit,
      contracts: contractQuotes,
      comparison,
    });
  } catch (err) {
    console.error('Market snapshot API error:', err);
    return NextResponse.json(
      {
        error: 'Failed to load MCX market snapshot',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
