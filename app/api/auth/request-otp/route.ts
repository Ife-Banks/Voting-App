import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendOtpEmail } from '@/lib/mailgun'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuth, logError } from '@/lib/logger'
import { randomInt } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip') ?? 'unknown'

    const rl = checkRateLimit(`request-otp:${ip}`)
    if (!rl.allowed) {
      logAuth('request-otp', ip, 'RATE_LIMITED')
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    let identifier: string
    try {
      const body = await req.json()
      identifier = body.matric_number ?? body.identifier
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Matric number or email is required' }, { status: 400 })
    }

    identifier = identifier.trim()
    const isEmail = identifier.includes('@')
    const lookupValue = isEmail ? identifier.toLowerCase() : identifier.toUpperCase()

    const supabase = createAdminClient()

    const { data: student, error: dbError } = await supabase
      .from('students')
      .select('id, email, has_voted, matric_number')
      .eq(isEmail ? 'email' : 'matric_number', lookupValue)
      .maybeSingle()

    if (dbError) {
      logError('request-otp', 'db', dbError.message)
      return NextResponse.json({ error: 'Database error.' }, { status: 500 })
    }

    if (!student) {
      logAuth('request-otp', identifier, 'NOT_FOUND')
      return NextResponse.json({ error: 'No student found with this email or matric number' }, { status: 404 })
    }

    const { data: settings } = await supabase
      .from('settings')
      .select('voting_open')
      .eq('id', 1)
      .maybeSingle()

    if (!settings?.voting_open) {
      logAuth('request-otp', identifier, 'VOTING_CLOSED')
      return NextResponse.json({ voting_closed: true, identifier }, { status: 200 })
    }

    if (student.has_voted) {
      logAuth('request-otp', identifier, 'ALREADY_VOTED')
      return NextResponse.json({ error: 'You have already voted' }, { status: 401 })
    }

    const otp = randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString()

    const { error: updateError } = await supabase
      .from('students')
      .update({
        otp_code: otp,
        otp_expires_at: expiresAt,
        otp_attempts: 0,
      })
      .eq('id', student.id)

    if (updateError) {
      logError('request-otp', 'update', updateError.message)
      return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 })
    }

    const sent = await sendOtpEmail(student.email, otp)
    if (!sent) {
      logError('request-otp', 'email', 'Failed to send email')
      return NextResponse.json({ error: 'Failed to send OTP email' }, { status: 500 })
    }

    logAuth('request-otp', identifier, 'SUCCESS')
    return NextResponse.json({ success: true, message: 'OTP sent to your email' })
  } catch (err) {
    logError('request-otp', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}