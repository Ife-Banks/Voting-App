import type { SupabaseClient } from '@supabase/supabase-js'

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
    created_at?: string
  }
): Promise<ReverifyResult> {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) {
    console.log(`[reverify] FLW_SECRET_KEY not set`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: 'FLW_SECRET_KEY not set' }
  }

  const expectedAmountNaira = payment.amount_kobo / 100
  let flwData: any = null

  if (payment.flw_transaction_id) {
    console.log(`[reverify] Verifying by ID: ${payment.flw_transaction_id}`)
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/${payment.flw_transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error(`[reverify] Flutterwave HTTP ${res.status}: ${txt}`)
      if (res.status === 400 || res.status === 404) {
        const ageMs = payment.created_at ? Date.now() - new Date(payment.created_at).getTime() : 0
        const ageHours = ageMs / (1000 * 60 * 60)
        if (ageHours > 24) {
          console.log(`[reverify] ${payment.tx_ref} not found and >24h old, marking failed`)
          await supabase
            .from('payments')
            .update({ status: 'failed', verified_at: new Date().toISOString() })
            .eq('id', payment.id)
            .eq('status', 'pending')
          return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: 'Transaction not found (>24h old)' }
        }
        console.log(`[reverify] ${payment.tx_ref} not found but only ${ageHours.toFixed(1)}h old, leaving as pending`)
        return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'still_pending', detail: `Transaction not found (${ageHours.toFixed(1)}h old, money may be in transit)` }
      }
      return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Flutterwave HTTP ${res.status}` }
    }
    flwData = await res.json()
    console.log(`[reverify] Flutterwave response: status=${flwData?.status} data.status=${flwData?.data?.status} data.tx_ref=${flwData?.data?.tx_ref} data.amount=${flwData?.data?.amount} data.currency=${flwData?.data?.currency}`)
  } else {
    console.log(`[reverify] No flw_transaction_id, verifying by tx_ref: ${payment.tx_ref}`)
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payment.tx_ref)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error(`[reverify] Flutterwave HTTP ${res.status}: ${txt}`)
      if (res.status === 400 || res.status === 404) {
        const ageMs = payment.created_at ? Date.now() - new Date(payment.created_at).getTime() : 0
        const ageHours = ageMs / (1000 * 60 * 60)
        if (ageHours > 24) {
          console.log(`[reverify] ${payment.tx_ref} not found and >24h old, marking failed`)
          await supabase
            .from('payments')
            .update({ status: 'failed', verified_at: new Date().toISOString() })
            .eq('id', payment.id)
            .eq('status', 'pending')
          return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: 'Transaction not found (>24h old)' }
        }
        console.log(`[reverify] ${payment.tx_ref} not found but only ${ageHours.toFixed(1)}h old, leaving as pending`)
        return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'still_pending', detail: `Transaction not found (${ageHours.toFixed(1)}h old, money may be in transit)` }
      }
      return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Flutterwave HTTP ${res.status}` }
    }
    flwData = await res.json()
    console.log(`[reverify] Flutterwave response: status=${flwData?.status} data.status=${flwData?.data?.status} data.tx_ref=${flwData?.data?.tx_ref} data.amount=${flwData?.data?.amount} data.currency=${flwData?.data?.currency}`)
  }

  const flwStatus = flwData?.data?.status
  const flwTxRef = flwData?.data?.tx_ref
  const flwCurrency = flwData?.data?.currency
  const flwAmount = Number(flwData?.data?.amount)
  const flwId = flwData?.data?.id

  if (flwStatus === 'pending') {
    console.log(`[reverify] ${payment.tx_ref} still pending on Flutterwave`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'still_pending', detail: 'Flutterwave status: pending' }
  }

  if (flwStatus === 'failed') {
    console.log(`[reverify] ${payment.tx_ref} failed on Flutterwave, marking as failed in DB`)
    await supabase
      .from('payments')
      .update({ status: 'failed', verified_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'pending')
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: 'Flutterwave status: failed' }
  }

  const isSuccessful = flwStatus === 'successful' || flwStatus === 'completed'
  const outerSuccess = flwData?.status === 'success' || flwData?.status === 'completed'

  if (!outerSuccess || !isSuccessful) {
    console.log(`[reverify] ${payment.tx_ref} unexpected status: outer=${flwData?.status} inner=${flwStatus}`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Unexpected status: ${flwData?.status}/${flwStatus}` }
  }
  if (flwTxRef !== payment.tx_ref) {
    console.log(`[reverify] ${payment.tx_ref} tx_ref mismatch: got ${flwTxRef}`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `tx_ref mismatch: ${flwTxRef}` }
  }
  if (flwCurrency !== 'NGN') {
    console.log(`[reverify] ${payment.tx_ref} currency mismatch: got ${flwCurrency}`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Currency mismatch: ${flwCurrency}` }
  }
  if (flwAmount < expectedAmountNaira) {
    console.log(`[reverify] ${payment.tx_ref} amount mismatch: ${flwAmount} < ${expectedAmountNaira}`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `Amount mismatch: ${flwAmount} < ${expectedAmountNaira}` }
  }

  const flwIdToStore = flwId ? Number(flwId) : payment.flw_transaction_id
  console.log(`[reverify] ${payment.tx_ref} validation passed, updating DB...`)
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
    console.error(`[reverify] ${payment.tx_ref} DB update error: ${updateError.message}`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'failed', detail: `DB update error: ${updateError.message}` }
  }

  if (!updated) {
    console.log(`[reverify] ${payment.tx_ref} already processed (no row returned)`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'success', detail: 'Already processed' }
  }

  const { error: incrementError } = await supabase.rpc('increment_candidate_votes', {
    p_candidate_id: payment.candidate_id,
    p_quantity: payment.quantity,
  })

  if (incrementError) {
    console.error(`[reverify] ${payment.tx_ref} vote increment error: ${incrementError.message}`)
    return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'success', detail: 'Payment updated but vote increment failed' }
  }

  console.log(`[reverify] ${payment.tx_ref} SUCCESS — verified and ${payment.quantity} vote(s) incremented`)
  return { payment_id: payment.id, tx_ref: payment.tx_ref, result: 'success', detail: 'Verified and votes incremented' }
}
