import { z } from 'zod'
import {
  createRazorpayTestOrder,
  RazorpayIntegrationError,
} from '@/lib/goldprism/razorpay'
import {
  isValidWalletPaymentAmount,
  WALLET_PAYMENT_CONFIG,
} from '@/lib/goldprism/wallet-config'

export const runtime = 'nodejs'

const orderRequestSchema = z.object({
  amountInr: z.number().refine(isValidWalletPaymentAmount),
})

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }

  const parsed = orderRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json(
      {
        error: `Enter ₹${WALLET_PAYMENT_CONFIG.minAmountInr}–₹${WALLET_PAYMENT_CONFIG.maxAmountInr.toLocaleString('en-IN')} with up to two decimal places.`,
      },
      { status: 400 }
    )
  }

  try {
    const order = await createRazorpayTestOrder(parsed.data.amountInr)
    return Response.json(order, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof RazorpayIntegrationError) {
      return Response.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Unexpected Razorpay test order error.')
    return Response.json({ error: 'Could not create a Razorpay test order.' }, { status: 502 })
  }
}
