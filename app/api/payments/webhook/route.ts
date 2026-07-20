import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'

async function verifyPaystackSignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const sigArr = new Uint8Array(sig)
  let sigHex = ''
  for (let i = 0; i < sigArr.length; i++) sigHex += sigArr[i].toString(16).padStart(2, '0')
  return sigHex === signature
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-paystack-signature')

    const valid = await verifyPaystackSignature(body, signature)
    if (!valid) {
      logError('payments', 'webhook', 'Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)

    // Only process charge.success events
    if (payload.event !== 'charge.success') {
      return NextResponse.json({ status: 'ignored' })
    }

    const reference = payload.data?.reference
    const amountKobo = payload.data?.amount

    if (!reference || !amountKobo) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Atomic status transition - only succeeds if still 'pending'
    const { data: payment, error: updateError } = await supabase
      .from('payments')
      .update({ status: 'success', verified_at: new Date().toISOString() })
      .eq('paystack_reference', reference)
      .eq('status', 'pending')
      .select()
      .single()

    if (updateError) {
      logError('payments', 'webhook-update', updateError.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    // If payment was already processed, no-op
    if (!payment) {
      return NextResponse.json({ status: 'already_processed' })
    }

    // First time processing - increment votes
    const { error: incrementError } = await supabase.rpc('increment_candidate_votes', {
      p_candidate_id: payment.candidate_id,
      p_quantity: payment.quantity,
    })

    if (incrementError) {
      logError('payments', 'webhook-increment', incrementError.message)
    }

    return NextResponse.json({ status: 'success' })
  } catch (err) {
    logError('payments', 'webhook', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
