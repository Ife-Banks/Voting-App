import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { reverifyPayment } from '@/lib/reverify'
import { logError } from '@/lib/logger'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.log('[cron-reconcile] Unauthorized — missing or mismatched CRON_SECRET')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[cron-reconcile] Authorized, starting reconciliation...')

  const supabase = createAdminClient()

  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    console.log(`[cron-reconcile] Cutoff: ${cutoff}`)

    // First: count ALL pending payments (including recent ones) for context
    const { count: totalPending } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    console.log(`[cron-reconcile] Total pending payments (all ages): ${totalPending ?? 'unknown'}`)

    const { data: pendingPayments, error } = await supabase
      .from('payments')
      .select('id, tx_ref, flw_transaction_id, amount_kobo, candidate_id, quantity, status')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(25)

    if (error) {
      logError('cron-reconcile', 'query', error.message)
      console.error(`[cron-reconcile] Query error: ${error.message}`)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[cron-reconcile] Found ${pendingPayments?.length ?? 0} pending payments older than 15 min`)

    if (!pendingPayments || pendingPayments.length === 0) {
      return NextResponse.json({ summary: { checked: 0, succeeded: 0, failed: 0, still_pending: 0 }, results: [] })
    }

    // Log first few for debugging
    for (const p of pendingPayments.slice(0, 3)) {
      console.log(`[cron-reconcile]   -> id=${p.id} tx_ref=${p.tx_ref} flw_id=${p.flw_transaction_id} amount_kobo=${p.amount_kobo} created=${p.created_at}`)
    }

    const results = []
    let succeeded = 0
    let failed = 0
    let stillPending = 0

    for (const p of pendingPayments) {
      console.log(`[cron-reconcile] Re-verifying ${p.tx_ref} (flw_id=${p.flw_transaction_id})...`)
      const result = await reverifyPayment(supabase, p)
      console.log(`[cron-reconcile]   result=${result.result} detail=${result.detail}`)
      results.push(result)
      if (result.result === 'success') succeeded++
      else if (result.result === 'failed') failed++
      else stillPending++

      await new Promise(r => setTimeout(r, 300))
    }

    const summary = { checked: pendingPayments.length, succeeded, failed, still_pending: stillPending }
    console.log(`[cron-reconcile] Done: ${summary.checked} checked, ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.still_pending} still pending`)

    return NextResponse.json({ summary, results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('cron-reconcile', 'unknown', msg)
    console.error(`[cron-reconcile] Exception: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
