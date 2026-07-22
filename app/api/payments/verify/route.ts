import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const transactionId = req.nextUrl.searchParams.get('transaction_id')
    const txRef = req.nextUrl.searchParams.get('reference')

    if (!transactionId || !txRef) {
      return NextResponse.json({ error: 'Missing transaction_id or reference' }, { status: 400 })
    }

    const secretKey = process.env.FLW_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    // Look up the pending payment to get expected amount
    const supabase = createAdminClient()
    const { data: pendingPayment } = await supabase
      .from('payments')
      .select('amount_kobo')
      .eq('tx_ref', txRef)
      .single()

    if (!pendingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const expectedAmountNaira = pendingPayment.amount_kobo / 100

    // Verify with Flutterwave
    const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    if (!flwRes.ok) {
      const flwErr = await flwRes.text()
      logError('payments', 'verify-flutterwave', `Flutterwave returned ${flwRes.status}: ${flwErr}`)
      return NextResponse.json({ error: 'Payment verification failed', details: flwErr }, { status: 502 })
    }

    const flwData = await flwRes.json()

    // Validate transaction
    if (
      (flwData.status !== 'success' && flwData.status !== 'completed') ||
      (flwData.data?.status !== 'successful' && flwData.data?.status !== 'completed') ||
      flwData.data?.tx_ref !== txRef ||
      flwData.data?.currency !== 'NGN' ||
      Number(flwData.data?.amount) < expectedAmountNaira
    ) {
      return NextResponse.json({ error: 'Payment not successful', details: flwData }, { status: 400 })
    }

    const channel = flwData.data.payment_type as string | undefined

    // Atomic status transition - only succeeds if still 'pending'
    const { data: payment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'success',
        verified_at: new Date().toISOString(),
        flw_transaction_id: Number(transactionId),
      })
      .eq('tx_ref', txRef)
      .eq('status', 'pending')
      .select()
      .single()

    if (updateError) {
      logError('payments', 'verify-update', updateError.message)
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
    }

    // If no row returned, already processed - return existing
    if (!payment) {
      const { data: existing } = await supabase
        .from('payments')
        .select('*')
        .eq('tx_ref', txRef)
        .single()
      return NextResponse.json({ payment: existing, already_processed: true })
    }

    // First time processing - increment votes
    const { error: incrementError } = await supabase.rpc('increment_candidate_votes', {
      p_candidate_id: payment.candidate_id,
      p_quantity: payment.quantity,
    })

    if (incrementError) {
      logError('payments', 'verify-increment', incrementError.message)
    }

    return NextResponse.json({ payment, success: true, channel })
  } catch (err) {
    logError('payments', 'verify', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
