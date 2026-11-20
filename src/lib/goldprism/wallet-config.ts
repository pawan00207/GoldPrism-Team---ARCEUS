export const WALLET_CONFIG = {
  xrayReportUnlockFeeGGold: 0.001,
} as const

export const WALLET_PAYMENT_CONFIG = {
  minAmountInr: 1,
  maxAmountInr: 100_000,
  suggestedAmountsInr: [100, 500, 1000],
} as const

export function isValidWalletPaymentAmount(amountInr: number): boolean {
  const amountPaise = Math.round(amountInr * 100)
  return (
    Number.isSafeInteger(amountPaise) &&
    Math.abs(amountInr * 100 - amountPaise) < 0.000001 &&
    amountInr >= WALLET_PAYMENT_CONFIG.minAmountInr &&
    amountInr <= WALLET_PAYMENT_CONFIG.maxAmountInr
  )
}
