import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { reverifyPayment } from '@/lib/reverify'
import { logError } from '@/lib/logger'

export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET — Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // Find all pending payments older than 15 minutes
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data: pendingPayments, error } = await supabase
      .from('payments')
      .select('id, tx_ref, flw_transaction_id, amount_kobo, candidate_id, quantity, status')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })

    if (error) {
      logError('cron-reconcile', 'query', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      console.log('[cron-reconcile] No pending payments older than 15 minutes')
      return NextResponse.json({ summary: { checked: 0, succeeded: 0, failed: 0, still_pending: 0 }, results: [] })
    }

    const results = []
    let succeeded = 0
    let failed = 0
    let stillPending = 0

    for (const p of pendingPayments) {
      const result = await reverifyPayment(supabase, p)
      results.push(result)
      if (result.result === 'success') succeeded++
      else if (result.result === 'failed') failed++
      else stillPending++

      // Rate limit: 300ms between Flutterwave API calls
      await new Promise(r => setTimeout(r, 300))
    }

    const summary = { checked: pendingPayments.length, succeeded, failed, still_pending: stillPending }
    console.log(`[cron-reconcile] Done: ${summary.checked} checked, ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.still_pending} still pending`)

    return NextResponse.json({ summary, results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('cron-reconcile', 'unknown', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
