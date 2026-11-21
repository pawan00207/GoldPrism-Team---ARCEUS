export interface WalletLedgerSnapshot {
  gGOLD_balance: number
  usdt_balance: number
  transactions: Array<{ id: string }>
}

export function walletSnapshotsMatch(
  left: WalletLedgerSnapshot,
  right: WalletLedgerSnapshot
): boolean {
  return (
    left.gGOLD_balance === right.gGOLD_balance &&
    left.usdt_balance === right.usdt_balance &&
    left.transactions.length === right.transactions.length &&
    left.transactions.every(
      (transaction, index) => transaction.id === right.transactions[index]?.id
    )
  )
}
