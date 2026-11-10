/**
 * Brand figure rules (GP-03):
 * - true minus (−), never a hyphen
 * - always show the sign on bps
 * - one decimal for bps
 * - ₹ before the number, /g after
 * - unit is lower case: bps, never BPS
 */

export const MINUS = "\u2212";
export const NBSP = "\u00a0";

export function num(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return Math.abs(value).toFixed(digits);
}

/** Absolute value with a true-minus prefix when negative. */
export function absSigned(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const body = Math.abs(value).toFixed(digits);
  return value < 0 ? `${MINUS}${body}` : body;
}

/** Always signed: +4.0, −5.2, 0.0 */
export function signed(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const body = Math.abs(value).toFixed(digits);
  if (value < 0) return `${MINUS}${body}`;
  if (value > 0) return `+${body}`;
  return body;
}

export function bps(value: number, digits = 1): string {
  return `${signed(value, digits)} bps`;
}

/** ₹ before the number. Negative reads as −₹30.17. */
export function inr(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const body = Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return value < 0 ? `${MINUS}₹${body}` : `₹${body}`;
}

export function inrPerG(value: number, digits = 2): string {
  return `${inr(value, digits)}/g`;
}

export function pct(value: number, digits = 1): string {
  return `${signed(value, digits)}%`;
}

/** Plain percentage, never signed — for ratios and explanatory copy. */
export function pctAbs(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.abs(value).toFixed(digits)}%`;
}

export function unitBps(value: number, digits = 1): string {
  return `${absSigned(value, digits)}${NBSP}bps`;
}
