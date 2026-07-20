import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { logError } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const reference = req.nextUrl.searchParams.get('reference')
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    if (!paystackRes.ok) {
      logError('payments', 'verify-paystack', `Paystack returned ${paystackRes.status}`)
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 502 })
    }

    const paystackData = await paystackRes.json()
    if (paystackData.status !== true || paystackData.data?.status !== 'success') {
      return NextResponse.json({ error: 'Payment not successful' }, { status: 400 })
    }

    const amountKobo = paystackData.data.amount
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
      logError('payments', 'verify-update', updateError.message)
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
    }

    // If no row returned, already processed - return existing
    if (!payment) {
      const { data: existing } = await supabase
        .from('payments')
        .select('*')
        .eq('paystack_reference', reference)
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

    return NextResponse.json({ payment, success: true })
  } catch (err) {
    logError('payments', 'verify', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
