import { z } from 'zod'
import {
  createRazorpayTestOrder,
  RazorpayIntegrationError,
} from '@/lib/goldprism/razorpay'

export const runtime = 'nodejs'

const orderRequestSchema = z.object({
  amountInr: z.union([z.literal(100), z.literal(500), z.literal(1000)]),
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
    return Response.json({ error: 'Choose ₹100, ₹500, or ₹1,000.' }, { status: 400 })
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
