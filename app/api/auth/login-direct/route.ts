import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createSessionCookie, getCookieExpiry } from '@/lib/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuth, logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip') ?? 'unknown'

    const rl = checkRateLimit(`login-direct:${ip}`)
    if (!rl.allowed) {
      logAuth('login-direct', ip, 'RATE_LIMITED')
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    let matric_number: string
    try {
      const body = await req.json()
      matric_number = body.matric_number
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!matric_number || typeof matric_number !== 'string') {
      return NextResponse.json({ error: 'Matric number is required' }, { status: 400 })
    }

    matric_number = matric_number.trim().toUpperCase()

    const supabase = createAdminClient()

    const { data: settings } = await supabase
      .from('settings')
      .select('voting_open')
      .eq('id', 1)
      .maybeSingle()

    if (settings?.voting_open) {
      logAuth('login-direct', matric_number, 'VOTING_STILL_OPEN')
      return NextResponse.json({ error: 'Voting is still open. Please use OTP to login.' }, { status: 400 })
    }

    const { data: student, error: dbError } = await supabase
      .from('students')
      .select('id, email, matric_number')
      .eq('matric_number', matric_number)
      .maybeSingle()

    if (dbError) {
      logError('login-direct', 'db', dbError.message)
      return NextResponse.json({ error: 'Database error.' }, { status: 500 })
    }

    if (!student) {
      logAuth('login-direct', matric_number, 'NOT_FOUND')
      return NextResponse.json({ error: 'No student found with this matric number' }, { status: 404 })
    }

    const exp = getCookieExpiry()
    const cookie = await createSessionCookie({
      email: student.email,
      id: student.id,
      matric_number: student.matric_number,
      exp,
    })

    const response = NextResponse.json({ success: true })
    response.headers.append('Set-Cookie', cookie)
    logAuth('login-direct', matric_number, 'SUCCESS')
    return response
  } catch (err) {
    logError('login-direct', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}