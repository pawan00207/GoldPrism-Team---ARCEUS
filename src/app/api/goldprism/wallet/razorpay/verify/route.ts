import { z } from 'zod'
import {
  RazorpayIntegrationError,
  verifyRazorpayTestPayment,
} from '@/lib/goldprism/razorpay'
import {
  isValidWalletPaymentAmount,
  WALLET_PAYMENT_CONFIG,
} from '@/lib/goldprism/wallet-config'

export const runtime = 'nodejs'

const verifyRequestSchema = z.object({
  orderId: z.string().regex(/^order_[A-Za-z0-9]+$/),
  paymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  signature: z.string().regex(/^[\da-f]{64}$/i),
  expectedAmountInr: z.number().refine(isValidWalletPaymentAmount),
})

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }

  const parsed = verifyRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json({ error: 'Razorpay returned an invalid payment response.' }, { status: 400 })
  }

  try {
    const payment = await verifyRazorpayTestPayment(parsed.data)
    return Response.json({ verified: true, ...payment }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof RazorpayIntegrationError) {
      return Response.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Unexpected Razorpay test payment verification error.')
    return Response.json({ error: 'Could not verify the Razorpay test payment.' }, { status: 502 })
  }
}
