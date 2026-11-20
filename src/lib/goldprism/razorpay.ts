import { Buffer } from 'node:buffer'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const RAZORPAY_API = 'https://api.razorpay.com/v1'
const ALLOWED_AMOUNTS_INR = [100, 500, 1000] as const
const ORDER_TIMEOUT_MS = 10_000

const orderResponseSchema = z.object({
  id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  amount: z.number().int().positive(),
  currency: z.literal('INR'),
})

const paymentResponseSchema = z.object({
  id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  amount: z.number().int().positive(),
  currency: z.literal('INR'),
  status: z.string(),
  captured: z.boolean(),
})

export class RazorpayIntegrationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message)
    this.name = 'RazorpayIntegrationError'
  }
}

function getTestCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) {
    throw new RazorpayIntegrationError(
      'Razorpay test credentials are not configured on the server.',
      503
    )
  }
  if (!keyId.startsWith('rzp_test_')) {
    throw new RazorpayIntegrationError(
      'Wallet checkout accepts Razorpay test keys only; live keys are disabled.',
      503
    )
  }
  return { keyId, keySecret }
}

async function razorpayRequest(
  path: string,
  method: 'GET' | 'POST',
  body: Record<string, unknown> | null,
  fetcher: typeof fetch,
  credentials: ReturnType<typeof getTestCredentials>
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ORDER_TIMEOUT_MS)
  try {
    const response = await fetcher(`${RAZORPAY_API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: controller.signal,
    })
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    return { ok: response.ok, status: response.status, payload }
  } catch {
    throw new RazorpayIntegrationError(
      'Razorpay test API request failed or timed out.',
      502
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function createRazorpayTestOrder(
  amountInr: number,
  fetcher: typeof fetch = fetch
): Promise<{ orderId: string; amountPaise: number; currency: 'INR'; keyId: string }> {
  if (!(ALLOWED_AMOUNTS_INR as readonly number[]).includes(amountInr)) {
    throw new RazorpayIntegrationError('Choose a supported wallet payment amount.', 400)
  }

  const credentials = getTestCredentials()
  const amountPaise = amountInr * 100
  const response = await razorpayRequest(
    '/orders',
    'POST',
    {
      amount: amountPaise,
      currency: 'INR',
      receipt: `gp_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      notes: { product: 'GoldPrism gGOLD test wallet' },
    },
    fetcher,
    credentials
  )

  if (!response.ok) {
    throw new RazorpayIntegrationError(
      `Razorpay could not create a test order (HTTP ${response.status}).`,
      502
    )
  }

  const parsed = orderResponseSchema.safeParse(response.payload)
  if (!parsed.success || parsed.data.amount !== amountPaise) {
    throw new RazorpayIntegrationError(
      'Razorpay returned an invalid test order response.',
      502
    )
  }

  return {
    orderId: parsed.data.id,
    amountPaise: parsed.data.amount,
    currency: parsed.data.currency,
    keyId: credentials.keyId,
  }
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): boolean {
  if (!/^[\da-f]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest()
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function verifyRazorpayTestPayment(
  input: {
    orderId: string
    paymentId: string
    signature: string
    expectedAmountInr: number
  },
  fetcher: typeof fetch = fetch
): Promise<{ orderId: string; paymentId: string; amountInr: number }> {
  if (!(ALLOWED_AMOUNTS_INR as readonly number[]).includes(input.expectedAmountInr)) {
    throw new RazorpayIntegrationError('The requested payment amount is invalid.', 400)
  }

  const credentials = getTestCredentials()
  if (!verifyRazorpaySignature(input.orderId, input.paymentId, input.signature, credentials.keySecret)) {
    throw new RazorpayIntegrationError('Razorpay payment signature verification failed.', 401)
  }

  const response = await razorpayRequest(
    `/payments/${encodeURIComponent(input.paymentId)}`,
    'GET',
    null,
    fetcher,
    credentials
  )
  if (!response.ok) {
    throw new RazorpayIntegrationError(
      `Razorpay payment verification failed (HTTP ${response.status}).`,
      502
    )
  }

  const parsed = paymentResponseSchema.safeParse(response.payload)
  const expectedPaise = input.expectedAmountInr * 100
  if (
    !parsed.success ||
    parsed.data.id !== input.paymentId ||
    parsed.data.order_id !== input.orderId ||
    parsed.data.amount !== expectedPaise
  ) {
    throw new RazorpayIntegrationError(
      'Razorpay payment does not match the created order.',
      409
    )
  }
  if (parsed.data.status !== 'captured' || !parsed.data.captured) {
    throw new RazorpayIntegrationError(
      'Payment is not captured; no wallet credit was applied.',
      409
    )
  }

  return {
    orderId: parsed.data.order_id,
    paymentId: parsed.data.id,
    amountInr: parsed.data.amount / 100,
  }
}
