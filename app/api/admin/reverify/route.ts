import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { reverifyPayment } from '@/lib/reverify'
import { logError } from '@/lib/logger'

function extractAccessToken(cookies: { name: string; value: string }[]): string | null {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
  const prefix = projectRef ? `sb-${projectRef}-auth-token` : '-auth-token'
  const authCookie = cookies.find(c => c.name === prefix || c.name.includes(prefix))
  if (!authCookie) return null
  const raw = authCookie.value
  try {
    const base64 = raw.startsWith('base64-') ? raw.slice(7) : raw
    const json = JSON.parse(Buffer.from(base64, 'base64url').toString('utf-8'))
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}
  try {
    const json = JSON.parse(raw)
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}
  if (raw.split('.').length === 3) return raw
  return null
}

async function getCallerAdmin(req: NextRequest) {
  try {
    const accessToken = extractAccessToken(req.cookies.getAll())
    if (!accessToken) return null
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user } } = await supabase.auth.getUser(accessToken)
    const email = user?.email
    if (!email) return null
    if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return { id: '', role: 'super_admin' }
    }
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('admin_profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle()
    return profile
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const admin = await getCallerAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    // Single re-verify by payment ID
    if (body.payment_id && typeof body.payment_id === 'string') {
      const { data: payment, error } = await supabase
        .from('payments')
        .select('id, tx_ref, flw_transaction_id, amount_kobo, candidate_id, quantity, status')
        .eq('id', body.payment_id)
        .single()

      if (error || !payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }
      if (payment.status !== 'pending') {
        return NextResponse.json({ error: `Payment is already ${payment.status}` }, { status: 400 })
      }

      const result = await reverifyPayment(supabase, payment)
      return NextResponse.json({ result })
    }

    // Bulk re-verify all pending payments older than 15 minutes
    if (body.bulk === true) {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: pendingPayments, error } = await supabase
        .from('payments')
        .select('id, tx_ref, flw_transaction_id, amount_kobo, candidate_id, quantity, status')
        .eq('status', 'pending')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (!pendingPayments || pendingPayments.length === 0) {
        return NextResponse.json({ results: [], summary: { checked: 0, succeeded: 0, failed: 0, still_pending: 0 } })
      }

      const results = []
      let succeeded = 0
      let failed = 0
      let stillPending = 0

      // Process sequentially to avoid Flutterwave rate limits
      for (const p of pendingPayments) {
        const result = await reverifyPayment(supabase, p)
        results.push(result)
        if (result.result === 'success') succeeded++
        else if (result.result === 'failed') failed++
        else stillPending++

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 300))
      }

      return NextResponse.json({
        results,
        summary: { checked: pendingPayments.length, succeeded, failed, still_pending: stillPending },
      })
    }

    return NextResponse.json({ error: 'Provide payment_id (single) or bulk: true' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('admin-reverify', 'unknown', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
