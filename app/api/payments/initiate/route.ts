import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rl = checkRateLimit(`initiate:${ip}`)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const { candidate_id, quantity, voter_name, voter_email } = await req.json()

    if (!candidate_id || !quantity || quantity < 1 || !voter_name?.trim() || !voter_email?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check award is open
    const { data: settings } = await supabase.from('settings').select('award_open, price_per_vote_kobo').single()
    if (!settings?.award_open) {
      return NextResponse.json({ error: 'Voting is currently closed' }, { status: 403 })
    }

    // Validate candidate exists and get position
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, position_id')
      .eq('id', candidate_id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const pricePerVoteKobo = settings.price_per_vote_kobo
    const amountKobo = quantity * pricePerVoteKobo

    // Generate unique reference
    const reference = `SCA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    // Insert pending payment row
    const { error: insertError } = await supabase.from('payments').insert({
      candidate_id,
      position_id: candidate.position_id,
      voter_name: voter_name.trim(),
      voter_email: voter_email.trim().toLowerCase(),
      quantity,
      price_per_vote_kobo: pricePerVoteKobo,
      amount_kobo: amountKobo,
      paystack_reference: reference,
      status: 'pending',
    })

    if (insertError) {
      logError('payments', 'initiate', insertError.message)
      return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
    }

    return NextResponse.json({
      amount_kobo: amountKobo,
      reference,
      channels: ['card', 'bank', 'bank_transfer', 'ussd'],
    })
  } catch (err) {
    logError('payments', 'initiate', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
