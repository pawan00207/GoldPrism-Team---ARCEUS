import assert from 'node:assert/strict'
import test from 'node:test'
import {
  walletSnapshotsMatch,
  type WalletLedgerSnapshot,
} from '../../src/lib/goldprism/wallet-ledger'

const wallet: WalletLedgerSnapshot = {
  gGOLD_balance: 1.25,
  usdt_balance: 2,
  transactions: [{ id: 'txn-1' }, { id: 'txn-2' }],
}

test('wallet snapshot guard permits the same saved balance and transaction order', () => {
  const saved = {
    ...wallet,
    transactions: wallet.transactions.map((transaction) => ({ ...transaction })),
  }
  assert.equal(walletSnapshotsMatch(wallet, saved), true)
})

test('wallet snapshot guard rejects stale balance or transaction history', () => {
  assert.equal(
    walletSnapshotsMatch(wallet, { ...wallet, gGOLD_balance: 0.75 }),
    false
  )
  assert.equal(
    walletSnapshotsMatch(wallet, { ...wallet, transactions: [{ id: 'txn-2' }, { id: 'txn-1' }] }),
    false
  )
})
