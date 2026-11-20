'use client'

import * as React from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ExternalLink, ShieldCheck } from 'lucide-react'
import { useGoldMarket } from '@/hooks/use-gold-market'
import { useMcxMarketWatch } from '@/hooks/use-mcx-market-watch'
import { pricePerGramInr } from '@/lib/goldprism/gold-market'
import { buildWalletCatalog } from '@/lib/goldprism/wallet-catalog'

const STORAGE_KEY = 'goldprism-token-wallet-v1'

type WalletTransactionType = 'MINT' | 'SPEND' | 'SWAP'

interface WalletTransaction {
  id: string
  type: WalletTransactionType
  amount: number
  detail: string
  txHash: string
  time: string
  paymentId?: string
  orderId?: string
  usdtAmount?: number
}

interface WalletData {
  gGOLD_balance: number
  usdt_balance: number
  transactions: WalletTransaction[]
}

const EMPTY_WALLET: WalletData = { gGOLD_balance: 0, usdt_balance: 0, transactions: [] }

function isWalletData(value: unknown): value is WalletData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return (
    typeof data.gGOLD_balance === 'number' &&
    Number.isFinite(data.gGOLD_balance) &&
    data.gGOLD_balance >= 0 &&
    typeof data.usdt_balance === 'number' &&
    Number.isFinite(data.usdt_balance) &&
    data.usdt_balance >= 0 &&
    Array.isArray(data.transactions) &&
    data.transactions.every((transaction) => {
      if (!transaction || typeof transaction !== 'object') return false
      const item = transaction as Record<string, unknown>
      return (
        typeof item.id === 'string' &&
        (item.type === 'MINT' || item.type === 'SPEND' || item.type === 'SWAP') &&
        typeof item.amount === 'number' &&
        typeof item.detail === 'string' &&
        typeof item.txHash === 'string' &&
        typeof item.time === 'string'
      )
    })
  )
}

function formatNumber(value: number, digits = 4) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value)
}

function inr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

