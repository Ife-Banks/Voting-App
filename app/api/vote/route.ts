import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getSessionFromCookie } from '@/lib/session'
import { logAuth, logError } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rl = checkRateLimit(`vote:${ip}`)
    if (!rl.allowed) {
      logAuth('vote', ip, `RATE_LIMITED (reset in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s)`)
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const { votes, email } = await req.json()
    if (!votes?.length || !email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    for (const vote of votes) {
      if (!vote.position_id || typeof vote.position_id !== 'string') {
        return NextResponse.json({ error: 'Invalid vote: missing position_id' }, { status: 400 })
      }
      if (vote.candidate_id && typeof vote.candidate_id !== 'string') {
        return NextResponse.json({ error: 'Invalid vote: invalid candidate_id' }, { status: 400 })
      }
    }

    // Verify session cookie matches the email being voted for
    const session = await getSessionFromCookie(req.headers.get('cookie') ?? null)
    if (!session) {
      logAuth('vote', email, 'FAILED - no session')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (session.email !== email) {
      logAuth('vote', email, `FAILED - session email mismatch (session: ${session.email})`)
      return NextResponse.json({ error: 'Session email mismatch' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Check voting is open
    const { data: settings } = await supabase.from('settings').select('voting_open').single()
    if (!settings?.voting_open) {
      logAuth('vote', email, 'FAILED - voting closed')
      return NextResponse.json({ error: 'Voting is currently closed' }, { status: 403 })
    }

    // Atomic optimistic lock: only one request can set has_voted = true
    const { data: locked, error: lockError } = await supabase
      .from('students')
      .update({ has_voted: true })
      .eq('email', email)
      .eq('has_voted', false)
      .select('id')
      .single()

    if (lockError || !locked) {
      logAuth('vote', email, lockError ? `DB error: ${lockError.message}` : 'FAILED - already voted (race guard)')
      return NextResponse.json({ error: 'You have already voted' }, { status: 400 })
    }

    // Insert votes
    const { error: voteError } = await supabase.from('votes').insert(votes)
    if (voteError) {
      logError('vote', 'insert', voteError.message)
      await supabase.from('students').update({ has_voted: false }).eq('id', locked.id)
      return NextResponse.json({ error: 'Failed to record votes' }, { status: 500 })
    }

    // Increment candidate vote counts
    for (const vote of votes) {
      await supabase.rpc('increment_vote', { candidate_id: vote.candidate_id })
    }

    logAuth('vote', email, 'SUCCESS')
    return NextResponse.json({ success: true })
  } catch (err) {
    logError('vote', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
