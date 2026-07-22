import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    // Flutterwave V3 webhook: static secret hash comparison via verif-hash header
    const signature = req.headers.get('verif-hash')
    const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH
    if (!signature || signature !== secretHash) {
      logError('payments', 'webhook', 'Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = await req.json()

    // Only process charge.completed events
    if (payload.event !== 'charge.completed') {
      return NextResponse.json({ status: 'ignored' })
    }

    const flwId = payload.data?.id
    const txRef = payload.data?.tx_ref

    if (!flwId || !txRef) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const secretKey = process.env.FLW_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    // Re-verify server-side (don't trust the webhook payload directly)
    const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwId}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    if (!flwRes.ok) {
      logError('payments', 'webhook-verify', `Flutterwave verify returned ${flwRes.status}`)
      return NextResponse.json({ error: 'Verification failed' }, { status: 502 })
    }

    const flwData = await flwRes.json()

    if (
      flwData.status !== 'success' ||
      flwData.data?.status !== 'successful' ||
      flwData.data?.tx_ref !== txRef ||
      flwData.data?.currency !== 'NGN'
    ) {
      return NextResponse.json({ status: 'not_successful' })
    }

    const supabase = createAdminClient()

    // Atomic status transition - only succeeds if still 'pending'
    const { data: payment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'success',
        verified_at: new Date().toISOString(),
        flw_transaction_id: Number(flwId),
      })
      .eq('tx_ref', txRef)
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
