import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createSessionCookie, getCookieExpiry } from '@/lib/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuth, logError } from '@/lib/logger'

const MAX_ATTEMPTS = 3

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip') ?? 'unknown'

    const rl = checkRateLimit(`verify-otp:${ip}`)
    if (!rl.allowed) {
      logAuth('verify-otp', ip, 'RATE_LIMITED')
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    let identifier: string
    let otp_code: string
    try {
      const body = await req.json()
      identifier = body.identifier ?? body.matric_number
      otp_code = body.otp_code
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!identifier || !otp_code) {
      return NextResponse.json({ error: 'Email/matric number and OTP are required' }, { status: 400 })
    }

    identifier = identifier.trim()
    const isEmail = identifier.includes('@')
    const lookupValue = isEmail ? identifier.toLowerCase() : identifier.toUpperCase()

    const supabase = createAdminClient()

    const { data: settings } = await supabase
      .from('settings')
      .select('otp_enabled, voting_open, results_public')
      .eq('id', 1)
      .maybeSingle()

    if (settings?.otp_enabled === false) {
      logAuth('verify-otp', identifier, 'OTP_DISABLED')
      return NextResponse.json({ error: 'OTP verification is currently disabled. Please sign in with your matric number and email instead.' }, { status: 403 })
    }

    const { data: student, error: dbError } = await supabase
      .from('students')
      .select('id, email, matric_number, has_voted, otp_code, otp_expires_at, otp_attempts')
      .eq(isEmail ? 'email' : 'matric_number', lookupValue)
      .maybeSingle()

    if (dbError) {
      logError('verify-otp', 'db', dbError.message)
      return NextResponse.json({ error: 'Database error.' }, { status: 500 })
    }

    if (!student) {
      logAuth('verify-otp', identifier, 'NOT_FOUND')
      return NextResponse.json({ error: 'No student found with this email or matric number' }, { status: 401 })
    }

    if (student.otp_attempts !== null && student.otp_attempts >= MAX_ATTEMPTS) {
      logAuth('verify-otp', identifier, 'MAX_ATTEMPTS_EXCEEDED')
      return NextResponse.json({ error: 'Too many attempts. Request a new OTP.' }, { status: 429 })
    }

    const now = new Date()
    const expiresAt = student.otp_expires_at ? new Date(student.otp_expires_at) : null

    if (!expiresAt || now > expiresAt) {
      logAuth('verify-otp', identifier, 'OTP_EXPIRED')
      return NextResponse.json({ error: 'OTP has expired. Request a new one.' }, { status: 401 })
    }

    if (!student.otp_code || student.otp_code !== otp_code) {
      const newAttempts = (student.otp_attempts ?? 0) + 1
      await supabase
        .from('students')
        .update({ otp_attempts: newAttempts })
        .eq('id', student.id)

      logAuth('verify-otp', identifier, `WRONG_OTP (attempt ${newAttempts})`)
      return NextResponse.json({ error: 'Invalid OTP code' }, { status: 401 })
    }

    if (settings?.voting_open && student.has_voted) {
      logAuth('verify-otp', identifier, 'ALREADY_VOTED')
      return NextResponse.json({ error: 'You have already voted' }, { status: 401 })
    }

    await supabase
      .from('students')
      .update({ otp_code: null, otp_expires_at: null, otp_attempts: null })
      .eq('id', student.id)

    const exp = getCookieExpiry()
    const cookie = await createSessionCookie({
      email: student.email,
      id: student.id,
      matric_number: student.matric_number ?? null,
      exp,
    })

    const response = NextResponse.json({ success: true })
    response.headers.append('Set-Cookie', cookie)
    logAuth('verify-otp', identifier, 'SUCCESS')
    return response
  } catch (err) {
    logError('verify-otp', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}