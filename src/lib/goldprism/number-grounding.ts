/**
 * LLM Number-Grounding Validator — GoldPrism
 * ==========================================
 * Enforces the strict quantitative rule:
 *   "The LLM NEVER computes or invents numbers. Every figure in its answer must
 *    cite an artifact ID / source row. Validate the response: if it contains a
 *    number not present in the tool results, reject or flag it."
 */

export interface GroundingValidationResult {
  ok: boolean;
  extractedNumbers: number[];
  groundedNumbers: number[];
  ungroundedNumbers: number[];
  citedArtifactIds: string[];
  expectedArtifactIds: string[];
  missingArtifactCitation: boolean;
}

/**
 * Recursively collects all finite numeric literals from any JSON tool payload,
 * including both raw values and common rounded representations (1, 2, 4 decimals).
 */
export function collectToolNumbers(payload: unknown): number[] {
  const nums = new Set<number>();

  function walk(node: unknown) {
    if (typeof node === 'number' && Number.isFinite(node)) {
      nums.add(node);
      nums.add(Math.abs(node));
      nums.add(Number(node.toFixed(1)));
      nums.add(Number(node.toFixed(2)));
      nums.add(Math.round(node));
      return;
    }
    if (typeof node === 'string') {
      // Extract date components like 2025, 06, 30 or numbers embedded in strings
      const matches = node.match(/-?\d[\d,]*(?:\.\d+)?/g);
      if (matches) {
        for (const m of matches) {
          const val = Number(m.replace(/,/g, ''));
          if (Number.isFinite(val)) {
            nums.add(val);
            nums.add(Math.abs(val));
          }
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === 'object') {
      for (const val of Object.values(node)) walk(val);
    }
  }

  walk(payload);
  return Array.from(nums);
}

/**
 * Extracts numeric tokens from markdown/prose text, ignoring markdown heading numbers
 * or trivial list indices (e.g. "1." at start of line) and dates formatted as YYYY-MM-DD
 * only after validating date tokens separately.
 */
export function extractNumericTokensFromProse(text: string): number[] {
  // Strip artifact IDs like [ART-CMP-GOLDM-GOLDTEN-2025-06-30] before numeric scan
  const withoutArtifacts = text.replace(/\[?ART-[A-Z0-9._-]+\]?/g, ' ');
  // Strip ISO dates YYYY-MM-DD so year/month/day don't masquerade as financial figures,
  // unless we want to verify dates too — actually tool payloads contain the date string!
  const withoutListBullets = withoutArtifacts.replace(/^\s*\d+\.\s+/gm, ' ');

  const regex = /(?:^|[\s(₹+−-])([+-]?\d[\d,]*(?:\.\d+)?)(?=%|\s|$|[),.:;a-zA-Z])/g;
  const found: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(withoutListBullets)) !== null) {
    const raw = match[1].replace(/,/g, '');
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      found.push(parsed);
    }
  }
  return found;
}

export function validateResponseGrounding(
  responseText: string,
  toolResults: unknown[],
  expectedArtifactIds: string[]
): GroundingValidationResult {
  const allowedNumbers = collectToolNumbers(toolResults);
  // Also allow standard structural constants explicitly defined in contractSpecs / methodology (10g, 8g, 1g, 100g, 995, 999, 5 bps hurdle)
  const structuralAllowlist = [1, 2, 3, 4, 5, 8, 10, 18, 20, 30, 50, 100, 365, 995, 999, 1000, 10000];
  for (const s of structuralAllowlist) {
    allowedNumbers.push(s);
  }

  const extractedNumbers = extractNumericTokensFromProse(responseText);
  const groundedNumbers: number[] = [];
  const ungroundedNumbers: number[] = [];

  for (const n of extractedNumbers) {
    const absN = Math.abs(n);
    const isGrounded = allowedNumbers.some((allowed) => {
      const absA = Math.abs(allowed);
      const tol = Math.max(0.05, absA * 0.002); // 0.2% or 0.05 rounding tolerance
      return Math.abs(absN - absA) <= tol;
    });
    if (isGrounded) {
      groundedNumbers.push(n);
    } else {
      ungroundedNumbers.push(n);
    }
  }

  const citedArtifactIds = expectedArtifactIds.filter((id) => responseText.includes(id));
  const missingArtifactCitation =
    expectedArtifactIds.length > 0 && citedArtifactIds.length === 0;

  return {
    ok: ungroundedNumbers.length === 0 && !missingArtifactCitation,
    extractedNumbers,
    groundedNumbers,
    ungroundedNumbers,
    citedArtifactIds,
    expectedArtifactIds,
    missingArtifactCitation,
  };
}
