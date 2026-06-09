import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createSessionCookie, getCookieExpiry } from '@/lib/session'
import { logAuth, logError } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    const rl = checkRateLimit(`login:${ip}`)
    if (!rl.allowed) {
      logAuth('login', ip, `RATE_LIMITED (reset in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s)`)
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }
    let email: string
    try {
      const body = await req.json()
      email = body.email
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    email = email.toLowerCase().trim()

    if (!EMAIL_RE.test(email)) {
      logAuth('login', email, 'FAILED - invalid format')
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      logAuth('login', email, 'FAILED - admin email used on student login')
      return NextResponse.json({ error: 'Admins must sign in at the admin login page' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { data: student, error: dbError } = await supabase
      .from('students')
      .select('id, email, has_voted')
      .eq('email', email)
      .maybeSingle()

    if (dbError) {
      logError('login', 'db', dbError.message)
      return NextResponse.json({ error: 'Database error. Check that the students table exists.' }, { status: 500 })
    }

    if (!student) {
      logAuth('login', email, 'FAILED - not registered')
      return NextResponse.json({ error: 'This email is not registered to vote' }, { status: 401 })
    }

    if (student.has_voted) {
      logAuth('login', email, 'FAILED - already voted')
      return NextResponse.json({ error: 'You have already voted' }, { status: 403 })
    }

    const exp = getCookieExpiry()
    const cookie = await createSessionCookie({ email: student.email, id: student.id, exp })
    const response = NextResponse.json({ success: true })
    response.headers.append('Set-Cookie', cookie)
    logAuth('login', email, 'SUCCESS')
    return response
  } catch (err) {
    logError('login', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
