/**
 * 5-Minute Judge Demo Script — GoldPrism
 * ========================================
 * Implements the deterministic 4-step evaluation script from Slide 7
 * ("5 Minutes to Truth: From data to decision in one view"):
 *
 * STEP 1: CAUGHT FAULT
 *   Seeded error CSV triggers data integrity gates.
 *   Date mismatch, outlier, missing value caught.
 *   Status: "Failed: run blocked".
 *
 * STEP 2: X-RAY WATERFALL
 *   Clean MCX gold pair decomposition.
 *   Raw spread → Structural basis → Carry → Settlement artifact → Residual.
 *
 * STEP 3: INACTION VERDICT
 *   Net edge after costs is negative or noise.
 *   Verdict: NO EDGE (or WATCH).
 *   Proves when NOT to trade.
 *
 * STEP 4: BEST VEHICLE
 *   Ranks contracts for target exposure (e.g. 50g).
 *   Proves optimal hedge vehicle.
 *
 * Team ARCEUS · Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
 */

import { parseAndValidateBhavcopyCsv, IngestionResult } from './data-adapter';
import { computeXRayWaterfall, XRayWaterfallResult } from './xray';
import { rankBestVehicleForExposure, VehicleRank } from './signal';
import { CLEAN_MCX_BHAVCOPY_CSV, SEEDED_ERROR_BHAVCOPY_CSV } from './fixtures';

export interface JudgeDemoState {
  currentStep: 1 | 2 | 3 | 4;
  step1Data: IngestionResult;
  step2Data: XRayWaterfallResult;
  step3Data: XRayWaterfallResult;
  step4Data: VehicleRank[];
  exposureChoiceG: number;
  isSeededErrorActive: boolean;
}

export function initializeJudgeDemo(): JudgeDemoState {
  // Step 1: Ingest seeded error file
  const step1Data = parseAndValidateBhavcopyCsv(SEEDED_ERROR_BHAVCOPY_CSV, {
    requestedDate: '2026-03-20',
    fileName: 'mcx_bhavcopy_seeded_fault.csv',
    dataMode: 'HISTORICAL_FIXTURE',
  });

  // Step 2: Clean X-Ray Waterfall (GOLDM vs GOLDTEN)
  const step2Data = computeXRayWaterfall({
    contractA: 'GOLDTEN',
    priceAQuoted: 74080.0,
    expiryA: '2026-04-28',
    contractB: 'GOLDM',
    priceBQuoted: 73510.0,
    expiryB: '2026-04-05',
    tradeDate: '2026-03-20',
    annualCarryRate: 0.065,
    settlementArtifactInrPerG: 14.8,
  });

  // Step 3: Inaction Verdict (Pair with thin gross residual that gets eaten by transaction costs)
  const step3Data = computeXRayWaterfall({
    contractA: 'GOLDTEN',
    priceAQuoted: 74080.0,
    expiryA: '2026-04-28',
    contractB: 'GOLDPETAL',
    priceBQuoted: 7410.0,
    expiryB: '2026-04-28',
    tradeDate: '2026-03-20',
    annualCarryRate: 0.065,
    settlementArtifactInrPerG: 0.0,
  });

  // Step 4: Best vehicle for 50g exposure
  const step4Data = rankBestVehicleForExposure(50);

  return {
    currentStep: 1,
    step1Data,
    step2Data,
    step3Data,
    step4Data,
    exposureChoiceG: 50,
    isSeededErrorActive: true,
  };
}
