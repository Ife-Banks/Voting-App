import type { SupabaseClient } from '@supabase/supabase-js'
import { logError } from '@/lib/logger'

export type ReverifyResult = {
  payment_id: string
  tx_ref: string
  result: 'success' | 'failed' | 'still_pending'
  detail: string
}

export async function reverifyPayment(
  supabase: SupabaseClient,
  payment: {
    id: string
    tx_ref: string
    flw_transaction_id: number | null
    amount_kobo: number
    candidate_id: string
    quantity: number
  }
): Promise<ReverifyResult> {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) {
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: 'FLW_SECRET_KEY not set' }
  }

  const expectedAmountNaira = payment.amount_kobo / 100

  let flwData: any = null

  // Step 1: Verify with Flutterwave
  if (payment.flw_transaction_id) {
    // We have the numeric ID — verify directly
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/${payment.flw_transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!res.ok) {
      const txt = await res.text()
      logError('reverify', 'flw-verify-by-id', `HTTP ${res.status}: ${txt}`)
      return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Flutterwave HTTP ${res.status}` }
    }
    flwData = await res.json()
  } else {
    // No numeric ID — look up by tx_ref
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payment.tx_ref)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!res.ok) {
      const txt = await res.text()
      logError('reverify', 'flw-verify-by-ref', `HTTP ${res.status}: ${txt}`)
      return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Flutterwave HTTP ${res.status}` }
    }
    flwData = await res.json()
  }

  // Step 2: Validate the Flutterwave response
  const flwStatus = flwData?.data?.status
  const flwTxRef = flwData?.data?.tx_ref
  const flwCurrency = flwData?.data?.currency
  const flwAmount = Number(flwData?.data?.amount)
  const flwId = flwData?.data?.id

  // If Flutterwave says it's still pending (e.g. bank transfer awaiting confirmation)
  if (flwStatus === 'pending') {
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'still_pending', detail: 'Flutterwave status: pending' }
  }

  // If Flutterwave says it failed
  if (flwStatus === 'failed') {
    // Mark as failed in DB
    await supabase
      .from('payments')
      .update({ status: 'failed', verified_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'pending')
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: 'Flutterwave status: failed' }
  }

  // Validate successful
  const isSuccessful = flwStatus === 'successful' || flwStatus === 'completed'
  const outerSuccess = flwData?.status === 'success' || flwData?.status === 'completed'

  if (!outerSuccess || !isSuccessful) {
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Unexpected status: ${flwData?.status}/${flwStatus}` }
  }
  if (flwTxRef !== payment.tx_ref) {
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `tx_ref mismatch: ${flwTxRef}` }
  }
  if (flwCurrency !== 'NGN') {
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Currency mismatch: ${flwCurrency}` }
  }
  if (flwAmount < expectedAmountNaira) {
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Amount mismatch: ${flwAmount} < ${expectedAmountNaira}` }
  }

  // Step 3: Atomic status transition (pending → success)
  const flwIdToStore = flwId ? Number(flwId) : payment.flw_transaction_id
  const { data: updated, error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'success',
      verified_at: new Date().toISOString(),
      ...(flwIdToStore ? { flw_transaction_id: flwIdToStore } : {}),
    })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select()
    .single()

  if (updateError) {
    logError('reverify', 'update', updateError.message)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `DB update error: ${updateError.message}` }
  }

  // No row returned = already processed by someone else
  if (!updated) {
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'success', detail: 'Already processed' }
  }

  // Step 4: Increment votes
  const { error: incrementError } = await supabase.rpc('increment_candidate_votes', {
    p_candidate_id: payment.candidate_id,
    p_quantity: payment.quantity,
  })

  if (incrementError) {
    logError('reverify', 'increment', incrementError.message)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'success', detail: 'Payment updated but vote increment failed' }
  }

  return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'success', detail: 'Verified and votes incremented' }
}
