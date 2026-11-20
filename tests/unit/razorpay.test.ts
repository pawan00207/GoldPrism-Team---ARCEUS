import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import {
  createRazorpayTestOrder,
  verifyRazorpaySignature,
  verifyRazorpayTestPayment,
} from '../../src/lib/goldprism/razorpay'

const TEST_KEY_ID = 'rzp_test_fixture'
const TEST_KEY_SECRET = 'test-fixture-secret'

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

function withTestCredentials<T>(run: () => Promise<T>) {
  const previousKeyId = process.env.RAZORPAY_KEY_ID
  const previousSecret = process.env.RAZORPAY_KEY_SECRET
  process.env.RAZORPAY_KEY_ID = TEST_KEY_ID
  process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET
  return run().finally(() => {
    restoreEnvironment('RAZORPAY_KEY_ID', previousKeyId)
    restoreEnvironment('RAZORPAY_KEY_SECRET', previousSecret)
  })
}

test('Razorpay order creation fails closed without test credentials', async () => {
  const previousKeyId = process.env.RAZORPAY_KEY_ID
  const previousSecret = process.env.RAZORPAY_KEY_SECRET
  delete process.env.RAZORPAY_KEY_ID
  delete process.env.RAZORPAY_KEY_SECRET
  let called = false
  try {
    await assert.rejects(
      createRazorpayTestOrder(100, async () => {
        called = true
        return Response.json({})
      }),
      /not configured/
    )
  } finally {
    restoreEnvironment('RAZORPAY_KEY_ID', previousKeyId)
    restoreEnvironment('RAZORPAY_KEY_SECRET', previousSecret)
  }
  assert.equal(called, false)
})

test('Razorpay test order sends a validated INR amount using server-only credentials', async () => {
  await withTestCredentials(async () => {
    const fetcher: typeof fetch = async (input, init) => {
      assert.equal(String(input), 'https://api.razorpay.com/v1/orders')
      assert.equal(init?.method, 'POST')
      assert.equal((init?.headers as Record<string, string>).Authorization, `Basic ${Buffer.from(`${TEST_KEY_ID}:${TEST_KEY_SECRET}`).toString('base64')}`)
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      assert.equal(body.amount, 100_000)
      assert.equal(body.currency, 'INR')
      assert.match(String(body.receipt), /^gp_[\da-f]+$/i)
      assert.deepEqual(body.notes, { product: 'GoldPrism gGOLD test wallet' })
      return Response.json({ id: 'order_testfixture', amount: 100_000, currency: 'INR' })
    }

    const order = await createRazorpayTestOrder(1000, fetcher)
    assert.deepEqual(order, {
      orderId: 'order_testfixture',
      amountPaise: 100_000,
      currency: 'INR',
      keyId: TEST_KEY_ID,
    })
  })
})

test('Razorpay signature verification rejects tampered signatures', () => {
  const signature = createHmac('sha256', TEST_KEY_SECRET)
    .update('order_testfixture|pay_testfixture')
    .digest('hex')

  assert.equal(verifyRazorpaySignature('order_testfixture', 'pay_testfixture', signature, TEST_KEY_SECRET), true)
  assert.equal(verifyRazorpaySignature('order_testfixture', 'pay_testfixture', '0'.repeat(64), TEST_KEY_SECRET), false)
  assert.equal(verifyRazorpaySignature('order_testfixture', 'pay_testfixture', 'invalid', TEST_KEY_SECRET), false)
})

test('only captured payments matching the Razorpay order can verify', async () => {
  await withTestCredentials(async () => {
    const orderId = 'order_testfixture'
    const paymentId = 'pay_testfixture'
    const signature = createHmac('sha256', TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')
    const fetcher: typeof fetch = async (input, init) => {
      assert.equal(String(input), `https://api.razorpay.com/v1/payments/${paymentId}`)
      assert.equal(init?.method, 'GET')
      return Response.json({
        id: paymentId,
        order_id: orderId,
        amount: 50_000,
        currency: 'INR',
        status: 'captured',
        captured: true,
      })
    }

    const verified = await verifyRazorpayTestPayment(
      { orderId, paymentId, signature, expectedAmountInr: 500 },
      fetcher
    )
    assert.deepEqual(verified, { orderId, paymentId, amountInr: 500 })

    await assert.rejects(
      verifyRazorpayTestPayment(
        { orderId, paymentId, signature, expectedAmountInr: 1000 },
        fetcher
      ),
      /does not match the created order/
    )
  })
})

test('authorized but uncaptured Razorpay payments are not wallet credits', async () => {
  await withTestCredentials(async () => {
    const orderId = 'order_testfixture'
    const paymentId = 'pay_testfixture'
    const signature = createHmac('sha256', TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')
    const fetcher: typeof fetch = async () =>
      Response.json({
        id: paymentId,
        order_id: orderId,
        amount: 10_000,
        currency: 'INR',
        status: 'authorized',
        captured: false,
      })

    await assert.rejects(
      verifyRazorpayTestPayment(
        { orderId, paymentId, signature, expectedAmountInr: 100 },
        fetcher
      ),
      /not captured/
    )
  })
})
