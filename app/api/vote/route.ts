import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { votes, email } = await req.json()

  if (!votes?.length || !email) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify student exists and hasn't voted
  const { data: student } = await supabase
    .from('students').select('id, has_voted').eq('email', email).single()

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 403 })
  }
  if (student.has_voted) {
    return NextResponse.json({ error: 'You have already voted' }, { status: 400 })
  }

  // Check voting is open
  const { data: settings } = await supabase.from('settings').select('voting_open').single()
  if (!settings?.voting_open) {
    return NextResponse.json({ error: 'Voting is currently closed' }, { status: 403 })
  }

  // Insert votes
  const { error: voteError } = await supabase.from('votes').insert(votes)
  if (voteError) {
    return NextResponse.json({ error: 'Failed to record votes' }, { status: 500 })
  }

  // Increment candidate vote counts
  for (const vote of votes) {
    await supabase.rpc('increment_vote', { candidate_id: vote.candidate_id })
  }

  // Mark student as voted
  await supabase.from('students').update({ has_voted: true }).eq('email', email)

  return NextResponse.json({ success: true })
}