function secureHex(byteCount: number) {
  const bytes = new Uint8Array(byteCount)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function makeOrderId() {
  return `GP-${secureHex(3).toUpperCase()}`
}

function makeTransaction(type: WalletTransactionType, amount: number, detail: string): WalletTransaction {
  return {
    id: secureHex(8),
    type,
    amount,
    detail,
    txHash: `0x${secureHex(32)}`,
    time: new Date().toISOString(),
  }
}

export function GoldTokenWallet() {
  const market = useGoldMarket()
  const mcxMarket = useMcxMarketWatch()
  const live = market.status === 'live' ? market.data : null
  const goldmQuote =
    mcxMarket.status === 'available'
      ? mcxMarket.data.quotes.find((quote) => quote.symbol === 'GOLDM' && quote.freshness !== 'Stale') ?? null
      : null
  const goldpetalQuote =
    mcxMarket.status === 'available'
      ? mcxMarket.data.quotes.find((quote) => quote.symbol === 'GOLDPETAL' && quote.freshness !== 'Stale') ?? null
      : null
  const catalog = React.useMemo(
    () =>
      buildWalletCatalog({
        paxgPriceInrPerTroyOunce: live?.paxg.inr ?? null,
        paxgFetchedAt: live?.fetchedAt ?? null,
        goldmQuote,
        goldpetalQuote,
      }),
    [live, goldmQuote, goldpetalQuote]
  )
  const [wallet, setWallet] = React.useState<WalletData>(EMPTY_WALLET)
  const [storageReady, setStorageReady] = React.useState(false)
  const [storageError, setStorageError] = React.useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = React.useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = React.useState<'UPI' | 'Card'>('UPI')
  const [swapAmount, setSwapAmount] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<{ orderId: string; message: string } | null>(null)

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (!isWalletData(parsed)) throw new Error('Saved wallet data is invalid and was not changed.')
        setWallet(parsed)
      }
      setStorageReady(true)
    } catch (loadError) {
      setStorageError(
        loadError instanceof Error
          ? loadError.message
          : 'Browser storage is unavailable; wallet actions are disabled.',
      )
    }
  }, [])

  React.useEffect(() => {
    const syncWallet = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const parsed: unknown = JSON.parse(event.newValue)
        if (!isWalletData(parsed)) throw new Error('Wallet data changed in another tab but is invalid.')
        setWallet(parsed)
      } catch (syncError) {
        setStorageError(syncError instanceof Error ? syncError.message : 'Could not sync wallet changes.')
      }
    }
    window.addEventListener('storage', syncWallet)
    return () => window.removeEventListener('storage', syncWallet)
  }, [])

  const commitWallet = (next: WalletData) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setWallet(next)
      setStorageError(null)
      return true
    } catch {
      setStorageError('Wallet could not be saved to browser storage. Check available storage and try again.')
      return false
    }
  }

  const finishPayment = () => {
    setError(null)
    if (!paymentAmount) return
    if (!live) {
      setError('Live PAXG price is required before minting. Wait for the quote to load and retry.')
      return
    }
    const minted = paymentAmount / pricePerGramInr(live.paxg.inr)
    if (!Number.isFinite(minted) || minted <= 0) {
      setError('The live PAXG quote cannot be used to calculate a mint amount.')
      return
    }
    const paymentId = `pay_${secureHex(4)}`
    const entry = {
      ...makeTransaction('MINT', minted, `Mint from simulated ₹${paymentAmount} payment`),
      paymentId,
    }
    const next = {
      ...wallet,
      gGOLD_balance: wallet.gGOLD_balance + minted,
      transactions: [entry, ...wallet.transactions],
    }
    if (commitWallet(next)) {
      setPaymentAmount(null)
      setSuccess({
        orderId: paymentId,
        message: `Payment simulated successfully. Minted ${formatNumber(minted)} gGOLD at the live PAXG rate.`,
      })
    }
  }

  const buyItem = (item: (typeof catalog)[number]) => {
    setError(null)
    if (item.gGoldCost === null || item.inrValue === null) {
      setError(`${item.name} is unavailable until its live price inputs are available.`)
      return
    }
    if (wallet.gGOLD_balance < item.gGoldCost) {
      setError(`Insufficient Balance — ${item.name} costs ${formatNumber(item.gGoldCost)} gGOLD.`)
      return
    }
    const orderId = makeOrderId()
    const entry = {
      ...makeTransaction('SPEND', item.gGoldCost, item.name),
      orderId,
    }
    const next = {
      ...wallet,
      gGOLD_balance: wallet.gGOLD_balance - item.gGoldCost,
      transactions: [entry, ...wallet.transactions],
    }
    if (commitWallet(next)) {
      setSuccess({
        orderId,
        message: `${item.name} purchased for ${formatNumber(item.gGoldCost)} gGOLD (${inr(item.inrValue)} equivalent). Source: ${item.source}. As of ${item.asOf ?? 'unavailable'}. Demo wallet only.`,
      })
    }
  }

  const swapToUsdt = () => {
    setError(null)
    const amount = Number(swapAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a gGOLD amount greater than zero.')
      return
    }
    if (!live) {
      setError('Live PAXG price is required to calculate the USDT quote. Wait for live data and retry.')
      return
    }
    if (wallet.gGOLD_balance < amount) {
      setError('Insufficient Balance — your gGOLD balance is lower than the amount requested.')
      return
    }
    const usdtAmount = amount * (live.paxg.usd / 31.1035)
    const orderId = makeOrderId()
    const entry = {
      ...makeTransaction('SWAP', amount, 'gGOLD to USDT'),
      orderId,
      usdtAmount,
    }
    const next = {
      ...wallet,
      gGOLD_balance: wallet.gGOLD_balance - amount,
      usdt_balance: wallet.usdt_balance + usdtAmount,
      transactions: [entry, ...wallet.transactions],
    }
    if (commitWallet(next)) {
      setSwapAmount('')
      setSuccess({ orderId, message: `Swapped ${formatNumber(amount)} gGOLD for ${formatNumber(usdtAmount, 2)} simulated USDT at the live PAXG USD price.` })
    }
  }

  const gGoldInrValue = live
    ? wallet.gGOLD_balance * pricePerGramInr(live.paxg.inr)
    : null
  const usdtQuote = live && Number(swapAmount) > 0
    ? Number(swapAmount) * (live.paxg.usd / 31.1035)
    : 0
  const actionsDisabled = !storageReady || !!storageError

  return (
    <section className="gp-container py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Demo only: payments, products, USDT, and Sepolia transaction references are simulated. No real money is charged, no gold is held, and no blockchain mint occurs.
          </p>
        </div>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Razorpay-style test flow</span>
      </div>

      {storageError || error ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert">
          <span>{storageError ?? error}</span>
          {error && !storageError ? (
            <button type="button" className="shrink-0 font-mono text-[9px] uppercase underline" onClick={() => setError(null)}>Dismiss</button>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300" role="status">
          <span>{success.message} · Ref {success.orderId}</span>
          <button type="button" className="font-mono text-[9px] uppercase underline" onClick={() => setSuccess(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <BalanceCard label="gGOLD balance" value={`${formatNumber(wallet.gGOLD_balance)} g`} detail="Persistent in this browser" />
        <BalanceCard label="Live INR value" value={gGoldInrValue === null ? 'Fetching live…' : inr(gGoldInrValue)} detail={live ? 'Using live CoinGecko PAXG / gram' : 'Waiting for live PAXG price'} />
        <BalanceCard label="USDT balance" value={`${formatNumber(wallet.usdt_balance, 2)} USDT`} detail="Received from demo swaps" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-4 sm:p-5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">01 · Pay to mint</p>
            <h2 className="mt-1 font-serif text-2xl text-foreground">Choose a test amount</h2>
            <p className="mt-1 text-xs text-muted-foreground">gGOLD is calculated only after the simulated payment succeeds, using live PAXG INR / gram.</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[100, 500, 1000].map((amount) => (
              <button
                type="button"
                key={amount}
                disabled={actionsDisabled || !live}
                onClick={() => { setError(null); setPaymentAmount(amount) }}
                className="rounded-sm border border-border bg-background px-2 py-3 font-mono text-xs text-foreground transition-colors hover:border-[var(--gp-caramel)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pay {inr(amount)}
              </button>
            ))}
          </div>
          {!live ? <p className="mt-3 text-[10px] text-muted-foreground">Fetching live PAXG quote; payment buttons unlock when pricing is available.</p> : null}
        </div>

        <div className="rounded-md border border-border bg-card p-4 sm:p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">02 · Spend gGOLD</p>
          <h2 className="mt-1 font-serif text-2xl text-foreground">Trade utilities &amp; swap</h2>
          <div className="mt-4 space-y-2">
            {catalog.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background/70 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.name}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      · {item.gGoldCost === null ? 'Unavailable' : `${formatNumber(item.gGoldCost)} gGOLD`}
                    </span>
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    INR equivalent · {item.inrValue === null ? 'Unavailable' : inr(item.inrValue)}
                  </p>
                  <p className="mt-1 font-mono text-[8px] text-muted-foreground">
                    Source · {item.source} · As of {item.asOf ?? 'unavailable'}
                  </p>
                </div>
                <button type="button" disabled={actionsDisabled || item.gGoldCost === null || item.inrValue === null} onClick={() => buyItem(item)} className="rounded-sm bg-foreground px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-background hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50">Buy</button>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-sm border border-border p-3">
            <label htmlFor="swap-amount" className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Swap gGOLD to USDT</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id="swap-amount"
                type="number"
                min="0"
                step="0.0001"
                inputMode="decimal"
                value={swapAmount}
                onChange={(event) => setSwapAmount(event.target.value)}
                placeholder="gGOLD amount"
                className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 font-mono text-xs text-foreground"
              />
              <span className="font-mono text-[10px] text-muted-foreground">≈ {live ? `${formatNumber(usdtQuote, 2)} USDT` : 'Fetching live…'}</span>
              <button type="button" disabled={actionsDisabled} onClick={swapToUsdt} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-foreground hover:border-[var(--gp-caramel)] disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
              </button>
            </div>
            {live ? <p className="mt-2 text-[9px] text-muted-foreground">Quote: live PAXG USD / troy ounce ÷ 31.1035 · demo swap, no fees or execution.</p> : null}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">03 · Activity</p>
            <h2 className="mt-1 font-serif text-xl text-foreground">Transaction history</h2>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">{wallet.transactions.length} saved transactions</span>
        </div>
        {wallet.transactions.length ? (
          <ol className="divide-y divide-border">
            {wallet.transactions.map((transaction) => (
              <li key={transaction.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase text-muted-foreground">
                  {transaction.type === 'MINT' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {transaction.type}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-foreground">{transaction.detail} · {formatNumber(transaction.amount)} gGOLD{transaction.usdtAmount ? ` → ${formatNumber(transaction.usdtAmount, 2)} USDT` : ''}</p>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${transaction.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex max-w-full items-center gap-1 truncate font-mono text-[9px] text-muted-foreground underline-offset-2 hover:underline"
                    title="Simulated transaction hash; it is not broadcast to Sepolia"
                  >
                    {transaction.txHash} <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  </a>
                  {transaction.paymentId ? <p className="font-mono text-[9px] text-muted-foreground">Payment ref: {transaction.paymentId}</p> : null}
                  {transaction.orderId ? <p className="font-mono text-[9px] text-muted-foreground">Order: {transaction.orderId}</p> : null}
                </div>
                <time dateTime={transaction.time} className="font-mono text-[9px] text-muted-foreground">{new Date(transaction.time).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No transactions yet. Complete a simulated payment to mint gGOLD.</p>
        )}
      </div>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
        Tokenization reference: Paxos model · 1 token represents 1 troy ounce of gold. This gGOLD demo is gram-denominated (1 gGOLD = 1 gram reference) and is not backed by or redeemable for physical gold.
      </p>

      {paymentAmount !== null ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentAmount(null) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="payment-title" className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Secure checkout · test mode</p>
                <h2 id="payment-title" className="mt-1 font-serif text-2xl text-foreground">Pay {inr(paymentAmount)}</h2>
              </div>
              <button type="button" onClick={() => setPaymentAmount(null)} className="font-mono text-[10px] text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Payment method">
              {(['UPI', 'Card'] as const).map((method) => (
                <button key={method} type="button" role="tab" aria-selected={paymentMethod === method} onClick={() => setPaymentMethod(method)} className={`rounded-sm border px-3 py-2.5 text-xs ${paymentMethod === method ? 'border-[var(--gp-caramel)] bg-[var(--gp-caramel)]/10 text-foreground' : 'border-border text-muted-foreground'}`}>
                  {method === 'UPI' ? 'UPI · test' : 'Card · test'}
                </button>
              ))}
            </div>
            {paymentMethod === 'UPI' ? (
              <div className="mt-4 rounded-sm border border-border bg-background p-4">
                <p className="text-sm text-foreground">Test UPI checkout</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose “Pay success” to simulate a Razorpay test payment. No UPI app will be contacted.</p>
                <label className="mt-3 block text-[10px] text-muted-foreground" htmlFor="upi-id">UPI ID (demo display only)</label>
                <input id="upi-id" defaultValue="demo@razorpay" className="mt-1 h-9 w-full rounded-sm border border-border bg-card px-3 font-mono text-xs text-foreground" />
              </div>
            ) : (
              <div className="mt-4 space-y-3 rounded-sm border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Razorpay-style test card entry · never sent anywhere</p>
                <label className="block text-[10px] text-muted-foreground" htmlFor="card-number">Card number (demo display only)</label>
                <input id="card-number" inputMode="numeric" placeholder="4242 4242 4242 4242" className="h-9 w-full rounded-sm border border-border bg-card px-3 font-mono text-xs text-foreground" />
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Expiry (demo)" placeholder="MM / YY" className="h-9 rounded-sm border border-border bg-card px-3 font-mono text-xs text-foreground" />
                  <input aria-label="CVV (demo)" inputMode="numeric" placeholder="CVV" className="h-9 rounded-sm border border-border bg-card px-3 font-mono text-xs text-foreground" />
                </div>
              </div>
            )}
            <p className="mt-3 font-mono text-[9px] text-muted-foreground">Demo mint estimate: {live ? `${formatNumber(paymentAmount / pricePerGramInr(live.paxg.inr))} gGOLD` : 'waiting for live price'}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPaymentAmount(null)} className="h-11 flex-1 rounded-sm border border-border font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Cancel</button>
              <button type="button" disabled={!live || actionsDisabled} onClick={finishPayment} className="h-11 flex-1 rounded-sm bg-[var(--gp-tradable-ink)] px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-white disabled:cursor-not-allowed disabled:opacity-50">Pay success · test</button>
            </div>
          </div>
        </div>
      ) : null}

      {success ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSuccess(null) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="success-title" className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-2xl">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-300">Demo transaction complete</p>
            <h2 id="success-title" className="mt-2 font-serif text-2xl text-foreground">Success</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{success.message}</p>
            <p className="mt-3 font-mono text-xs text-foreground">Reference: {success.orderId}</p>
            <button type="button" onClick={() => setSuccess(null)} className="mt-5 h-10 w-full rounded-sm bg-foreground font-mono text-[9px] uppercase tracking-[0.1em] text-background">Done</button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function BalanceCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-2xl text-foreground">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  )
}
